import { supabase, send, withUser, readBody, fail, getMembership } from "./_lib/session.js";
import { insertMessage, loadUsers, cleanEnc } from "./_lib/chat.js";

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

async function getCall(id, me) {
  const { data: call, error } = await supabase.from("bean_calls").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!call || (call.caller_id !== me.id && call.callee_id !== me.id)) fail(404, "Call not found");
  return call;
}

function shapeCall(call, me, users) {
  const peerId = call.caller_id === me.id ? call.callee_id : call.caller_id;
  return {
    id: call.id,
    conversationId: call.conversation_id,
    kind: call.kind,
    status: call.status,
    role: call.caller_id === me.id ? "caller" : "callee",
    peer: users?.get(peerId) || null,
    createdAt: call.created_at,
    answeredAt: call.answered_at,
    endedAt: call.ended_at,
  };
}

function formatDuration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

async function logCall(call, status) {
  const label = call.kind === "video" ? "video call" : "voice call";
  let text;
  if (status === "ended" && call.answered_at) {
    text = `${label[0].toUpperCase()}${label.slice(1)} · ${formatDuration(Date.now() - new Date(call.answered_at).getTime())}`;
  } else if (status === "declined") {
    text = `Declined ${label}`;
  } else {
    text = `Missed ${label}`;
  }
  await insertMessage({ conversationId: call.conversation_id, senderId: call.caller_id, kind: "call", body: text });
}

/* GET  /api/calls?config=1                    -> { iceServers }
 * GET  /api/calls?id=<callId>&after=<signal>  -> { call, signals }
 * POST /api/calls {action: start|accept|decline|end|signal, ...}   */
export default withUser(
  async (req, res, me) => {
    if (req.method === "GET") {
      if (req.query.config) return send(res, 200, { iceServers: iceServers() });
      const call = await getCall(String(req.query.id || ""), me);
      const after = Number(req.query.after || 0);
      const { data: signals, error } = await supabase
        .from("bean_call_signals")
        .select("id, type, payload")
        .eq("call_id", call.id)
        .eq("to_user", me.id)
        .gt("id", after)
        .order("id", { ascending: true })
        .limit(100);
      if (error) throw error;
      return send(res, 200, { call: shapeCall(call, me), signals: signals || [] });
    }

    const body = readBody(req);

    switch (body.action) {
      case "start": {
        const { conversationId } = body;
        await getMembership(conversationId, me.id);
        const kind = body.kind === "video" ? "video" : "audio";
        const { data: conv } = await supabase.from("bean_conversations").select("type").eq("id", conversationId).single();
        if (conv?.type !== "dm") fail(400, "Calls work in one-to-one chats for now");
        const { data: members } = await supabase
          .from("bean_conversation_members")
          .select("user_id")
          .eq("conversation_id", conversationId)
          .neq("user_id", me.id);
        const calleeId = members?.[0]?.user_id;
        if (!calleeId) fail(400, "Nobody to call");

        // end any stale ringing calls between these two
        await supabase
          .from("bean_calls")
          .update({ status: "missed", ended_at: new Date().toISOString() })
          .eq("conversation_id", conversationId)
          .eq("status", "ringing");

        const { data: call, error } = await supabase
          .from("bean_calls")
          .insert({ conversation_id: conversationId, caller_id: me.id, callee_id: calleeId, kind })
          .select("*")
          .single();
        if (error) throw error;
        const users = await loadUsers([calleeId]);
        return send(res, 200, { call: shapeCall(call, me, users), iceServers: iceServers() });
      }

      case "accept": {
        const call = await getCall(body.id, me);
        if (call.callee_id !== me.id) fail(403, "Not your call");
        if (call.status !== "ringing") fail(409, "Call already ended");
        const { data: updated } = await supabase
          .from("bean_calls")
          .update({ status: "active", answered_at: new Date().toISOString() })
          .eq("id", call.id)
          .eq("status", "ringing")
          .select("*")
          .single();
        if (!updated) fail(409, "Call already ended");
        const users = await loadUsers([call.caller_id]);
        return send(res, 200, { call: shapeCall(updated, me, users), iceServers: iceServers() });
      }

      case "decline":
      case "end": {
        const call = await getCall(body.id, me);
        if (["ended", "declined", "missed"].includes(call.status)) return send(res, 200, { call: shapeCall(call, me) });
        let status = "ended";
        if (call.status === "ringing") status = body.action === "decline" && call.callee_id === me.id ? "declined" : "missed";
        const { data: updated } = await supabase
          .from("bean_calls")
          .update({ status, ended_at: new Date().toISOString() })
          .eq("id", call.id)
          .in("status", ["ringing", "active"])
          .select("*")
          .maybeSingle();
        if (updated) await logCall(call, status);
        return send(res, 200, { call: shapeCall(updated || call, me) });
      }

      case "signal": {
        const call = await getCall(body.id, me);
        if (!["offer", "answer", "ice"].includes(body.type)) fail(400, "Bad signal");
        if (["ended", "declined", "missed"].includes(call.status)) fail(409, "Call ended");
        const to = call.caller_id === me.id ? call.callee_id : call.caller_id;
        // Signalling is end-to-end encrypted with the chat key, so the server can't swap the
        // call's DTLS fingerprint (no man-in-the-middle on voice/video).
        const enc = cleanEnc(body.payload?.enc, 30000);
        if (!enc) fail(400, "Call signalling must be end-to-end encrypted. Refresh Bean.");
        const { error } = await supabase
          .from("bean_call_signals")
          .insert({ call_id: call.id, from_user: me.id, to_user: to, type: body.type, payload: { enc } });
        if (error) throw error;
        return send(res, 200, { ok: true });
      }

      default:
        fail(400, "Unknown action");
    }
  },
  { methods: ["GET", "POST"], limit: [900, 60], name: "calls" }
);
