/* Bean Meet: one meeting, many people. Mesh WebRTC with "perfect negotiation"
 * (either side may renegotiate, collisions resolve themselves), so screen shares
 * can start and stop at any time. Signalling + presence ride /api/meet polling. */
import { api } from "./api.js";

const POLL_MS = 1000;

const SpeechRec = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
export const captionsSupported = Boolean(SpeechRec);
export const screenShareSupported = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia);

export const CAPTION_LANGS = [
  ["en-US", "English"],
  ["ur-PK", "اردو Urdu"],
  ["hi-IN", "हिन्दी Hindi"],
  ["ar-SA", "العربية Arabic"],
  ["es-ES", "Español"],
  ["fr-FR", "Français"],
  ["de-DE", "Deutsch"],
  ["tr-TR", "Türkçe"],
];

export function captionLang() {
  const saved = localStorage.getItem("bean_caption_lang");
  if (saved && CAPTION_LANGS.some(([c]) => c === saved)) return saved;
  const nav = (navigator.language || "en-US").toLowerCase();
  return (CAPTION_LANGS.find(([c]) => c.toLowerCase().startsWith(nav.slice(0, 2))) || CAPTION_LANGS[0])[0];
}

/* One connection to one other person. */
class Link {
  constructor(session, remoteId) {
    this.session = session;
    this.remoteId = remoteId;
    this.polite = session.peerId > remoteId;
    this.makingOffer = false;
    this.ignoreOffer = false;
    this.pendingIce = [];
    this.streams = new Map(); // remote stream id -> MediaStream
    this.remoteScreenId = null;
    this.senders = new Map(); // track -> sender
    this.state = "new";

    const pc = (this.pc = new RTCPeerConnection({ iceServers: session.iceServers }));
    pc.ontrack = (e) => this.onTrack(e);
    pc.onicecandidate = (e) => e.candidate && this.send("ice", e.candidate.toJSON());
    pc.onnegotiationneeded = () => this.negotiate();
    pc.onconnectionstatechange = () => {
      this.state = pc.connectionState;
      if (this.state === "failed") pc.restartIce?.();
      session.emit();
    };
    for (const t of session.localStream?.getTracks() || []) this.addTrack(t, session.localStream);
    for (const t of session.screenStream?.getTracks() || []) this.addTrack(t, session.screenStream);
  }

  addTrack(track, stream) {
    if (this.senders.has(track)) return;
    try {
      this.senders.set(track, this.pc.addTrack(track, stream));
    } catch {}
  }

  removeTrack(track) {
    const sender = this.senders.get(track);
    if (!sender) return;
    this.senders.delete(track);
    try {
      this.pc.removeTrack(sender);
    } catch {}
  }

  onTrack(e) {
    const stream = e.streams[0] || new MediaStream([e.track]);
    if (!this.streams.has(stream.id)) {
      this.streams.set(stream.id, stream);
      stream.addEventListener?.("removetrack", () => {
        if (!stream.getTracks().length) this.streams.delete(stream.id);
        this.session.emit();
      });
    }
    e.track.addEventListener?.("ended", () => this.session.emit());
    this.session.emit();
  }

  live(stream) {
    return stream && stream.getTracks().some((t) => t.readyState !== "ended");
  }

  /* the remote person's camera + mic */
  get camera() {
    for (const [id, st] of this.streams) if (id !== this.remoteScreenId && this.live(st)) return st;
    return null;
  }

  /* their shared screen, when they are sharing */
  get screen() {
    const st = this.remoteScreenId && this.streams.get(this.remoteScreenId);
    return this.live(st) && st.getVideoTracks().length ? st : null;
  }

  describe() {
    return { sdp: this.pc.localDescription?.sdp, type: this.pc.localDescription?.type, screen: this.session.screenStream?.id || null };
  }

  async negotiate() {
    try {
      this.makingOffer = true;
      await this.pc.setLocalDescription();
      await this.send("offer", this.describe());
    } catch {
    } finally {
      this.makingOffer = false;
    }
  }

  async handle(type, payload) {
    const pc = this.pc;
    if (type === "ice") {
      if (!pc.remoteDescription) return this.pendingIce.push(payload);
      try {
        await pc.addIceCandidate(payload);
      } catch {}
      return;
    }
    // offer or answer
    this.remoteScreenId = payload.screen || null;
    const desc = { type: payload.type || type, sdp: payload.sdp };
    const collision = desc.type === "offer" && (this.makingOffer || pc.signalingState !== "stable");
    this.ignoreOffer = !this.polite && collision;
    if (this.ignoreOffer) return;
    try {
      await pc.setRemoteDescription(desc);
      for (const c of this.pendingIce.splice(0)) await pc.addIceCandidate(c).catch(() => {});
      if (desc.type === "offer") {
        await pc.setLocalDescription();
        await this.send("answer", this.describe());
      }
      this.session.emit();
    } catch {}
  }

  send(type, payload) {
    return this.session.signal(this.remoteId, type, payload);
  }

  close() {
    try {
      this.pc.close();
    } catch {}
  }
}

export class MeetSession {
  constructor({ meeting, peer, iceServers, localStream, onUpdate, onEnd }) {
    this.meeting = meeting;
    this.peerId = peer.id;
    this.me = peer;
    this.status = peer.status; // waiting | joined
    this.iceServers = iceServers?.length ? iceServers : [{ urls: "stun:stun.l.google.com:19302" }];
    this.localStream = localStream || null;
    this.screenStream = null;
    this.onUpdate = onUpdate;
    this.onEnd = onEnd;
    this.links = new Map();
    this.peers = [];
    this.lastSignal = 0;
    this.lastCaption = 0;
    this.captions = []; // { id, userId, name, text, at }
    this.interim = "";
    this.muted = Boolean(peer.muted) || !this.localStream?.getAudioTracks().length;
    this.cameraOff = Boolean(peer.cameraOff) || !this.localStream?.getVideoTracks().length;
    this.hand = false;
    this.ended = false;
    this.failures = 0;
    this.levels = new Map(); // peerId -> 0..1
    this.applyTrackState();
  }

  get joined() {
    return this.status === "joined";
  }

  start() {
    this.poll();
    this.levelTimer = setInterval(() => this.measure(), 250);
    this.onPageHide = () => this.beaconLeave();
    window.addEventListener("pagehide", this.onPageHide);
  }

  async signal(to, type, payload) {
    if (this.ended) return;
    try {
      await api.meetAction("signal", { id: this.meeting.id, peerId: this.peerId, to, type, payload });
    } catch {}
  }

  async poll() {
    if (this.ended) return;
    try {
      const res = await api.meetPoll({ id: this.meeting.id, peer: this.peerId, after: this.lastSignal, captions: this.lastCaption });
      this.failures = 0;
      if (res.ended) return this.teardown("ended");
      if (res.left) return this.teardown("left");
      const wasJoined = this.joined;
      this.meeting = { ...this.meeting, ...res.meeting };
      this.me = res.me;
      this.status = res.me.status;
      if (this.status === "denied") return this.teardown("denied");
      if (this.status === "removed") return this.teardown("removed");
      if (!wasJoined && this.joined) this.onAdmitted?.();
      this.peers = res.peers || [];
      this.syncLinks();
      for (const s of res.signals || []) {
        this.lastSignal = Math.max(this.lastSignal, s.id);
        let link = this.links.get(s.from_peer);
        if (!link && this.peers.some((p) => p.id === s.from_peer && p.status === "joined")) {
          link = new Link(this, s.from_peer);
          this.links.set(s.from_peer, link);
        }
        await link?.handle(s.type, s.payload);
      }
      for (const c of res.captions || []) {
        this.lastCaption = Math.max(this.lastCaption, c.id);
        this.captions.push(c);
      }
      if (this.captions.length > 400) this.captions.splice(0, this.captions.length - 400);
      this.syncCaptions();
      this.emit();
    } catch (err) {
      this.failures++;
      if ([403, 404, 410].includes(err.status)) {
        return this.teardown(/removed/i.test(err.message) ? "removed" : /declined/i.test(err.message) ? "denied" : "ended");
      }
      if (this.failures === 3) this.emit();
    }
    this.pollTimer = setTimeout(() => this.poll(), this.failures ? Math.min(8000, POLL_MS * 2 ** this.failures) : POLL_MS);
  }

  syncLinks() {
    if (!this.joined) return;
    const others = new Set(this.peers.filter((p) => p.status === "joined" && p.id !== this.peerId).map((p) => p.id));
    for (const id of others) if (!this.links.has(id)) this.links.set(id, new Link(this, id));
    for (const [id, link] of this.links) {
      if (!others.has(id)) {
        link.close();
        this.links.delete(id);
      }
    }
  }

  /* ---------- controls ---------- */

  applyTrackState() {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = !this.muted));
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = !this.cameraOff));
  }

  pushState(patch) {
    if (this.ended) return;
    api.meetAction("state", { id: this.meeting.id, peerId: this.peerId, ...patch }).catch(() => {});
  }

  toggleMute() {
    if (!this.localStream?.getAudioTracks().length) return this.onToast?.("No microphone found");
    this.muted = !this.muted;
    this.applyTrackState();
    this.pushState({ muted: this.muted });
    this.syncCaptions();
    this.emit();
  }

  toggleCamera() {
    if (!this.localStream?.getVideoTracks().length) return this.onToast?.("No camera found");
    this.cameraOff = !this.cameraOff;
    this.applyTrackState();
    this.pushState({ cameraOff: this.cameraOff });
    this.emit();
  }

  toggleHand() {
    this.hand = !this.hand;
    this.pushState({ hand: this.hand });
    this.emit();
  }

  async toggleScreen() {
    if (this.screenStream) return this.stopScreen();
    if (!screenShareSupported) return this.onToast?.("This browser can't share the screen");
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 30 } }, audio: true });
    } catch {
      return; // picker closed
    }
    if (this.ended) return stream.getTracks().forEach((t) => t.stop());
    this.screenStream = stream;
    const video = stream.getVideoTracks()[0];
    if (video) {
      video.contentHint = "detail";
      video.onended = () => this.stopScreen();
    }
    for (const link of this.links.values()) for (const t of stream.getTracks()) link.addTrack(t, stream);
    this.pushState({ sharing: true });
    this.emit();
  }

  stopScreen() {
    const stream = this.screenStream;
    if (!stream) return;
    this.screenStream = null;
    for (const t of stream.getTracks()) {
      for (const link of this.links.values()) link.removeTrack(t);
      t.stop();
    }
    this.pushState({ sharing: false });
    this.emit();
  }

  async setTranscribing(on) {
    try {
      await api.meetAction("transcribe", { id: this.meeting.id, peerId: this.peerId, on });
      this.meeting = { ...this.meeting, transcribing: on };
      this.syncCaptions();
      this.emit();
    } catch (err) {
      this.onToast?.(err.message);
    }
  }

  async admit(target, allow) {
    try {
      await api.meetAction("admit", { id: this.meeting.id, peerId: this.peerId, target, allow });
      this.peers = this.peers.map((p) => (p.id === target ? { ...p, status: allow ? "joined" : "denied" } : p)).filter((p) => p.status !== "denied");
      this.emit();
    } catch (err) {
      this.onToast?.(err.message);
    }
  }

  async remove(target) {
    try {
      await api.meetAction("remove", { id: this.meeting.id, peerId: this.peerId, target });
      this.peers = this.peers.filter((p) => p.id !== target);
      this.syncLinks();
      this.emit();
    } catch (err) {
      this.onToast?.(err.message);
    }
  }

  async setLocked(on) {
    try {
      await api.meetAction("lock", { id: this.meeting.id, peerId: this.peerId, on });
      this.meeting = { ...this.meeting, locked: on };
      this.emit();
    } catch (err) {
      this.onToast?.(err.message);
    }
  }

  async endForAll() {
    try {
      await api.meetAction("end", { id: this.meeting.id, peerId: this.peerId });
    } catch (err) {
      return this.onToast?.(err.message);
    }
    this.teardown("ended");
  }

  async leave() {
    if (this.ended) return;
    const id = this.meeting.id;
    const peerId = this.peerId;
    this.teardown("left");
    await api.meetAction("leave", { id, peerId }).catch(() => {});
  }

  beaconLeave() {
    if (this.ended) return;
    try {
      const blob = new Blob([JSON.stringify({ action: "leave", id: this.meeting.id, peerId: this.peerId })], { type: "application/json" });
      navigator.sendBeacon?.("/api/meet", blob);
    } catch {}
  }

  /* ---------- live captions (each person transcribes their own voice) ---------- */

  syncCaptions() {
    const want = Boolean(this.meeting.transcribing && this.joined && !this.muted && !this.ended && captionsSupported);
    if (want && !this.rec) this.startRecognition();
    else if (!want && this.rec) this.stopRecognition();
  }

  startRecognition() {
    const rec = new SpeechRec();
    rec.lang = captionLang();
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0]?.transcript?.trim();
        if (!text) continue;
        if (r.isFinal) this.postCaption(text);
        else interim += `${text} `;
      }
      this.interim = interim.trim();
      this.emit();
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        this.captionsBlocked = true;
        this.onToast?.("Captions need microphone permission");
      }
    };
    rec.onend = () => {
      // the browser stops after silence: keep going while transcription is on
      if (this.rec === rec && !this.captionsBlocked) setTimeout(() => this.rec === rec && this.restartRecognition(rec), 250);
    };
    this.rec = rec;
    try {
      rec.start();
    } catch {}
  }

  restartRecognition(rec) {
    try {
      rec.start();
    } catch {
      this.rec = null;
      this.syncCaptions();
    }
  }

  stopRecognition() {
    const rec = this.rec;
    this.rec = null;
    this.interim = "";
    try {
      rec?.stop();
    } catch {}
  }

  changeCaptionLang(lang) {
    localStorage.setItem("bean_caption_lang", lang);
    if (this.rec) {
      this.stopRecognition();
      this.syncCaptions();
    }
  }

  postCaption(text) {
    api.meetAction("caption", { id: this.meeting.id, peerId: this.peerId, text }).catch(() => {});
  }

  /* ---------- who is talking ---------- */

  measure() {
    if (this.ended) return;
    try {
      this.audio ||= new AudioContext();
    } catch {
      return;
    }
    const level = (key, stream) => {
      const track = stream?.getAudioTracks()[0];
      if (!track || track.readyState === "ended") return 0;
      let a = this.analysers?.get(key);
      if (!a || a.track !== track) {
        this.analysers ||= new Map();
        try {
          const src = this.audio.createMediaStreamSource(new MediaStream([track]));
          const node = this.audio.createAnalyser();
          node.fftSize = 512;
          src.connect(node);
          a = { track, node, buf: new Uint8Array(node.fftSize) };
          this.analysers.set(key, a);
        } catch {
          return 0;
        }
      }
      a.node.getByteTimeDomainData(a.buf);
      let sum = 0;
      for (const v of a.buf) sum += (v - 128) ** 2;
      return Math.min(1, Math.sqrt(sum / a.buf.length) / 30);
    };
    const levels = new Map();
    levels.set(this.peerId, this.muted ? 0 : level("me", this.localStream));
    for (const [id, link] of this.links) levels.set(id, level(id, link.camera));
    let speaker = null;
    let best = 0.12;
    for (const [id, v] of levels) if (v > best) (best = v), (speaker = id);
    const changed = speaker !== this.speaker;
    this.levels = levels;
    if (speaker) this.speaker = speaker;
    if (changed && speaker) this.emit();
  }

  /* ---------- end ---------- */

  teardown(reason) {
    if (this.ended) return;
    this.ended = true;
    clearTimeout(this.pollTimer);
    clearInterval(this.levelTimer);
    window.removeEventListener("pagehide", this.onPageHide);
    this.stopRecognition();
    for (const link of this.links.values()) link.close();
    this.links.clear();
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.screenStream?.getTracks().forEach((t) => t.stop());
    this.audio?.close?.().catch(() => {});
    this.onEnd?.(reason);
  }

  emit() {
    if (!this.ended) this.onUpdate?.(this);
  }
}
