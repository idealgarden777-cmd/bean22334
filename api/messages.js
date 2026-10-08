import { supabase, send, withUser, readBody, fail, getMembership } from "./_lib/session.js";
import { hydrateMessages, insertMessage } from "./_lib/chat.js";

const PAGE = 50;
const MAX_TEXT = 4000;
const EMOJI_OK = /^[\p{Extended_Pictographic}\u200d\ufe0f\u{1F3FB}-\u{1F3FF}]{1,8}$/u;

function kindForMime(mime) {
  if (String(mime).startsWith("image/")) return "image";
  if (String(mime).startsWith("audio/")) return "audio";
  return "file";
}

async function ownMessage(messageId, me) {
  const { data: msg, error } = await supabase.from("bean_messages").select("*").eq("id", messageId).maybeSingle();
  if (error) throw error;
  if (!msg) fail(404, "Message not found");
  await getMembership(msg.conversation_id, me.id);
  return msg;
}

async function touchConversationPreview(msg, text) {
  await supabase
    .from("bean_conversations")
    .update({ last_message: text })
    .eq("id", msg.conversation_id)
    .eq("last_message_id", msg.id);
}

/* GET  /api/messages?conversationId=..&before=ISO  -> history page (newest 50 before cursor)
 * POST /api/messages {action:"send"|"edit"|"delete"|"react", ...}                         */
export default withUser(
  async (req, res, me) => {
    if (req.method === "GET") {
      const conversationId = String(req.query.conversationId || "");
      await getMembership(conversationId, me.id);

      let query = supabase
        .from("bean_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(PAGE + 1);
      if (req.query.before) query = query.lt("created_at", String(req.query.before));

      const { data, error } = await query;
      if (error) throw error;
      const rows = (data || []).slice(0, PAGE).reverse();
      return send(res, 200, { messages: await hydrateMessages(rows), hasMore: (data || []).length > PAGE });
    }

    const body = readBody(req);

    switch (body.action || "send") {
      case "send": {
        const { conversationId, replyTo, clientId } = body;
        await getMembership(conversationId, me.id);
        const text = String(body.text || "").trim();
        if (text.length > MAX_TEXT) fail(400, "Message is too long");

        let attachment = null;
        if (body.attachment) {
          const a = body.attachment;
          if (typeof a.path !== "string" || !a.path.startsWith(`${conversationId}/`)) fail(400, "Bad attachment");
          attachment = {
            path: a.path,
            name: String(a.name || "file").slice(0, 200),
            size: Number(a.size) || 0,
            mime: String(a.mime || "application/octet-stream").slice(0, 100),
            duration: a.duration ? Number(a.duration) : null,
          };
        }
        if (!text && !attachment) fail(400, "Message is empty");

        if (replyTo) {
          const { data: parent } = await supabase.from("bean_messages").select("conversation_id").eq("id", replyTo).maybeSingle();
          if (!parent || parent.conversation_id !== conversationId) fail(400, "Can't reply to that message");
        }

        const row = await insertMessage({
          conversationId,
          senderId: me.id,
          kind: attachment ? kindForMime(attachment.mime) : "text",
          body: text || null,
          attachment,
          replyTo: replyTo || null,
        });

        await supabase
          .from("bean_conversation_members")
          .update({ last_read_at: row.created_at })
          .eq("conversation_id", conversationId)
          .eq("user_id", me.id);
        await supabase.from("bean_presence").upsert({ user_id: me.id, last_seen_at: new Date().toISOString(), typing_in: null, typing_at: null });

        const [message] = await hydrateMessages([row]);
        return send(res, 200, { message, clientId });
      }

      case "edit": {
        const msg = await ownMessage(body.messageId, me);
        if (msg.sender_id !== me.id) fail(403, "You can only edit your own messages");
        if (msg.deleted_at || msg.kind !== "text") fail(400, "This message can't be edited");
        const text = String(body.text || "").trim();
        if (!text) fail(400, "Message is empty");
        if (text.length > MAX_TEXT) fail(400, "Message is too long");
        const now = new Date().toISOString();
        const { data: row, error } = await supabase
          .from("bean_messages")
          .update({ body: text, edited_at: now, updated_at: now })
          .eq("id", msg.id)
          .select("*")
          .single();
        if (error) throw error;
        await touchConversationPreview(msg, text.slice(0, 140));
        const [message] = await hydrateMessages([row]);
        return send(res, 200, { message });
      }

      case "delete": {
        const msg = await ownMessage(body.messageId, me);
        if (msg.sender_id !== me.id) fail(403, "You can only delete your own messages");
        const now = new Date().toISOString();
        const { data: row, error } = await supabase
          .from("bean_messages")
          .update({ body: null, attachment: null, deleted_at: now, updated_at: now })
          .eq("id", msg.id)
          .select("*")
          .single();
        if (error) throw error;
        if (msg.attachment?.path) await supabase.storage.from("bean-media").remove([msg.attachment.path]);
        await supabase.from("bean_reactions").delete().eq("message_id", msg.id);
        await touchConversationPreview(msg, "Message deleted");
        const [message] = await hydrateMessages([row]);
        return send(res, 200, { message });
      }

      case "react": {
        const msg = await ownMessage(body.messageId, me);
        if (msg.deleted_at) fail(400, "Message was deleted");
        const emoji = String(body.emoji || "");
        if (!EMOJI_OK.test(emoji)) fail(400, "Unsupported reaction");

        const { data: existing } = await supabase
          .from("bean_reactions")
          .select("emoji")
          .eq("message_id", msg.id)
          .eq("user_id", me.id)
          .maybeSingle();

        if (existing?.emoji === emoji) {
          await supabase.from("bean_reactions").delete().eq("message_id", msg.id).eq("user_id", me.id);
        } else {
          await supabase.from("bean_reactions").upsert({ message_id: msg.id, user_id: me.id, emoji });
        }
        const { data: row } = await supabase
          .from("bean_messages")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", msg.id)
          .select("*")
          .single();
        const [message] = await hydrateMessages([row]);
        return send(res, 200, { message });
      }

      default:
        fail(400, "Unknown action");
    }
  },
  { methods: ["GET", "POST"] }
);
