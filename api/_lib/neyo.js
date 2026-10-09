/* =========================================================
 * Neyo inside Bean
 *  - Neyo: answers in DMs, and in groups when someone writes @neyo
 *  - Neyo Ghost: background tasks (reminders, watching a chat,
 *    daily digest). Runs on every "tick" (/api/neyo?action=tick),
 *    called by open Bean tabs every minute and by Supabase pg_cron.
 * ========================================================= */
import { supabase, NEYO_ID as SESSION_NEYO_ID } from "./session.js";
import { insertMessage, notExpired } from "./chat.js";
import { setGhost, ghostProfile } from "./ghost.js";

export const NEYO_ID = SESSION_NEYO_ID;
export const NEYO_USERNAME = "neyo";

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const MODELS = [process.env.NEYO_BEAN_MODEL, "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash"].filter(Boolean);
const HISTORY = 20;
const WATCH_EVERY_MS = 5 * 60 * 1000;
const DEFAULT_TZ = "Asia/Karachi";

/* ---------------- small helpers ---------------- */

const safeTz = (tz) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TZ;
  }
};

const localTime = (date, tz) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);

/* minutes to add to UTC to get local time in tz, at `date` */
function tzOffsetMinutes(tz, date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

/* "2026-10-09T17:00" (local, no offset) or full ISO -> Date */
export { localTime, safeTz };

export function parseWhen(when, tz) {
  const s = String(when || "").trim();
  if (!s) return null;
  if (/[zZ]$|[+-]\d\d:?\d\d$/.test(s)) {
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/);
  if (!m) return null;
  const guess = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
  return new Date(guess.getTime() - tzOffsetMinutes(tz, guess) * 60000);
}

/* next time HH:MM happens in tz */
function nextDailyTime(hhmm, tz) {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const now = new Date();
  const offset = tzOffsetMinutes(tz, now);
  const local = new Date(now.getTime() + offset * 60000);
  let target = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), +m[1], +m[2]) - offset * 60000;
  if (target <= now.getTime() + 30000) target += 86400000;
  return new Date(target);
}

async function setTyping(conversationId) {
  const now = new Date().toISOString();
  await supabase
    .from("bean_presence")
    .upsert(
      { user_id: NEYO_ID, last_seen_at: now, typing_in: conversationId, typing_at: conversationId ? now : null },
      { onConflict: "user_id" }
    );
}

export async function neyoSay(conversationId, text) {
  const body = String(text || "").trim().slice(0, 2000);
  if (!body) return null;
  return insertMessage({ conversationId, senderId: NEYO_ID, kind: "text", body });
}

/* DM between a user and Neyo (created when missing) */
export async function neyoDmFor(userId) {
  const dmKey = [userId, NEYO_ID].sort().join(":");
  const found = await supabase.from("bean_conversations").select("id").eq("dm_key", dmKey).maybeSingle();
  if (found.data) return found.data.id;
  const created = await supabase
    .from("bean_conversations")
    .insert({ type: "dm", dm_key: dmKey, created_by: userId })
    .select("id")
    .single();
  if (created.error) {
    const again = await supabase.from("bean_conversations").select("id").eq("dm_key", dmKey).single();
    if (again.error) throw created.error;
    return again.data.id;
  }
  await supabase.from("bean_conversation_members").insert([
    { conversation_id: created.data.id, user_id: userId, role: "admin" },
    { conversation_id: created.data.id, user_id: NEYO_ID, role: "admin" },
  ]);
  return created.data.id;
}

/* ---------------- Gemini (fast + stable) ----------------
 * - one overall deadline per request (never runs past Vercel's limit)
 * - short per-call timeout, one quick retry on 429/5xx, then the next model
 * - models that answer 404/400 "not found" are skipped for 30 min (per instance)
 * - the last model that worked is tried first next time                       */

const badModels = new Map(); // model -> until (ms)
let goodModel = null;

export const geminiReady = () => Boolean(GEMINI_KEY);

function modelOrder() {
  const now = Date.now();
  const list = MODELS.filter((m) => (badModels.get(m) || 0) < now);
  if (goodModel && list.includes(goodModel)) return [goodModel, ...list.filter((m) => m !== goodModel)];
  return list.length ? list : MODELS;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function gemini({ system, contents, tools, maxTokens = 700, json = false, deadlineMs = 40000 }) {
  const deadline = Date.now() + deadlineMs;
  let lastErr;
  for (const model of modelOrder()) {
    const generationConfig = { temperature: 0.6, maxOutputTokens: maxTokens };
    if (json) generationConfig.responseMimeType = "application/json";
    if (/gemini-3/i.test(model)) generationConfig.thinkingConfig = { thinkingLevel: "minimal" };
    else if (/gemini-2\.5/i.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
    const body = { systemInstruction: { parts: [{ text: system }] }, contents, generationConfig };
    if (tools) body.tools = [{ functionDeclarations: tools }];

    for (let attempt = 0; attempt < 2; attempt++) {
      const left = deadline - Date.now();
      if (left < 2500) throw lastErr || new Error("Neyo took too long");
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(Math.min(18000, left - 500)),
        });
        const data = await r.json().catch(() => ({}));
        if (r.ok) {
          goodModel = model;
          const content = data?.candidates?.[0]?.content || { role: "model", parts: [] };
          return { content: { role: "model", parts: content.parts || [] }, model };
        }
        lastErr = new Error(`Gemini ${model}: ${data?.error?.message || r.status}`);
        if (r.status === 404 || (r.status === 400 && /not found|not supported|unknown name/i.test(data?.error?.message || ""))) {
          badModels.set(model, Date.now() + 30 * 60000);
          break; // next model
        }
        if ([429, 500, 502, 503, 504].includes(r.status)) {
          if (attempt === 0) {
            await sleep(400 + Math.random() * 400);
            continue; // quick retry, same model
          }
          break;
        }
        throw lastErr; // 401/403 etc: config problem, no point trying other models
      } catch (err) {
        lastErr = err;
        if (err?.name === "TimeoutError" || err?.name === "AbortError") break; // slow model -> next
        if (String(err?.message || "").startsWith("Gemini ")) throw err;
      }
    }
  }
  throw lastErr || new Error("Gemini unavailable");
}

export const textOf = (content) =>
  (content.parts || [])
    .filter((p) => p.text && !p.thought)
    .map((p) => p.text)
    .join("")
    .trim();

export async function ask(system, prompt, maxTokens = 500, json = false) {
  const { content } = await gemini({ system, contents: [{ role: "user", parts: [{ text: prompt }] }], maxTokens, json, deadlineMs: 25000 });
  return textOf(content);
}

/* ---------------- tools Neyo can use ---------------- */

const TOOLS = [
  {
    name: "set_reminder",
    description: "Neyo Ghost reminds the user later with a Bean message from Neyo.",
    parameters: {
      type: "OBJECT",
      properties: {
        text: { type: "STRING", description: "What to remind about, short" },
        when: { type: "STRING", description: "Local date-time in the user's time zone, format YYYY-MM-DDTHH:MM" },
        repeat: { type: "STRING", enum: ["none", "daily", "weekly"] },
      },
      required: ["text", "when"],
    },
  },
  {
    name: "daily_digest",
    description: "Every day at a time, Neyo sends the user a short digest of WHO messaged them and how many messages (chats are end-to-end encrypted, so never the content).",
    parameters: {
      type: "OBJECT",
      properties: { time: { type: "STRING", description: "Local time HH:MM, 24-hour" } },
      required: ["time"],
    },
  },
  {
    name: "ghost_mode",
    description:
      "Turn Ghost (Away Mode) on or off. While on, the user's contacts see that they are away with their short note. Ghost never reads or answers messages (chats are end-to-end encrypted). When turned off, the user gets a handoff report of who messaged and how many messages.",
    parameters: {
      type: "OBJECT",
      properties: {
        on: { type: "BOOLEAN" },
        note: { type: "STRING", description: "Short away note contacts will see, in the user's words (e.g. 'meeting mein hun, 6 baje free'). It is a status, not encrypted. Optional." },
        hours: { type: "NUMBER", description: "Turn off automatically after this many hours. Optional." },
      },
      required: ["on"],
    },
  },
  { name: "list_tasks", description: "List the user's active Neyo Ghost tasks.", parameters: { type: "OBJECT", properties: {} } },
  {
    name: "cancel_task",
    description: "Stop a Neyo Ghost task. Use the number from list_tasks.",
    parameters: { type: "OBJECT", properties: { number: { type: "NUMBER" } }, required: ["number"] },
  },
];

async function userChats(userId) {
  const { data: mine } = await supabase.from("bean_conversation_members").select("conversation_id").eq("user_id", userId);
  const ids = (mine || []).map((m) => m.conversation_id);
  if (!ids.length) return [];
  const [{ data: convs }, { data: members }] = await Promise.all([
    supabase.from("bean_conversations").select("id, type, title").in("id", ids),
    supabase.from("bean_conversation_members").select("conversation_id, user_id").in("conversation_id", ids),
  ]);
  const userIds = [...new Set((members || []).map((m) => m.user_id))];
  const { data: users } = await supabase.from("bean_users").select("id, username, display_name").in("id", userIds);
  const nameById = new Map((users || []).map((u) => [u.id, u.display_name || u.username]));
  const userById = new Map((users || []).map((u) => [u.id, u]));
  return (convs || []).map((c) => {
    const others = (members || []).filter((m) => m.conversation_id === c.id && m.user_id !== userId);
    const peer = others[0] ? userById.get(others[0].user_id) : null;
    return {
      id: c.id,
      type: c.type,
      name: c.type === "group" ? c.title || "Group" : nameById.get(peer?.id) || "chat",
      username: c.type === "dm" ? peer?.username : null,
      isNeyo: c.type === "dm" && peer?.id === NEYO_ID,
    };
  });
}

function findChat(chats, name, currentId) {
  const q = String(name || "").trim().toLowerCase().replace(/^@/, "").replace(/@bean$/, "");
  if (!q) return chats.find((c) => c.id === currentId) || null;
  return (
    chats.find((c) => c.name.toLowerCase() === q || c.username === q) ||
    chats.find((c) => c.name.toLowerCase().includes(q) || (c.username || "").includes(q)) ||
    null
  );
}

async function chatLines(conversationId, count = 40, sinceIso = null) {
  let q = notExpired(
    supabase
      .from("bean_messages")
      .select("id, sender_id, kind, body, attachment, created_at, deleted_at, enc")
      .eq("conversation_id", conversationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(Number(count) || 40, 1), 100))
  );
  if (sinceIso) q = q.gt("created_at", sinceIso);
  const { data } = await q;
  const rows = (data || []).reverse().filter((r) => !r.enc); // encrypted messages are unreadable here, by design
  const ids = [...new Set(rows.map((r) => r.sender_id).filter(Boolean))];
  const { data: users } = ids.length ? await supabase.from("bean_users").select("id, username, display_name").in("id", ids) : { data: [] };
  const names = new Map((users || []).map((u) => [u.id, u.display_name || u.username]));
  return rows.map((r) => ({
    id: r.id,
    senderId: r.sender_id,
    at: r.created_at,
    line: `${names.get(r.sender_id) || "System"}: ${r.body || (r.kind === "text" ? "" : `[${r.kind}${r.attachment?.name ? " " + r.attachment.name : ""}]`)}`,
  }));
}

async function runTool(name, args, ctx) {
  const { me, tz, conversationId, chats } = ctx;
  switch (name) {
    case "set_reminder": {
      const at = parseWhen(args.when, tz);
      if (!at || at.getTime() < Date.now() - 60000) return { ok: false, error: "That time is in the past or unclear. Ask the user for the time." };
      const repeat = args.repeat === "daily" ? 86400 : args.repeat === "weekly" ? 604800 : null;
      const { error } = await supabase.from("bean_ghost_tasks").insert({
        user_id: me.id,
        kind: "remind",
        title: String(args.text || "Reminder").slice(0, 300),
        run_at: at.toISOString(),
        repeat_seconds: repeat,
      });
      if (error) throw error;
      return { ok: true, remind_at_local: localTime(at, tz), repeat: args.repeat || "none" };
    }
    case "watch_chat":
    case "read_chat":
      return { ok: false, error: "Bean chats are end-to-end encrypted. Neyo cannot read, watch or summarize them. Tell the user this honestly." };
    case "daily_digest": {
      const at = nextDailyTime(args.time, tz);
      if (!at) return { ok: false, error: "Time unclear" };
      const { error } = await supabase.from("bean_ghost_tasks").insert({
        user_id: me.id,
        kind: "digest",
        title: `Daily digest at ${args.time}`,
        run_at: at.toISOString(),
        repeat_seconds: 86400,
        last_checked_at: new Date().toISOString(),
      });
      if (error) throw error;
      return { ok: true, first_digest_local: localTime(at, tz) };
    }
    case "ghost_mode": {
      const r = await setGhost(me, { enabled: Boolean(args.on), note: args.note, hours: args.hours });
      return {
        ok: true,
        ghost: r.ghostEnabled ? "on" : "off",
        until: r.ghostUntil ? localTime(new Date(r.ghostUntil), tz) : undefined,
        handoff_report_sent: !r.ghostEnabled,
      };
    }
    case "list_tasks": {
      const tasks = await activeTasks(me.id);
      return {
        tasks: tasks.map((t, i) => ({
          number: i + 1,
          kind: t.kind,
          title: t.title,
          what: t.prompt || undefined,
          next: t.run_at ? localTime(new Date(t.run_at), tz) : undefined,
          repeat: t.repeat_seconds ? (t.repeat_seconds === 86400 ? "daily" : "weekly") : undefined,
        })),
      };
    }
    case "cancel_task": {
      const tasks = await activeTasks(me.id);
      const t = tasks[Number(args.number) - 1];
      if (!t) return { ok: false, error: "No task with that number" };
      await supabase.from("bean_ghost_tasks").update({ status: "cancelled" }).eq("id", t.id).eq("user_id", me.id);
      return { ok: true, cancelled: t.title };
    }
    default:
      return { ok: false, error: "Unknown tool" };
  }
}

async function activeTasks(userId) {
  const { data } = await supabase
    .from("bean_ghost_tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  return data || [];
}

/* ---------------- Neyo replies in a chat ---------------- */

function persona(me, tz, chat, chats, ghost) {
  return `You are Neyo, the AI of Signaturesi, living inside Bean (a chat app) as the contact neyo@bean.
Bean chats between people are END-TO-END ENCRYPTED: you cannot read, watch, summarize or answer them, and you must say so honestly if asked.
Only this private chat with you is not end-to-end encrypted (an AI has to read it). Never ask for passwords, card numbers, bank details or codes; if the user shares one, tell them to delete it.
You can: chat and help, set reminders, a daily digest of WHO messaged (metadata only), and turn Ghost (Away Mode) on/off: contacts see "away" + the user's short note, and a handoff report (who messaged, how many) comes when they're back. Ghost never reads or answers messages.

Style: text like a smart, warm friend. Short messages (usually 1-4 sentences), no markdown headings, no tables.
Reply in the user's language: Roman Urdu if they write Roman Urdu, Urdu script if Urdu, otherwise English.
Never pretend to have done something you did not do with a tool. Be honest that you are an AI.
When the user asks for a reminder, digest or away mode, use the tool, then confirm in one line with the time.
If something needed is missing (like the time for a reminder), ask one short question.

Now: ${localTime(new Date(), tz)} (user's time zone ${tz}).
Ghost (Away Mode): ${ghost?.ghostEnabled ? `ON${ghost.ghostUntil ? ` until ${localTime(new Date(ghost.ghostUntil), tz)}` : ""}` : "off"}.
User: ${me.displayName} (@${me.username}).`;
}

export async function replyInChat(me, conversationId, tzRaw) {
  const tz = safeTz(tzRaw);
  // Neyo only answers in its own (non-E2EE, clearly labelled) chat
  const dmKey = [me.id, NEYO_ID].sort().join(":");
  const { data: conv } = await supabase.from("bean_conversations").select("id, dm_key").eq("id", conversationId).maybeSingle();
  if (!conv || conv.dm_key !== dmKey) return { skipped: "not the Neyo chat" };

  const lines = await chatLines(conversationId, HISTORY);
  const last = [...lines].reverse().find((l) => l.senderId && l.senderId !== NEYO_ID);
  if (!last || last.senderId !== me.id) return { skipped: "nothing new from user" };
  if (lines[lines.length - 1]?.senderId === NEYO_ID) return { skipped: "already answered" };

  // exactly one answer per user message, even if the request is sent twice
  const claim = await supabase.from("bean_neyo_jobs").insert({ message_id: last.id });
  if (claim.error && claim.error.code === "23505") return { skipped: "already answering" };

  if (!geminiReady()) {
    await neyoSay(conversationId, "Neyo abhi setup ho raha hai: Bean ke Vercel mein GEMINI_API_KEY lagani baqi hai.");
    return { ok: false, error: "GEMINI_API_KEY missing" };
  }
  const chat = { id: conversationId, type: "dm", name: "Neyo" };
  const chats = [];

  await setTyping(conversationId);
  const contents = [];
  for (const l of lines) {
    const role = l.senderId === NEYO_ID ? "model" : "user";
    const text = role === "model" ? l.line.replace(/^Neyo:\s*/, "") : l.line;
    if (!text.trim()) continue;
    const prev = contents[contents.length - 1];
    if (prev && prev.role === role) prev.parts[0].text += `\n${text}`;
    else contents.push({ role, parts: [{ text }] });
  }
  if (contents[0]?.role === "model") contents.shift();

  const system = persona(me, tz, chat, chats, await ghostProfile(me.id));
  const ctx = { me, tz, conversationId, chats };
  let answer = "";
  try {
    for (let step = 0; step < 4; step++) {
      const { content } = await gemini({ system, contents, tools: TOOLS, deadlineMs: 48000 - step * 6000 });
      const calls = content.parts.filter((p) => p.functionCall);
      if (!calls.length) {
        answer = textOf(content);
        break;
      }
      contents.push(content);
      const responses = [];
      for (const p of calls) {
        let result;
        try {
          result = await runTool(p.functionCall.name, p.functionCall.args || {}, ctx);
        } catch (err) {
          result = { ok: false, error: err.message };
        }
        responses.push({ functionResponse: { name: p.functionCall.name, response: result } });
      }
      contents.push({ role: "user", parts: responses });
      await setTyping(conversationId);
    }
  } catch (err) {
    console.error("Neyo reply failed:", err);
    answer = "Maaf kijiye, abhi jawab nahi de pa raha. Thori dair baad dobara likhein.";
  } finally {
    await setTyping(null);
  }
  if (!answer) answer = "Ho gaya 👍";
  await neyoSay(conversationId, answer);
  return { ok: true };
}

/* ---------------- Neyo Ghost: background run ---------------- */

export async function ghostTick() {
  // only one run per ~50 seconds
  const cutoff = new Date(Date.now() - 50000).toISOString();
  const { data: lock } = await supabase
    .from("bean_ghost_state")
    .update({ last_tick_at: new Date().toISOString() })
    .eq("id", 1)
    .lt("last_tick_at", cutoff)
    .select("id");
  if (!lock?.length) return { skipped: "recently ran" };

  const nowIso = new Date().toISOString();
  const done = { reminders: 0, digests: 0, watches: 0, alerts: 0 };

  // chat watching can't work on end-to-end encrypted chats: close old watch tasks once, with a note
  const { data: oldWatches } = await supabase
    .from("bean_ghost_tasks")
    .update({ status: "done" })
    .eq("status", "active")
    .eq("kind", "watch")
    .select("id, user_id, title");
  for (const t of oldWatches || []) {
    await neyoSay(
      await neyoDmFor(t.user_id),
      `🔒 "${t.title}" band kar diya: Bean chats ab end-to-end encrypted hain, is liye Neyo unhe parh ya watch nahi kar sakta.`
    ).catch(() => {});
  }

  // due reminders + digests: claim first (at-most-once), then send
  const { data: due } = await supabase
    .from("bean_ghost_tasks")
    .select("*")
    .eq("status", "active")
    .in("kind", ["remind", "digest"])
    .lte("run_at", nowIso)
    .order("run_at", { ascending: true })
    .limit(50);
  await Promise.all(
    (due || []).map(async (t) => {
      try {
        const next = t.repeat_seconds ? nextRun(t.run_at, t.repeat_seconds) : null;
        const { data: claimed } = await supabase
          .from("bean_ghost_tasks")
          .update(next ? { run_at: next, last_checked_at: nowIso } : { status: "done", last_checked_at: nowIso })
          .eq("id", t.id)
          .eq("status", "active")
          .eq("run_at", t.run_at)
          .select("id");
        if (!claimed?.length) return; // another run took it
        const dm = await neyoDmFor(t.user_id);
        if (t.kind === "remind") {
          await neyoSay(dm, `⏰ Reminder: ${t.title}`);
          done.reminders++;
        } else {
          await neyoSay(dm, await digestFor(t.user_id, t.last_checked_at));
          done.digests++;
        }
      } catch (err) {
        console.error("Ghost task failed:", t.id, err);
      }
    })
  );
  done.watchesClosed = (oldWatches || []).length;
  return done;
}

function nextRun(runAt, every) {
  let t = new Date(runAt).getTime();
  const now = Date.now();
  while (t <= now) t += every * 1000;
  return new Date(t).toISOString();
}

/* Daily digest: who messaged and how many (metadata only: chats are end-to-end encrypted). */
async function digestFor(userId, sinceIso) {
  const since = sinceIso || new Date(Date.now() - 86400000).toISOString();
  const { data: mine } = await supabase.from("bean_conversation_members").select("conversation_id").eq("user_id", userId);
  const ids = (mine || []).map((m) => m.conversation_id);
  if (!ids.length) return "🌙 Daily digest: aaj koi naya message nahi aaya.";
  const { data: rows } = await supabase
    .from("bean_messages")
    .select("conversation_id, sender_id, kind")
    .in("conversation_id", ids)
    .neq("sender_id", userId)
    .neq("sender_id", NEYO_ID)
    .is("deleted_at", null)
    .gt("created_at", since)
    .limit(3000);
  const list = (rows || []).filter((r) => r.sender_id && !["system", "call"].includes(r.kind));
  if (!list.length) return "🌙 Daily digest: aaj aap ki chats mein koi naya message nahi aaya.";
  const [{ data: convs }, { data: users }] = await Promise.all([
    supabase.from("bean_conversations").select("id, type, title").in("id", [...new Set(list.map((r) => r.conversation_id))]),
    supabase.from("bean_users").select("id, username, display_name").in("id", [...new Set(list.map((r) => r.sender_id))]),
  ]);
  const convById = new Map((convs || []).map((c) => [c.id, c]));
  const nameById = new Map((users || []).map((u) => [u.id, u.display_name || u.username]));
  const per = new Map();
  for (const r of list) {
    const c = convById.get(r.conversation_id);
    const label = c?.type === "group" ? `${c.title || "Group"} (group)` : nameById.get(r.sender_id) || "Someone";
    per.set(r.conversation_id, { label, count: (per.get(r.conversation_id)?.count || 0) + 1 });
  }
  const lines = [...per.values()].sort((a, b) => b.count - a.count).slice(0, 10).map((l) => `• ${l.label}: ${l.count}`);
  return `🌙 Daily digest: ${list.length} naye messages\n${lines.join("\n")}\n🔒 Content encrypted hai, chats khol kar parhein.`;
}
