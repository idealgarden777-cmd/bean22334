/* =========================================================
 * Bean end-to-end encryption: public keys + wrapped chat keys.
 *
 * The server only ever stores:
 *  - each user's PUBLIC key (ECDH P-256) and its fingerprint
 *  - the user's private key BACKUP, encrypted in the browser with their
 *    Chat Lock passphrase (Argon2id). The server never sees the passphrase.
 *  - per chat, per "epoch": the chat key wrapped (AES-GCM) for each member
 *    with an ECDH key only the sender + that member can derive.
 * Nothing here can decrypt a message.
 *
 * GET  /api/keys?scope=me                       -> { key }  my public key + encrypted backup
 * GET  /api/keys?users=id1,id2                  -> { keys: [...] } public keys
 * GET  /api/keys?scope=wraps                    -> { wraps } every chat key wrapped for me
 * GET  /api/keys?conversationId=X               -> { wraps, latest } for one chat
 * POST /api/keys {action:"publish", publicKey, fingerprint, backup, reset?}
 * POST /api/keys {action:"backup", backup}                  (Chat Lock changed)
 * POST /api/keys {action:"rekey", conversationId, epoch, senderPub, wraps:[{userId, recipientFp, wrapped}]}
 * ========================================================= */
import { supabase, send, withUser, readBody, fail, getMembership, chatInfo, rateLimit } from "./_lib/session.js";

const B64URL = /^[A-Za-z0-9_-]{43}$/;
const B64 = /^[A-Za-z0-9+/_=-]+$/;
const HEX64 = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f-]{36}$/i;

function cleanPub(pub) {
  if (!pub || pub.kty !== "EC" || pub.crv !== "P-256" || !B64URL.test(pub.x || "") || !B64URL.test(pub.y || "")) return null;
  return { kty: "EC", crv: "P-256", x: pub.x, y: pub.y };
}

function cleanBox(box, max = 400) {
  if (!box || typeof box.iv !== "string" || typeof box.ct !== "string") return null;
  if (!B64.test(box.iv) || !B64.test(box.ct) || box.iv.length > 32 || box.ct.length > max) return null;
  return { iv: box.iv, ct: box.ct };
}

function cleanBackup(b) {
  if (!b || b.v !== 1 || !b.kdf || typeof b.kdf !== "object") return null;
  const { alg, m, t, p, salt } = b.kdf;
  if (alg !== "argon2id" || !(m >= 19456 && m <= 1048576) || !(t >= 2 && t <= 20) || !(p >= 1 && p <= 8)) return null;
  if (typeof salt !== "string" || !B64.test(salt) || salt.length > 64) return null;
  const box = cleanBox(b, 1000);
  if (!box) return null;
  return { v: 1, kdf: { alg, m, t, p, salt }, ...box };
}

const shapeKey = (row) =>
  row && {
    userId: row.user_id,
    publicKey: row.public_key,
    fingerprint: row.fingerprint,
    keyVersion: row.key_version,
    updatedAt: row.updated_at,
  };

const shapeWrap = (w) => ({
  conversationId: w.conversation_id,
  epoch: w.epoch,
  senderId: w.sender_id,
  senderPub: w.sender_pub,
  recipientFp: w.recipient_fp,
  wrapped: w.wrapped,
});

async function latestEpoch(conversationId) {
  const { data, error } = await supabase
    .from("bean_chat_keys")
    .select("epoch")
    .eq("conversation_id", conversationId)
    .order("epoch", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.epoch || 0;
}

export default withUser(
  async (req, res, me) => {
    if (req.method === "GET") {
      const { scope, users, conversationId } = req.query;

      if (scope === "me") {
        const { data, error } = await supabase.from("bean_keys").select("*").eq("user_id", me.id).maybeSingle();
        if (error) throw error;
        return send(res, 200, { key: data ? { ...shapeKey(data), backup: data.backup } : null });
      }

      if (users) {
        const ids = String(users).split(",").filter((x) => UUID.test(x)).slice(0, 300);
        if (!ids.length) return send(res, 200, { keys: [] });
        const { data, error } = await supabase.from("bean_keys").select("user_id, public_key, fingerprint, key_version, updated_at").in("user_id", ids);
        if (error) throw error;
        return send(res, 200, { keys: (data || []).map(shapeKey) });
      }

      if (scope === "wraps") {
        const { data, error } = await supabase
          .from("bean_chat_keys")
          .select("conversation_id, epoch, sender_id, sender_pub, recipient_fp, wrapped")
          .eq("user_id", me.id)
          .order("created_at", { ascending: false })
          .limit(3000);
        if (error) throw error;
        return send(res, 200, { wraps: (data || []).map(shapeWrap) });
      }

      if (conversationId) {
        await getMembership(String(conversationId), me.id);
        const epoch = await latestEpoch(conversationId);
        const [mine, latest] = await Promise.all([
          supabase
            .from("bean_chat_keys")
            .select("conversation_id, epoch, sender_id, sender_pub, recipient_fp, wrapped")
            .eq("conversation_id", conversationId)
            .eq("user_id", me.id)
            .order("epoch", { ascending: false })
            .limit(500),
          epoch
            ? supabase.from("bean_chat_keys").select("user_id, recipient_fp").eq("conversation_id", conversationId).eq("epoch", epoch)
            : Promise.resolve({ data: [] }),
        ]);
        if (mine.error) throw mine.error;
        if (latest.error) throw latest.error;
        return send(res, 200, {
          wraps: (mine.data || []).map(shapeWrap),
          latest: { epoch, recipients: (latest.data || []).map((r) => ({ userId: r.user_id, fp: r.recipient_fp })) },
        });
      }
      fail(400, "Missing query");
    }

    const body = readBody(req);
    switch (body.action) {
      case "publish": {
        await rateLimit(`keys-publish:${me.id}`, 8, 3600);
        const publicKey = cleanPub(body.publicKey);
        const fingerprint = String(body.fingerprint || "");
        const backup = cleanBackup(body.backup);
        if (!publicKey || !HEX64.test(fingerprint) || !backup) fail(400, "Bad key data");
        const { data: existing } = await supabase.from("bean_keys").select("key_version").eq("user_id", me.id).maybeSingle();
        if (existing && !body.reset) fail(409, "Chat Lock already set up. Unlock it, or reset it.");
        const now = new Date().toISOString();
        const { error } = await supabase.from("bean_keys").upsert(
          {
            user_id: me.id,
            public_key: publicKey,
            fingerprint,
            backup,
            key_version: (existing?.key_version || 0) + 1,
            updated_at: now,
            ...(existing ? {} : { created_at: now }),
          },
          { onConflict: "user_id" }
        );
        if (error) throw error;
        return send(res, 200, { ok: true, keyVersion: (existing?.key_version || 0) + 1 });
      }

      case "backup": {
        await rateLimit(`keys-backup:${me.id}`, 10, 3600);
        const backup = cleanBackup(body.backup);
        if (!backup) fail(400, "Bad backup");
        const fingerprint = String(body.fingerprint || "");
        const { data: existing } = await supabase.from("bean_keys").select("fingerprint").eq("user_id", me.id).maybeSingle();
        if (!existing) fail(404, "No Chat Lock yet");
        if (existing.fingerprint !== fingerprint) fail(409, "Key changed on another device. Unlock again.");
        const { error } = await supabase.from("bean_keys").update({ backup, updated_at: new Date().toISOString() }).eq("user_id", me.id);
        if (error) throw error;
        return send(res, 200, { ok: true });
      }

      case "rekey": {
        const conversationId = String(body.conversationId || "");
        await getMembership(conversationId, me.id);
        await rateLimit(`rekey:${me.id}`, 60, 60);
        const chat = await chatInfo(conversationId);
        if (chat.plain) fail(400, "Neyo chat is not end-to-end encrypted");

        const epoch = Number(body.epoch);
        const senderPub = cleanPub(body.senderPub);
        if (!senderPub || !Number.isInteger(epoch) || epoch < 1) fail(400, "Bad key data");

        const [{ data: members, error: mErr }, { data: myKey }] = await Promise.all([
          supabase.from("bean_conversation_members").select("user_id").eq("conversation_id", conversationId),
          supabase.from("bean_keys").select("public_key").eq("user_id", me.id).maybeSingle(),
        ]);
        if (mErr) throw mErr;
        if (!myKey || myKey.public_key.x !== senderPub.x || myKey.public_key.y !== senderPub.y) fail(409, "Your key changed. Unlock Chat Lock again.");

        const memberIds = new Set((members || []).map((m) => m.user_id));
        const wraps = Array.isArray(body.wraps) ? body.wraps.slice(0, 300) : [];
        const wrapIds = new Set(wraps.map((w) => w.userId));
        if (wrapIds.size !== wraps.length || wrapIds.size !== memberIds.size || [...memberIds].some((id) => !wrapIds.has(id))) {
          fail(409, "Members changed. Try again.");
        }

        const { data: keys, error: kErr } = await supabase.from("bean_keys").select("user_id, fingerprint").in("user_id", [...memberIds]);
        if (kErr) throw kErr;
        const fpById = new Map((keys || []).map((k) => [k.user_id, k.fingerprint]));
        const rows = wraps.map((w) => {
          const wrapped = cleanBox(w.wrapped);
          if (!wrapped || !HEX64.test(String(w.recipientFp || ""))) fail(400, "Bad wrapped key");
          if (fpById.get(w.userId) !== w.recipientFp) fail(409, "A member's key changed. Try again.");
          return {
            conversation_id: conversationId,
            epoch,
            user_id: w.userId,
            sender_id: me.id,
            sender_pub: senderPub,
            recipient_fp: w.recipientFp,
            wrapped,
          };
        });

        const current = await latestEpoch(conversationId);
        if (epoch !== current + 1) fail(409, "Someone else just updated the chat key. Try again.");
        const { error } = await supabase.from("bean_chat_keys").insert(rows);
        if (error) {
          if (error.code === "23505") fail(409, "Someone else just updated the chat key. Try again.");
          throw error;
        }
        return send(res, 200, { ok: true, epoch });
      }

      default:
        fail(400, "Unknown action");
    }
  },
  { methods: ["GET", "POST"], limit: [120, 60], name: "keys" }
);
