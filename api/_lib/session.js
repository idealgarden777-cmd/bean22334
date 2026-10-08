/* =========================================================
 * Bean — shared Bean ID session helpers (server only)
 * Uses the same Supabase project + bean_session cookie that
 * accounts.signaturesi.com sets on .signaturesi.com
 * ========================================================= */
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "bean_session";

export function getCookie(req, name) {
  const parts = String(req.headers.cookie || "").split(";");
  for (const part of parts) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

export function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

export function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name || user.username,
    beanId: `${user.username}@bean`,
  };
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

  return publicUser(user);
}

/* Wraps a handler: verifies the session and catches errors. */
export function withUser(handler, { methods = ["GET"] } = {}) {
  return async (req, res) => {
    if (!methods.includes(req.method)) {
      res.setHeader("Allow", methods.join(", "));
      return send(res, 405, { error: "Method not allowed" });
    }
    try {
      const me = await getSessionUser(req);
      if (!me) return send(res, 401, { error: "Not signed in" });
      return await handler(req, res, me);
    } catch (err) {
      console.error("Bean API error:", err);
      return send(res, 500, { error: "Something went wrong" });
    }
  };
}

export async function isMember(conversationId, userId) {
  const { data, error } = await supabase
    .from("bean_conversation_members")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
