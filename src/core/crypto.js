/* =========================================================
 * Bean E2EE primitives (browser WebCrypto + Argon2id).
 * Nothing in this file talks to the network.
 *
 *  identity key   ECDH P-256, one per Bean ID, same on all your devices
 *  Chat Lock      passphrase -> Argon2id (64 MB, 3 passes) -> AES-256-GCM
 *                 seals the identity private key ("backup"); never leaves the browser
 *  chat key       random AES-256-GCM key per chat "epoch"; new epoch whenever
 *                 members or their keys change
 *  key wrap       ECDH(sender, member) -> HKDF-SHA-256 (bound to chat, epoch,
 *                 sender, member) -> AES-GCM wraps the chat key for that member
 *  message        AES-256-GCM, random 96-bit IV, AAD binds chat + sender + epoch
 *  media          a fresh AES-256-GCM key per file, kept inside the message
 * ========================================================= */
import { argon2id } from "hash-wasm";

const subtle = globalThis.crypto.subtle;
const te = new TextEncoder();
const td = new TextDecoder();
const ECDH = { name: "ECDH", namedCurve: "P-256" };

export const KDF_DEFAULT = { alg: "argon2id", m: 65536, t: 3, p: 1 };

export class CryptoError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

/* ---------- encoding ---------- */

export function b64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
export function unb64(str) {
  const s = atob(String(str).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
export const randomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/* ---------- identity ---------- */

const cleanPub = (jwk) => ({ kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y });

export async function fingerprint(pub) {
  return hex(await subtle.digest("SHA-256", te.encode(`bean-id-v1|${pub.crv}|${pub.x}|${pub.y}`)));
}

export async function generateIdentity() {
  const kp = await subtle.generateKey(ECDH, true, ["deriveBits"]);
  const pub = cleanPub(await subtle.exportKey("jwk", kp.publicKey));
  const pkcs8 = new Uint8Array(await subtle.exportKey("pkcs8", kp.privateKey));
  return { pub, pkcs8, fingerprint: await fingerprint(pub) };
}

/* Import a private key for use on this device. Non-extractable: even code
 * running in this page can't read the raw key back out of the browser. */
export async function importPrivate(pkcs8) {
  return subtle.importKey("pkcs8", pkcs8, ECDH, false, ["deriveBits"]);
}

/* The public key that belongs to a private key (to check a backup matches). */
export async function publicOf(pkcs8) {
  const k = await subtle.importKey("pkcs8", pkcs8, ECDH, true, ["deriveBits"]);
  return cleanPub(await subtle.exportKey("jwk", k));
}

const pubCache = new Map();
export async function importPublic(pub) {
  const id = `${pub.x}.${pub.y}`;
  if (!pubCache.has(id)) pubCache.set(id, subtle.importKey("jwk", { ...cleanPub(pub), ext: true }, ECDH, true, []));
  return pubCache.get(id);
}

/* 60-digit safety number for two people (same on both phones). */
export async function safetyNumber(fpA, fpB) {
  const [a, b] = [fpA, fpB].sort();
  const digest = new Uint8Array(await subtle.digest("SHA-512", te.encode(`bean-safety-v1|${a}|${b}`)));
  const groups = [];
  for (let i = 0; i < 12; i++) {
    let n = 0;
    for (let j = 0; j < 5; j++) n = (n * 256 + digest[i * 5 + j]) % 100000;
    groups.push(String(n).padStart(5, "0"));
  }
  return groups;
}

/* ---------- Chat Lock (passphrase) ---------- */

async function passKey(passphrase, salt, kdf) {
  const raw = await argon2id({
    password: String(passphrase).normalize("NFKC"),
    salt,
    parallelism: kdf.p,
    iterations: kdf.t,
    memorySize: kdf.m,
    hashLength: 32,
    outputType: "binary",
  });
  return subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function sealBackup(pkcs8, passphrase, kdf = KDF_DEFAULT) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await passKey(passphrase, salt, kdf);
  const ct = await subtle.encrypt({ name: "AES-GCM", iv, additionalData: te.encode("bean-backup-v1") }, key, pkcs8);
  return { v: 1, kdf: { ...kdf, salt: b64(salt) }, iv: b64(iv), ct: b64(ct) };
}

export async function openBackup(backup, passphrase) {
  const key = await passKey(passphrase, unb64(backup.kdf.salt), backup.kdf);
  try {
    return new Uint8Array(
      await subtle.decrypt({ name: "AES-GCM", iv: unb64(backup.iv), additionalData: te.encode("bean-backup-v1") }, key, unb64(backup.ct))
    );
  } catch {
    throw new CryptoError("WRONG_PASSPHRASE", "Chat Lock galat hai");
  }
}

/* ---------- chat keys ---------- */

export const newChatKeyRaw = () => randomBytes(32);
export const importChatKey = (raw) => subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
export const wrapInfo = (conversationId, epoch, senderId, recipientId) => `bean-wrap-v1|${conversationId}|${epoch}|${senderId}|${recipientId}`;

async function pairKey(myPriv, theirPub, info) {
  const bits = await subtle.deriveBits({ name: "ECDH", public: await importPublic(theirPub) }, myPriv, 256);
  const base = await subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: te.encode("bean-wrap-salt-v1"), info: te.encode(info) },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function wrapChatKey(raw, myPriv, theirPub, info) {
  const iv = randomBytes(12);
  const k = await pairKey(myPriv, theirPub, info);
  const ct = await subtle.encrypt({ name: "AES-GCM", iv, additionalData: te.encode(info) }, k, raw);
  return { iv: b64(iv), ct: b64(ct) };
}

export async function unwrapChatKey(wrapped, myPriv, senderPub, info) {
  const k = await pairKey(myPriv, senderPub, info);
  try {
    const raw = await subtle.decrypt({ name: "AES-GCM", iv: unb64(wrapped.iv), additionalData: te.encode(info) }, k, unb64(wrapped.ct));
    return importChatKey(new Uint8Array(raw));
  } catch {
    throw new CryptoError("UNWRAP_FAILED", "Chat key could not be opened");
  }
}

/* ---------- messages ---------- */

export async function encryptJson(key, obj, aad) {
  const iv = randomBytes(12);
  const ct = await subtle.encrypt({ name: "AES-GCM", iv, additionalData: te.encode(aad) }, key, te.encode(JSON.stringify(obj)));
  return { iv: b64(iv), ct: b64(ct) };
}

export async function decryptJson(key, box, aad) {
  try {
    const pt = await subtle.decrypt({ name: "AES-GCM", iv: unb64(box.iv), additionalData: te.encode(aad) }, key, unb64(box.ct));
    return JSON.parse(td.decode(pt));
  } catch {
    throw new CryptoError("DECRYPT_FAILED", "Message could not be decrypted");
  }
}

/* ---------- files ---------- */

export async function encryptFile(bytes) {
  const raw = randomBytes(32);
  const iv = randomBytes(12);
  const key = await importChatKey(raw);
  const ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv }, key, bytes));
  return { ct, k: b64(raw), iv: b64(iv) };
}

export async function decryptFile(bytes, k, iv) {
  const key = await importChatKey(unb64(k));
  try {
    return new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, key, bytes));
  } catch {
    throw new CryptoError("DECRYPT_FAILED", "File could not be decrypted");
  }
}
