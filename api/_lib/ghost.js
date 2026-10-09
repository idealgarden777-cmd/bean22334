/* =========================================================
 * Ghost = Away Mode 👻 (v2, end-to-end encrypted Bean)
 *
 * Chats are end-to-end encrypted, so the server (and Neyo) can
 * NOT read them. Ghost therefore never reads or answers messages.
 * It does three simple, fast, non-AI things:
 *  1. Shows contacts that you are away, with your own short note
 *     (a status, like "About": stored on the server, NOT encrypted,
 *     the app tells you that before you write it).
 *  2. Turns itself off at the time you chose.
 *  3. When you are back: a handoff report in your Neyo chat with
 *     WHO wrote and HOW MANY messages (metadata only, never content).
 * ========================================================= */
import { supabase, NEYO_ID } from "./session.js";
import { neyoSay, neyoDmFor } from "./neyo.js";

const MAX_NOTE = 160;
const MAX_HOURS = 72;

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

/* user ids -> Map(id -> { note, until }) for users who are away right now */
export async function awayStatus(ids) {
  const out = new Map();
  if (!ids?.length) return out;
  try {
    const { data, error } = await supabase
      .from("bean_settings")
      .select("user_id, ghost_enabled, ghost_note, ghost_until")
      .in("user_id", ids)
      .eq("ghost_enabled", true);
    if (error) return out;
    const now = Date.now();
    for (const r of data || []) {
      if (r.ghost_until && new Date(r.ghost_until).getTime() <= now) continue;
      out.set(r.user_id, { note: r.ghost_note || "", until: r.ghost_until || null });
    }
  } catch {}
  return out;
}

/* kept for older imports */
export async function ghostFlags(ids) {
  return new Set((await awayStatus(ids)).keys());
}

/* Turn Away Mode on/off. Off => handoff report. me = { id } */
export async function setGhost(me, { enabled, note, hours }) {
  const current = await ghostProfile(me.id);
  const now = new Date().toISOString();
  const row = { user_id: me.id, updated_at: now };
  if (note !== undefined && note !== null) row.ghost_note = String(note).replace(/\s+/g, " ").trim().slice(0, MAX_NOTE) || null;

  if (enabled) {
    row.ghost_enabled = true;
    if (!current.ghostEnabled) row.ghost_since = now;
    if (hours !== undefined && hours !== null) {
      const h = Number(hours);
      row.ghost_until = h > 0 ? new Date(Date.now() + Math.min(h, MAX_HOURS) * 3600000).toISOString() : null;
    }
  } else if (enabled === false) {
    row.ghost_enabled = false;
    row.ghost_until = null;
  }

  const { error } = await supabase.from("bean_settings").upsert(row, { onConflict: "user_id" });
  if (error) throw error;

  if (enabled === false && current.ghostEnabled) {
    await sendHandoff(me.id, current.ghostSince).catch((err) => console.error("Handoff failed:", err));
  }
  return ghostProfile(me.id);
}

/* ---------- handoff report (metadata only, never message content) ---------- */

function awayFor(sinceIso) {
  if (!sinceIso) return "";
  const mins = Math.max(1, Math.round((Date.now() - new Date(sinceIso).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  return h ? `${h} ghante${mins % 60 ? ` ${mins % 60} min` : ""}` : `${mins} min`;
}

export async function handoffText(ownerId, sinceIso) {
  const away = awayFor(sinceIso);
  const head = `👻 Welcome back!${away ? ` (${away} away)` : ""}`;
  const { data: mine } = await supabase.from("bean_conversation_members").select("conversation_id").eq("user_id", ownerId);
  const convIds = (mine || []).map((m) => m.conversation_id);
  if (!convIds.length) return `${head}\nIs dauran koi message nahi aaya.`;

  let q = supabase
    .from("bean_messages")
    .select("conversation_id, sender_id, kind")
    .in("conversation_id", convIds)
    .neq("sender_id", ownerId)
    .neq("sender_id", NEYO_ID)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(2000);
  if (sinceIso) q = q.gt("created_at", sinceIso);
  const { data: rows } = await q;
  const list = (rows || []).filter((r) => r.sender_id && !["system", "call"].includes(r.kind));
  if (!list.length) return `${head}\nIs dauran koi message nahi aaya.`;

  const [{ data: convs }, { data: users }] = await Promise.all([
    supabase.from("bean_conversations").select("id, type, title").in("id", [...new Set(list.map((r) => r.conversation_id))]),
    supabase.from("bean_users").select("id, username, display_name").in("id", [...new Set(list.map((r) => r.sender_id))]),
  ]);
  const convById = new Map((convs || []).map((c) => [c.id, c]));
  const nameById = new Map((users || []).map((u) => [u.id, u.display_name || u.username]));

  const perChat = new Map();
  for (const r of list) {
    const c = convById.get(r.conversation_id);
    const key = r.conversation_id;
    const label = c?.type === "group" ? `${c.title || "Group"} (group)` : nameById.get(r.sender_id) || "Someone";
    const entry = perChat.get(key) || { label, count: 0 };
    entry.count++;
    perChat.set(key, entry);
  }
  const people = new Set(list.map((r) => r.sender_id)).size;
  const lines = [...perChat.values()].sort((a, b) => b.count - a.count);
  const out = [head, `${people} ${people === 1 ? "shakhs" : "logon"} ne ${list.length} messages bheje:`];
  for (const l of lines.slice(0, 12)) out.push(`• ${l.label}: ${l.count} ${l.count === 1 ? "message" : "messages"}`);
  if (lines.length > 12) out.push(`• +${lines.length - 12} aur chats`);
  out.push("", "🔒 Messages end-to-end encrypted hain, is liye Neyo unhe parh nahi sakta. Chats khol kar dekh lein.");
  return out.join("\n").slice(0, 1990);
}

export async function sendHandoff(ownerId, sinceIso) {
  const text = await handoffText(ownerId, sinceIso);
  await neyoSay(await neyoDmFor(ownerId), text);
  return { ok: true };
}

/* E2EE: Ghost no longer reads or answers chats. Kept so old clients get a clean answer. */
export async function handleGhostDm() {
  return { skipped: "e2ee" };
}

/* ---------- background sweep: only auto-off at the chosen time ---------- */

export async function ghostSweep() {
  const done = { ghostUsers: 0, ghostEnded: 0 };
  let users = [];
  try {
    const { data, error } = await supabase
      .from("bean_settings")
      .select("user_id, ghost_until")
      .eq("ghost_enabled", true)
      .not("ghost_until", "is", null)
      .lte("ghost_until", new Date().toISOString())
      .limit(100);
    if (error) return done;
    users = data || [];
  } catch {
    return done;
  }
  for (const u of users) {
    done.ghostUsers++;
    try {
      await setGhost({ id: u.user_id }, { enabled: false });
      done.ghostEnded++;
    } catch (err) {
      console.error("Ghost auto-off failed:", u.user_id, err);
    }
  }
  return done;
}
