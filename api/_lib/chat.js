/* Shared chat logic: shaping messages and conversations. */
import { supabase, publicUser, MEDIA_BUCKET, getAvatars, NEYO_ID } from "./session.js";
import { awayStatus } from "./ghost.js";

const SIGNED_URL_TTL = 60 * 60 * 6; // 6 hours

export const ENC_PREVIEW = "🔒 Encrypted message";

/* Shape check for an end-to-end encrypted payload ({v, e, iv, ct}, all base64).
 * The server never sees keys; it only stores this blob. */
export function cleanEnc(enc, maxCt = 60000) {
  if (!enc || typeof enc !== "object") return null;
  const b64 = /^[A-Za-z0-9+/_=-]+$/;
  const e = Number(enc.e);
  if (enc.v !== 1 || !Number.isInteger(e) || e < 1 || e > 1e9) return null;
  if (typeof enc.iv !== "string" || enc.iv.length < 12 || enc.iv.length > 32 || !b64.test(enc.iv)) return null;
  if (typeof enc.ct !== "string" || enc.ct.length < 16 || enc.ct.length > maxCt || !b64.test(enc.ct)) return null;
  return { v: 1, e, iv: enc.iv, ct: enc.ct };
}

export function previewFor(kind, body, attachment, enc) {
  if (enc) return ENC_PREVIEW;
  if (kind === "image") return body ? `📷 ${body}` : "📷 Photo";
  if (kind === "audio") return "🎤 Voice message";
  if (kind === "file") return `📎 ${attachment?.name || "File"}`;
  return (body || "").slice(0, 140);
}

/* Hide messages whose disappearing timer ran out. */
export const notExpired = (query) => query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

export async function insertMessage({ conversationId, senderId, kind = "text", body = null, attachment = null, replyTo = null, expiresAt = null, ghost = false, enc = null }) {
  const row = { conversation_id: conversationId, sender_id: senderId, kind, body, attachment, reply_to: replyTo };
  if (enc) row.enc = enc;
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
      last_message: previewFor(kind, body, attachment, enc),
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
  const [{ data: users, error: e1 }, { data: presence, error: e2 }, avatars, away] = await Promise.all([
    supabase.from("bean_users").select("id, username, display_name, status").in("id", unique),
    supabase.from("bean_presence").select("user_id, last_seen_at").in("user_id", unique),
    getAvatars(unique),
    awayStatus(unique),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const presenceById = new Map((presence || []).map((p) => [p.user_id, p]));
  return new Map((users || []).map((u) => [u.id, { ...publicUser(u, presenceById.get(u.id), avatars.get(u.id)), ...(away.has(u.id) ? { ghost: true, away: away.get(u.id) } : {}) }]));
}

/* Rows from bean_messages -> client messages with replies, reactions, signed media URLs. */
export async function hydrateMessages(rows) {
  if (!rows?.length) return [];
  const ids = rows.map((r) => r.id);
  const replyIds = [...new Set(rows.map((r) => r.reply_to).filter(Boolean))];
  const paths = [...new Set(rows.filter((r) => !r.deleted_at && r.attachment?.path).map((r) => r.attachment.path))];

  const [reactionsRes, repliesRes, signedRes] = await Promise.all([
    supabase.from("bean_reactions").select("*").in("message_id", ids),
    replyIds.length
      ? supabase.from("bean_messages").select("id, conversation_id, sender_id, kind, body, attachment, deleted_at, enc").in("id", replyIds)
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
  const encReactionsByMsg = new Map();
  for (const r of reactionsRes.data || []) {
    if (r.enc) {
      const list = encReactionsByMsg.get(r.message_id) || [];
      list.push({ userId: r.user_id, enc: r.enc });
      encReactionsByMsg.set(r.message_id, list);
      continue;
    }
    const list = reactionsByMsg.get(r.message_id) || [];
    list.push(r);
    reactionsByMsg.set(r.message_id, list);
  }

  return rows.map((r) => {
    const deleted = Boolean(r.deleted_at);
    const reply = r.reply_to ? repliesById.get(r.reply_to) : null;
    const grouped = {};
    for (const x of reactionsByMsg.get(r.id) || []) (grouped[x.emoji] ||= []).push(x.user_id);

    const enc = !deleted && r.enc ? r.enc : null;
    return {
      id: r.id,
      conversationId: r.conversation_id,
      senderId: r.sender_id,
      kind: deleted ? "text" : r.kind,
      text: deleted || enc ? "" : r.body || "",
      enc,
      encrypted: Boolean(enc),
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
            text: reply.deleted_at ? "Message deleted" : previewFor(reply.kind, reply.body, reply.attachment, reply.enc),
            enc: !reply.deleted_at && reply.enc ? reply.enc : null,
          }
        : null,
      reactions: deleted ? [] : Object.entries(grouped).map(([emoji, userIds]) => ({ emoji, userIds })),
      encReactions: deleted ? [] : encReactionsByMsg.get(r.id) || [],
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
      .select("id, type, title, dm_key, created_by, last_message, last_sender_id, last_message_id, created_at, updated_at")
      .in("id", ids),
    supabase.from("bean_conversation_members").select("conversation_id, user_id, role, last_read_at").in("conversation_id", ids),
    supabase.rpc("bean_unread_counts", { p_user: me.id }),
  ]);
  if (convRes.error) throw convRes.error;
  if (memberRes.error) throw memberRes.error;
  if (unreadRes.error) throw unreadRes.error;

  const encLastIds = (convRes.data || []).filter((c) => c.last_message === ENC_PREVIEW && c.last_message_id).map((c) => c.last_message_id);
  const [users, encLast] = await Promise.all([
    loadUsers((memberRes.data || []).map((m) => m.user_id)),
    encLastIds.length
      ? supabase.from("bean_messages").select("id, sender_id, enc, deleted_at").in("id", encLastIds).then((r) => r.data || [])
      : Promise.resolve([]),
  ]);
  const encLastById = new Map(encLast.filter((m) => m.enc && !m.deleted_at).map((m) => [m.id, m]));
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
        lastEnc: encLastById.has(c.last_message_id) ? { id: c.last_message_id, senderId: c.last_sender_id, enc: encLastById.get(c.last_message_id).enc } : null,
        e2ee: !(c.type === "dm" && String(c.dm_key || "").includes(NEYO_ID)),
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      };
    })
    .filter((c) => c.type === "group" || c.peer)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}
