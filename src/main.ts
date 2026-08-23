import "./styles/tokens.css";
import "./styles/app.css";

import { bootstrapApp } from "./core";


/* ============================================================
   BEAN — SIGNATURESI
   Application Bootstrap

   Responsibilities:
   - Start the application
   - Register the service worker
   - Surface fatal startup errors cleanly

   Must NOT own:
   - Authentication
   - Supabase queries
   - Messaging
   - Realtime
   - UI feature logic
   ============================================================ */


/* ============================================================
   ROOT
   ============================================================ */

const root = document.getElementById("app");

if (!(root instanceof HTMLElement)) {
  throw new Error(
    "Bean bootstrap failed: #app root element was not found."
  );
}


/* ============================================================
   FATAL ERROR UI
   Minimal fallback only.
   Full error UX will live in errors.ts + ui.ts.
   ============================================================ */

function renderFatalError(): void {
  root.innerHTML = `
    <main class="fatal-screen" role="alert">
      <div class="fatal-screen__content">
        <p class="fatal-screen__brand">Bean</p>

        <h1 class="fatal-screen__title">
          Bean could not start
        </h1>

        <p class="fatal-screen__message">
          Refresh the app and try again.
        </p>

        <button
          class="fatal-screen__button"
          type="button"
          data-action="reload"
        >
          Reload
        </button>
      </div>
    </main>
  `;

  const reloadButton =
    root.querySelector<HTMLButtonElement>(
      '[data-action="reload"]'
    );

  reloadButton?.addEventListener("click", () => {
    window.location.reload();
  });
}


/* ============================================================
   SERVICE WORKER
   ============================================================ */

async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  /*
   * Service workers require HTTPS in production.
   * localhost is also permitted by browsers.
   */
  if (
    window.location.protocol !== "https:" &&
    window.location.hostname !== "localhost"
  ) {
    return;
  }

  try {
    const registration =
      await navigator.serviceWorker.register("/sw.js", {
        scope: "/"
      });

    /*
     * Detect when a newer service worker has been installed.
     * We do not force-refresh the user automatically.
     *
     * Later notifications.ts / ui.ts can surface an
     * "Update available" action.
     */
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;

      if (!worker) {
        return;
      }

      worker.addEventListener("statechange", () => {
        if (
          worker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          window.dispatchEvent(
            new CustomEvent("bean:update-available")
          );
        }
      });
    });
  } catch (error) {
    /*
     * PWA failure must never prevent Bean itself from working.
     */
    console.warn(
      "[Bean] Service worker registration failed.",
      error
    );
  }
}


/* ============================================================
   START
   ============================================================ */

async function start(): Promise<void> {
  try {
    await bootstrapApp(root);

    /*
     * Service worker registration happens after the main
     * application has successfully started.
     */
    void registerServiceWorker();
  } catch (error) {
    console.error(
      "[Bean] Fatal startup error.",
      error
    );

    renderFatalError();
  }
}


/* ============================================================
   GLOBAL SAFETY NETS
   These log unexpected browser-level failures.
   Later telemetry.ts can replace console reporting.
   ============================================================ */

window.addEventListener("error", (event) => {
  console.error(
    "[Bean] Unhandled runtime error.",
    event.error ?? event.message
  );
});


window.addEventListener(
  "unhandledrejection",
  (event) => {
    console.error(
      "[Bean] Unhandled promise rejection.",
      event.reason
    );
  }
);


/* ============================================================
   BOOT
   ============================================================ */

void start();
