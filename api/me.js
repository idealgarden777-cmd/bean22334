import argon2 from "argon2";
import {
  getSessionUser, send, readBody, supabase, getCookie, hashToken, COOKIE_NAME, sessionCookie, getSettings, HttpError,
  sameOrigin, rateLimit,
} from "./_lib/session.js";
import { setGhost } from "./_lib/ghost.js";

const TIMERS = [0, 86400, 604800, 2592000]; // off, 24h, 7d, 30d (seconds)
const VERSION = "3.4.0";
const build = () => ({
  version: VERSION,
  commit: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || null,
  repo: process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG
    ? `https://github.com/${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`
    : null,
});

/* Which kind of Supabase key the server has (never the key itself).
 * Must be service_role / secret: bean_update_v32.sql blocks the public anon key. */
function keyKind(key) {
  const k = String(key || "");
  if (!k) return "missing";
  if (k.startsWith("sb_secret_")) return "secret";
  if (k.startsWith("sb_publishable_")) return "publishable (WRONG: use the service_role/secret key)";
  try {
    const role = JSON.parse(Buffer.from(k.split(".")[1], "base64url").toString()).role;
    return role === "service_role" ? "service_role" : `${role} (WRONG: use the service_role key)`;
  } catch {
    return "unknown";
  }
}

/* ---------- profile: photo + about ---------- */
const MAX_AVATAR_BYTES = 200 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function imageType(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

function cleanBio(value) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 160);
}

async function saveProfile(me, body) {
  const row = { user_id: me.id, updated_at: new Date().toISOString() };
  if (body.bio !== undefined) row.bio = cleanBio(body.bio);
  if (body.avatar !== undefined) {
    if (body.avatar === null) {
      row.avatar_data = null;
      row.avatar_v = null;
      row.avatar_url = null;
    } else {
      const m = /^data:image\/(jpeg|png|webp);base64,([a-z0-9+/=]+)$/i.exec(String(body.avatar));
      if (!m) throw new HttpError(400, "Please choose a JPG, PNG or WebP photo");
      const buf = Buffer.from(m[2], "base64");
      if (!buf.length || buf.length > MAX_AVATAR_BYTES) throw new HttpError(400, "Photo is too large (max 200 KB after resizing)");
      const type = imageType(buf);
      if (!type) throw new HttpError(400, "That file is not a valid image");
      row.avatar_data = `data:${type};base64,${buf.toString("base64")}`;
      row.avatar_v = Date.now();
    }
  }
  const { error } = await supabase.from("bean_profiles").upsert(row, { onConflict: "user_id" });
  if (error) {
    if (/column|relation|schema cache/i.test(error.message || "")) {
      throw new HttpError(503, "Profile editing needs the one-time database update (bean_update_v32.sql).");
    }
    throw error;
  }
}

async function serveAvatar(req, res) {
  const me = await getSessionUser(req);
  if (!me) return send(res, 401, { error: "Not signed in" });
  const id = String(req.query.avatar || "");
  if (!UUID.test(id)) return send(res, 404, { error: "Not found" });
  const { data } = await supabase.from("bean_profiles").select("avatar_data").eq("user_id", id).maybeSingle();
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(data?.avatar_data || "");
  if (!m) return send(res, 404, { error: "Not found" });
  const buf = Buffer.from(m[2], "base64");
  res.statusCode = 200;
  res.setHeader("Content-Type", m[1]);
  res.setHeader("Content-Length", buf.length);
  res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  return res.end(buf);
}

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
 * POST /api/me {action:"update", ghostEnabled?, ghostNote?, ghostHours?, ghostCharacter?}  (Neyo Ghost: Delegated Presence;
 *   ghostCharacter = neyo | zadi | wizi | crony, the NEYO character that writes Ghost replies) */
export default async function handler(req, res) {
  try {
    if (req.method === "GET" && req.query?.health) {
      const t0 = Date.now();
      const { error } = await supabase.from("bean_users").select("id", { head: true, count: "exact" }).limit(1);
      return send(res, error ? 503 : 200, {
        ok: !error,
        database: error ? "down" : "ok",
        dbMs: Date.now() - t0,
        neyo: process.env.GEMINI_API_KEY ? "configured" : "missing GEMINI_API_KEY",
        serverKey: keyKind(process.env.SUPABASE_SERVICE_ROLE_KEY),
        ...build(),
      });
    }
    if (req.method === "GET" && req.query?.avatar) return serveAvatar(req, res);
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

    if (body.action === "profile") {
      const me = await getSessionUser(req);
      if (!me) return send(res, 401, { error: "Not signed in" });
      await rateLimit(`profile:${me.id}`, 20, 600);
      await saveProfile(me, body);
      return send(res, 200, { success: true, user: await getSessionUser(req) });
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
        if (!ok) return send(res, 403, { error: "Current password is incorrect" });
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

      if (body.ghostEnabled !== undefined || body.ghostNote !== undefined || body.ghostCharacter !== undefined) {
        await setGhost(me, {
          enabled: body.ghostEnabled === undefined ? undefined : Boolean(body.ghostEnabled),
          note: body.ghostNote,
          hours: body.ghostHours,
          character: body.ghostCharacter,
        });
      }

      const user = await getSessionUser(req);
      return send(res, 200, { success: true, user, settings: await getSettings(me.id), build: build() });
    }

    return send(res, 400, { error: "Unknown action" });
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.message });
    if ([400, 409].includes(err?.status)) return send(res, err.status, { error: err.message });
    console.error("me error:", err);
    return send(res, 500, { error: "Something went wrong", detail: [err?.message, err?.details, err?.hint].filter(Boolean).join(" | ") || undefined, code: err?.code });
  }
}
