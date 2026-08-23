/* ============================================================
   BEAN — SIGNATURESI
   Core Application Runtime

   Responsibilities:
   - Hold stable application runtime state
   - Validate required environment configuration
   - Initialize top-level application lifecycle
   - Provide safe app-wide lifecycle events
   - Coordinate module startup order

   Must NOT own:
   - Authentication implementation
   - Database queries
   - Messaging logic
   - Realtime subscriptions
   - Encryption
   - Uploads
   - Calls
   - Feature-specific UI
   ============================================================ */


export type AppEnvironment =
  | "development"
  | "preview"
  | "production";


export type AppLifecycleState =
  | "idle"
  | "booting"
  | "ready"
  | "failed";


export interface BeanRuntimeConfig {
  appName: string;
  environment: AppEnvironment;

  accountsUrl: string;

  supabaseUrl: string;
  supabasePublishableKey: string;

  realtimeEnabled: boolean;

  featureDefaults: {
    voiceCalls: boolean;
    videoCalls: boolean;
    beanmoji3D: boolean;
    discover: boolean;
    work: boolean;
  };
}


export interface BeanRuntimeState {
  lifecycle: AppLifecycleState;

  startedAt: number | null;

  isOnline: boolean;
  isVisible: boolean;

  lastError: unknown | null;
}


/* ============================================================
   ENVIRONMENT HELPERS
   ============================================================ */

function readRequiredEnv(
  key: keyof ImportMetaEnv
): string {
  const value = import.meta.env[key];

  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new Error(
      `Missing required Bean environment variable: ${key}`
    );
  }

  return value.trim();
}


function readOptionalEnv(
  key: keyof ImportMetaEnv,
  fallback: string
): string {
  const value = import.meta.env[key];

  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    return fallback;
  }

  return value.trim();
}


function readBooleanEnv(
  key: keyof ImportMetaEnv,
  fallback = false
): boolean {
  const value = import.meta.env[key];

  if (typeof value !== "string") {
    return fallback;
  }

  switch (value.trim().toLowerCase()) {
    case "true":
    case "1":
    case "yes":
    case "on":
      return true;

    case "false":
    case "0":
    case "no":
    case "off":
      return false;

    default:
      return fallback;
  }
}


function parseEnvironment(
  value: string
): AppEnvironment {
  switch (value) {
    case "production":
      return "production";

    case "preview":
      return "preview";

    case "development":
      return "development";

    default:
      return import.meta.env.PROD
        ? "production"
        : "development";
  }
}


/* ============================================================
   CONFIG
   Immutable after boot.
   ============================================================ */

function createRuntimeConfig(): BeanRuntimeConfig {
  return Object.freeze({
    appName: readOptionalEnv(
      "VITE_APP_NAME",
      "Bean"
    ),

    environment: parseEnvironment(
      readOptionalEnv(
        "VITE_APP_ENV",
        import.meta.env.PROD
          ? "production"
          : "development"
      )
    ),

    accountsUrl: readRequiredEnv(
      "VITE_ACCOUNTS_URL"
    ),

    supabaseUrl: readRequiredEnv(
      "VITE_SUPABASE_URL"
    ),

    supabasePublishableKey: readRequiredEnv(
      "VITE_SUPABASE_PUBLISHABLE_KEY"
    ),

    realtimeEnabled: readBooleanEnv(
      "VITE_REALTIME_ENABLED",
      true
    ),

    featureDefaults: Object.freeze({
      voiceCalls: readBooleanEnv(
        "VITE_FEATURE_VOICE_CALLS"
      ),

      videoCalls: readBooleanEnv(
        "VITE_FEATURE_VIDEO_CALLS"
      ),

      beanmoji3D: readBooleanEnv(
        "VITE_FEATURE_BEANMOJI_3D"
      ),

      discover: readBooleanEnv(
        "VITE_FEATURE_DISCOVER"
      ),

      work: readBooleanEnv(
        "VITE_FEATURE_WORK"
      )
    })
  });
}


export const config = createRuntimeConfig();


/* ============================================================
   RUNTIME STATE
   ============================================================ */

const runtimeState: BeanRuntimeState = {
  lifecycle: "idle",
  startedAt: null,

  isOnline: navigator.onLine,
  isVisible:
    document.visibilityState === "visible",

  lastError: null
};


export function getRuntimeState():
  Readonly<BeanRuntimeState> {
  return runtimeState;
}


/* ============================================================
   APP EVENTS
   ============================================================ */

export type BeanEventName =
  | "bean:booting"
  | "bean:ready"
  | "bean:failed"
  | "bean:online"
  | "bean:offline"
  | "bean:visible"
  | "bean:hidden";


function emitAppEvent(
  name: BeanEventName,
  detail?: unknown
): void {
  window.dispatchEvent(
    new CustomEvent(name, {
      detail
    })
  );
}


export function onAppEvent(
  name: BeanEventName,
  listener: EventListener
): () => void {
  window.addEventListener(
    name,
    listener
  );

  return () => {
    window.removeEventListener(
      name,
      listener
    );
  };
}


/* ============================================================
   BROWSER LIFECYCLE
   ============================================================ */

function initializeBrowserLifecycle(): void {
  window.addEventListener(
    "online",
    () => {
      runtimeState.isOnline = true;

      emitAppEvent(
        "bean:online"
      );
    }
  );


  window.addEventListener(
    "offline",
    () => {
      runtimeState.isOnline = false;

      emitAppEvent(
        "bean:offline"
      );
    }
  );


  document.addEventListener(
    "visibilitychange",
    () => {
      runtimeState.isVisible =
        document.visibilityState === "visible";

      emitAppEvent(
        runtimeState.isVisible
          ? "bean:visible"
          : "bean:hidden"
      );
    }
  );
}


/* ============================================================
   INITIAL SCREEN
   Temporary shell until ui.ts owns the full interface.
   ============================================================ */

function renderBootShell(
  root: HTMLElement
): void {
  root.innerHTML = `
    <main
      class="app-boot"
      aria-busy="true"
      aria-live="polite"
    >
      <div class="app-boot__content">
        <div
          class="app-boot__mark"
          aria-hidden="true"
        >
          B
        </div>

        <p class="app-boot__name">
          Bean
        </p>

        <p class="app-boot__status">
          Starting...
        </p>
      </div>
    </main>
  `;
}


/* ============================================================
   BOOTSTRAP
   IMPORTANT:
   Module imports will be added here one-by-one according
   to the locked architecture plan.
   ============================================================ */

export async function bootstrapApp(
  root: HTMLElement
): Promise<void> {
  if (
    runtimeState.lifecycle === "booting" ||
    runtimeState.lifecycle === "ready"
  ) {
    return;
  }


  runtimeState.lifecycle = "booting";
  runtimeState.startedAt =
    Date.now();
  runtimeState.lastError = null;

  emitAppEvent(
    "bean:booting"
  );


  try {
    renderBootShell(root);

    initializeBrowserLifecycle();


    /*
     * Next modules will enter here in dependency order:
     *
     * 1. data.ts
     * 2. auth.ts
     * 3. identity.ts
     * 4. ui.ts
     *
     * Later:
     * conversations
     * messages
     * realtime
     * presence
     * crypto
     * media
     * notifications
     * calls
     * profile
     * discovery
     * work
     * beanmoji
     *
     * We intentionally do NOT import unfinished modules yet.
     */


    runtimeState.lifecycle =
      "ready";

    emitAppEvent(
      "bean:ready"
    );
  } catch (error) {
    runtimeState.lifecycle =
      "failed";

    runtimeState.lastError =
      error;

    emitAppEvent(
      "bean:failed",
      error
    );

    throw error;
  }
}
