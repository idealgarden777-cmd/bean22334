// Bean Meet: real /api/meet handler against the fake Supabase.
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test";
process.env.GEMINI_API_KEY = "k";
const base = new URL("../api", import.meta.url).href;
const { db, install, call } = await import("./fakedb.mjs");
const { supabase, NEYO_ID } = await import(`${base}/_lib/session.js`);
install(supabase);
const auth = (await import(`${base}/auth.js`)).default;
const conversations = (await import(`${base}/conversations.js`)).default;
const messages = (await import(`${base}/messages.js`)).default;
const meet = (await import(`${base}/meet.js`)).default;
const sync = (await import(`${base}/sync.js`)).default;
const keepAlive = setInterval(() => {}, 1000);

let notesAsked = "";
globalThis.fetch = async (_url, init) => ((notesAsked = String(init?.body || "")), { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: "Summary\n- They agreed to ship on Friday.\nAction items\n- Leo → test calls" }] } }] }) });

let pass = 0, failN = 0;
const ok = (c, l) => { c ? pass++ : failN++; console.log((c ? "PASS " : "FAIL ") + l); };
(db.bean_users ||= []).push({ id: NEYO_ID, username: "neyo", display_name: "Neyo", status: "active" });

async function signup(username) {
  const r = await call(auth, { body: { action: "register", username, password: "very-long-password-1" }, ip: `10.1.${username.length}.${Math.floor(Math.random() * 200)}` });
  return { cookie: `bean_session=${r.headers["set-cookie"].match(/bean_session=([^;]+)/)[1]}`, user: r.body.user };
}
const sam = await signup("samuel");
const leo = await signup("leo2233");
const ali = await signup("ali777");
const eve = await signup("evelyn");

let r = await call(conversations, { cookie: sam.cookie, body: { action: "create_group", title: "Team", usernames: ["leo2233", "ali777"] } });
const group = r.body.conversation || r.body;
ok(group?.id, "group created");

// start a meeting in the group
r = await call(meet, { cookie: sam.cookie, body: { action: "create", conversationId: group.id } });
ok(r.code === 200 && /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(r.body.meeting.code), "meeting starts with a random code");
const code = r.body.meeting.code;
const meetingId = r.body.meeting.id;
r = await call(messages, { method: "GET", cookie: leo.cookie, query: { conversationId: group.id } });
const card = (r.body.messages || []).find((m) => m.meeting);
ok(card && card.kind === "call" && card.meeting.code === code && card.meeting.status === "live" && !card.attachment, "chat gets a server-written meeting card");

r = await call(meet, { cookie: leo.cookie, body: { action: "create", conversationId: group.id } });
ok(r.body.meeting.code === code && r.body.existing, "a second start in the same chat joins the running meeting");

r = await call(meet, { method: "GET", cookie: eve.cookie, query: { code: "abc-defg-hij" } });
ok(r.code === 404, "unknown codes are not found");
r = await call(meet, { method: "GET", cookie: "", query: { code } });
ok(r.code === 401, "no Bean session, no meeting");
r = await call(meet, { method: "GET", cookie: eve.cookie, query: { code: "<script>" } });
ok(r.code === 404, "malformed codes rejected");

// preview + join
r = await call(meet, { method: "GET", cookie: leo.cookie, query: { code } });
ok(r.code === 200 && r.body.direct === true && r.body.meeting.host.username === "samuel", "chat member sees verified host and can join directly");
r = await call(meet, { method: "GET", cookie: eve.cookie, query: { code } });
ok(r.code === 200 && r.body.direct === false && r.body.meeting.chatTitle === null, "outsider must ask, and doesn't see the chat name");

r = await call(meet, { cookie: sam.cookie, body: { action: "join", code } });
const samPeer = r.body.peer;
ok(samPeer.status === "joined", "host joins");
r = await call(meet, { cookie: leo.cookie, body: { action: "join", code, muted: true } });
const leoPeer = r.body.peer;
ok(leoPeer.status === "joined" && leoPeer.muted === true, "member joins (muted)");
r = await call(meet, { cookie: eve.cookie, body: { action: "join", code } });
const evePeer = r.body.peer;
ok(evePeer.status === "waiting", "outsider waits in the lobby");

// lobby: waiting person sees nobody, can't signal
r = await call(meet, { method: "GET", cookie: eve.cookie, query: { id: meetingId, peer: evePeer.id } });
ok(r.body.peers.length === 1 && r.body.peers[0].id === evePeer.id && r.body.signals.length === 0, "lobby sees no one and gets no signals");
r = await call(meet, { cookie: eve.cookie, body: { action: "signal", id: meetingId, peerId: evePeer.id, to: samPeer.id, type: "offer", payload: { sdp: "x" } } });
ok(r.code === 403, "lobby can't send signals");
r = await call(meet, { method: "GET", cookie: eve.cookie, query: { id: meetingId, peer: samPeer.id } });
ok(r.code === 403, "can't poll as someone else's peer");

// host sees the knock with Bean ID, admits
r = await call(meet, { method: "GET", cookie: sam.cookie, query: { id: meetingId, peer: samPeer.id } });
const knock = r.body.peers.find((p) => p.status === "waiting");
ok(knock && knock.user.username === "evelyn", "people inside see who is knocking (Bean ID)");
r = await call(meet, { cookie: sam.cookie, body: { action: "admit", id: meetingId, peerId: samPeer.id, target: evePeer.id, allow: true } });
ok(r.code === 200, "admit works");
r = await call(meet, { method: "GET", cookie: eve.cookie, query: { id: meetingId, peer: evePeer.id } });
ok(r.body.me.status === "joined" && r.body.peers.length === 3, "admitted person is in and sees everyone");

// signalling between peers
r = await call(meet, { cookie: leo.cookie, body: { action: "signal", id: meetingId, peerId: leoPeer.id, to: samPeer.id, type: "offer", payload: { type: "offer", sdp: "v=0", screen: null } } });
ok(r.body.ok, "signal sent");
r = await call(meet, { method: "GET", cookie: sam.cookie, query: { id: meetingId, peer: samPeer.id, after: 0 } });
ok(r.body.signals.length === 1 && r.body.signals[0].from_peer === leoPeer.id && r.body.signals[0].type === "offer", "signal delivered only to its target");
const lastSig = r.body.signals[0].id;
r = await call(meet, { method: "GET", cookie: sam.cookie, query: { id: meetingId, peer: samPeer.id, after: lastSig } });
ok(r.body.signals.length === 0, "signals are delivered once");
r = await call(meet, { cookie: leo.cookie, body: { action: "signal", id: meetingId, peerId: leoPeer.id, to: samPeer.id, type: "evil", payload: {} } });
ok(r.code === 400, "unknown signal types rejected");

// state: hand + screen share
r = await call(meet, { cookie: leo.cookie, body: { action: "state", id: meetingId, peerId: leoPeer.id, hand: true, sharing: true } });
r = await call(meet, { method: "GET", cookie: sam.cookie, query: { id: meetingId, peer: samPeer.id } });
const leoNow = r.body.peers.find((p) => p.id === leoPeer.id);
ok(leoNow.hand && leoNow.sharing, "raised hand and presenting show for everyone");
await call(meet, { cookie: eve.cookie, body: { action: "state", id: meetingId, peerId: evePeer.id, sharing: true } });
r = await call(meet, { method: "GET", cookie: sam.cookie, query: { id: meetingId, peer: samPeer.id } });
ok(r.body.peers.filter((p) => p.sharing).length === 2, "two people can present at once");

// captions
r = await call(meet, { cookie: leo.cookie, body: { action: "caption", id: meetingId, peerId: leoPeer.id, text: "hello" } });
ok(r.body.ok === false, "no captions saved until transcript is on");
await call(meet, { cookie: leo.cookie, body: { action: "transcribe", id: meetingId, peerId: leoPeer.id, on: true } });
await call(meet, { cookie: leo.cookie, body: { action: "caption", id: meetingId, peerId: leoPeer.id, text: "Let's ship on Friday" } });
await call(meet, { cookie: sam.cookie, body: { action: "caption", id: meetingId, peerId: samPeer.id, text: "Agreed, Leo tests calls" } });
r = await call(meet, { method: "GET", cookie: eve.cookie, query: { id: meetingId, peer: evePeer.id, captions: 0 } });
ok(r.body.meeting.transcribing && r.body.captions.length === 2 && r.body.captions[0].name, "live captions reach everyone with names");

// host-only controls
r = await call(meet, { cookie: leo.cookie, body: { action: "remove", id: meetingId, peerId: leoPeer.id, target: evePeer.id } });
ok(r.code === 403, "only the host removes people");
r = await call(meet, { cookie: leo.cookie, body: { action: "end", id: meetingId, peerId: leoPeer.id } });
ok(r.code === 403, "only the host ends for everyone");
r = await call(meet, { cookie: sam.cookie, body: { action: "remove", id: meetingId, peerId: samPeer.id, target: evePeer.id } });
r = await call(meet, { method: "GET", cookie: eve.cookie, query: { id: meetingId, peer: evePeer.id } });
ok(r.code === 403, "removed person is out");
r = await call(meet, { cookie: eve.cookie, body: { action: "join", code } });
ok(r.code === 403, "removed person can't come back");

// lock
await call(meet, { cookie: sam.cookie, body: { action: "lock", id: meetingId, peerId: samPeer.id, on: true } });
const zed = await signup("zedzed");
r = await call(meet, { cookie: zed.cookie, body: { action: "join", code } });
ok(r.code === 403 && /locked/.test(r.body.error), "locked meeting takes no new requests");

// transcript access
r = await call(meet, { method: "GET", cookie: zed.cookie, query: { transcript: meetingId } });
ok(r.code === 403, "strangers can't read the transcript");

// end -> card updated, notes posted
r = await call(meet, { cookie: sam.cookie, body: { action: "end", id: meetingId, peerId: samPeer.id } });
ok(r.code === 200, "host ends the meeting");
r = await call(messages, { method: "GET", cookie: ali.cookie, query: { conversationId: group.id } });
const cards = (r.body.messages || []).filter((m) => m.meeting);
ok(cards.some((m) => m.meeting.status === "ended" && m.meeting.people === 3), "meeting card turns into 'ended' with head count");
const notes = cards.find((m) => m.meeting.kind === "notes");
ok(notes && /Friday/.test(notes.meeting.notes) && notes.meeting.lines === 2, "Neyo notes posted in the chat");
ok(/Let's ship on Friday/.test(notesAsked) && !/gemini/i.test(notes.meeting.notes), "notes come from the transcript");
r = await call(meet, { method: "GET", cookie: ali.cookie, query: { transcript: meetingId } });
ok(r.code === 200 && r.body.lines.length === 2 && r.body.notes, "chat members can open the full transcript");
r = await call(meet, { method: "GET", cookie: leo.cookie, query: { id: meetingId, peer: leoPeer.id } });
ok(r.body.ended === true, "everyone's poll sees the end");
r = await call(meet, { cookie: leo.cookie, body: { action: "join", code } });
ok(r.code === 410, "ended meeting can't be joined");

// instant meeting (no chat): host admits, last one out ends it, notes go to Neyo chat
r = await call(meet, { cookie: leo.cookie, body: { action: "create" } });
const inst = r.body.meeting;
ok(inst.conversationId === null, "instant meeting without a chat");
r = await call(meet, { cookie: ali.cookie, body: { action: "join", code: inst.code } });
ok(r.body.peer.status === "waiting", "instant meeting: guests ask first, even friends");
r = await call(meet, { cookie: leo.cookie, body: { action: "join", code: inst.code } });
const leoP2 = r.body.peer;
await call(meet, { cookie: leo.cookie, body: { action: "transcribe", id: inst.id, peerId: leoP2.id, on: true } });
await call(meet, { cookie: leo.cookie, body: { action: "caption", id: inst.id, peerId: leoP2.id, text: "Notes for me" } });
r = await call(meet, { cookie: leo.cookie, body: { action: "leave", id: inst.id, peerId: leoP2.id } });
const ended = db.bean_meetings.find((m) => m.id === inst.id);
ok(ended.status === "ended", "last one out ends the meeting");
const neyoNote = db.bean_messages.find((m) => m.sender_id === NEYO_ID && m.attachment?.meeting?.kind === "notes");
ok(Boolean(neyoNote), "instant meeting notes land in Neyo chat");

// incoming meeting ring through sync
r = await call(meet, { cookie: ali.cookie, body: { action: "create", conversationId: group.id } });
r = await call(sync, { method: "GET", cookie: leo.cookie, query: {} });
ok(r.body.incomingMeeting && r.body.incomingMeeting.code && r.body.incomingMeeting.host.username === "ali777", "group members get a 'meeting started' ring");
r = await call(sync, { method: "GET", cookie: ali.cookie, query: {} });
ok(!r.body.incomingMeeting, "host doesn't ring themselves");

// guessing codes is rate limited
let limited = false;
for (let i = 0; i < 45 && !limited; i++) {
  r = await call(meet, { method: "GET", cookie: zed.cookie, query: { code: `aaa-bbbb-c${String.fromCharCode(97 + (i % 26))}c` } });
  limited = r.code === 429;
}
ok(limited, "code guessing gets rate limited");

clearInterval(keepAlive);
console.log(`\n${pass} passed, ${failN} failed`);
process.exit(failN ? 1 : 0);
