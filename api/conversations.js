import { supabase, send, withUser, readBody, publicUser } from "./_lib/session.js";

async function loadConversations(me) {
  const { data: mine, error } = await supabase
    .from("bean_conversation_members")
    .select("conversation_id")
    .eq("user_id", me.id);
  if (error) throw error;

  const ids = (mine || []).map((m) => m.conversation_id);
  if (!ids.length) return [];

  const [{ data: convs, error: e1 }, { data: others, error: e2 }] = await Promise.all([
    supabase
      .from("bean_conversations")
      .select("id, updated_at, last_message, last_sender_id")
      .in("id", ids),
    supabase
      .from("bean_conversation_members")
      .select("conversation_id, user_id")
      .in("conversation_id", ids)
      .neq("user_id", me.id),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const otherIds = [...new Set((others || []).map((o) => o.user_id))];
  let users = [];
  if (otherIds.length) {
    const { data, error: e3 } = await supabase
      .from("bean_users")
      .select("id, username, display_name, status")
      .in("id", otherIds);
    if (e3) throw e3;
    users = data || [];
  }
  const userById = new Map(users.map((u) => [u.id, publicUser(u)]));
  const otherByConv = new Map((others || []).map((o) => [o.conversation_id, userById.get(o.user_id)]));

  return (convs || [])
    .map((c) => ({
      id: c.id,
      updatedAt: c.updated_at,
      lastMessage: c.last_message || "",
      lastSenderId: c.last_sender_id,
      contact: otherByConv.get(c.id) || null,
    }))
    .filter((c) => c.contact)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

/* GET  /api/conversations            -> my chats
 * POST /api/conversations {username} -> open (or create) a 1:1 chat */
export default withUser(
  async (req, res, me) => {
    if (req.method === "GET") {
      return send(res, 200, { conversations: await loadConversations(me) });
    }

    const { username } = readBody(req);
    const clean = String(username || "").toLowerCase().replace(/@bean$/, "").trim();
    if (!clean) return send(res, 400, { error: "Username is required" });

    const { data: other, error } = await supabase
      .from("bean_users")
      .select("id, username, display_name, status")
      .eq("username", clean)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw error;
    if (!other) return send(res, 404, { error: "No Bean ID found" });
    if (other.id === me.id) return send(res, 400, { error: "You can't chat with yourself" });

    const dmKey = [me.id, other.id].sort().join(":");

    let { data: conv, error: findErr } = await supabase
      .from("bean_conversations")
      .select("id, updated_at, last_message, last_sender_id")
      .eq("dm_key", dmKey)
      .maybeSingle();
    if (findErr) throw findErr;

    if (!conv) {
      const { data: created, error: createErr } = await supabase
        .from("bean_conversations")
        .insert({ dm_key: dmKey })
        .select("id, updated_at, last_message, last_sender_id")
        .single();
      if (createErr) throw createErr;
      conv = created;

      const { error: memberErr } = await supabase.from("bean_conversation_members").insert([
        { conversation_id: conv.id, user_id: me.id },
        { conversation_id: conv.id, user_id: other.id },
      ]);
      if (memberErr) throw memberErr;
    }

    return send(res, 200, {
      conversation: {
        id: conv.id,
        updatedAt: conv.updated_at,
        lastMessage: conv.last_message || "",
        lastSenderId: conv.last_sender_id,
        contact: publicUser(other),
      },
    });
  },
  { methods: ["GET", "POST"] }
);
