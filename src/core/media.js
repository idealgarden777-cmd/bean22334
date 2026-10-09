/* In-app media: voice notes and files are played/saved inside Bean,
 * never by sending the user to a raw storage link in a new tab. */
import { store } from "./store.js";

const blobs = new Map(); // remote url -> blob: url (only for files we had to re-type)
const MAX_CACHED = 24;

function remember(url, objectUrl) {
  blobs.set(url, objectUrl);
  if (blobs.size > MAX_CACHED) {
    const [oldUrl, oldObj] = blobs.entries().next().value;
    blobs.delete(oldUrl);
    URL.revokeObjectURL(oldObj);
  }
}

export const cachedBlobUrl = (url) => blobs.get(url) || null;

/* Download bytes and give them the right type (old voice notes were stored without one). */
export async function blobUrlFor(url, mime) {
  if (!url) throw new Error("No file");
  if (url.startsWith("blob:")) return url;
  if (blobs.has(url)) return blobs.get(url);
  const res = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer" });
  if (!res.ok) throw new Error(res.status === 400 || res.status === 403 ? "This link expired. Reopen the chat." : "Couldn't load this file");
  let blob = await res.blob();
  if (mime && blob.type !== mime) blob = new Blob([blob], { type: mime });
  const objectUrl = URL.createObjectURL(blob);
  remember(url, objectUrl);
  return objectUrl;
}

function safeName(name) {
  return String(name || "file").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").slice(0, 120) || "file";
}

/* Save a file to the device without leaving Bean. */
export async function downloadFile(url, name) {
  if (!url) return store.toast("This file isn't ready yet");
  store.toast("Downloading…", 2500);
  try {
    const res = url.startsWith("blob:") ? await fetch(url) : await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer" });
    if (!res.ok) throw new Error();
    // octet-stream so the browser saves it instead of opening/running it
    const blob = new Blob([await res.blob()], { type: "application/octet-stream" });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = safeName(name);
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
    store.toast("Saved to your downloads", 2200);
  } catch {
    store.toast("Couldn't download this file. Try again.");
  }
}
