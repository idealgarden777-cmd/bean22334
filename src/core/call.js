/* One WebRTC call between two Bean IDs. Signalling goes through /api/calls (polling). */
import { api } from "./api.js";
import { e2ee } from "./e2ee.js";

const POLL_MS = 900;

export class CallSession {
  constructor({ call, iceServers, onUpdate, onEnd, conversation }) {
    this.call = call; // { id, kind, role, peer, status }
    this.conversation = conversation; // signalling is encrypted with this chat's E2EE key
    this.iceServers = iceServers?.length ? iceServers : [{ urls: "stun:stun.l.google.com:19302" }];
    this.onUpdate = onUpdate;
    this.onEnd = onEnd;
    this.lastSignal = 0;
    this.pendingIce = [];
    this.remoteSet = false;
    this.ended = false;
    this.connectedAt = null;
    this.localStream = null;
    this.remoteStream = new MediaStream();
    this.muted = false;
    this.cameraOff = false;
  }

  get video() {
    return this.call.kind === "video";
  }

  async start() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: this.video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false,
      });
    } catch (err) {
      await this.hangup("media");
      throw new Error(this.video ? "Camera or microphone permission was denied" : "Microphone permission was denied");
    }

    const pc = (this.pc = new RTCPeerConnection({ iceServers: this.iceServers }));
    this.localStream.getTracks().forEach((t) => pc.addTrack(t, this.localStream));

    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach((t) => {
        if (!this.remoteStream.getTracks().includes(t)) this.remoteStream.addTrack(t);
      });
      this.emit();
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) this.signal("ice", e.candidate.toJSON());
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected" && !this.connectedAt) {
        this.connectedAt = Date.now();
        this.call.status = "active";
      }
      if (s === "failed") this.hangup("failed");
      this.emit();
    };

    if (this.call.role === "caller") {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await this.signal("offer", { type: offer.type, sdp: offer.sdp });
    }

    this.emit();
    this.poll();
  }

  async signal(type, payload) {
    if (this.ended) return;
    try {
      const enc = await e2ee.encryptSignal(this.conversation, this.call.id, type, payload);
      await api.callAction("signal", { id: this.call.id, type, payload: { enc } });
    } catch {}
  }

  async poll() {
    if (this.ended) return;
    try {
      const { call, signals } = await api.callPoll(this.call.id, this.lastSignal);
      if (["ended", "declined", "missed"].includes(call.status)) {
        this.call.status = call.status;
        return this.teardown(call.status);
      }
      if (call.status === "active" && this.call.status === "ringing") this.call.status = "connecting";
      for (const s of signals) {
        this.lastSignal = Math.max(this.lastSignal, s.id);
        await this.handleSignal(s);
      }
      this.emit();
    } catch {}
    this.pollTimer = setTimeout(() => this.poll(), POLL_MS);
  }

  async handleSignal({ type, payload: sealed }) {
    const pc = this.pc;
    if (!pc) return;
    let payload;
    try {
      payload = await e2ee.decryptSignal(this.conversation.id, this.call.id, type, sealed?.enc);
    } catch {
      return; // not from the other person: ignore
    }
    if (type === "offer" && this.call.role === "callee") {
      await pc.setRemoteDescription(payload);
      this.remoteSet = true;
      await this.flushIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.signal("answer", { type: answer.type, sdp: answer.sdp });
    } else if (type === "answer" && this.call.role === "caller" && !this.remoteSet) {
      await pc.setRemoteDescription(payload);
      this.remoteSet = true;
      await this.flushIce();
    } else if (type === "ice") {
      if (this.remoteSet) await pc.addIceCandidate(payload).catch(() => {});
      else this.pendingIce.push(payload);
    }
  }

  async flushIce() {
    const list = this.pendingIce.splice(0);
    for (const c of list) await this.pc.addIceCandidate(c).catch(() => {});
  }

  toggleMute() {
    this.muted = !this.muted;
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = !this.muted));
    this.emit();
  }

  toggleCamera() {
    this.cameraOff = !this.cameraOff;
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = !this.cameraOff));
    this.emit();
  }

  async hangup(reason = "hangup") {
    if (this.ended) return;
    try {
      await api.callAction("end", { id: this.call.id });
    } catch {}
    this.teardown(reason);
  }

  teardown(reason) {
    if (this.ended) return;
    this.ended = true;
    clearTimeout(this.pollTimer);
    this.localStream?.getTracks().forEach((t) => t.stop());
    try {
      this.pc?.close();
    } catch {}
    this.onEnd?.(reason);
  }

  emit() {
    this.onUpdate?.(this);
  }
}
