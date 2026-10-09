import { send, readBody, withUser, HttpError } from "./_lib/session.js";
import { replyInChat, ghostTick, neyoDmFor } from "./_lib/neyo.js";
import { ghostSweep } from "./_lib/ghost.js";

/* POST /api/neyo {action:"reply", conversationId, tz}  -> Neyo answers in the user's Neyo chat
 * POST /api/neyo {action:"open"}                         -> { conversationId } DM with Neyo
 * GET|POST /api/neyo?action=tick                         -> background run: reminders, digests,
 *   Ghost (Away Mode) auto-off. Called every minute by open Bean tabs and by pg_cron.
 * Neyo never reads people's chats: they are end-to-end encrypted.                       */
const userActions = withUser(
  async (req, res, me) => {
    const body = readBody(req);
    if (body.action === "reply") return send(res, 200, await replyInChat(me, String(body.conversationId || ""), body.tz));
    if (body.action === "ghost") return send(res, 200, { skipped: "e2ee" }); // old clients
    if (body.action === "open") return send(res, 200, { conversationId: await neyoDmFor(me.id) });
    return send(res, 400, { error: "Unknown action" });
  },
  { methods: ["POST"], limit: [30, 60], name: "neyo" }
);

export default async function handler(req, res) {
  const action = req.query?.action || readBody(req).action;
  if (action === "tick") {
    try {
      const tasks = await ghostTick();
      const away = tasks.skipped ? {} : await ghostSweep();
      return send(res, 200, { ...tasks, ...away });
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { error: err.message });
      console.error("Neyo tick failed:", err);
      return send(res, 500, { error: "Neyo run failed" });
    }
  }
  return userActions(req, res);
}
