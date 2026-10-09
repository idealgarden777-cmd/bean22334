import argon2 from "argon2";
import {
  getSessionUser, send, readBody, supabase, getCookie, hashToken, COOKIE_NAME, sessionCookie, getSettings, HttpError,
  sameOrigin, rateLimit,
} from "./_lib/session.js";
import { setGhost } from "./_lib/ghost.js";

const TIMERS = [0, 86400, 604800, 2592000]; // off, 24h, 7d, 30d (seconds)
const VERSION = "3.0.0";
const build = () => ({
  version: VERSION,
  commit: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || null,
  repo: process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG
    ? `https://github.com/${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`
    : null,
});

function deviceName(ua) {
  const s = String(ua || "");
  const browser = /Edg\//.test(s) ? "Edge" : /OPR\//.test(s) ? "Opera" : /Chrome\//.test(s) ? "Chrome" : /Firefox\//.test(s) ? "Firefox" : /Safari\//.test(s) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(s) ? "iPhone/iPad" : /Android/.test(s) ? "Android" : /Windows/.test(s) ? "Windows" : /Mac OS X/.test(s) ? "Mac" : /Linux/.test(s) ? "Linux" : "Device";
  return `${browser} · ${os}`;
}

async function listSessions(req, me) {
  const current = hashToken(getCookie(req, COOKIE_NAME) || "");
  const { data, error } = await supabase
    .from("bean_sessions")
    .select("id, token_hash, user_agent, created_at, expires_at")
    .eq("user_id", me.id)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data || []).map((x) => ({
    id: x.id,
    device: deviceName(x.user_agent),
    createdAt: x.created_at,
    expiresAt: x.expires_at,
    current: x.token_hash === current,
  }));
}

/* revoke every session of this user except (optionally) the current one */
async function revokeOthers(req, userId, keepCurrent) {
  const now = new Date().toISOString();
  let q = supabase.from("bean_sessions").update({ revoked_at: now }).eq("user_id", userId).is("revoked_at", null);
  if (keepCurrent) q = q.neq("token_hash", hashToken(getCookie(req, COOKIE_NAME) || ""));
  const { error } = await q;
  if (error) throw error;
}
const WALLPAPERS = ["none", "dots", "grid", "sand", "mist", "night"];

/* GET  /api/me                                        -> { authenticated, user, settings }
 * POST /api/me {action:"logout"}
 * POST /api/me {action:"update", displayName?, password?, messageTimer?, wallpaper?}  ("Update Identity")
 * POST /api/me {action:"update", ghostEnabled?, ghostNote?, ghostHours?}  (Neyo Ghost: Delegated Presence) */
export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const user = await getSessionUser(req);
      if (!user) return send(res, 200, { authenticated: false });
      return send(res, 200, { authenticated: true, user, settings: await getSettings(user.id), build: build() });
    }
    if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
    if (!sameOrigin(req)) return send(res, 403, { error: "Blocked: request did not come from Bean" });

    const body = readBody(req);

    if (["sessions", "logout_all", "revoke_session"].includes(body.action)) {
      const me = await getSessionUser(req);
      if (!me) return send(res, 401, { error: "Not signed in" });
      if (body.action === "logout_all") {
        await revokeOthers(req, me.id, false);
        res.setHeader("Set-Cookie", sessionCookie(req, "", 0));
        return send(res, 200, { success: true });
      }
      if (body.action === "revoke_session") {
        const { error } = await supabase
          .from("bean_sessions")
          .update({ revoked_at: new Date().toISOString() })
          .eq("id", body.sessionId)
          .eq("user_id", me.id);
        if (error) throw error;
      }
      return send(res, 200, { sessions: await listSessions(req, me) });
    }

    if (body.action === "logout") {
      const raw = getCookie(req, COOKIE_NAME);
      if (raw) {
        await supabase.from("bean_sessions").update({ revoked_at: new Date().toISOString() }).eq("token_hash", hashToken(raw));
      }
      res.setHeader("Set-Cookie", sessionCookie(req, "", 0));
      return send(res, 200, { success: true });
    }

    if (body.action === "update") {
      const me = await getSessionUser(req);
      if (!me) return send(res, 401, { error: "Not signed in" });
      await rateLimit(`me:${me.id}`, 30, 60);

      if (body.displayName !== undefined) {
        const name = String(body.displayName || "").trim().replace(/\s+/g, " ").slice(0, 40);
        if (!name) return send(res, 400, { error: "Display name can't be empty" });
        const { error } = await supabase.from("bean_users").update({ display_name: name }).eq("id", me.id);
        if (error) throw error;
      }

      if (body.password) {
        const password = String(body.password);
        if (password.length < 10 || password.length > 100) return send(res, 400, { error: "Password must be at least 10 characters" });
        const { data: cred } = await supabase.from("bean_credentials").select("password_hash").eq("user_id", me.id).maybeSingle();
        let ok = false;
        try {
          ok = Boolean(cred?.password_hash) && (await argon2.verify(cred.password_hash, String(body.currentPassword || "")));
        } catch {}
        if (!ok) return send(res, 403, { error: "Current password galat hai" });
        const password_hash = await argon2.hash(password, { type: argon2.argon2id });
        const { error } = await supabase.from("bean_credentials").update({ password_hash }).eq("user_id", me.id);
        if (error) throw error;
        await revokeOthers(req, me.id, true); // new password = every other device is signed out
      }

      if (body.messageTimer !== undefined || body.wallpaper !== undefined) {
        const current = await getSettings(me.id);
        const messageTimer = body.messageTimer !== undefined ? Number(body.messageTimer) : current.messageTimer;
        const wallpaper = body.wallpaper !== undefined ? String(body.wallpaper) : current.wallpaper;
        if (!TIMERS.includes(messageTimer)) return send(res, 400, { error: "Unknown message timer" });
        if (!WALLPAPERS.includes(wallpaper)) return send(res, 400, { error: "Unknown wallpaper" });
        const { error } = await supabase
          .from("bean_settings")
          .upsert({ user_id: me.id, message_timer: messageTimer, wallpaper, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
        if (error) throw error;
      }

      if (body.ghostEnabled !== undefined || body.ghostNote !== undefined) {
        await setGhost(me, {
          enabled: body.ghostEnabled === undefined ? undefined : Boolean(body.ghostEnabled),
          note: body.ghostNote,
          hours: body.ghostHours,
        });
      }

      const user = await getSessionUser(req);
      return send(res, 200, { success: true, user, settings: await getSettings(me.id), build: build() });
    }

    return send(res, 400, { error: "Unknown action" });
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.message });
    console.error("me error:", err);
    return send(res, 500, { error: "Something went wrong", detail: [err?.message, err?.details, err?.hint].filter(Boolean).join(" | ") || undefined, code: err?.code });
  }
}
