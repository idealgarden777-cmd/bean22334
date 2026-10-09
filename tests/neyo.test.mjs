// Neyo: fast + stable Gemini calls, one answer per message, Neyo chat only.
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test";
process.env.GEMINI_API_KEY = "k";
process.env.NEYO_BEAN_MODEL = "model-a";
const base = new URL("../api", import.meta.url).href;
const { db, install } = await import("./fakedb.mjs");
const { supabase, NEYO_ID } = await import(`${base}/_lib/session.js`);
install(supabase);
const { gemini, replyInChat } = await import(`${base}/_lib/neyo.js`);

let pass = 0, failN = 0;
const keepAlive = setInterval(() => {}, 1000); // AbortSignal.timeout timers are unref()d
const ok = (c, l) => { c ? pass++ : failN++; console.log((c ? "PASS " : "FAIL ") + l); };

const calls = [];
let plan = {};
globalThis.fetch = async (url, opts) => {
  const model = decodeURIComponent(url.match(/models\/([^:]+):/)[1]);
  calls.push({ model, key: opts.headers["x-goog-api-key"], url });
  const step = (plan[model] ||= []).shift() || { status: 200, text: `hi from ${model}` };
  if (step.hang) return new Promise((_, rej) => opts.signal.addEventListener("abort", () => rej(Object.assign(new Error("timeout"), { name: "TimeoutError" }))));
  return { ok: step.status === 200, status: step.status, json: async () => (step.status === 200 ? { candidates: [{ content: { parts: [{ text: step.text }] } }] } : { error: { message: step.msg || "err" } }) };
};

// 1. key goes in a header, not the URL
let r = await gemini({ system: "s", contents: [{ role: "user", parts: [{ text: "x" }] }] });
ok(r.model === "model-a" && calls[0].key === "k" && !calls[0].url.includes("key="), "API key sent in header (not in URL / logs)");

// 2. 404 model is skipped and remembered
calls.length = 0;
plan = { "model-a": [{ status: 404, msg: "not found" }] };
r = await gemini({ system: "s", contents: [{ role: "user", parts: [{ text: "x" }] }] });
ok(r.model !== "model-a", "404 model -> next model");
calls.length = 0;
r = await gemini({ system: "s", contents: [{ role: "user", parts: [{ text: "x" }] }] });
ok(!calls.some((c) => c.model === "model-a"), "bad model is not retried for 30 min");

// 3. 503 -> one quick retry on the same model, then success
const first = r.model;
calls.length = 0;
plan = { [first]: [{ status: 503 }] };
r = await gemini({ system: "s", contents: [{ role: "user", parts: [{ text: "x" }] }] });
ok(calls.length === 2 && calls[0].model === first && calls[1].model === first && r.model === first, "503 -> quick retry, same model");

// 4. a hanging model never blows the deadline
calls.length = 0;
plan = { [first]: [{ hang: true }] };
const t0 = Date.now();
r = await gemini({ system: "s", contents: [{ role: "user", parts: [{ text: "x" }] }], deadlineMs: 6000 }).catch((e) => e);
ok(Date.now() - t0 < 6500, `deadline respected (${Date.now() - t0} ms)`);

// 5. bad API key -> stop at once (no pointless retries)
calls.length = 0;
plan = { [first]: [{ status: 403, msg: "API key not valid" }] };
r = await gemini({ system: "s", contents: [{ role: "user", parts: [{ text: "x" }] }] }).catch((e) => e);
ok(r instanceof Error && calls.length === 1, "403 stops immediately");

// 6. Neyo answers once per message, only in the Neyo chat
plan = {};
const me = { id: "u-me", username: "sam", displayName: "Sam" };
const dmKey = [me.id, NEYO_ID].sort().join(":");
db.bean_conversations = [{ id: "c-neyo", type: "dm", dm_key: dmKey }];
db.bean_users = [{ id: me.id, username: "sam", display_name: "Sam" }, { id: NEYO_ID, username: "neyo", display_name: "Neyo" }];
db.bean_conversation_members = [{ conversation_id: "c-neyo", user_id: me.id, role: "admin" }, { conversation_id: "c-neyo", user_id: NEYO_ID, role: "admin" }];
db.bean_messages = [{ id: "m1", conversation_id: "c-neyo", sender_id: me.id, kind: "text", body: "salam neyo", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null, enc: null }];
const [a, b] = await Promise.all([replyInChat(me, "c-neyo", "Asia/Karachi"), replyInChat(me, "c-neyo", "Asia/Karachi")]);
console.log(a, b);
const answers = db.bean_messages.filter((m) => m.sender_id === NEYO_ID);
ok(answers.length === 1 && [a, b].some((x) => x.skipped), "two simultaneous requests -> exactly one answer");

console.log(`\n${pass} passed, ${failN} failed`);
clearInterval(keepAlive);
process.exit(failN ? 1 : 0);
