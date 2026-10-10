/* Bean Meet: group video meetings with screen sharing, live captions, a transcript
 * and Neyo meeting notes. Mesh WebRTC (up to MAX_PEOPLE), signalling by polling.
 *
 * Safety (phishing-proof by design):
 *  - every call needs a Bean session; links carry only a random code, never a token
 *  - people who are not in the meeting's chat wait in a lobby until someone inside
 *    admits them, seeing their verified Bean ID first
 *  - meeting cards in chats are written by the server only (users can't fake one)
 *  - code lookups and joins are rate limited, so codes can't be guessed
 *
 * GET  /api/meet?code=<code>                              -> join screen preview
 * GET  /api/meet?id=<id>&peer=<peerId>&after=&captions=   -> live poll (heartbeat)
 * GET  /api/meet?transcript=<id>                          -> full transcript + notes
 * POST /api/meet {action: create|join|admit|remove|signal|state|caption|transcribe|lock|leave|end}
 */
import crypto from "node:crypto";
import { supabase, send, withUser, readBody, fail, getMembership, rateLimit, NEYO_ID } from "./_lib/session.js";
import { insertMessage, loadUsers } from "./_lib/chat.js";
import { geminiReady, ask, neyoDmFor } from "./_lib/neyo.js";

export const MAX_PEOPLE = 8;
const STALE_MS = 25_000; // a peer that stopped polling this long ago has left
const CODE_RE = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

function iceServers() {
  const servers = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  if (process.env.TURN_URL) {
    servers.push({
      urls: process.env.TURN_URL.split(",").map((s) => s.trim()),
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }
  return servers;
}

function newCode() {
  const abc = "abcdefghijkmnopqrstuvwxyz";
  const pick = (n) => Array.from(crypto.randomBytes(n), (b) => abc[b % abc.length]).join("");
  return `${pick(3)}-${pick(4)}-${pick(3)}`;
}

const tableMissing = (error) => error && (["42P01", "PGRST205"].includes(error.code) || /bean_meeting/.test(String(error.message || "")) && /does not exist|schema cache/.test(String(error.message || "")));
function check(error) {
  if (!error) return;
  if (tableMissing(error)) fail(503, "Meetings need the Bean 3.5 database update (bean_update_v35.sql)");
  throw error;
}

const fresh = (p) => Date.now() - new Date(p.last_seen_at).getTime() < STALE_MS;

async function getMeeting(query) {
  const { data, error } = await query.maybeSingle();
  check(error);
  if (!data) fail(404, "Meeting not found");
  return data;
}

async function peersOf(meetingId) {
  const { data, error } = await supabase.from("bean_meeting_peers").select("*").eq("meeting_id", meetingId).in("status", ["waiting", "joined"]);
  check(error);
  return (data || []).filter(fresh);
}

async function myPeer(meeting, peerId, me, { joined = true } = {}) {
  const { data, error } = await supabase.from("bean_meeting_peers").select("*").eq("id", String(peerId || "")).eq("meeting_id", meeting.id).maybeSingle();
  check(error);
  if (!data || data.user_id !== me.id) fail(403, "You are not in this meeting");
  if (data.status === "removed") fail(403, "You were removed from this meeting");
  if (data.status === "denied") fail(403, "Your request to join was declined");
  if (joined && data.status !== "joined") fail(403, "Waiting to be let in");
  return data;
}

async function isChatMember(meeting, userId) {
  if (!meeting.conversation_id) return false;
  try {
    await getMembership(meeting.conversation_id, userId);
    return true;
  } catch {
    return false;
  }
}

function shapeMeeting(m, users) {
  return {
    id: m.id,
    code: m.code,
    title: m.title || "Bean meeting",
    status: m.status,
    host: users?.get(m.host_id) || null,
    hostId: m.host_id,
    conversationId: m.conversation_id,
    transcribing: m.transcribing,
    locked: m.locked,
    createdAt: m.created_at,
    endedAt: m.ended_at,
  };
}

const shapePeer = (p, users) => ({
  id: p.id,
  userId: p.user_id,
  user: users.get(p.user_id) || null,
  status: p.status,
  hand: p.hand,
  muted: p.muted,
  cameraOff: p.camera_off,
  sharing: p.sharing,
  joinedAt: p.joined_at,
});

function formatDuration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}:${String(s % 60).padStart(2, "0")}`;
}

/* The meeting card in the chat: written only here, kept in step with the meeting. */
async function updateCard(meeting, patch) {
  if (!meeting.message_id) return;
  const { data: msg } = await supabase.from("bean_messages").select("attachment").eq("id", meeting.message_id).maybeSingle();
  if (!msg?.attachment?.meeting) return;
  await supabase
    .from("bean_messages")
    .update({ attachment: { meeting: { ...msg.attachment.meeting, ...patch } }, updated_at: new Date().toISOString() })
    .eq("id", meeting.message_id);
}

async function loadTranscript(meetingId) {
  const { data, error } = await supabase
    .from("bean_meeting_captions")
    .select("id, user_id, text, created_at")
    .eq("meeting_id", meetingId)
    .order("id", { ascending: true })
    .limit(4000);
  check(error);
  return data || [];
}

async function makeNotes(meeting, lines, users) {
  if (!lines.length || !geminiReady()) return null;
  const text = lines
    .map((l) => `${users.get(l.user_id)?.displayName || "Someone"}: ${l.text}`)
    .join("\n")
    .slice(-60000);
  try {
    const out = await ask(
      "You are Neyo, writing meeting notes for a Bean video meeting. Write in the language the people spoke. Plain text, no markdown symbols except '- ' bullets. Sections: Summary (2-3 sentences), Decisions, Action items (who → what). Skip a section that has nothing. Never invent facts. Never mention which AI model you are.",
      `Meeting: ${meeting.title || "Bean meeting"}\nTranscript:\n${text}`,
      700
    );
    return out?.trim().slice(0, 4000) || null;
  } catch {
    return null;
  }
}

/* End a meeting once: card turns into a summary, notes go to the chat (or to each person's Neyo chat). */
async function endMeeting(meeting) {
  const now = new Date().toISOString();
  const { data: ended } = await supabase
    .from("bean_meetings")
    .update({ status: "ended", ended_at: now, transcribing: false })
    .eq("id", meeting.id)
    .eq("status", "live")
    .select("*")
    .maybeSingle();
  if (!ended) return; // someone else already ended it
  await supabase.from("bean_meeting_peers").update({ status: "left", left_at: now }).eq("meeting_id", meeting.id).in("status", ["waiting", "joined"]);

  const { data: everyone } = await supabase.from("bean_meeting_peers").select("user_id, joined_at").eq("meeting_id", meeting.id);
  const people = [...new Set((everyone || []).filter((p) => p.joined_at).map((p) => p.user_id))];
  const duration = formatDuration(Date.now() - new Date(meeting.created_at).getTime());
  const lines = await loadTranscript(meeting.id).catch(() => []);
  const users = await loadUsers([...people, ...lines.map((l) => l.user_id)]);
  const notes = await makeNotes(meeting, lines, users);
  if (notes) await supabase.from("bean_meetings").update({ notes }).eq("id", meeting.id);
  await updateCard(meeting, { status: "ended", duration, people: people.length, endedAt: now });
  await supabase.from("bean_meeting_signals").delete().eq("meeting_id", meeting.id);

  if (!notes && !lines.length) return;
  const card = { meeting: { id: meeting.id, code: meeting.code, title: meeting.title || "Bean meeting", kind: "notes", notes, lines: lines.length, duration, people: people.length } };
  const body = `Meeting notes · ${meeting.title || "Bean meeting"}`;
  if (meeting.conversation_id) {
    await insertMessage({ conversationId: meeting.conversation_id, senderId: meeting.host_id, kind: "call", body, attachment: card });
  } else {
    for (const uid of people) {
      const dm = await neyoDmFor(uid).catch(() => null);
      if (dm) await insertMessage({ conversationId: dm, senderId: NEYO_ID, kind: "call", body, attachment: card }).catch(() => {});
    }
  }
}

/* Nobody polled for a while: the meeting is over. A fresh meeting nobody has
 * entered yet stays open 10 minutes (the host may still be on the join screen). */
async function endIfEmpty(meeting) {
  if (meeting.status !== "live") return meeting;
  const { data: all, error } = await supabase.from("bean_meeting_peers").select("status, joined_at, last_seen_at").eq("meeting_id", meeting.id);
  check(error);
  const rows = all || [];
  if (rows.some((p) => p.status === "joined" && fresh(p))) return meeting;
  const lastSeen = Math.max(new Date(meeting.created_at).getTime(), ...rows.filter((p) => p.joined_at).map((p) => new Date(p.last_seen_at).getTime()));
  const everEntered = rows.some((p) => p.joined_at);
  const idle = Date.now() - lastSeen;
  if (idle < (everEntered ? STALE_MS + 15_000 : 10 * 60_000)) return meeting;
  await endMeeting(meeting);
  return { ...meeting, status: "ended" };
}

export default withUser(
  async (req, res, me) => {
    if (req.method === "GET") {
      const q = req.query;

      if (q.config) return send(res, 200, { iceServers: iceServers(), maxPeople: MAX_PEOPLE });

      if (q.code) {
        await rateLimit(`meetcode:${me.id}`, 40, 60);
        const code = String(q.code).toLowerCase();
        if (!CODE_RE.test(code)) fail(404, "Check the meeting code");
        let meeting = await getMeeting(supabase.from("bean_meetings").select("*").eq("code", code));
        meeting = await endIfEmpty(meeting);
        const peers = await peersOf(meeting.id);
        const joined = peers.filter((p) => p.status === "joined");
        const users = await loadUsers([meeting.host_id, ...joined.map((p) => p.user_id)]);
        const member = meeting.host_id === me.id || (await isChatMember(meeting, me.id));
        let chatTitle = null;
        if (meeting.conversation_id && member) {
          const { data: conv } = await supabase.from("bean_conversations").select("title, type").eq("id", meeting.conversation_id).maybeSingle();
          chatTitle = conv?.type === "group" ? conv.title : null;
        }
        return send(res, 200, {
          meeting: { ...shapeMeeting(meeting, users), chatTitle },
          people: joined.map((p) => users.get(p.user_id)).filter(Boolean).slice(0, MAX_PEOPLE),
          full: joined.length >= MAX_PEOPLE,
          direct: member, // goes straight in; everyone else asks to join
          iceServers: iceServers(),
        });
      }

      if (q.transcript) {
        const meeting = await getMeeting(supabase.from("bean_meetings").select("*").eq("id", String(q.transcript)));
        const { data: wasIn } = await supabase.from("bean_meeting_peers").select("id, joined_at").eq("meeting_id", meeting.id).eq("user_id", me.id);
        const allowed = meeting.host_id === me.id || (wasIn || []).some((p) => p.joined_at) || (await isChatMember(meeting, me.id));
        if (!allowed) fail(403, "Only people from this meeting can read its transcript");
        const lines = await loadTranscript(meeting.id);
        const users = await loadUsers([meeting.host_id, ...lines.map((l) => l.user_id)]);
        return send(res, 200, {
          meeting: shapeMeeting(meeting, users),
          notes: meeting.notes || null,
          lines: lines.map((l) => ({ id: l.id, name: users.get(l.user_id)?.displayName || "Someone", userId: l.user_id, text: l.text, at: l.created_at })),
        });
      }

      // live poll
      let meeting = await getMeeting(supabase.from("bean_meetings").select("*").eq("id", String(q.id || "")));
      const peer = await myPeer(meeting, q.peer, me, { joined: false });
      if (meeting.status === "ended") return send(res, 200, { meeting: shapeMeeting(meeting), ended: true });
      if (peer.status === "left") return send(res, 200, { meeting: shapeMeeting(meeting), left: true });
      const now = new Date().toISOString();
      await supabase.from("bean_meeting_peers").update({ last_seen_at: now }).eq("id", peer.id);

      const after = Number(q.after || 0);
      const captionsAfter = Number(q.captions || 0);
      const [peers, sigRes, capRes] = await Promise.all([
        peersOf(meeting.id),
        peer.status === "joined"
          ? supabase.from("bean_meeting_signals").select("id, from_peer, type, payload").eq("meeting_id", meeting.id).eq("to_peer", peer.id).gt("id", after).order("id", { ascending: true }).limit(200)
          : Promise.resolve({ data: [] }),
        peer.status === "joined" && captionsAfter >= 0
          ? supabase.from("bean_meeting_captions").select("id, user_id, text, created_at").eq("meeting_id", meeting.id).gt("id", captionsAfter).order("id", { ascending: true }).limit(60)
          : Promise.resolve({ data: [] }),
      ]);
      check(sigRes.error);
      const users = await loadUsers([meeting.host_id, ...peers.map((p) => p.user_id), ...(capRes.data || []).map((c) => c.user_id)]);
      const visible = peer.status === "joined" ? peers : peers.filter((p) => p.id === peer.id);
      return send(res, 200, {
        meeting: shapeMeeting(meeting, users),
        me: shapePeer({ ...peer, last_seen_at: now }, users),
        peers: visible.map((p) => shapePeer(p, users)),
        signals: sigRes.data || [],
        captions: (capRes.data || []).map((c) => ({ id: c.id, userId: c.user_id, name: users.get(c.user_id)?.displayName || "Someone", text: c.text, at: c.created_at })),
      });
    }

    const body = readBody(req);
    const action = body.action;

    if (action === "create") {
      const title = String(body.title || "").trim().slice(0, 80) || null;
      let conversationId = body.conversationId || null;
      let convTitle = null;
      if (conversationId) {
        await getMembership(conversationId, me.id);
        const { data: conv } = await supabase.from("bean_conversations").select("type, title").eq("id", conversationId).maybeSingle();
        convTitle = conv?.type === "group" ? conv.title : null;
        // a meeting already running in this chat: join that one instead of starting a second
        const { data: running, error } = await supabase.from("bean_meetings").select("*").eq("conversation_id", conversationId).eq("status", "live").order("created_at", { ascending: false }).limit(1).maybeSingle();
        check(error);
        if (running) {
          const still = await endIfEmpty(running);
          if (still.status === "live") return send(res, 200, { meeting: shapeMeeting(still), existing: true });
        }
      }
      await rateLimit(`meetnew:${me.id}`, 20, 3600);
      let meeting = null;
      for (let i = 0; i < 4 && !meeting; i++) {
        const { data, error } = await supabase
          .from("bean_meetings")
          .insert({ code: newCode(), conversation_id: conversationId, host_id: me.id, title: title || convTitle })
          .select("*")
          .single();
        if (error && error.code === "23505") continue; // code clash, try another
        check(error);
        meeting = data;
      }
      if (!meeting) fail(500, "Could not start a meeting");
      if (conversationId) {
        const msg = await insertMessage({
          conversationId,
          senderId: me.id,
          kind: "call",
          body: "Started a meeting",
          attachment: { meeting: { id: meeting.id, code: meeting.code, title: meeting.title || "Bean meeting", status: "live", startedAt: meeting.created_at } },
        });
        await supabase.from("bean_meetings").update({ message_id: msg.id }).eq("id", meeting.id);
        meeting.message_id = msg.id;
      }
      const users = await loadUsers([me.id]);
      return send(res, 200, { meeting: shapeMeeting(meeting, users) });
    }

    if (action === "join") {
      await rateLimit(`meetjoin:${me.id}`, 30, 60);
      const code = String(body.code || "").toLowerCase();
      if (!CODE_RE.test(code)) fail(404, "Check the meeting code");
      let meeting = await getMeeting(supabase.from("bean_meetings").select("*").eq("code", code));
      meeting = await endIfEmpty(meeting);
      if (meeting.status !== "live") fail(410, "This meeting has ended");
      const { data: before } = await supabase.from("bean_meeting_peers").select("status").eq("meeting_id", meeting.id).eq("user_id", me.id);
      if ((before || []).some((p) => p.status === "removed")) fail(403, "You were removed from this meeting");
      const peers = await peersOf(meeting.id);
      const direct = meeting.host_id === me.id || (await isChatMember(meeting, me.id));
      if (!direct && meeting.locked) fail(403, "This meeting is locked");
      if (direct && peers.filter((p) => p.status === "joined").length >= MAX_PEOPLE) fail(409, `This meeting is full (${MAX_PEOPLE} people)`);
      if (!direct && peers.filter((p) => p.status === "waiting").length >= 10) fail(429, "Too many people are waiting to join");
      // my older tabs in this meeting leave, so I am never in twice
      await supabase.from("bean_meeting_peers").update({ status: "left", left_at: new Date().toISOString() }).eq("meeting_id", meeting.id).eq("user_id", me.id).in("status", ["waiting", "joined"]);
      const nowIso = new Date().toISOString();
      const { data: peer, error } = await supabase
        .from("bean_meeting_peers")
        .insert({
          meeting_id: meeting.id,
          user_id: me.id,
          status: direct ? "joined" : "waiting",
          joined_at: direct ? nowIso : null,
          muted: Boolean(body.muted),
          camera_off: Boolean(body.cameraOff),
          last_seen_at: nowIso,
        })
        .select("*")
        .single();
      check(error);
      const users = await loadUsers([meeting.host_id, me.id]);
      return send(res, 200, { meeting: shapeMeeting(meeting, users), peer: shapePeer(peer, users), iceServers: iceServers(), maxPeople: MAX_PEOPLE });
    }

    // everything below acts inside a meeting
    const meeting = await getMeeting(supabase.from("bean_meetings").select("*").eq("id", String(body.id || "")));
    if (meeting.status !== "live" && action !== "leave") fail(410, "This meeting has ended");

    switch (action) {
      case "admit": {
        await myPeer(meeting, body.peerId, me);
        const { data: target } = await supabase.from("bean_meeting_peers").select("*").eq("id", String(body.target || "")).eq("meeting_id", meeting.id).maybeSingle();
        if (!target || target.status !== "waiting") fail(404, "Nobody is waiting");
        if (body.allow) {
          const joined = (await peersOf(meeting.id)).filter((p) => p.status === "joined");
          if (joined.length >= MAX_PEOPLE) fail(409, `This meeting is full (${MAX_PEOPLE} people)`);
        }
        await supabase
          .from("bean_meeting_peers")
          .update(body.allow ? { status: "joined", joined_at: new Date().toISOString() } : { status: "denied" })
          .eq("id", target.id)
          .eq("status", "waiting");
        return send(res, 200, { ok: true });
      }

      case "remove": {
        await myPeer(meeting, body.peerId, me);
        if (meeting.host_id !== me.id) fail(403, "Only the host can remove people");
        const { data: target } = await supabase.from("bean_meeting_peers").select("*").eq("id", String(body.target || "")).eq("meeting_id", meeting.id).maybeSingle();
        if (!target || target.user_id === me.id) fail(404, "Person not found");
        await supabase.from("bean_meeting_peers").update({ status: "removed", left_at: new Date().toISOString() }).eq("id", target.id);
        return send(res, 200, { ok: true });
      }

      case "signal": {
        const peer = await myPeer(meeting, body.peerId, me);
        if (!["offer", "answer", "ice"].includes(body.type)) fail(400, "Bad signal");
        const payload = body.payload || {};
        if (JSON.stringify(payload).length > 60000) fail(413, "Signal too large");
        const { data: to } = await supabase.from("bean_meeting_peers").select("id, status").eq("id", String(body.to || "")).eq("meeting_id", meeting.id).maybeSingle();
        if (!to || to.status !== "joined") return send(res, 200, { ok: false });
        const { error } = await supabase.from("bean_meeting_signals").insert({ meeting_id: meeting.id, from_peer: peer.id, to_peer: to.id, type: body.type, payload });
        check(error);
        return send(res, 200, { ok: true });
      }

      case "state": {
        const peer = await myPeer(meeting, body.peerId, me);
        const patch = {};
        for (const [k, col] of [["hand", "hand"], ["muted", "muted"], ["cameraOff", "camera_off"], ["sharing", "sharing"]]) {
          if (typeof body[k] === "boolean") patch[col] = body[k];
        }
        if (Object.keys(patch).length) await supabase.from("bean_meeting_peers").update(patch).eq("id", peer.id);
        return send(res, 200, { ok: true });
      }

      case "caption": {
        await myPeer(meeting, body.peerId, me);
        if (!meeting.transcribing) return send(res, 200, { ok: false });
        const text = String(body.text || "").replace(/\s+/g, " ").trim().slice(0, 400);
        if (!text) return send(res, 200, { ok: false });
        const { error } = await supabase.from("bean_meeting_captions").insert({ meeting_id: meeting.id, user_id: me.id, text });
        check(error);
        return send(res, 200, { ok: true });
      }

      case "transcribe": {
        await myPeer(meeting, body.peerId, me);
        await supabase.from("bean_meetings").update({ transcribing: Boolean(body.on) }).eq("id", meeting.id);
        return send(res, 200, { ok: true, transcribing: Boolean(body.on) });
      }

      case "lock": {
        await myPeer(meeting, body.peerId, me);
        if (meeting.host_id !== me.id) fail(403, "Only the host can lock the meeting");
        await supabase.from("bean_meetings").update({ locked: Boolean(body.on) }).eq("id", meeting.id);
        return send(res, 200, { ok: true });
      }

      case "leave": {
        const peer = await myPeer(meeting, body.peerId, me, { joined: false });
        await supabase.from("bean_meeting_peers").update({ status: "left", left_at: new Date().toISOString(), sharing: false, hand: false }).eq("id", peer.id);
        if (meeting.status === "live") {
          const left = (await peersOf(meeting.id)).filter((p) => p.status === "joined");
          if (!left.length) await endMeeting(meeting);
        }
        return send(res, 200, { ok: true });
      }

      case "end": {
        await myPeer(meeting, body.peerId, me);
        if (meeting.host_id !== me.id) fail(403, "Only the host can end the meeting for everyone");
        await endMeeting(meeting);
        return send(res, 200, { ok: true });
      }

      default:
        fail(400, "Unknown action");
    }
  },
  { methods: ["GET", "POST"], limit: [1500, 60], name: "meet" }
);
