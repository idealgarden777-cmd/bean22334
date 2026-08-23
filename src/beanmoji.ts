import {
  config
} from "./core";

import {
  requireAuthenticatedUser
} from "./auth";

import {
  createError
} from "./errors";


/* ============================================================
   BEAN — SIGNATURESI
   Beanmoji Module

   Responsibilities:
   - Define Beanmoji expression system
   - Manage Beanmoji runtime state
   - Register rendering implementation
   - Select expressions from app context
   - Support static and animated reactions
   - Expose safe Beanmoji events

   Must NOT own:
   - User identity
   - Authentication
   - Messaging persistence
   - 3D renderer implementation
   - WebGL engine selection
   - UI layout
   - Profile storage
   - AI decision making

   Identity:
   Internal user identity -> UUID
   Public identity        -> bean@username
   Beanmoji               -> visual expression only
   ============================================================ */


/* ============================================================
   FEATURE
   ============================================================ */

function assertBeanmojiEnabled():
  void {
  if (
    !config.featureDefaults
      .beanmoji3D
  ) {
    throw createError(
      "NOT_SUPPORTED",
      "beanmoji",
      {
        message:
          "Beanmoji is currently disabled."
      }
    );
  }
}


/* ============================================================
   EXPRESSIONS

   Keep expressions semantic.

   Rendering implementation decides:
   - eye shape
   - mouth shape
   - movement
   - rotation
   - squash/stretch
   - timing
   - 3D materials

   Business logic never manipulates geometry directly.
   ============================================================ */

export type BeanmojiExpression =
  | "neutral"
  | "happy"
  | "excited"
  | "laughing"
  | "thinking"
  | "curious"
  | "surprised"
  | "focused"
  | "confused"
  | "sad"
  | "concerned"
  | "sleepy"
  | "celebrating"
  | "listening"
  | "talking";


/* ============================================================
   ACTIVITY
   ============================================================ */

export type BeanmojiActivity =
  | "idle"
  | "listening"
  | "thinking"
  | "talking"
  | "typing"
  | "calling"
  | "celebrating";


/* ============================================================
   INTENSITY
   ============================================================ */

export type BeanmojiIntensity =
  | "subtle"
  | "normal"
  | "strong";


/* ============================================================
   ANIMATION REQUEST
   ============================================================ */

export interface BeanmojiAnimation {
  expression:
    BeanmojiExpression;

  activity:
    BeanmojiActivity;

  intensity:
    BeanmojiIntensity;

  durationMs:
    number | null;

  loop:
    boolean;
}


/* ============================================================
   RUNTIME STATE
   ============================================================ */

export interface BeanmojiState {
  expression:
    BeanmojiExpression;

  activity:
    BeanmojiActivity;

  intensity:
    BeanmojiIntensity;

  active:
    boolean;

  updatedAt:
    number;
}


const state:
  BeanmojiState = {
    expression:
      "neutral",

    activity:
      "idle",

    intensity:
      "subtle",

    active:
      false,

    updatedAt:
      Date.now()
  };


export function getBeanmojiState():
  Readonly<BeanmojiState> {
  return state;
}


/* ============================================================
   RENDERER CONTRACT

   A future Three.js/WebGL/native renderer can implement this.

   beanmoji.ts stays rendering-engine agnostic.
   ============================================================ */

export interface BeanmojiRenderer {
  initialize():
    Promise<void>;


  play(
    animation:
      BeanmojiAnimation
  ): Promise<void>;


  stop():
    Promise<void>;


  reset():
    Promise<void>;


  destroy():
    Promise<void>;
}


/* ============================================================
   RENDERER
   ============================================================ */

let renderer:
  BeanmojiRenderer | null = null;


let initialized =
  false;


let animationToken =
  0;


/* ============================================================
   REGISTER RENDERER
   ============================================================ */

export function registerBeanmojiRenderer(
  value:
    BeanmojiRenderer
): void {
  if (
    initialized
  ) {
    throw createError(
      "NOT_SUPPORTED",
      "beanmoji",
      {
        message:
          "Beanmoji renderer cannot be replaced while active."
      }
    );
  }


  renderer =
    value;
}


/* ============================================================
   EVENTS
   ============================================================ */

export type BeanmojiEventName =
  | "bean:beanmoji-ready"
  | "bean:beanmoji-change"
  | "bean:beanmoji-stop"
  | "bean:beanmoji-reset";


function emitBeanmojiEvent(
  name:
    BeanmojiEventName
): void {
  window.dispatchEvent(
    new CustomEvent(
      name,
      {
        detail: {
          ...state
        }
      }
    )
  );
}


/* ============================================================
   INITIALIZE
   ============================================================ */

export async function initializeBeanmoji():
  Promise<void> {
  requireAuthenticatedUser();

  assertBeanmojiEnabled();


  if (
    initialized
  ) {
    return;
  }


  if (!renderer) {
    throw createError(
      "NOT_SUPPORTED",
      "beanmoji",
      {
        message:
          "Beanmoji renderer is not configured."
      }
    );
  }


  await renderer.initialize();


  initialized =
    true;


  state.active =
    true;

  state.expression =
    "neutral";

  state.activity =
    "idle";

  state.intensity =
    "subtle";

  state.updatedAt =
    Date.now();


  emitBeanmojiEvent(
    "bean:beanmoji-ready"
  );
}


/* ============================================================
   PLAY
   ============================================================ */

export async function playBeanmoji(
  input:
    Partial<BeanmojiAnimation> &
    Pick<
      BeanmojiAnimation,
      "expression"
    >
): Promise<void> {
  assertBeanmojiEnabled();


  if (
    !initialized ||
    !renderer
  ) {
    throw createError(
      "NOT_SUPPORTED",
      "beanmoji",
      {
        message:
          "Beanmoji is not initialized."
      }
    );
  }


  const token =
    ++animationToken;


  const animation:
    BeanmojiAnimation = {
      expression:
        input.expression,

      activity:
        input.activity ??
        "idle",

      intensity:
        input.intensity ??
        "normal",

      durationMs:
        input.durationMs ??
        null,

      loop:
        input.loop ??
        false
    };


  state.expression =
    animation.expression;

  state.activity =
    animation.activity;

  state.intensity =
    animation.intensity;

  state.active =
    true;

  state.updatedAt =
    Date.now();


  emitBeanmojiEvent(
    "bean:beanmoji-change"
  );


  await renderer.play(
    animation
  );


  /*
   * Timed animations return automatically to neutral.

   * Token prevents an older animation timeout from
   * cancelling a newer expression.
   */
  if (
    animation.durationMs !==
      null &&
    animation.durationMs > 0 &&
    !animation.loop
  ) {
    window.setTimeout(
      () => {
        if (
          animationToken !==
            token
        ) {
          return;
        }


        void resetBeanmoji();
      },

      animation.durationMs
    );
  }
}


/* ============================================================
   ACTIVITY HELPERS

   Feature modules can call semantic helpers rather than
   selecting facial geometry.
   ============================================================ */

export async function showListening():
  Promise<void> {
  await playBeanmoji({
    expression:
      "listening",

    activity:
      "listening",

    intensity:
      "subtle",

    loop:
      true
  });
}


export async function showThinking():
  Promise<void> {
  await playBeanmoji({
    expression:
      "thinking",

    activity:
      "thinking",

    intensity:
      "normal",

    loop:
      true
  });
}


export async function showTalking():
  Promise<void> {
  await playBeanmoji({
    expression:
      "talking",

    activity:
      "talking",

    intensity:
      "normal",

    loop:
      true
  });
}


export async function showTyping():
  Promise<void> {
  await playBeanmoji({
    expression:
      "focused",

    activity:
      "typing",

    intensity:
      "subtle",

    loop:
      true
  });
}


export async function showCall():
  Promise<void> {
  await playBeanmoji({
    expression:
      "listening",

    activity:
      "calling",

    intensity:
      "normal",

    loop:
      true
  });
}


export async function celebrate(
  durationMs =
    1_800
): Promise<void> {
  await playBeanmoji({
    expression:
      "celebrating",

    activity:
      "celebrating",

    intensity:
      "strong",

    durationMs,

    loop:
      false
  });
}


/* ============================================================
   REACTION

   Used for lightweight message reactions / expressive UI.
   ============================================================ */

export async function reactBeanmoji(
  expression:
    BeanmojiExpression,
  intensity:
    BeanmojiIntensity =
      "normal"
): Promise<void> {
  await playBeanmoji({
    expression,

    activity:
      "idle",

    intensity,

    durationMs:
      1_200,

    loop:
      false
  });
}


/* ============================================================
   STOP

   Stops current motion but preserves expression.
   ============================================================ */

export async function stopBeanmoji():
  Promise<void> {
  if (
    !initialized ||
    !renderer
  ) {
    return;
  }


  ++animationToken;


  await renderer.stop();


  state.activity =
    "idle";

  state.active =
    false;

  state.updatedAt =
    Date.now();


  emitBeanmojiEvent(
    "bean:beanmoji-stop"
  );
}


/* ============================================================
   RESET
   ============================================================ */

export async function resetBeanmoji():
  Promise<void> {
  if (
    !initialized ||
    !renderer
  ) {
    return;
  }


  ++animationToken;


  await renderer.reset();


  state.expression =
    "neutral";

  state.activity =
    "idle";

  state.intensity =
    "subtle";

  state.active =
    true;

  state.updatedAt =
    Date.now();


  emitBeanmojiEvent(
    "bean:beanmoji-reset"
  );
}


/* ============================================================
   DESTROY

   Used on:
   - logout
   - account switch
   - full app shutdown
   ============================================================ */

export async function destroyBeanmoji():
  Promise<void> {
  ++animationToken;


  if (
    renderer
  ) {
    try {
      await renderer.destroy();
    } catch {
      // Runtime reset continues.
    }
  }


  renderer =
    null;

  initialized =
    false;


  state.expression =
    "neutral";

  state.activity =
    "idle";

  state.intensity =
    "subtle";

  state.active =
    false;

  state.updatedAt =
    Date.now();
}


/* ============================================================
   CONTEXT MAPPING

   This gives the app a predictable semantic mapping.

   AI may later recommend expressions, but renderer/UI does
   not need AI to function.
   ============================================================ */

export function getExpressionForContext(
  context:
    string
): BeanmojiExpression {
  switch (
    context
      .trim()
      .toLowerCase()
  ) {
    case "success":
    case "completed":
      return "celebrating";


    case "thinking":
    case "processing":
      return "thinking";


    case "listening":
      return "listening";


    case "talking":
    case "speaking":
      return "talking";


    case "typing":
    case "working":
      return "focused";


    case "error":
    case "warning":
      return "concerned";


    case "question":
      return "curious";


    case "surprise":
      return "surprised";


    case "happy":
      return "happy";


    case "excited":
      return "excited";


    default:
      return "neutral";
  }
}
