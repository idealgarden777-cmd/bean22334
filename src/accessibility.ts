import {
  getSettings
} from "./settings";

import {
  createError
} from "./errors";


/* ============================================================
   BEAN — SIGNATURESI
   Accessibility Runtime

   Responsibilities:
   - Screen-reader announcements
   - Keyboard navigation helpers
   - Focus restoration
   - Focus trapping for dialogs/modals
   - Escape-key handling
   - Reduced-motion synchronization
   - Input-modality tracking
   - Safe focus utilities

   Must NOT own:
   - UI rendering
   - Application navigation
   - Business logic
   - Theme design
   - CSS layout
   - Authentication
   - Data persistence

   Accessibility is a platform-wide concern.
   ============================================================ */


/* ============================================================
   CONSTANTS
   ============================================================ */

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]'
].join(",");


/* ============================================================
   TYPES
   ============================================================ */

export type InputModality =
  | "keyboard"
  | "pointer";


export type AnnouncementPriority =
  | "polite"
  | "assertive";


export interface FocusTrap {
  deactivate():
    void;
}


/* ============================================================
   STATE
   ============================================================ */

let initialized =
  false;


let currentInputModality:
  InputModality =
    "pointer";


let politeLiveRegion:
  HTMLElement | null =
    null;


let assertiveLiveRegion:
  HTMLElement | null =
    null;


let previousFocusedElement:
  HTMLElement | null =
    null;


/* ============================================================
   INPUT MODALITY
   ============================================================ */

export function getInputModality():
  InputModality {
  return currentInputModality;
}


function setInputModality(
  modality:
    InputModality
): void {
  if (
    currentInputModality ===
      modality
  ) {
    return;
  }


  currentInputModality =
    modality;


  document.documentElement
    .dataset.inputModality =
      modality;


  window.dispatchEvent(
    new CustomEvent(
      "bean:input-modality",
      {
        detail: {
          modality
        }
      }
    )
  );
}


/* ============================================================
   LIVE REGIONS
   ============================================================ */

function createLiveRegion(
  priority:
    AnnouncementPriority
): HTMLElement {
  const element =
    document.createElement(
      "div"
    );


  element.className =
    "a11y-live-region";


  element.setAttribute(
    "aria-live",
    priority
  );


  element.setAttribute(
    "aria-atomic",
    "true"
  );


  element.setAttribute(
    "role",
    priority ===
      "assertive"
      ? "alert"
      : "status"
  );


  element.dataset.a11yLive =
    priority;


  document.body.appendChild(
    element
  );


  return element;
}


/* ============================================================
   ANNOUNCEMENTS

   Examples:
   announce("Message sent");
   announce("Call ended", "assertive");
   ============================================================ */

export function announce(
  message:
    string,

  priority:
    AnnouncementPriority =
      "polite"
): void {
  const text =
    message.trim();


  if (!text) {
    return;
  }


  const region =
    priority ===
      "assertive"
      ? assertiveLiveRegion
      : politeLiveRegion;


  if (!region) {
    return;
  }


  /*
   * Clear first so repeated identical announcements
   * are still detected by assistive technology.
   */
  region.textContent =
    "";


  window.setTimeout(
    () => {
      region.textContent =
        text;
    },
    20
  );
}


/* ============================================================
   REDUCED MOTION
   ============================================================ */

export function prefersReducedMotion():
  boolean {
  const settings =
    getSettings();


  if (
    settings.reduceMotion
  ) {
    return true;
  }


  return (
    window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches ??
    false
  );
}


function applyReducedMotion():
  void {
  document.documentElement
    .dataset.reduceMotion =
      prefersReducedMotion()
        ? "true"
        : "false";
}


/* ============================================================
   SAFE FOCUS
   ============================================================ */

export function focusElement(
  element:
    HTMLElement | null,

  options: {
    preventScroll?: boolean;
  } = {}
): boolean {
  if (!element) {
    return false;
  }


  if (
    !element.isConnected
  ) {
    return false;
  }


  try {
    element.focus({
      preventScroll:
        options.preventScroll ??
        false
    });


    return (
      document.activeElement ===
        element
    );
  } catch {
    return false;
  }
}


/* ============================================================
   REMEMBER / RESTORE FOCUS

   Useful when opening:
   - dialog
   - profile panel
   - settings modal
   - message actions menu
   ============================================================ */

export function rememberFocus():
  void {
  const active =
    document.activeElement;


  previousFocusedElement =
    active instanceof HTMLElement
      ? active
      : null;
}


export function restoreFocus():
  void {
  const target =
    previousFocusedElement;


  previousFocusedElement =
    null;


  if (!target) {
    return;
  }


  focusElement(
    target,
    {
      preventScroll:
        true
    }
  );
}


/* ============================================================
   FOCUSABLE ELEMENTS
   ============================================================ */

export function getFocusableElements(
  container:
    HTMLElement
): HTMLElement[] {
  const nodes =
    Array.from(
      container.querySelectorAll<
        HTMLElement
      >(
        FOCUSABLE_SELECTOR
      )
    );


  return nodes.filter(
    (
      element
    ) => {
      if (
        element.hidden
      ) {
        return false;
      }


      if (
        element.getAttribute(
          "aria-hidden"
        ) === "true"
      ) {
        return false;
      }


      const style =
        window.getComputedStyle(
          element
        );


      return (
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    }
  );
}


/* ============================================================
   FOCUS TRAP

   Intended for modal/dialog surfaces only.

   Example:
   const trap = trapFocus(dialog);
   trap.deactivate();
   ============================================================ */

export function trapFocus(
  container:
    HTMLElement,

  options: {
    initialFocus?: HTMLElement | null;

    restoreFocusOnDeactivate?: boolean;
  } = {}
): FocusTrap {
  if (
    !container.isConnected
  ) {
    throw createError(
      "INVALID_INPUT",
      "ui",
      {
        message:
          "Focus trap container must be attached to the document."
      }
    );
  }


  const restoreOnDeactivate =
    options.restoreFocusOnDeactivate ??
    true;


  const activeBeforeTrap =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;


  const handleKeyDown =
    (
      event:
        KeyboardEvent
    ): void => {
      if (
        event.key !==
          "Tab"
      ) {
        return;
      }


      const focusable =
        getFocusableElements(
          container
        );


      if (
        focusable.length ===
          0
      ) {
        event.preventDefault();

        container.focus();

        return;
      }


      const first =
        focusable[0];

      const last =
        focusable[
          focusable.length - 1
        ];


      if (
        !first ||
        !last
      ) {
        return;
      }


      const active =
        document.activeElement;


      if (
        event.shiftKey
      ) {
        if (
          active === first ||
          !container.contains(
            active
          )
        ) {
          event.preventDefault();

          last.focus();
        }


        return;
      }


      if (
        active === last ||
        !container.contains(
          active
        )
      ) {
        event.preventDefault();

        first.focus();
      }
    };


  container.addEventListener(
    "keydown",
    handleKeyDown
  );


  /*
   * A non-focusable dialog container needs a fallback
   * focus target.
   */
  const originalTabIndex =
    container.getAttribute(
      "tabindex"
    );


  if (
    !container.matches(
      FOCUSABLE_SELECTOR
    )
  ) {
    container.setAttribute(
      "tabindex",
      "-1"
    );
  }


  const initial =
    options.initialFocus ??
    getFocusableElements(
      container
    )[0] ??
    container;


  focusElement(
    initial
  );


  let active =
    true;


  return {
    deactivate():
      void {
      if (!active) {
        return;
      }


      active =
        false;


      container.removeEventListener(
        "keydown",
        handleKeyDown
      );


      if (
        originalTabIndex ===
          null
      ) {
        container.removeAttribute(
          "tabindex"
        );
      } else {
        container.setAttribute(
          "tabindex",
          originalTabIndex
        );
      }


      if (
        restoreOnDeactivate &&
        activeBeforeTrap
      ) {
        focusElement(
          activeBeforeTrap,
          {
            preventScroll:
              true
          }
        );
      }
    }
  };
}


/* ============================================================
   ESCAPE HANDLER

   Returns cleanup function.

   Useful for:
   - modal
   - menu
   - drawer
   - popover
   ============================================================ */

export function onEscape(
  callback:
    () => void
): () => void {
  const listener =
    (
      event:
        KeyboardEvent
    ): void => {
      if (
        event.key !==
          "Escape"
      ) {
        return;
      }


      event.preventDefault();

      callback();
    };


  document.addEventListener(
    "keydown",
    listener
  );


  return () => {
    document.removeEventListener(
      "keydown",
      listener
    );
  };
}


/* ============================================================
   ENTER / SPACE ACTIVATION

   For custom interactive controls only.

   Native <button> should always be preferred.
   ============================================================ */

export function makeKeyboardActivatable(
  element:
    HTMLElement,

  callback:
    () => void
): () => void {
  const listener =
    (
      event:
        KeyboardEvent
    ): void => {
      if (
        event.key !==
          "Enter" &&
        event.key !==
          " "
      ) {
        return;
      }


      event.preventDefault();

      callback();
    };


  element.addEventListener(
    "keydown",
    listener
  );


  return () => {
    element.removeEventListener(
      "keydown",
      listener
    );
  };
}


/* ============================================================
   FOCUS FIRST INVALID FIELD

   Forms can call this after validation failure.
   ============================================================ */

export function focusFirstInvalidField(
  form:
    HTMLFormElement
): boolean {
  const invalid =
    form.querySelector<
      HTMLElement
    >(
      [
        "[aria-invalid='true']",
        ":invalid"
      ].join(",")
    );


  if (!invalid) {
    return false;
  }


  return focusElement(
    invalid
  );
}


/* ============================================================
   MESSAGE LIST ANNOUNCEMENT

   Keeps messaging-specific screen-reader text standardized
   without owning messaging logic.
   ============================================================ */

export function announceNewMessage(
  senderName:
    string
): void {
  const name =
    senderName.trim();


  announce(
    name
      ? `New message from ${name}.`
      : "New message."
  );
}


/* ============================================================
   ROUTE / SCREEN ANNOUNCEMENT
   ============================================================ */

export function announceScreen(
  screenName:
    string
): void {
  const value =
    screenName.trim();


  if (!value) {
    return;
  }


  announce(
    `${value} screen.`
  );
}


/* ============================================================
   KEYBOARD MODALITY
   ============================================================ */

function handleKeyboardInput(
  event:
    KeyboardEvent
): void {
  /*
   * Modifier-only keys should not switch modality.
   */
  if (
    event.key === "Shift" ||
    event.key === "Control" ||
    event.key === "Alt" ||
    event.key === "Meta"
  ) {
    return;
  }


  setInputModality(
    "keyboard"
  );
}


function handlePointerInput():
  void {
  setInputModality(
    "pointer"
  );
}


/* ============================================================
   SETTINGS / SYSTEM CHANGES
   ============================================================ */

function handleSettingsChange():
  void {
  applyReducedMotion();
}


function handleSystemMotionChange():
  void {
  applyReducedMotion();
}


/* ============================================================
   INITIALIZE
   ============================================================ */

export function initializeAccessibility():
  void {
  if (
    initialized
  ) {
    return;
  }


  initialized =
    true;


  politeLiveRegion =
    createLiveRegion(
      "polite"
    );


  assertiveLiveRegion =
    createLiveRegion(
      "assertive"
    );


  document.documentElement
    .dataset.inputModality =
      currentInputModality;


  applyReducedMotion();


  window.addEventListener(
    "keydown",
    handleKeyboardInput,
    {
      capture:
        true
    }
  );


  window.addEventListener(
    "pointerdown",
    handlePointerInput,
    {
      capture:
        true
    }
  );


  window.addEventListener(
    "bean:settings-change",
    handleSettingsChange
  );


  window.addEventListener(
    "bean:settings-reset",
    handleSettingsChange
  );


  const motionQuery =
    window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    );


  motionQuery?.addEventListener(
    "change",
    handleSystemMotionChange
  );


  window.dispatchEvent(
    new CustomEvent(
      "bean:accessibility-ready"
    )
  );
}


/* ============================================================
   RESET

   Mostly useful during full application teardown/tests.
   ============================================================ */

export function resetAccessibility():
  void {
  if (
    !initialized
  ) {
    return;
  }


  initialized =
    false;


  window.removeEventListener(
    "keydown",
    handleKeyboardInput,
    {
      capture:
        true
    }
  );


  window.removeEventListener(
    "pointerdown",
    handlePointerInput,
    {
      capture:
        true
    }
  );


  window.removeEventListener(
    "bean:settings-change",
    handleSettingsChange
  );


  window.removeEventListener(
    "bean:settings-reset",
    handleSettingsChange
  );


  politeLiveRegion
    ?.remove();


  assertiveLiveRegion
    ?.remove();


  politeLiveRegion =
    null;

  assertiveLiveRegion =
    null;


  previousFocusedElement =
    null;


  delete document
    .documentElement
    .dataset
    .inputModality;
}
