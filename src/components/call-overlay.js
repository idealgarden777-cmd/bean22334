import { store } from "../core/store.js";
import { icons } from "./icons.js";
import { avatar, escapeHtml, formatDuration } from "../core/utils.js";

export function mountCallOverlay(container) {
  let timer = null;
  let lastKey = "";

  const render = (s) => {
    const call = s.call;
    const incoming = !call && s.incomingCall;
    const key = call
      ? JSON.stringify(["call", call.id, call.status, Boolean(call.connectedAt), call.muted, call.cameraOff, call.remoteStream?.getTracks().length])
      : incoming ? `in:${incoming.id}` : "";
    if (key === lastKey) return;
    lastKey = key;
    clearInterval(timer);

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
      <div class="call-screen ${video ? "is-video" : "is-audio"} ${connected ? "connected" : ""}">
        ${video ? `<video class="remote-video" autoplay playsinline></video>` : `<audio class="remote-audio" autoplay></audio>`}
        <div class="call-center">
          ${avatar(call.peer, "xxl")}
          <h2>${escapeHtml(call.peer?.displayName || "Bean user")}</h2>
          <p class="call-status">${status}</p>
        </div>
        ${video ? `<video class="local-video ${call.cameraOff ? "off" : ""}" autoplay playsinline muted></video>` : ""}
        <div class="call-controls">
          <button type="button" class="call-btn ${call.muted ? "on" : ""}" data-mute aria-label="Mute">${call.muted ? icons.micOff : icons.mic}</button>
          ${video ? `<button type="button" class="call-btn ${call.cameraOff ? "on" : ""}" data-camera aria-label="Camera">${call.cameraOff ? icons.videoOff : icons.video}</button>` : ""}
          <button type="button" class="call-btn decline" data-hangup aria-label="End call">${icons.phoneOff}</button>
        </div>
      </div>`;

    const remote = container.querySelector(".remote-video, .remote-audio");
    if (call.remoteStream && remote.srcObject !== call.remoteStream) remote.srcObject = call.remoteStream;
    remote.play?.().catch(() => {});
    const local = container.querySelector(".local-video");
    if (local && call.localStream) local.srcObject = call.localStream;
    const hasRemoteVideo = call.remoteStream?.getVideoTracks().length > 0;
    container.querySelector(".call-screen").classList.toggle("has-remote-video", Boolean(video && hasRemoteVideo && connected));

    container.querySelector("[data-hangup]").onclick = () => store.hangup();
    container.querySelector("[data-mute]").onclick = () => store.toggleCallMute();
    container.querySelector("[data-camera]")?.addEventListener("click", () => store.toggleCamera());

    if (connected) {
      const el = container.querySelector(".call-status");
      timer = setInterval(() => (el.textContent = formatDuration((Date.now() - call.connectedAt) / 1000)), 1000);
    }
  };

  store.subscribe(render);
  render(store.getState());
}
