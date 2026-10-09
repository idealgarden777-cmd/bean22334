import {
  supabase, send, withUser, readBody, fail, getMembership, findUsersByUsernames, cleanUsername,
} from "./_lib/session.js";
import { loadConversations, systemMessage } from "./_lib/chat.js";

const MAX_GROUP = 256;

async function one(me, id) {
  const [conv] = await loadConversations(me, [id]);
  return conv;
}

async function openDm(me, username) {
  const clean = cleanUsername(username);
  if (!clean) fail(400, "Enter a Bean ID");
  const [other] = await findUsersByUsernames([clean]);
  if (!other) fail(404, `No Bean ID called ${clean}@bean`);
  if (other.id === me.id) fail(400, "That's your own Bean ID");

  const dmKey = [me.id, other.id].sort().join(":");
  let { data: conv, error } = await supabase.from("bean_conversations").select("id").eq("dm_key", dmKey).maybeSingle();
  if (error) throw error;

  if (!conv) {
    const created = await supabase
      .from("bean_conversations")
      .insert({ type: "dm", dm_key: dmKey, created_by: me.id })
      .select("id")
      .single();
    if (created.error) {
      // someone else created it at the same moment
      const again = await supabase.from("bean_conversations").select("id").eq("dm_key", dmKey).single();
      if (again.error) throw created.error;
      conv = again.data;
    } else {
      conv = created.data;
      const { error: mErr } = await supabase.from("bean_conversation_members").insert([
        { conversation_id: conv.id, user_id: me.id, role: "admin" },
        { conversation_id: conv.id, user_id: other.id, role: "admin" },
      ]);
      if (mErr) throw mErr;
    }
  }
  return one(me, conv.id);
}

async function createGroup(me, title, usernames) {
  const name = String(title || "").trim().slice(0, 60);
  if (!name) fail(400, "Give the group a name");
  const users = (await findUsersByUsernames(usernames)).filter((u) => u.id !== me.id);
  if (!users.length) fail(400, "Add at least one Bean ID");
  if (users.length + 1 > MAX_GROUP) fail(400, "Too many members");

  const { data: conv, error } = await supabase
    .from("bean_conversations")
    .insert({ type: "group", title: name, created_by: me.id })
    .select("id")
    .single();
  if (error) throw error;

  const { error: mErr } = await supabase.from("bean_conversation_members").insert([
    { conversation_id: conv.id, user_id: me.id, role: "admin" },
    ...users.map((u) => ({ conversation_id: conv.id, user_id: u.id, role: "member" })),
  ]);
  if (mErr) throw mErr;

  await systemMessage(conv.id, `${me.displayName} created "${name}"`, me.id);
  return one(me, conv.id);
}

async function requireGroupAdmin(conversationId, me) {
  const membership = await getMembership(conversationId, me.id);
  const { data: conv, error } = await supabase.from("bean_conversations").select("type").eq("id", conversationId).single();
  if (error) throw error;
  if (conv.type !== "group") fail(400, "Only groups can do that");
  if (membership.role !== "admin") fail(403, "Only group admins can do that");
}

/* GET  /api/conversations                     -> my chats
 * POST /api/conversations {action, ...}       -> open_dm | create_group | rename | add_members
 *                                                remove_member | leave | mute | read            */
export default withUser(
  async (req, res, me) => {
    if (req.method === "GET") return send(res, 200, { conversations: await loadConversations(me) });

    const body = readBody(req);
    const { action, conversationId } = body;

    switch (action) {
      case "open_dm":
        return send(res, 200, { conversation: await openDm(me, body.username) });

      case "create_group":
        return send(res, 200, { conversation: await createGroup(me, body.title, body.usernames) });

      case "rename": {
        await requireGroupAdmin(conversationId, me);
        const title = String(body.title || "").trim().slice(0, 60);
        if (!title) fail(400, "Name can't be empty");
        await supabase.from("bean_conversations").update({ title }).eq("id", conversationId);
        await systemMessage(conversationId, `${me.displayName} renamed the group to "${title}"`, me.id);
        return send(res, 200, { conversation: await one(me, conversationId) });
      }

      case "add_members": {
        await requireGroupAdmin(conversationId, me);
        const users = await findUsersByUsernames(body.usernames);
        if (!users.length) fail(404, "No matching Bean IDs");
        const { error } = await supabase
          .from("bean_conversation_members")
          .upsert(users.map((u) => ({ conversation_id: conversationId, user_id: u.id, role: "member" })), {
            onConflict: "conversation_id,user_id",
            ignoreDuplicates: true,
          });
        if (error) throw error;
        await systemMessage(
          conversationId,
          `${me.displayName} added ${users.map((u) => u.display_name || u.username).join(", ")}`,
          me.id
        );
        return send(res, 200, { conversation: await one(me, conversationId) });
      }

      case "remove_member": {
        await requireGroupAdmin(conversationId, me);
        if (body.userId === me.id) fail(400, "Use Leave group instead");
        const { data: removed } = await supabase.from("bean_users").select("username, display_name").eq("id", body.userId).maybeSingle();
        await supabase.from("bean_conversation_members").delete().eq("conversation_id", conversationId).eq("user_id", body.userId);
        await systemMessage(conversationId, `${me.displayName} removed ${removed?.display_name || removed?.username || "a member"}`, me.id);
        return send(res, 200, { conversation: await one(me, conversationId) });
      }

      case "leave": {
        const membership = await getMembership(conversationId, me.id);
        const { data: conv } = await supabase.from("bean_conversations").select("type").eq("id", conversationId).single();
        if (conv?.type !== "group") fail(400, "You can only leave groups");
        await supabase.from("bean_conversation_members").delete().eq("conversation_id", conversationId).eq("user_id", me.id);
        await systemMessage(conversationId, `${me.displayName} left`, null);
        if (membership.role === "admin") {
          // hand admin to the longest-standing member if no admin is left
          const { data: rest } = await supabase
            .from("bean_conversation_members")
            .select("user_id, role, joined_at")
            .eq("conversation_id", conversationId)
            .order("joined_at", { ascending: true });
          if (rest?.length && !rest.some((m) => m.role === "admin")) {
            await supabase
              .from("bean_conversation_members")
              .update({ role: "admin" })
              .eq("conversation_id", conversationId)
              .eq("user_id", rest[0].user_id);
          }
        }
        return send(res, 200, { success: true });
      }

      case "mute": {
        await getMembership(conversationId, me.id);
        await supabase
          .from("bean_conversation_members")
          .update({ muted: Boolean(body.muted) })
          .eq("conversation_id", conversationId)
          .eq("user_id", me.id);
        return send(res, 200, { success: true });
      }

      case "read": {
        await supabase
          .from("bean_conversation_members")
          .update({ last_read_at: new Date().toISOString() })
          .eq("conversation_id", conversationId)
          .eq("user_id", me.id);
        return send(res, 200, { success: true });
      }

      default:
        fail(400, "Unknown action");
    }
  },
  { methods: ["GET", "POST"], limit: [60, 60], name: "conv" }
);
