import { getSessionUser, send, readBody, supabase, getCookie, hashToken, COOKIE_NAME } from "./_lib/session.js";

/* GET  /api/me                      -> current Bean ID
 * POST /api/me {action:"logout"}    -> sign out everywhere on this device */
export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const user = await getSessionUser(req);
      if (!user) return send(res, 200, { authenticated: false });
      return send(res, 200, { authenticated: true, user });
    }
    if (req.method === "POST" && readBody(req).action === "logout") {
      const raw = getCookie(req, COOKIE_NAME);
      if (raw) {
        await supabase.from("bean_sessions").update({ revoked_at: new Date().toISOString() }).eq("token_hash", hashToken(raw));
      }
      res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; Domain=.signaturesi.com; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
      return send(res, 200, { success: true });
    }
    return send(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("me error:", err);
    return send(res, 500, { error: "Unable to verify session" });
  }
}
