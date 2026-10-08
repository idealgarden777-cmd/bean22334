import { getSessionUser, send } from "./_lib/session.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });
  try {
    const user = await getSessionUser(req);
    if (!user) return send(res, 200, { authenticated: false });
    return send(res, 200, { authenticated: true, user });
  } catch (err) {
    console.error("me error:", err);
    return send(res, 500, { error: "Unable to verify session" });
  }
}
