import { supabase, getCookie, hashToken, COOKIE_NAME, send } from "./_lib/session.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  const raw = getCookie(req, COOKIE_NAME);
  if (raw) {
    await supabase
      .from("bean_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", hashToken(raw));
  }
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; Domain=.signaturesi.com; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  );
  return send(res, 200, { success: true });
}
