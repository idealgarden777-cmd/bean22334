/* =========================================================
 * Bean — shared server helpers (Bean ID session + responses)
 * Same Supabase project + `bean_session` cookie that
 * accounts.signaturesi.com sets on .signaturesi.com
 * ========================================================= */
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";


export const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "bean_session";
export const MEDIA_BUCKET = "bean-media";
export const ONLINE_WINDOW_MS = 35_000;

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const fail = (status, message) => {
  throw new HttpError(status, message);
};

export const MISSING_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((k) => !process.env[k]);

// Missing env vars must not crash the function at import: every call then
// answers with a clear JSON error instead of FUNCTION_INVOCATION_FAILED.
export const supabase = MISSING_ENV.length
  ? new Proxy({}, {
      get() {
        throw new HttpError(500, `Server setup incomplete: add ${MISSING_ENV.join(", ")} in Vercel → Settings → Environment Variables, then Redeploy.`);
      },
    })
  : createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

export function getCookie(req, name) {
  for (const part of String(req.headers.cookie || "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/* Cookie on .signaturesi.com when served there (shared Bean ID login),
 * host-only elsewhere (e.g. *.vercel.app previews) so testing still works. */
export function sessionCookie(req, value, maxAge) {
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(":")[0].toLowerCase();
  const domain = host === "signaturesi.com" || host.endsWith(".signaturesi.com") ? "; Domain=.signaturesi.com" : "";
  const secure = host === "localhost" || host === "127.0.0.1" ? "" : "; Secure";
  return `${COOKIE_NAME}=${value}; Path=/${domain}; HttpOnly${secure}; SameSite=Lax; Max-Age=${maxAge}`;
}

export const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

export function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(status).json(body);
}

export function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export function publicUser(user, presence, avatarUrl = null) {
  const lastSeenAt = presence?.last_seen_at || null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name || user.username,
    beanId: `${user.username}@bean`,
    avatarUrl: avatarUrl || (user.username === "neyo" ? "/neyo-icon.png" : null),
    lastSeenAt,
    online: user.username === "neyo" || (lastSeenAt ? Date.now() - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS : false),
    ...(user.username === "neyo" ? { isBot: true } : {}),
  };
}

export function cleanUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/@bean$/, "");
}

export async function getSessionUser(req) {
  const raw = getCookie(req, COOKIE_NAME);
  if (!raw) return null;

  const { data: session, error } = await supabase
    .from("bean_sessions")
    .select("user_id, expires_at, revoked_at")
    .eq("token_hash", hashToken(raw))
    .maybeSingle();
  if (error) throw error;
  if (!session || session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) return null;

  const { data: user, error: userError } = await supabase
    .from("bean_users")
    .select("id, username, display_name, status")
    .eq("id", session.user_id)
    .maybeSingle();
  if (userError) throw userError;
  if (!user || user.status !== "active") return null;

  return publicUser(user, { last_seen_at: new Date().toISOString() }, await getAvatars([user.id]).then((m) => m.get(user.id)));
}

/* Profile photos live in bean_profiles (accounts.signaturesi). Optional: never breaks a request. */
export async function getAvatars(ids) {
  const out = new Map();
  if (!ids?.length) return out;
  try {
    const { data, error } = await supabase.from("bean_profiles").select("user_id, avatar_url").in("user_id", ids);
    if (!error) for (const p of data || []) if (p.avatar_url) out.set(p.user_id, p.avatar_url);
  } catch {}
  return out;
}

/* Per-user Bean settings (message timer, wallpaper). Optional table. */
export async function getSettings(userId) {
  try {
    const { data, error } = await supabase.from("bean_settings").select("*").eq("user_id", userId).maybeSingle();
    if (!error && data)
      return {
        messageTimer: Number(data.message_timer) || 0,
        wallpaper: data.wallpaper || "none",
        ghostEnabled: Boolean(data.ghost_enabled),
        ghostNote: data.ghost_note || "",
        ghostUntil: data.ghost_until || null,
      };
  } catch {}
  return { messageTimer: 0, wallpaper: "none", ghostEnabled: false, ghostNote: "", ghostUntil: null };
}

/* ---------- security helpers ---------- */

export const NEYO_ID = "0e000000-0000-4000-8000-000000000001";

export function clientIp(req) {
  return String(req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim()
    .slice(0, 64);
}

/* Cross-site request guard: a POST must come from our own pages. */
export function sameOrigin(req) {
  if (req.method === "GET" || req.method === "HEAD") return true;
  const origin = req.headers.origin;
  if (!origin) return true; // same-origin fetch from old browsers / server-to-server (cron)
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").toLowerCase();
  try {
    return new URL(origin).host.toLowerCase() === host;
  } catch {
    return false;
  }
}

/* Fixed-window rate limit backed by public.bean_rate_hit (bean_e2ee.sql).
 * If the SQL function is not installed yet the request is allowed (logged). */
export async function rateLimit(key, max, windowSeconds) {
  try {
    const { data, error } = await supabase.rpc("bean_rate_hit", { p_key: key, p_window: windowSeconds, p_max: max });
    if (error) {
      if (!rateLimit.warned) console.warn("Rate limit unavailable (run supabase/bean_e2ee.sql):", error.message);
      rateLimit.warned = true;
      return;
    }
    if (data === false) fail(429, "Bahut zyada koshishen. Thori dair baad dobara try karein.");
  } catch (err) {
    if (err instanceof HttpError) throw err;
  }
}

/* Every chat is end-to-end encrypted except a DM with Neyo (an AI has to read it). */
export async function chatInfo(conversationId) {
  const { data, error } = await supabase.from("bean_conversations").select("id, type, dm_key").eq("id", conversationId).maybeSingle();
  if (error) throw error;
  if (!data) fail(404, "Chat not found");
  return { ...data, plain: data.type === "dm" && String(data.dm_key || "").includes(NEYO_ID) };
}

/* Wraps a handler: method check, origin check, session check, rate limit, error handling. */
export function withUser(handler, { methods = ["GET"], limit = [240, 60], name = "api" } = {}) {
  return async (req, res) => {
    if (!methods.includes(req.method)) {
      res.setHeader("Allow", methods.join(", "));
      return send(res, 405, { error: "Method not allowed" });
    }
    try {
      if (!sameOrigin(req)) return send(res, 403, { error: "Blocked: request did not come from Bean" });
      const me = await getSessionUser(req);
      if (!me) return send(res, 401, { error: "Not signed in" });
      if (limit && req.method !== "GET") await rateLimit(`${name}:${me.id}`, limit[0], limit[1]);
      return await handler(req, res, me);
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { error: err.message });
      console.error("Bean API error:", err);
      return send(res, 500, { error: "Something went wrong", detail: [err?.message, err?.details, err?.hint].filter(Boolean).join(" | ") || undefined, code: err?.code });
    }
  };
}

export async function getMembership(conversationId, userId) {
  if (!conversationId) fail(400, "conversationId is required");
  const { data, error } = await supabase
    .from("bean_conversation_members")
    .select("conversation_id, user_id, role, last_read_at, muted")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) fail(403, "You are not in this chat");
  return data;
}

export async function findUsersByUsernames(usernames) {
  const names = [...new Set((usernames || []).map(cleanUsername).filter(Boolean))].slice(0, 50);
  if (!names.length) return [];
  const { data, error } = await supabase
    .from("bean_users")
    .select("id, username, display_name, status")
    .in("username", names)
    .eq("status", "active");
  if (error) throw error;
  return data || [];
}
