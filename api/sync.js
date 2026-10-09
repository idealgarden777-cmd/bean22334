import { supabase, send, withUser, readBody, getMembership } from "./_lib/session.js";
import { hydrateMessages, loadConversations, loadUsers, notExpired } from "./_lib/chat.js";

const TYPING_WINDOW_MS = 6000;
const RING_WINDOW_MS = 45000;

/* GET  /api/sync?active=<convId>&since=<ISO>&read=1&lists=1
 *   -> { now, conversations?, active?: { messages, typing, reads }, incomingCall }
 * POST /api/sync { typing: <convId|null> }                                         */
export default withUser(
  async (req, res, me) => {
    const now = new Date();
    const nowIso = now.toISOString();

    if (req.method === "POST") {
      const { typing } = readBody(req);
      if (typing) await getMembership(typing, me.id);
      await supabase.from("bean_presence").upsert({
        user_id: me.id,
        last_seen_at: nowIso,
        typing_in: typing || null,
        typing_at: typing ? nowIso : null,
      }, { onConflict: "user_id" });
      return send(res, 200, { ok: true });
    }

    const { active, since, read, lists } = req.query;
    const out = { now: nowIso, incomingCall: null };

    await supabase.from("bean_presence").upsert({ user_id: me.id, last_seen_at: nowIso }, { onConflict: "user_id" });

    const jobs = [];

    if (active) {
      jobs.push(
        (async () => {
          await getMembership(active, me.id);
          if (read === "1") {
            await supabase
              .from("bean_conversation_members")
              .update({ last_read_at: nowIso })
              .eq("conversation_id", active)
              .eq("user_id", me.id);
          }

          let q = notExpired(
            supabase.from("bean_messages").select("*").eq("conversation_id", active).order("updated_at", { ascending: true }).limit(100)
          );
          if (since) q = q.gte("updated_at", String(since));
          else q = q.gte("updated_at", new Date(now - 60000).toISOString());

          const [msgRes, typingRes, readsRes] = await Promise.all([
            q,
            supabase
              .from("bean_presence")
              .select("user_id, typing_at")
              .eq("typing_in", active)
              .neq("user_id", me.id)
              .gte("typing_at", new Date(now - TYPING_WINDOW_MS).toISOString()),
            supabase.from("bean_conversation_members").select("user_id, last_read_at").eq("conversation_id", active),
          ]);
          if (msgRes.error) throw msgRes.error;

          out.active = {
            conversationId: active,
            messages: await hydrateMessages(msgRes.data || []),
            typing: (typingRes.data || []).map((t) => t.user_id),
            reads: Object.fromEntries((readsRes.data || []).map((r) => [r.user_id, r.last_read_at])),
          };
        })()
      );
    }

    if (lists === "1") {
      jobs.push(
        (async () => {
          out.conversations = await loadConversations(me);
        })()
      );
    }

    jobs.push(
      (async () => {
        const { data: call } = await supabase
          .from("bean_calls")
          .select("id, conversation_id, caller_id, kind, status, created_at")
          .eq("callee_id", me.id)
          .eq("status", "ringing")
          .gte("created_at", new Date(now - RING_WINDOW_MS).toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (call) {
          const users = await loadUsers([call.caller_id]);
          out.incomingCall = {
            id: call.id,
            conversationId: call.conversation_id,
            kind: call.kind,
            status: call.status,
            peer: users.get(call.caller_id) || null,
            createdAt: call.created_at,
          };
        }
      })()
    );

    await Promise.all(jobs);
    return send(res, 200, out);
  },
  { methods: ["GET", "POST"], limit: [600, 60], name: "sync" }
);
