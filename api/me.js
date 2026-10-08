import argon2 from "argon2";
import {
  getSessionUser, send, readBody, supabase, getCookie, hashToken, COOKIE_NAME, sessionCookie, getSettings,
} from "./_lib/session.js";

const TIMERS = [0, 86400, 604800, 2592000]; // off, 24h, 7d, 30d (seconds)
const WALLPAPERS = ["none", "dots", "grid", "sand", "mist", "night"];

/* GET  /api/me                                        -> { authenticated, user, settings }
 * POST /api/me {action:"logout"}
 * POST /api/me {action:"update", displayName?, password?, messageTimer?, wallpaper?}  ("Update Identity") */
export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const user = await getSessionUser(req);
      if (!user) return send(res, 200, { authenticated: false });
      return send(res, 200, { authenticated: true, user, settings: await getSettings(user.id) });
    }
    if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });

    const body = readBody(req);

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

      if (body.displayName !== undefined) {
        const name = String(body.displayName || "").trim().replace(/\s+/g, " ").slice(0, 40);
        if (!name) return send(res, 400, { error: "Display name can't be empty" });
        const { error } = await supabase.from("bean_users").update({ display_name: name }).eq("id", me.id);
        if (error) throw error;
      }

      if (body.password) {
        const password = String(body.password);
        if (password.length < 10 || password.length > 100) return send(res, 400, { error: "Password must be at least 10 characters" });
        const password_hash = await argon2.hash(password, { type: argon2.argon2id });
        const { error } = await supabase.from("bean_credentials").update({ password_hash }).eq("user_id", me.id);
        if (error) throw error;
      }

      if (body.messageTimer !== undefined || body.wallpaper !== undefined) {
        const current = await getSettings(me.id);
        const messageTimer = body.messageTimer !== undefined ? Number(body.messageTimer) : current.messageTimer;
        const wallpaper = body.wallpaper !== undefined ? String(body.wallpaper) : current.wallpaper;
        if (!TIMERS.includes(messageTimer)) return send(res, 400, { error: "Unknown message timer" });
        if (!WALLPAPERS.includes(wallpaper)) return send(res, 400, { error: "Unknown wallpaper" });
        const { error } = await supabase
          .from("bean_settings")
          .upsert({ user_id: me.id, message_timer: messageTimer, wallpaper, updated_at: new Date().toISOString() });
        if (error) throw error;
      }

      const user = await getSessionUser(req);
      return send(res, 200, { success: true, user, settings: await getSettings(me.id) });
    }

    return send(res, 400, { error: "Unknown action" });
  } catch (err) {
    console.error("me error:", err);
    return send(res, 500, { error: "Something went wrong" });
  }
}
