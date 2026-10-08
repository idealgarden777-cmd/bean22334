/* Shared chat logic: shaping messages and conversations. */
import { supabase, publicUser, MEDIA_BUCKET, getAvatars } from "./session.js";
import { ghostFlags } from "./ghost.js";

const SIGNED_URL_TTL = 60 * 60 * 6; // 6 hours

export function previewFor(kind, body, attachment) {
  if (kind === "image") return body ? `📷 ${body}` : "📷 Photo";
  if (kind === "audio") return "🎤 Voice message";
  if (kind === "file") return `📎 ${attachment?.name || "File"}`;
  return (body || "").slice(0, 140);
}

/* Hide messages whose disappearing timer ran out. */
export const notExpired = (query) => query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

export async function insertMessage({ conversationId, senderId, kind = "text", body = null, attachment = null, replyTo = null, expiresAt = null, ghost = false }) {
  const row = { conversation_id: conversationId, sender_id: senderId, kind, body, attachment, reply_to: replyTo };
  if (expiresAt) row.expires_at = expiresAt;
  if (ghost) row.ghost = true;
  const { data: message, error } = await supabase
    .from("bean_messages")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;

  await supabase
    .from("bean_conversations")
    .update({
      updated_at: message.created_at,
      last_message: previewFor(kind, body, attachment),
      last_sender_id: senderId,
      last_message_id: message.id,
    })
    .eq("id", conversationId);

  return message;
}

export const systemMessage = (conversationId, body, senderId = null) =>
  insertMessage({ conversationId, senderId, kind: "system", body });

export async function loadUsers(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const [{ data: users, error: e1 }, { data: presence, error: e2 }, avatars, ghosts] = await Promise.all([
    supabase.from("bean_users").select("id, username, display_name, status").in("id", unique),
    supabase.from("bean_presence").select("user_id, last_seen_at").in("user_id", unique),
    getAvatars(unique),
    ghostFlags(unique),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const presenceById = new Map((presence || []).map((p) => [p.user_id, p]));
  return new Map((users || []).map((u) => [u.id, { ...publicUser(u, presenceById.get(u.id), avatars.get(u.id)), ...(ghosts.has(u.id) ? { ghost: true } : {}) }]));
}

/* Rows from bean_messages -> client messages with replies, reactions, signed media URLs. */
export async function hydrateMessages(rows) {
  if (!rows?.length) return [];
  const ids = rows.map((r) => r.id);
  const replyIds = [...new Set(rows.map((r) => r.reply_to).filter(Boolean))];
  const paths = [...new Set(rows.filter((r) => !r.deleted_at && r.attachment?.path).map((r) => r.attachment.path))];

  const [reactionsRes, repliesRes, signedRes] = await Promise.all([
    supabase.from("bean_reactions").select("message_id, user_id, emoji").in("message_id", ids),
    replyIds.length
      ? supabase.from("bean_messages").select("id, sender_id, kind, body, attachment, deleted_at").in("id", replyIds)
      : Promise.resolve({ data: [] }),
    paths.length
      ? supabase.storage.from(MEDIA_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL)
      : Promise.resolve({ data: [] }),
  ]);
  if (reactionsRes.error) throw reactionsRes.error;
  if (repliesRes.error) throw repliesRes.error;

  const urlByPath = new Map((signedRes.data || []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));
  const repliesById = new Map((repliesRes.data || []).map((r) => [r.id, r]));
  const reactionsByMsg = new Map();
  for (const r of reactionsRes.data || []) {
    const list = reactionsByMsg.get(r.message_id) || [];
    list.push(r);
    reactionsByMsg.set(r.message_id, list);
  }

  return rows.map((r) => {
    const deleted = Boolean(r.deleted_at);
    const reply = r.reply_to ? repliesById.get(r.reply_to) : null;
    const grouped = {};
    for (const x of reactionsByMsg.get(r.id) || []) (grouped[x.emoji] ||= []).push(x.user_id);

    return {
      id: r.id,
      conversationId: r.conversation_id,
      senderId: r.sender_id,
      kind: deleted ? "text" : r.kind,
      text: deleted ? "" : r.body || "",
      attachment:
        !deleted && r.attachment
          ? {
              url: urlByPath.get(r.attachment.path) || null,
              name: r.attachment.name,
              size: r.attachment.size,
              mime: r.attachment.mime,
              duration: r.attachment.duration || null,
            }
          : null,
      replyTo: reply
        ? {
            id: reply.id,
            senderId: reply.sender_id,
            kind: reply.kind,
            text: reply.deleted_at ? "Message deleted" : previewFor(reply.kind, reply.body, reply.attachment),
          }
        : null,
      reactions: deleted ? [] : Object.entries(grouped).map(([emoji, userIds]) => ({ emoji, userIds })),
      expiresAt: r.expires_at || null,
      ghost: Boolean(r.ghost) && !deleted,
      editedAt: r.edited_at,
      deletedAt: r.deleted_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
}

export async function loadConversations(me, onlyIds = null) {
  let mineQuery = supabase
    .from("bean_conversation_members")
    .select("conversation_id, role, last_read_at, muted")
    .eq("user_id", me.id);
  if (onlyIds) mineQuery = mineQuery.in("conversation_id", onlyIds);
  const { data: mine, error } = await mineQuery;
  if (error) throw error;

  const ids = (mine || []).map((m) => m.conversation_id);
  if (!ids.length) return [];

  const [convRes, memberRes, unreadRes] = await Promise.all([
    supabase
      .from("bean_conversations")
      .select("id, type, title, created_by, last_message, last_sender_id, created_at, updated_at")
      .in("id", ids),
    supabase.from("bean_conversation_members").select("conversation_id, user_id, role, last_read_at").in("conversation_id", ids),
    supabase.rpc("bean_unread_counts", { p_user: me.id }),
  ]);
  if (convRes.error) throw convRes.error;
  if (memberRes.error) throw memberRes.error;
  if (unreadRes.error) throw unreadRes.error;

  const users = await loadUsers((memberRes.data || []).map((m) => m.user_id));
  const mineById = new Map(mine.map((m) => [m.conversation_id, m]));
  const unreadById = new Map((unreadRes.data || []).map((u) => [u.conversation_id, Number(u.unread)]));
  const membersByConv = new Map();
  for (const m of memberRes.data || []) {
    const list = membersByConv.get(m.conversation_id) || [];
    const user = users.get(m.user_id);
    if (user) list.push({ ...user, role: m.role, lastReadAt: m.last_read_at });
    membersByConv.set(m.conversation_id, list);
  }

  return (convRes.data || [])
    .map((c) => {
      const members = membersByConv.get(c.id) || [];
      const others = members.filter((m) => m.id !== me.id);
      const my = mineById.get(c.id);
      const peer = c.type === "dm" ? others[0] || null : null;
      return {
        id: c.id,
        type: c.type,
        title: c.type === "group" ? c.title || "Group" : peer?.displayName || "Bean user",
        members,
        peer,
        myRole: my?.role || "member",
        muted: Boolean(my?.muted),
        unread: unreadById.get(c.id) || 0,
        lastMessage: c.last_message || "",
        lastSenderId: c.last_sender_id,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      };
    })
    .filter((c) => c.type === "group" || c.peer)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}
