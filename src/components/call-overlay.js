import { store } from "../core/store.js";
import { icons } from "./icons.js";
import { avatar, escapeHtml, formatDuration } from "../core/utils.js";

export function mountCallOverlay(container) {
  let timer = null;
  let lastKey = "";

  const render = (s) => {
    const call = s.call;
    const incoming = !call && s.incomingCall;
    const meetIn = !call && !incoming && !s.meet && s.incomingMeeting;
    const key = call
      ? JSON.stringify(["call", call.id, call.status, Boolean(call.connectedAt), call.muted, call.cameraOff, call.sharing, call.peerSharing, call.remoteStream?.getTracks().length])
      : incoming ? `in:${incoming.id}` : meetIn ? `meet:${meetIn.id}` : "";
    if (key === lastKey) return;
    lastKey = key;
    clearInterval(timer);

    if (meetIn) {
      const chat = store.conversation(meetIn.conversationId);
      container.innerHTML = `
        <div class="incoming-call meet-incoming" role="alertdialog" aria-label="Meeting started">
          ${avatar(meetIn.host, "md")}
          <div class="incoming-text">
            <strong>${escapeHtml(meetIn.host?.displayName || "Bean user")}</strong>
            <span>${icons.meet} Started a meeting${chat ? ` in ${escapeHtml(chat.title)}` : ""}</span>
          </div>
          <button type="button" class="call-btn decline" data-dismiss aria-label="Dismiss">${icons.close}</button>
          <button type="button" class="call-btn accept meet-join-pill" data-join aria-label="Join meeting">Join</button>
        </div>`;
      container.querySelector("[data-join]").onclick = () => store.joinIncomingMeeting();
      container.querySelector("[data-dismiss]").onclick = () => store.dismissIncomingMeeting();
      return;
    }
    if (!call && !incoming) return (container.innerHTML = "");

    if (incoming) {
      container.innerHTML = `
        <div class="incoming-call" role="alertdialog" aria-label="Incoming call">
          ${avatar(incoming.peer, "md")}
          <div class="incoming-text">
            <strong>${escapeHtml(incoming.peer?.displayName || "Bean user")}</strong>
            <span>${icons.phoneIn} Incoming ${incoming.kind === "video" ? "video" : "voice"} call</span>
          </div>
          <button type="button" class="call-btn decline" data-decline aria-label="Decline">${icons.phoneOff}</button>
          <button type="button" class="call-btn accept" data-accept aria-label="Accept">${incoming.kind === "video" ? icons.video : icons.phone}</button>
        </div>`;
      container.querySelector("[data-accept]").onclick = () => store.acceptCall();
      container.querySelector("[data-decline]").onclick = () => store.declineCall();
      return;
    }

    const video = call.kind === "video";
    const connected = Boolean(call.connectedAt);
    const status = connected ? formatDuration((Date.now() - call.connectedAt) / 1000) : call.role === "caller" && call.status === "ringing" ? "Ringing…" : "Connecting…";

    container.innerHTML = `
      <div class="call-screen ${video ? "is-video" : "is-audio"} ${connected ? "connected" : ""} ${call.peerSharing ? "peer-sharing" : ""} ${call.sharing ? "self-sharing" : ""}">
        ${video ? `<video class="remote-video" autoplay playsinline></video>` : `<audio class="remote-audio" autoplay></audio><video class="remote-screen" autoplay playsinline muted></video>`}
        ${call.peerSharing ? `<span class="call-share-pill">${icons.screenShare} ${escapeHtml(call.peer?.displayName?.split(" ")[0] || "They")} is presenting</span>` : ""}
        ${call.sharing ? `<span class="call-share-pill self">${icons.screenShare} You are presenting</span>` : ""}
        <div class="call-center">
          ${avatar(call.peer, "xxl")}
          <h2>${escapeHtml(call.peer?.displayName || "Bean user")}</h2>
          <p class="call-status">${status}</p>
        </div>
        ${video ? `<video class="local-video ${call.cameraOff ? "off" : ""}" autoplay playsinline muted></video>` : ""}
        <div class="call-controls">
          <button type="button" class="call-btn ${call.muted ? "on" : ""}" data-mute aria-label="Mute">${call.muted ? icons.micOff : icons.mic}</button>
          ${video ? `<button type="button" class="call-btn ${call.cameraOff ? "on" : ""}" data-camera aria-label="Camera">${call.cameraOff ? icons.videoOff : icons.video}</button>` : ""}
          ${connected && navigator.mediaDevices?.getDisplayMedia ? `<button type="button" class="call-btn ${call.sharing ? "on" : ""}" data-screen data-tip="${call.sharing ? "Stop presenting" : "Share screen"}" aria-label="Share screen">${call.sharing ? icons.screenStop : icons.screenShare}</button>` : ""}
          <button type="button" class="call-btn decline" data-hangup aria-label="End call">${icons.phoneOff}</button>
        </div>
      </div>`;

    const remote = container.querySelector(".remote-video, .remote-audio");
    if (call.remoteStream && remote.srcObject !== call.remoteStream) remote.srcObject = call.remoteStream;
    remote.play?.().catch(() => {});
    const screen = container.querySelector(".remote-screen");
    if (screen && call.remoteStream) {
      screen.srcObject = call.remoteStream;
      screen.play?.().catch(() => {});
    }
    const local = container.querySelector(".local-video");
    if (local && call.localStream) local.srcObject = call.localStream;
    const hasRemoteVideo = call.remoteStream?.getVideoTracks().length > 0;
    container.querySelector(".call-screen").classList.toggle("has-remote-video", Boolean((video || call.peerSharing) && hasRemoteVideo && connected));

    container.querySelector("[data-hangup]").onclick = () => store.hangup();
    container.querySelector("[data-mute]").onclick = () => store.toggleCallMute();
    container.querySelector("[data-camera]")?.addEventListener("click", () => store.toggleCamera());
    container.querySelector("[data-screen]")?.addEventListener("click", () => store.toggleCallScreen());

    if (connected) {
      const el = container.querySelector(".call-status");
      timer = setInterval(() => (el.textContent = formatDuration((Date.now() - call.connectedAt) / 1000)), 1000);
    }
  };

  store.subscribe(render);
  render(store.getState());
}
