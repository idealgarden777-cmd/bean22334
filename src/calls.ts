/* ============================================================
   BEAN — SIGNATURESI
   Calls Module

   Responsibilities:
   - Manage voice/video call lifecycle
   - Request microphone/camera permissions
   - Create and own WebRTC peer connection
   - Exchange SDP / ICE through signaling provider
   - Track local and remote media streams
   - Expose stable call state/events
   - Clean up call resources safely

   Must NOT own:
   - Signaling backend implementation
   - TURN/STUN secrets
   - UI rendering
   - Push notifications
   - Conversation membership database logic
   - Call history persistence
   - User discovery

   SECURITY:
   - Call identity uses immutable UUID
   - TURN credentials must come from trusted backend
   - No secrets inside frontend source
   ============================================================ */


/* ============================================================
   IMPORTS
   ============================================================ */

import {
  config
} from "./core";

import {
  requireAuthenticatedUser
} from "./auth";

import {
  createError,
  normalizeError
} from "./errors";

import {
  getOwnMembership
} from "./conversations";


/* ============================================================
   CALL TYPES
   ============================================================ */

export type CallMode =
  | "voice"
  | "video";


export type CallDirection =
  | "outgoing"
  | "incoming";


export type CallStatus =
  | "idle"
  | "preparing"
  | "ringing"
  | "connecting"
  | "connected"
  | "ending"
  | "ended"
  | "failed";


export type CallEndReason =
  | "local_hangup"
  | "remote_hangup"
  | "declined"
  | "cancelled"
  | "busy"
  | "timeout"
  | "connection_failed"
  | "permission_denied"
  | "media_unavailable"
  | "unknown";


/* ============================================================
   ICE CONFIG
   ============================================================ */

export interface CallIceServer {
  urls:
    string | string[];

  username?:
    string;

  credential?:
    string;
}


export interface CallIceConfiguration {
  iceServers:
    CallIceServer[];
}


/* ============================================================
   CALL SESSION
   ============================================================ */

export interface CallSession {
  callId:
    string;

  conversationId:
    string;

  localUserId:
    string;

  remoteUserId:
    string;

  mode:
    CallMode;

  direction:
    CallDirection;

  status:
    CallStatus;

  startedAt:
    number;

  connectedAt:
    number | null;

  endedAt:
    number | null;

  endReason:
    CallEndReason | null;

  localStream:
    MediaStream | null;

  remoteStream:
    MediaStream | null;
}


/* ============================================================
   SIGNALING MESSAGES
   ============================================================ */

export type CallSignal =
  | {
      type:
        "offer";

      callId:
        string;

      conversationId:
        string;

      fromUserId:
        string;

      toUserId:
        string;

      mode:
        CallMode;

      description:
        RTCSessionDescriptionInit;
    }

  | {
      type:
        "answer";

      callId:
        string;

      conversationId:
        string;

      fromUserId:
        string;

      toUserId:
        string;

      description:
        RTCSessionDescriptionInit;
    }

  | {
      type:
        "ice";

      callId:
        string;

      conversationId:
        string;

      fromUserId:
        string;

      toUserId:
        string;

      candidate:
        RTCIceCandidateInit;
    }

  | {
      type:
        "hangup";

      callId:
        string;

      conversationId:
        string;

      fromUserId:
        string;

      toUserId:
        string;

      reason:
        CallEndReason;
    };


/* ============================================================
   SIGNALING PROVIDER

   Future signaling implementation may use:
   - Supabase Realtime private channels
   - trusted signaling endpoint
   - TURN credential endpoint

   calls.ts stays transport-agnostic.
   ============================================================ */

export interface CallSignalingProvider {
  initialize():
    Promise<void>;


  send(
    signal:
      CallSignal
  ): Promise<void>;


  subscribe(
    listener:
      (
        signal:
          CallSignal
      ) => void
  ): () => void;


  getIceConfiguration():
    Promise<CallIceConfiguration>;


  shutdown():
    Promise<void>;
}


/* ============================================================
   CALL EVENTS
   ============================================================ */

export type CallEventName =
  | "bean:call-starting"
  | "bean:call-ringing"
  | "bean:call-connecting"
  | "bean:call-connected"
  | "bean:call-updated"
  | "bean:call-ended"
  | "bean:call-failed"
  | "bean:incoming-call";


function emitCallEvent(
  name:
    CallEventName,
  detail?: unknown
): void {
  window.dispatchEvent(
    new CustomEvent(
      name,
      {
        detail
      }
    )
  );
}


/* ============================================================
   STATE
   ============================================================ */

let signalingProvider:
  CallSignalingProvider | null = null;


let unsubscribeSignals:
  (() => void) | null = null;


let currentSession:
  CallSession | null = null;


let peerConnection:
  RTCPeerConnection | null = null;


const pendingIceCandidates:
  RTCIceCandidateInit[] = [];


/* ============================================================
   PROVIDER REGISTRATION
   ============================================================ */

export function registerCallSignalingProvider(
  provider:
    CallSignalingProvider
): void {
  if (
    currentSession &&
    currentSession.status !==
      "ended"
  ) {
    throw createError(
      "CALL_NOT_ALLOWED",
      "calls",
      {
        message:
          "Cannot replace call signaling during an active call."
      }
    );
  }


  signalingProvider =
    provider;
}


/* ============================================================
   STATE ACCESS
   ============================================================ */

export function getCurrentCall():
  Readonly<CallSession> | null {
  return currentSession;
}


export function hasActiveCall():
  boolean {
  return (
    currentSession !== null &&
    currentSession.status !== "ended" &&
    currentSession.status !== "failed"
  );
}


/* ============================================================
   FEATURE CHECK
   ============================================================ */

function assertCallFeatureEnabled(
  mode:
    CallMode
): void {
  if (
    mode === "voice" &&
    !config.featureDefaults.voiceCalls
  ) {
    throw createError(
      "NOT_SUPPORTED",
      "calls",
      {
        message:
          "Voice calls are disabled."
      }
    );
  }


  if (
    mode === "video" &&
    !config.featureDefaults.videoCalls
  ) {
    throw createError(
      "NOT_SUPPORTED",
      "calls",
      {
        message:
          "Video calls are disabled."
      }
    );
  }
}


/* ============================================================
   WEBRTC SUPPORT
   ============================================================ */

function assertWebRtcAvailable():
  void {
  if (
    typeof RTCPeerConnection ===
      "undefined"
  ) {
    throw createError(
      "CALL_DEVICE_UNAVAILABLE",
      "calls",
      {
        message:
          "WebRTC is unavailable in this browser."
      }
    );
  }


  if (
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices
      .getUserMedia !==
      "function"
  ) {
    throw createError(
      "CALL_DEVICE_UNAVAILABLE",
      "calls",
      {
        message:
          "Camera or microphone APIs are unavailable."
      }
    );
  }
}


/* ============================================================
   UUID
   ============================================================ */

function createCallId():
  string {
  if (
    typeof crypto.randomUUID ===
      "function"
  ) {
    return crypto.randomUUID();
  }


  throw createError(
    "NOT_SUPPORTED",
    "calls",
    {
      message:
        "Secure call ID generation is unavailable."
    }
  );
}


/* ============================================================
   MEDIA
   ============================================================ */

async function createLocalMedia(
  mode:
    CallMode
): Promise<MediaStream> {
  try {
    return await navigator
      .mediaDevices
      .getUserMedia({
        audio:
          true,

        video:
          mode === "video"
            ? {
                facingMode:
                  "user"
              }
            : false
      });
  } catch (error) {
    if (
      error instanceof DOMException
    ) {
      if (
        error.name ===
          "NotAllowedError"
      ) {
        throw createError(
          "PERMISSION_DENIED",
          "calls",
          {
            cause:
              error,

            message:
              "Microphone or camera permission was denied."
          }
        );
      }


      if (
        error.name ===
          "NotFoundError" ||
        error.name ===
          "OverconstrainedError"
      ) {
        throw createError(
          "CALL_DEVICE_UNAVAILABLE",
          "calls",
          {
            cause:
              error
          }
        );
      }
    }


    throw normalizeError(
      error,
      {
        source:
          "calls",

        fallbackCode:
          "CALL_DEVICE_UNAVAILABLE"
      }
    );
  }
}


/* ============================================================
   STOP STREAM
   ============================================================ */

function stopStream(
  stream:
    MediaStream | null
): void {
  if (!stream) {
    return;
  }


  for (
    const track of
    stream.getTracks()
  ) {
    track.stop();
  }
}


/* ============================================================
   SESSION UPDATE
   ============================================================ */

function updateCallStatus(
  status:
    CallStatus
): void {
  if (!currentSession) {
    return;
  }


  currentSession.status =
    status;


  emitCallEvent(
    "bean:call-updated",
    {
      ...currentSession
    }
  );
}


/* ============================================================
   PEER CONNECTION
   ============================================================ */

async function createPeerConnection():
  Promise<RTCPeerConnection> {
  if (!signalingProvider) {
    throw createError(
      "CALL_CONNECTION_FAILED",
      "calls",
      {
        message:
          "Call signaling provider is unavailable."
      }
    );
  }


  let iceConfiguration:
    CallIceConfiguration;


  try {
    iceConfiguration =
      await signalingProvider
        .getIceConfiguration();
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "calls",

        fallbackCode:
          "CALL_CONNECTION_FAILED",

        context: {
          operation:
            "getIceConfiguration"
        }
      }
    );
  }


  const connection =
    new RTCPeerConnection({
      iceServers:
        iceConfiguration
          .iceServers
    });


  connection.addEventListener(
    "icecandidate",
    (
      event
    ) => {
      if (
        !event.candidate ||
        !currentSession ||
        !signalingProvider
      ) {
        return;
      }


      const signal:
        CallSignal = {
          type:
            "ice",

          callId:
            currentSession.callId,

          conversationId:
            currentSession
              .conversationId,

          fromUserId:
            currentSession.localUserId,

          toUserId:
            currentSession.remoteUserId,

          candidate:
            event.candidate
              .toJSON()
        };


      void signalingProvider
        .send(
          signal
        )
        .catch(
          (
            error
          ) => {
            console.warn(
              "[Bean:calls] ICE signal failed.",
              error
            );
          }
        );
    }
  );


  connection.addEventListener(
    "track",
    (
      event
    ) => {
      if (!currentSession) {
        return;
      }


      const stream =
        event.streams[0];


      if (stream) {
        currentSession.remoteStream =
          stream;
      } else {
        if (
          !currentSession
            .remoteStream
        ) {
          currentSession.remoteStream =
            new MediaStream();
        }


        currentSession.remoteStream
          .addTrack(
            event.track
          );
      }


      emitCallEvent(
        "bean:call-updated",
        {
          ...currentSession
        }
      );
    }
  );


  connection.addEventListener(
    "connectionstatechange",
    () => {
      if (!currentSession) {
        return;
      }


      switch (
        connection.connectionState
      ) {
        case "connected":
          currentSession.status =
            "connected";

          currentSession.connectedAt =
            currentSession.connectedAt ??
            Date.now();


          emitCallEvent(
            "bean:call-connected",
            {
              ...currentSession
            }
          );

          break;


        case "failed":
          void finishCall(
            "connection_failed",
            false
          );

          break;


        case "closed":
          if (
            currentSession.status !==
              "ended"
          ) {
            void finishCall(
              "remote_hangup",
              false
            );
          }

          break;


        default:
          break;
      }
    }
  );


  return connection;
}


/* ============================================================
   ADD LOCAL TRACKS
   ============================================================ */

function attachLocalStream(
  connection:
    RTCPeerConnection,
  stream:
    MediaStream
): void {
  for (
    const track of
    stream.getTracks()
  ) {
    connection.addTrack(
      track,
      stream
    );
  }
}


/* ============================================================
   SIGNAL PROCESSING
   ============================================================ */

async function handleSignal(
  signal:
    CallSignal
): Promise<void> {
  const account =
    requireAuthenticatedUser();


  if (
    signal.toUserId !==
      account.id
  ) {
    return;
  }


  switch (
    signal.type
  ) {
    case "offer":
      await handleIncomingOffer(
        signal
      );

      break;


    case "answer":
      await handleAnswer(
        signal
      );

      break;


    case "ice":
      await handleIceCandidate(
        signal
      );

      break;


    case "hangup":
      if (
        currentSession &&
        currentSession.callId ===
          signal.callId
      ) {
        await finishCall(
          signal.reason,
          false
        );
      }

      break;
  }
}


/* ============================================================
   OUTGOING CALL
   ============================================================ */

export async function startCall(
  conversationId: string,
  remoteUserId: string,
  mode: CallMode
): Promise<Readonly<CallSession>> {
  const account =
    requireAuthenticatedUser();


  assertCallFeatureEnabled(
    mode
  );


  assertWebRtcAvailable();


  if (hasActiveCall()) {
    throw createError(
      "CALL_NOT_ALLOWED",
      "calls",
      {
        message:
          "Another call is already active."
      }
    );
  }


  if (
    remoteUserId ===
      account.id
  ) {
    throw createError(
      "INVALID_INPUT",
      "calls",
      {
        message:
          "Cannot call the current user."
      }
    );
  }


  const membership =
    await getOwnMembership(
      conversationId
    );


  if (!membership) {
    throw createError(
      "CONVERSATION_FORBIDDEN",
      "calls"
    );
  }


  if (!signalingProvider) {
    throw createError(
      "CALL_CONNECTION_FAILED",
      "calls",
      {
        message:
          "Call signaling provider is not configured."
      }
    );
  }


  currentSession = {
    callId:
      createCallId(),

    conversationId,

    localUserId:
      account.id,

    remoteUserId,

    mode,

    direction:
      "outgoing",

    status:
      "preparing",

    startedAt:
      Date.now(),

    connectedAt:
      null,

    endedAt:
      null,

    endReason:
      null,

    localStream:
      null,

    remoteStream:
      null
  };


  emitCallEvent(
    "bean:call-starting",
    {
      ...currentSession
    }
  );


  try {
    const localStream =
      await createLocalMedia(
        mode
      );


    currentSession.localStream =
      localStream;


    peerConnection =
      await createPeerConnection();


    attachLocalStream(
      peerConnection,
      localStream
    );


    const offer =
      await peerConnection
        .createOffer();


    await peerConnection
      .setLocalDescription(
        offer
      );


    currentSession.status =
      "ringing";


    await signalingProvider.send({
      type:
        "offer",

      callId:
        currentSession.callId,

      conversationId,

      fromUserId:
        account.id,

      toUserId:
        remoteUserId,

      mode,

      description:
        offer
    });


    emitCallEvent(
      "bean:call-ringing",
      {
        ...currentSession
      }
    );


    return currentSession;
  } catch (error) {
    await finishCall(
      "connection_failed",
      false
    );


    throw normalizeError(
      error,
      {
        source:
          "calls",

        fallbackCode:
          "CALL_CONNECTION_FAILED",

        context: {
          operation:
            "startCall",

          conversationId,

          remoteUserId
        }
      }
    );
  }
}


/* ============================================================
   INCOMING OFFER
   ============================================================ */

async function handleIncomingOffer(
  signal:
    Extract<
      CallSignal,
      {
        type: "offer";
      }
    >
): Promise<void> {
  const account =
    requireAuthenticatedUser();


  assertCallFeatureEnabled(
    signal.mode
  );


  if (hasActiveCall()) {
    if (signalingProvider) {
      await signalingProvider.send({
        type:
          "hangup",

        callId:
          signal.callId,

        conversationId:
          signal.conversationId,

        fromUserId:
          account.id,

        toUserId:
          signal.fromUserId,

        reason:
          "busy"
      });
    }


    return;
  }


  const membership =
    await getOwnMembership(
      signal.conversationId
    );


  if (!membership) {
    return;
  }


  currentSession = {
    callId:
      signal.callId,

    conversationId:
      signal.conversationId,

    localUserId:
      account.id,

    remoteUserId:
      signal.fromUserId,

    mode:
      signal.mode,

    direction:
      "incoming",

    status:
      "ringing",

    startedAt:
      Date.now(),

    connectedAt:
      null,

    endedAt:
      null,

    endReason:
      null,

    localStream:
      null,

    remoteStream:
      null
  };


  /*
   * Store remote offer until acceptCall().
   */
  pendingIncomingOffer =
    signal.description;


  emitCallEvent(
    "bean:incoming-call",
    {
      ...currentSession
    }
  );
}


/* ============================================================
   PENDING OFFER
   ============================================================ */

let pendingIncomingOffer:
  RTCSessionDescriptionInit | null = null;


/* ============================================================
   ACCEPT CALL
   ============================================================ */

export async function acceptCall():
  Promise<Readonly<CallSession>> {
  if (
    !currentSession ||
    currentSession.direction !==
      "incoming" ||
    !pendingIncomingOffer
  ) {
    throw createError(
      "CALL_NOT_ALLOWED",
      "calls",
      {
        message:
          "There is no incoming call to accept."
      }
    );
  }


  if (!signalingProvider) {
    throw createError(
      "CALL_CONNECTION_FAILED",
      "calls"
    );
  }


  assertWebRtcAvailable();


  try {
    updateCallStatus(
      "connecting"
    );


    const localStream =
      await createLocalMedia(
        currentSession.mode
      );


    currentSession.localStream =
      localStream;


    peerConnection =
      await createPeerConnection();


    attachLocalStream(
      peerConnection,
      localStream
    );


    await peerConnection
      .setRemoteDescription(
        pendingIncomingOffer
      );


    await flushPendingIceCandidates();


    const answer =
      await peerConnection
        .createAnswer();


    await peerConnection
      .setLocalDescription(
        answer
      );


    await signalingProvider.send({
      type:
        "answer",

      callId:
        currentSession.callId,

      conversationId:
        currentSession
          .conversationId,

      fromUserId:
        currentSession.localUserId,

      toUserId:
        currentSession.remoteUserId,

      description:
        answer
    });


    pendingIncomingOffer =
      null;


    emitCallEvent(
      "bean:call-connecting",
      {
        ...currentSession
      }
    );


    return currentSession;
  } catch (error) {
    await finishCall(
      "connection_failed",
      true
    );


    throw normalizeError(
      error,
      {
        source:
          "calls",

        fallbackCode:
          "CALL_CONNECTION_FAILED",

        context: {
          operation:
            "acceptCall"
        }
      }
    );
  }
}


/* ============================================================
   DECLINE CALL
   ============================================================ */

export async function declineCall():
  Promise<void> {
  if (
    !currentSession ||
    currentSession.direction !==
      "incoming"
  ) {
    return;
  }


  await finishCall(
    "declined",
    true
  );
}


/* ============================================================
   ANSWER SIGNAL
   ============================================================ */

async function handleAnswer(
  signal:
    Extract<
      CallSignal,
      {
        type: "answer";
      }
    >
): Promise<void> {
  if (
    !currentSession ||
    currentSession.callId !==
      signal.callId ||
    !peerConnection
  ) {
    return;
  }


  try {
    updateCallStatus(
      "connecting"
    );


    await peerConnection
      .setRemoteDescription(
        signal.description
      );


    await flushPendingIceCandidates();


    emitCallEvent(
      "bean:call-connecting",
      {
        ...currentSession
      }
    );
  } catch (error) {
    await finishCall(
      "connection_failed",
      false
    );


    throw normalizeError(
      error,
      {
        source:
          "calls",

        fallbackCode:
          "CALL_CONNECTION_FAILED"
      }
    );
  }
}


/* ============================================================
   ICE SIGNAL
   ============================================================ */

async function handleIceCandidate(
  signal:
    Extract<
      CallSignal,
      {
        type: "ice";
      }
    >
): Promise<void> {
  if (
    !currentSession ||
    currentSession.callId !==
      signal.callId
  ) {
    return;
  }


  if (
    !peerConnection ||
    !peerConnection
      .remoteDescription
  ) {
    pendingIceCandidates.push(
      signal.candidate
    );

    return;
  }


  try {
    await peerConnection
      .addIceCandidate(
        signal.candidate
      );
  } catch (error) {
    console.warn(
      "[Bean:calls] Remote ICE candidate rejected.",
      error
    );
  }
}


/* ============================================================
   FLUSH PENDING ICE
   ============================================================ */

async function flushPendingIceCandidates():
  Promise<void> {
  if (!peerConnection) {
    return;
  }


  while (
    pendingIceCandidates.length >
      0
  ) {
    const candidate =
      pendingIceCandidates.shift();


    if (!candidate) {
      continue;
    }


    try {
      await peerConnection
        .addIceCandidate(
          candidate
        );
    } catch (error) {
      console.warn(
        "[Bean:calls] Pending ICE candidate rejected.",
        error
      );
    }
  }
}


/* ============================================================
   MICROPHONE
   ============================================================ */

export function setMicrophoneEnabled(
  enabled: boolean
): void {
  const stream =
    currentSession
      ?.localStream;


  if (!stream) {
    return;
  }


  for (
    const track of
    stream.getAudioTracks()
  ) {
    track.enabled =
      enabled;
  }


  emitCallEvent(
    "bean:call-updated",
    currentSession
  );
}


/* ============================================================
   CAMERA
   ============================================================ */

export function setCameraEnabled(
  enabled: boolean
): void {
  const stream =
    currentSession
      ?.localStream;


  if (!stream) {
    return;
  }


  for (
    const track of
    stream.getVideoTracks()
  ) {
    track.enabled =
      enabled;
  }


  emitCallEvent(
    "bean:call-updated",
    currentSession
  );
}


/* ============================================================
   HANG UP
   ============================================================ */

export async function hangUp():
  Promise<void> {
  await finishCall(
    "local_hangup",
    true
  );
}


/* ============================================================
   FINISH CALL
   ============================================================ */

async function finishCall(
  reason:
    CallEndReason,
  notifyRemote:
    boolean
): Promise<void> {
  const session =
    currentSession;


  if (!session) {
    return;
  }


  if (
    session.status ===
      "ended"
  ) {
    return;
  }


  session.status =
    "ending";


  if (
    notifyRemote &&
    signalingProvider
  ) {
    try {
      await signalingProvider.send({
        type:
          "hangup",

        callId:
          session.callId,

        conversationId:
          session.conversationId,

        fromUserId:
          session.localUserId,

        toUserId:
          session.remoteUserId,

        reason
      });
    } catch {
      /*
       * Local cleanup must never depend
       * on successful remote signaling.
       */
    }
  }


  stopStream(
    session.localStream
  );


  stopStream(
    session.remoteStream
  );


  if (peerConnection) {
    try {
      peerConnection.close();
    } catch {
      // Already closed.
    }
  }


  peerConnection =
    null;


  pendingIncomingOffer =
    null;


  pendingIceCandidates.splice(
    0
  );


  session.status =
    reason ===
      "connection_failed"
      ? "failed"
      : "ended";


  session.endedAt =
    Date.now();


  session.endReason =
    reason;


  emitCallEvent(
    session.status ===
      "failed"
      ? "bean:call-failed"
      : "bean:call-ended",

    {
      ...session
    }
  );
}


/* ============================================================
   INITIALIZE CALL SYSTEM
   ============================================================ */

export async function initializeCalls():
  Promise<void> {
  requireAuthenticatedUser();


  if (
    !config.featureDefaults
      .voiceCalls &&
    !config.featureDefaults
      .videoCalls
  ) {
    return;
  }


  if (!signalingProvider) {
    /*
     * Feature may be enabled before provider deployment.
     * Calls remain safely unavailable.
     */
    return;
  }


  try {
    await signalingProvider
      .initialize();


    unsubscribeSignals =
      signalingProvider.subscribe(
        (
          signal
        ) => {
          void handleSignal(
            signal
          ).catch(
            (
              error
            ) => {
              console.warn(
                "[Bean:calls] Signal processing failed.",
                error
              );
            }
          );
        }
      );
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "calls",

        fallbackCode:
          "CALL_CONNECTION_FAILED",

        context: {
          operation:
            "initializeCalls"
        }
      }
    );
  }
}


/* ============================================================
   RESET CALL SYSTEM

   Used during logout / account replacement.
   ============================================================ */

export async function resetCalls():
  Promise<void> {
  if (currentSession) {
    await finishCall(
      "local_hangup",
      false
    );
  }


  unsubscribeSignals?.();

  unsubscribeSignals =
    null;


  if (signalingProvider) {
    try {
      await signalingProvider
        .shutdown();
    } catch {
      // Local reset continues.
    }
  }


  signalingProvider =
    null;

  currentSession =
    null;

  peerConnection =
    null;

  pendingIncomingOffer =
    null;

  pendingIceCandidates.splice(
    0
  );
}
