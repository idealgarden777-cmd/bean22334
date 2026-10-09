/* =========================================================
 * Neyo Ghost = Delegated Presence 👻
 * When a user turns Ghost Mode on (Settings, or by telling Neyo),
 * Ghost handles their DIRECT messages while they are away:
 *  - simple, allowed messages  -> Ghost replies in the user's name,
 *    every reply marked "👻 Ghost"
 *  - money, promises, decisions, private info -> polite holding reply,
 *    queued for the user
 *  - urgent messages -> Neyo pings the user right away
 *  - when Ghost Mode goes off -> handoff report in the Neyo chat
 * Groups are never answered by Ghost.
 * ========================================================= */
import { supabase } from "./session.js";
import { insertMessage, notExpired } from "./chat.js";
import { NEYO_ID, neyoSay, neyoDmFor, geminiReady, ask } from "./neyo.js";

const MAX_NOTE = 500;
const MAX_HOURS = 72;

/* ---------- Ghost profile (stored in bean_settings) ---------- */

export async function ghostProfile(userId) {
  try {
    const { data, error } = await supabase.from("bean_settings").select("*").eq("user_id", userId).maybeSingle();
    if (!error && data) {
      return {
        ghostEnabled: Boolean(data.ghost_enabled),
        ghostNote: data.ghost_note || "",
        ghostSince: data.ghost_since || null,
        ghostUntil: data.ghost_until || null,
      };
    }
  } catch {}
  return { ghostEnabled: false, ghostNote: "", ghostSince: null, ghostUntil: null };
}

/* user ids -> Set of ids with Ghost Mode on (used to show "Away · Ghost" to others) */
export async function ghostFlags(ids) {
  const out = new Set();
  if (!ids?.length) return out;
  try {
    const { data, error } = await supabase.from("bean_settings").select("user_id, ghost_enabled").in("user_id", ids).eq("ghost_enabled", true);
    if (!error) for (const r of data || []) out.add(r.user_id);
  } catch {}
  return out;
}

/* Turn Ghost Mode on/off. Off => handoff report. me = { id, displayName } */
export async function setGhost(me, { enabled, note, hours }) {
  const current = await ghostProfile(me.id);
  const now = new Date().toISOString();
  const row = { user_id: me.id, updated_at: now };
  if (note !== undefined && note !== null) row.ghost_note = String(note).trim().slice(0, MAX_NOTE) || null;

  if (enabled) {
    row.ghost_enabled = true;
    if (!current.ghostEnabled) row.ghost_since = now;
    const h = Number(hours);
    if (hours !== undefined) row.ghost_until = h > 0 ? new Date(Date.now() + Math.min(h, MAX_HOURS) * 3600000).toISOString() : null;
  } else if (enabled === false) {
    row.ghost_enabled = false;
    row.ghost_until = null;
  }

  const { error } = await supabase.from("bean_settings").upsert(row, { onConflict: "user_id" });
  if (error) throw error;

  if (enabled === false && current.ghostEnabled) {
    await sendHandoff(me.id, current.ghostSince).catch((err) => console.error("Handoff failed:", err));
  } else if (enabled && !current.ghostEnabled) {
    await neyoSay(
      await neyoDmFor(me.id),
      `👻 Ghost Mode on. Main aap ke direct messages sambhal raha hun: simple baaton ka jawab dunga, zaroori cheezein aap ke liye rakh dunga.${
        row.ghost_until ? "" : " Wapas aa kar Ghost Mode off karein, handoff report mil jayegi."
      }`
    ).catch(() => {});
  }
  return ghostProfile(me.id);
}

/* ---------- handling one DM ---------- */

async function namesFor(ids) {
  const { data } = await supabase.from("bean_users").select("id, username, display_name").in("id", [...new Set(ids)]);
  return new Map((data || []).map((u) => [u.id, u.display_name || u.username]));
}

function cleanJson(text) {
  const s = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  try {
    return JSON.parse(s);
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (m) try { return JSON.parse(m[0]); } catch {}
  }
  return null;
}

function decisionPrompt(ownerName, note) {
  return `You are Neyo Ghost, the delegated presence of ${ownerName} inside Bean (a chat app). ${ownerName} is away and allowed you to handle simple direct messages for them.
Every reply you write is shown to the other person with a "👻 Ghost" label, so they know it's you, not ${ownerName}. Never pretend to be ${ownerName}.

${note ? `What ${ownerName} told you (you may share this): "${note}"` : `${ownerName} left no note. Say they are away and will see the message later.`}

Rules:
- Simple things (greetings, thanks, "kahan ho", "kab free ho", small talk, acknowledging info) -> short friendly reply, handled=true.
- Anything about money, payments, promises, agreeing to plans or meetings, decisions, passwords/codes, private or sensitive info, or anything you can't answer from the note -> do NOT decide or promise. Reply with a short holding message (e.g. "${ownerName} abhi available nahi, main unhe bata dunga 👍"), handled=false.
- Urgent (emergency, health, hard deadline today, "urgent", "jaldi") -> priority "high".
- If the latest messages need no reply (e.g. "ok", a sticker, an emoji) -> reply "" .
- Reply in the same language/script the person wrote in. Max 2 short sentences. No markdown.

Answer ONLY JSON: {"reply": "...", "handled": true|false, "priority": "high"|"normal"|"low", "summary": "what they want, max 12 words, in the person's language"}`;
}

/* Called right after someone sends a DM (and by the background sweep).
 * Safe to call many times: each incoming message is handled once. */
export async function handleGhostDm(conversationId) {
  const { data: conv } = await supabase.from("bean_conversations").select("id, type").eq("id", conversationId).maybeSingle();
  if (!conv || conv.type !== "dm") return { skipped: "not a dm" };
  const { data: members } = await supabase.from("bean_conversation_members").select("user_id").eq("conversation_id", conversationId);
  const ids = (members || []).map((m) => m.user_id);
  if (ids.length !== 2 || ids.includes(NEYO_ID)) return { skipped: "not a person dm" };

  const { data: rows } = await notExpired(
    supabase
      .from("bean_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20)
  );
  const recent = (rows || []).filter((r) => r.sender_id && !["system", "call"].includes(r.kind)).reverse();
  const last = recent[recent.length - 1];
  if (!last) return { skipped: "empty" };

  const ownerId = ids.find((id) => id !== last.sender_id);
  const peerId = last.sender_id;
  const profile = await ghostProfile(ownerId);
  if (!profile.ghostEnabled) return { skipped: "ghost off" };
  if (profile.ghostSince && new Date(last.created_at) < new Date(profile.ghostSince)) return { skipped: "older than ghost" };

  // claim this message (unique message_id) so it's handled exactly once
  const claim = await supabase
    .from("bean_ghost_log")
    .insert({ owner_id: ownerId, conversation_id: conversationId, from_user_id: peerId, message_id: last.id, status: "working" })
    .select("id")
    .single();
  if (claim.error) return { skipped: claim.error.code === "23505" ? "already handled" : claim.error.message };

  const names = await namesFor([ownerId, peerId]);
  const ownerName = names.get(ownerId) || "User";
  const peerName = names.get(peerId) || "Someone";

  // the new messages = everything from the peer after the owner's (or Ghost's) last message
  const lastOwnerIdx = recent.map((r) => r.sender_id).lastIndexOf(ownerId);
  const fresh = recent.slice(lastOwnerIdx + 1).filter((r) => r.sender_id === peerId);
  const line = (r) => `${r.sender_id === ownerId ? (r.ghost ? "Ghost" : ownerName) : peerName}: ${r.body || `[${r.kind}${r.attachment?.name ? " " + r.attachment.name : ""}]`}`;
  const freshText = fresh.map((r) => r.body || `[${r.kind}]`).join(" / ").slice(0, 300);

  // cost + spam guard: at most 8 AI decisions per chat per hour, then the plain away note
  const { count: recentAi } = await supabase
    .from("bean_ghost_log")
    .select("id", { head: true, count: "exact" })
    .eq("conversation_id", conversationId)
    .gt("created_at", new Date(Date.now() - 3600000).toISOString());
  let decision = null;
  if (geminiReady() && (recentAi || 0) <= 8) {
    try {
      decision = cleanJson(
        await ask(
          decisionPrompt(ownerName, profile.ghostNote),
          `Conversation (oldest first):\n${recent.map(line).join("\n")}\n\nNew messages from ${peerName} that need handling:\n${fresh.map(line).join("\n")}`,
          300,
          true
        )
      );
    } catch (err) {
      console.error("Ghost decision failed:", err);
    }
  }

  const ghostRepliedBefore = recent.some((r) => r.sender_id === ownerId && r.ghost && new Date(r.created_at) >= new Date(profile.ghostSince || 0));
  if (!decision) {
    // no AI: one polite away note per chat, everything queued
    decision = {
      reply: ghostRepliedBefore ? "" : profile.ghostNote ? `${ownerName} abhi available nahi: ${profile.ghostNote}` : `${ownerName} abhi available nahi. Message unhe mil jayega 👍`,
      handled: false,
      priority: /urgent|jaldi|emergency|asap|zaroori/i.test(freshText) ? "high" : "normal",
      summary: freshText.slice(0, 120),
    };
  }

  const reply = String(decision.reply || "").trim().slice(0, 600);
  const priority = ["high", "normal", "low"].includes(decision.priority) ? decision.priority : "normal";
  const handled = Boolean(decision.handled);

  if (reply) await insertMessage({ conversationId, senderId: ownerId, kind: "text", body: reply, ghost: true });

  await supabase
    .from("bean_ghost_log")
    .update({
      status: handled ? "handled" : "queued",
      priority,
      summary: String(decision.summary || freshText || "Message").slice(0, 200),
      incoming: freshText,
      ghost_reply: reply || null,
    })
    .eq("id", claim.data.id);

  if (priority === "high") {
    await neyoSay(await neyoDmFor(ownerId), `👻 Zaroori: ${peerName}: "${freshText.slice(0, 160)}"${reply ? `\nGhost ne kaha: "${reply}"` : ""}`).catch(() => {});
  }
  return { ok: true, replied: Boolean(reply), handled, priority };
}

/* ---------- handoff report ---------- */

function awayFor(sinceIso) {
  if (!sinceIso) return "";
  const mins = Math.max(1, Math.round((Date.now() - new Date(sinceIso).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  return h ? `${h} ghante${mins % 60 ? ` ${mins % 60} min` : ""}` : `${mins} min`;
}

export async function handoffText(ownerId, sinceIso) {
  let q = supabase
    .from("bean_ghost_log")
    .select("*")
    .eq("owner_id", ownerId)
    .is("reported_at", null)
    .neq("status", "working")
    .order("created_at", { ascending: true })
    .limit(60);
  if (sinceIso) q = q.gte("created_at", sinceIso);
  const { data: rows } = await q;
  const list = rows || [];
  const away = awayFor(sinceIso);
  if (!list.length) return { text: `👻 Handoff report${away ? ` (${away})` : ""}\nAap ke away rehne mein koi direct message nahi aaya.`, ids: [] };

  const names = await namesFor(list.map((r) => r.from_user_id));
  const who = (r) => names.get(r.from_user_id) || "Someone";
  const urgent = list.filter((r) => r.priority === "high");
  const queued = list.filter((r) => r.priority !== "high" && r.status === "queued");
  const handled = list.filter((r) => r.priority !== "high" && r.status === "handled");
  const people = new Set(list.map((r) => r.from_user_id)).size;

  const out = [`👻 Handoff report${away ? ` (${away})` : ""}`, `${people} logon ke ${list.length} messages aaye. ${handled.length} Ghost ne sambhal liye, ${urgent.length + queued.length} aap ke liye.`];
  const section = (title, items, withReply) => {
    if (!items.length) return;
    out.push("", title);
    for (const r of items.slice(0, 8)) out.push(`• ${who(r)}: ${r.summary || r.incoming || "message"}${withReply && r.ghost_reply ? ` (Ghost: "${r.ghost_reply.slice(0, 60)}")` : ""}`);
    if (items.length > 8) out.push(`• +${items.length - 8} aur`);
  };
  section("🔴 Zaroori", urgent, false);
  section("🟡 Aap ka jawab chahiye", queued, false);
  section("✅ Ghost ne jawab de diya", handled, true);
  return { text: out.join("\n").slice(0, 1990), ids: list.map((r) => r.id) };
}

export async function sendHandoff(ownerId, sinceIso) {
  const { text, ids } = await handoffText(ownerId, sinceIso);
  await neyoSay(await neyoDmFor(ownerId), text);
  if (ids.length) await supabase.from("bean_ghost_log").update({ reported_at: new Date().toISOString() }).in("id", ids);
  return { ok: true, items: ids.length };
}

/* ---------- background sweep (runs with every Neyo tick) ---------- */

export async function ghostSweep() {
  const done = { ghostUsers: 0, ghostChecked: 0, ghostEnded: 0 };
  let users = [];
  try {
    const { data, error } = await supabase.from("bean_settings").select("user_id, ghost_since, ghost_until").eq("ghost_enabled", true).limit(50);
    if (error) return done; // columns not created yet
    users = data || [];
  } catch {
    return done;
  }
  for (const u of users) {
    try {
      done.ghostUsers++;
      if (u.ghost_until && new Date(u.ghost_until) <= new Date()) {
        await setGhost({ id: u.user_id }, { enabled: false });
        done.ghostEnded++;
        continue;
      }
      const { data: mine } = await supabase.from("bean_conversation_members").select("conversation_id").eq("user_id", u.user_id);
      const ids = (mine || []).map((m) => m.conversation_id);
      if (!ids.length) continue;
      let q = supabase.from("bean_conversations").select("id, last_sender_id").in("id", ids).eq("type", "dm").neq("last_sender_id", u.user_id);
      if (u.ghost_since) q = q.gt("updated_at", u.ghost_since);
      const { data: convs } = await q.limit(20);
      for (const c of convs || []) {
        if (c.last_sender_id === NEYO_ID) continue;
        done.ghostChecked++;
        await handleGhostDm(c.id);
      }
    } catch (err) {
      console.error("Ghost sweep failed:", u.user_id, err);
    }
  }
  return done;
}
