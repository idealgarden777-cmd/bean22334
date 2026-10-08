/* Sounds, browser notifications and the tab title badge. */
let ctx;
function audio() {
  ctx ||= new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq, start, duration, gain = 0.06) {
  const a = audio();
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, a.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, a.currentTime + start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + duration);
  osc.connect(g).connect(a.destination);
  osc.start(a.currentTime + start);
  osc.stop(a.currentTime + start + duration + 0.05);
}

export function playMessageSound() {
  try {
    tone(880, 0, 0.12);
    tone(1320, 0.09, 0.16);
  } catch {}
}

let ringTimer = null;
export function startRinging(outgoing = false) {
  stopRinging();
  const ring = () => {
    try {
      if (outgoing) {
        tone(440, 0, 0.9, 0.035);
        tone(480, 0, 0.9, 0.035);
      } else {
        tone(784, 0, 0.18);
        tone(988, 0.2, 0.18);
        tone(784, 0.4, 0.18);
        tone(988, 0.6, 0.25);
      }
    } catch {}
  };
  ring();
  ringTimer = setInterval(ring, outgoing ? 3000 : 2200);
}
export function stopRinging() {
  clearInterval(ringTimer);
  ringTimer = null;
}

export const notificationsSupported = () => "Notification" in window;
export const notificationPermission = () => (notificationsSupported() ? Notification.permission : "denied");
export async function askNotificationPermission() {
  if (!notificationsSupported()) return "denied";
  return Notification.requestPermission();
}

export function showNotification(title, body, onClick) {
  if (notificationPermission() !== "granted") return;
  try {
    const n = new Notification(title, { body, icon: "/favicon.svg", tag: title, silent: true });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
  } catch {}
}

export function setTitleBadge(count) {
  document.title = count > 0 ? `(${count > 99 ? "99+" : count}) Bean` : "Bean";
}
