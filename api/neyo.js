import { send, readBody, withUser, HttpError } from "./_lib/session.js";
import { replyInChat, ghostTick, neyoDmFor } from "./_lib/neyo.js";
import { handleGhostDm, ghostSweep } from "./_lib/ghost.js";
import { getMembership } from "./_lib/session.js";

/* POST /api/neyo {action:"reply", conversationId, tz}  -> Neyo answers in that chat
 * POST /api/neyo {action:"open"}                         -> { conversationId } DM with Neyo
 * POST /api/neyo {action:"ghost", conversationId}       -> Ghost answers for an away user (DMs)
 * GET|POST /api/neyo?action=tick                         -> Neyo Ghost background run
 *   (called every minute by open Bean tabs and by Supabase pg_cron)                    */
const userActions = withUser(
  async (req, res, me) => {
    const body = readBody(req);
    if (body.action === "reply") return send(res, 200, await replyInChat(me, String(body.conversationId || ""), body.tz));
    if (body.action === "ghost") {
      const conversationId = String(body.conversationId || "");
      await getMembership(conversationId, me.id);
      return send(res, 200, await handleGhostDm(conversationId));
    }
    if (body.action === "open") return send(res, 200, { conversationId: await neyoDmFor(me.id) });
    return send(res, 400, { error: "Unknown action" });
  },
  { methods: ["POST"], limit: [60, 60], name: "neyo" }
);

export default async function handler(req, res) {
  const action = req.query?.action || readBody(req).action;
  if (action === "tick") {
    try {
      const tasks = await ghostTick();
      // Ghost replies to DMs are also done here, as a safety net when the sender's tab closed
      const presence = tasks.skipped ? {} : await ghostSweep();
      return send(res, 200, { ...tasks, ...presence });
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { error: err.message });
      console.error("Neyo Ghost tick failed:", err);
      return send(res, 500, { error: "Ghost run failed", detail: err?.message });
    }
  }
  return userActions(req, res);
}
