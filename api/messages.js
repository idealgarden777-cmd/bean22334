import { supabase, send, withUser, readBody, isMember } from "./_lib/session.js";

const MAX_LENGTH = 4000;

function shape(m) {
  return { id: m.id, senderId: m.sender_id, text: m.body, createdAt: m.created_at };
}

/* GET  /api/messages?conversationId=..&after=ISO  -> messages
 * POST /api/messages {conversationId, text}         -> send */
export default withUser(
  async (req, res, me) => {
    if (req.method === "GET") {
      const conversationId = String(req.query.conversationId || "");
      if (!conversationId) return send(res, 400, { error: "conversationId is required" });
      if (!(await isMember(conversationId, me.id))) return send(res, 403, { error: "Not allowed" });

      let query = supabase
        .from("bean_messages")
        .select("id, sender_id, body, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(200);

      if (req.query.after) query = query.gt("created_at", String(req.query.after));

      const { data, error } = await query;
      if (error) throw error;
      return send(res, 200, { messages: (data || []).map(shape) });
    }

    const { conversationId, text } = readBody(req);
    const body = String(text || "").trim();
    if (!conversationId || !body) return send(res, 400, { error: "Message is empty" });
    if (body.length > MAX_LENGTH) return send(res, 400, { error: "Message is too long" });
    if (!(await isMember(conversationId, me.id))) return send(res, 403, { error: "Not allowed" });

    const { data: message, error } = await supabase
      .from("bean_messages")
      .insert({ conversation_id: conversationId, sender_id: me.id, body })
      .select("id, sender_id, body, created_at")
      .single();
    if (error) throw error;

    await supabase
      .from("bean_conversations")
      .update({
        updated_at: message.created_at,
        last_message: body.slice(0, 140),
        last_sender_id: me.id,
      })
      .eq("id", conversationId);

    return send(res, 200, { message: shape(message) });
  },
  { methods: ["GET", "POST"] }
);
