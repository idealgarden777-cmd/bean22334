/* Bean API client. Talks to /api on the same origin (cookie auth).
 * When /api is missing (plain `vite dev`), switches to the in-browser demo backend. */
import { demoApi } from "./demo-api.js";

export const ACCOUNTS_URL = "https://accounts.signaturesi.com";

let useDemo = false;

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = res.headers.get("content-type") || "";
  if (!type.includes("application/json")) {
    const err = new Error("API not available");
    err.code = "NO_API";
    throw err;
  }
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || "Request failed");
    err.status = res.status;
    throw err;
  }
  return data;
}

const qs = (params) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

const live = {
  me: () => request("/api/me"),
  logout: () => request("/api/me", { method: "POST", body: { action: "logout" } }),
  updateMe: (changes) => request("/api/me", { method: "POST", body: { action: "update", ...changes } }),
  login: (username, password) => request("/api/auth", { method: "POST", body: { action: "login", username, password } }),
  register: (username, password) => request("/api/auth", { method: "POST", body: { action: "register", username, password } }),
  checkUsername: (username) => request("/api/auth", { method: "POST", body: { action: "check", username } }),
  searchUsers: (q) => request(`/api/users?${qs({ q })}`),

  conversations: () => request("/api/conversations"),
  conversationAction: (action, payload = {}) => request("/api/conversations", { method: "POST", body: { action, ...payload } }),

  messages: (conversationId, before) => request(`/api/messages?${qs({ conversationId, before })}`),
  messageAction: (action, payload = {}) => request("/api/messages", { method: "POST", body: { action, ...payload } }),

  sync: (params) => request(`/api/sync?${qs(params)}`),
  typing: (conversationId) => request("/api/sync", { method: "POST", body: { typing: conversationId || null } }),

  async upload(conversationId, file, onProgress) {
    const sign = await request("/api/upload", {
      method: "POST",
      body: { conversationId, name: file.name, size: file.size, mime: file.type },
    });
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", sign.signedUrl);
      xhr.setRequestHeader("x-upsert", "false");
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
      xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error("Upload failed")));
      xhr.onerror = () => reject(new Error("Upload failed"));
      const form = new FormData();
      form.append("cacheControl", "3600");
      form.append("", file);
      xhr.send(form);
    });
    return { path: sign.path, name: file.name, size: file.size, mime: file.type || "application/octet-stream" };
  },

  callConfig: () => request("/api/calls?config=1"),
  callPoll: (id, after) => request(`/api/calls?${qs({ id, after })}`),
  callAction: (action, payload = {}) => request("/api/calls", { method: "POST", body: { action, ...payload } }),
};

export const api = new Proxy(
  {},
  {
    get(_, key) {
      if (key === "isDemo") return () => useDemo;
      if (key === "enableDemo") return () => (useDemo = true);
      return (...args) => (useDemo ? demoApi[key] : live[key])(...args);
    },
  }
);
