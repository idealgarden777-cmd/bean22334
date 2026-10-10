// Bean v3.0 (no E2EE): real API handlers against a fake Supabase.
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test";
process.env.GEMINI_API_KEY = "k";
const base = new URL("../api", import.meta.url).href;
const { db, install, call, limits } = await import("./fakedb.mjs");
const { supabase, NEYO_ID } = await import(`${base}/_lib/session.js`);
install(supabase);
const auth = (await import(`${base}/auth.js`)).default;
const me = (await import(`${base}/me.js`)).default;
const conversations = (await import(`${base}/conversations.js`)).default;
const messages = (await import(`${base}/messages.js`)).default;
const calls = (await import(`${base}/calls.js`)).default;
const { setGhost, handleGhostDm } = await import(`${base}/_lib/ghost.js`);
const keepAlive = setInterval(() => {}, 1000);

let geminiReply = { reply: "Sam meeting mein hain, 6 baje free 👍", handled: true, priority: "normal", summary: "puch rahe hain kahan ho" };
let lastGeminiBody = "";
globalThis.fetch = async (_url, init) => (lastGeminiBody = String(init?.body || ""), { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(geminiReply) }] } }] }) });

let pass = 0, failN = 0;
const ok = (c, l) => { c ? pass++ : failN++; console.log((c ? "PASS " : "FAIL ") + l); };
(db.bean_users ||= []).push({ id: NEYO_ID, username: "neyo", display_name: "Neyo", status: "active" });

async function signup(username, password = "very-long-password-1") {
  const r = await call(auth, { body: { action: "register", username, password }, ip: `10.0.${username.length}.${Math.floor(Math.random() * 200)}` });
  if (r.code !== 201 && r.code !== 200) throw new Error(JSON.stringify(r.body));
  return { cookie: `bean_session=${r.headers["set-cookie"].match(/bean_session=([^;]+)/)[1]}`, user: r.body.user };
}
const sam = await signup("samuel");
const leo = await signup("leo2233");
ok(sam.user && leo.user, "register works");

let r = await call(auth, { body: { action: "login", username: "samuel", password: "very-long-password-1" }, origin: "https://evil.example" });
ok(r.code === 403, "login from another site is blocked");
r = await call(auth, { body: { action: "register", username: "admin", password: "very-long-password-1" }, ip: "8.8.8.8" });
ok(r.code === 409, "reserved Bean IDs can't be registered");

// DM + plain messages (no encryption step)
r = await call(conversations, { cookie: sam.cookie, body: { action: "open_dm", username: "leo2233" } });
const dm = r.body.conversation;
ok(r.code === 200 && dm?.id, "open DM");
r = await call(messages, { cookie: sam.cookie, body: { action: "send", conversationId: dm.id, text: "salam leo" } });
ok(r.code === 200 && r.body.message.text === "salam leo", "send plain text");
const mid = r.body.message.id;
r = await call(messages, { cookie: leo.cookie, method: "GET", query: { conversationId: dm.id } });
ok(r.body.messages?.some((m) => m.text === "salam leo"), "Leo reads it");
r = await call(messages, { cookie: leo.cookie, body: { action: "react", messageId: mid, emoji: "❤️" } });
ok(r.code === 200 && r.body.message.reactions?.length === 1, "reaction");
r = await call(messages, { cookie: sam.cookie, body: { action: "edit", messageId: mid, text: "salam leo bhai" } });
ok(r.code === 200 && r.body.message.text === "salam leo bhai", "edit");
r = await call(messages, { cookie: leo.cookie, body: { action: "edit", messageId: mid, text: "hack" } });
ok(r.code === 403 || r.code === 404, "can't edit someone else's message");
r = await call(messages, { cookie: sam.cookie, body: { action: "send", conversationId: dm.id, text: "x".repeat(2001) } });
ok(r.code === 400, "too long message rejected");

// dangerous file types become plain downloads
r = await call(messages, { cookie: sam.cookie, body: { action: "send", conversationId: dm.id, attachment: { path: `${dm.id}/x_evil.svg`, name: "evil.svg", size: 10, mime: "image/svg+xml" } } });
ok(r.code === 200 && r.body.message.kind === "file" && r.body.message.attachment.mime === "application/octet-stream", "SVG/HTML upload can't run as a page");
r = await call(messages, { cookie: sam.cookie, body: { action: "send", conversationId: dm.id, attachment: { path: `${dm.id}/v.webm`, name: "voice-1.webm", size: 900, duration: 4, mime: "audio/webm;codecs=opus" } } });
ok(r.code === 200 && r.body.message.kind === "audio" && r.body.message.attachment.mime === "audio/webm", "Chrome voice note (codec in mime) is a voice note, not a file");
r = await call(messages, { cookie: sam.cookie, body: { action: "send", conversationId: dm.id, attachment: { path: `${dm.id}/v2.webm`, name: "voice-2.webm", size: 900, duration: 3, mime: "text/html;charset=utf-8" } } });
ok(r.code === 200 && r.body.message.attachment.mime === "application/octet-stream", "mime parameters can't smuggle html");
{
  const { hydrateMessages } = await import("../api/_lib/chat.js");
  const [legacy] = await hydrateMessages([{ id: "lg1", conversation_id: dm.id, sender_id: "x", kind: "file", body: null, created_at: new Date().toISOString(), attachment: { path: `${dm.id}/old.webm`, name: "voice-171.webm", size: 900, mime: "application/octet-stream", duration: 5 } }]);
  ok(legacy.kind === "audio" && legacy.attachment.mime === "audio/webm", "old voice notes saved as files play as voice notes");
}
r = await call(messages, { cookie: sam.cookie, body: { action: "send", conversationId: dm.id, attachment: { path: `${dm.id}/p.jpg`, name: "p.jpg", size: 10, mime: "image/jpeg" } } });
ok(r.body.message.kind === "image", "normal photo still a photo");
r = await call(messages, { cookie: sam.cookie, body: { action: "send", conversationId: "someone-else", attachment: { path: `${dm.id}/p.jpg`, name: "p.jpg", size: 10, mime: "image/jpeg" } } });
ok(r.code >= 400, "can't post into a chat you're not in");

// message sent by the short-lived encrypted version still shows a clear label
db.bean_messages.push({ id: "00000000-0000-4000-8000-0000000000e1", conversation_id: dm.id, sender_id: leo.user.id, kind: "text", body: null, enc: { v: 1 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null });
r = await call(messages, { cookie: sam.cookie, method: "GET", query: { conversationId: dm.id } });
ok(r.body.messages.some((m) => /older encrypted version/.test(m.text)), "old encrypted message shows a label (not a blank bubble)");

// profile: photo + about
const tinyJpeg = "data:image/jpeg;base64," + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]).toString("base64");
r = await call(me, { cookie: sam.cookie, body: { action: "profile", avatar: "data:image/svg+xml;base64," + Buffer.from("<svg onload=alert(1)>").toString("base64") } });
ok(r.code === 400, "profile photo: SVG / scripts rejected");
r = await call(me, { cookie: sam.cookie, body: { action: "profile", avatar: "data:image/png;base64," + Buffer.from("<html>not a png</html>").toString("base64") } });
ok(r.code === 400, "profile photo: fake image bytes rejected");
r = await call(me, { cookie: sam.cookie, body: { action: "profile", avatar: "data:image/jpeg;base64," + Buffer.alloc(300 * 1024, 1).toString("base64") } });
ok(r.code === 400, "profile photo: too large rejected");
r = await call(me, { cookie: sam.cookie, body: { action: "profile", avatar: tinyJpeg, bio: "  Hello\u202e from Lahore \u0007 " } });
ok(r.code === 200 && /^\/api\/me\?avatar=/.test(r.body.user.avatarUrl) && r.body.user.bio === "Hello from Lahore", "profile photo + about saved (cleaned)");
const avatarQuery = Object.fromEntries(new URLSearchParams(r.body.user.avatarUrl.split("?")[1]));
r = await call(me, { method: "GET", query: avatarQuery });
ok(r.code === 401, "profile photo needs sign-in");
r = await call(me, { method: "GET", cookie: leo.cookie, query: avatarQuery });
ok(r.code === 200 && /image\/jpeg/.test(r.headers["content-type"]), "profile photo served as real image");
r = await call(me, { method: "GET", cookie: leo.cookie, query: { avatar: "../../etc" } });
ok(r.code === 404, "profile photo: bad id rejected");
r = await call(conversations, { cookie: leo.cookie, method: "GET" });
ok(r.body.conversations.some((c) => c.peer?.bio === "Hello from Lahore"), "chat partner sees about text");
r = await call(me, { cookie: sam.cookie, body: { action: "profile", avatar: null } });
ok(r.code === 200 && !r.body.user.avatarUrl, "profile photo removed");

// calls: plain signalling works again
r = await call(calls, { cookie: sam.cookie, body: { action: "start", conversationId: dm.id, video: false } });
const callId = r.body.call?.id;
ok(r.code === 200 && callId, "start call");
r = await call(calls, { cookie: sam.cookie, body: { action: "signal", id: callId, type: "offer", payload: { sdp: "v=0" } } });
ok(r.code === 200, "plain call signalling accepted");

// Ghost (AI delegated presence) like before
await setGhost(sam.user, { enabled: true, note: "meeting mein hun, 6 baje free", hours: 2 });
await new Promise((x) => setTimeout(x, 5));
r = await call(messages, { cookie: leo.cookie, body: { action: "send", conversationId: dm.id, text: "kahan ho?" } });
const g1 = await handleGhostDm(dm.id);
const g2 = await handleGhostDm(dm.id);
const ghostMsgs = db.bean_messages.filter((m) => m.ghost);
ok(ghostMsgs.length === 1 && ghostMsgs[0].body.includes("6 baje") && g2.skipped, "Ghost replies once with 👻 label");

// NEYO characters for Ghost: default Neyo, pick Zadi, Zadi writes the next reply
ok(ghostMsgs[0].ghost_character === "neyo" && lastGeminiBody.includes("you are Neyo, one of NEYO's characters"), "default Ghost character is Neyo");
r = await call(me, { cookie: sam.cookie, body: { action: "update", ghostCharacter: "batman" } });
ok(r.code === 400, "unknown Ghost character rejected");
r = await call(me, { cookie: sam.cookie, body: { action: "update", ghostCharacter: "zadi" } });
ok(r.code === 200 && r.body.settings.ghostCharacter === "zadi" && r.body.settings.ghostEnabled, "Ghost character saved, Ghost stays on");
geminiReply = { reply: "Sam is busy right now, free at 6! Let's lock it in then 🚀", handled: true, priority: "normal", summary: "wants to meet" };
await new Promise((x) => setTimeout(x, 5));
await call(messages, { cookie: leo.cookie, body: { action: "send", conversationId: dm.id, text: "chalo milte hain?" } });
await handleGhostDm(dm.id);
const zadiMsg = db.bean_messages.filter((m) => m.ghost).pop();
ok(zadiMsg.ghost_character === "zadi" && lastGeminiBody.includes("you are Zadi, one of NEYO's characters") && lastGeminiBody.includes("Never introduce yourself as Neyo"), "Zadi persona writes the Ghost reply");
r = await call(me, { cookie: sam.cookie, body: { action: "update", ghostCharacter: "yumi" } });
ok(r.code === 200 && r.body.settings.ghostCharacter === "yumi", "new NEYO characters (Yumi) work too");
r = await call(messages, { method: "GET", cookie: leo.cookie, query: { conversationId: dm.id } });
const seen = JSON.stringify(r.body);
ok(seen.includes('"ghostCharacter":"zadi"'), "peer sees which character replied");
const { missingColumn } = await import(`${base}/_lib/chat.js`);
ok(missingColumn({ code: "PGRST204", message: "Could not find the 'ghost_character' column" }, "ghost_character") && !missingColumn({ code: "23505", message: "dup" }, "ghost_character"), "missing-column fallback detects old database");

// password change needs current password, signs out other devices
const second = await call(auth, { body: { action: "login", username: "samuel", password: "very-long-password-1" }, ip: "9.9.9.9" });
const secondCookie = `bean_session=${second.headers["set-cookie"].match(/bean_session=([^;]+)/)[1]}`;
r = await call(me, { cookie: sam.cookie, body: { action: "update", password: "brand-new-pass-99" } });
ok(r.code === 403, "password change needs current password");
r = await call(me, { cookie: sam.cookie, body: { action: "update", password: "brand-new-pass-99", currentPassword: "very-long-password-1" } });
ok(r.code === 200, "password changed");
r = await call(me, { method: "GET", cookie: secondCookie });
ok(r.body.authenticated === false, "other devices signed out after password change");
r = await call(me, { cookie: sam.cookie, body: { action: "sessions" } });
ok(r.body.sessions?.some((s) => s.current), "device list");
r = await call(me, { cookie: sam.cookie, body: { action: "logout_all" } });
r = await call(me, { method: "GET", cookie: sam.cookie });
ok(r.body.authenticated === false, "log out all devices");
r = await call(me, { method: "GET", cookie: leo.cookie });
ok(r.body.authenticated === true && r.body.build?.version === "3.4.0", "other users unaffected; build 3.4.0");

r = await call(me, { method: "GET", query: { health: "1" } });
ok(r.code === 200 && r.body.ok && r.body.database === "ok" && r.body.version === "3.4.0" && r.body.serverKey, "health check");

// brute force
let blocked = false;
for (let i = 0; i < 12; i++) {
  const x = await call(auth, { body: { action: "login", username: "leo2233", password: "guess-" + i }, ip: "5.5.5." + i });
  if (x.code === 429) blocked = true;
}
ok(blocked, "brute force on one Bean ID is rate limited");

console.log(`\n${pass} passed, ${failN} failed`);
clearInterval(keepAlive);
process.exit(failN ? 1 : 0);
