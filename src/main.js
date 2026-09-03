```javascript
import "./styles/tokens.css";
import "./styles/reset.css";
import "./styles/app.css";
import "./styles/responsive.css";

/*
=========================================================
BEAN — MAIN ENTRY
=========================================================

Owns:
- Global CSS imports
- App root lookup
- Initial application bootstrap
- Fatal startup fallback

Does NOT own:
- Authentication
- Messaging
- Realtime
- Supabase queries
- NEYO
- NEYO Ghost
- Component-specific logic
=========================================================
*/

const app = document.getElementById("app");

if (!app) {
  throw new Error(
    "Bean startup failed: #app root element was not found."
  );
}

/*
=========================================================
INITIAL SHELL
=========================================================
*/

function renderInitialShell() {
  app.innerHTML = `
    <main class="bean-app" data-bean-app>
      <div class="bean-app__boot">
        <div
          class="bean-app__logo"
          aria-hidden="true"
        >
          B
        </div>

        <p class="bean-app__name">
          Bean
        </p>
      </div>
    </main>
  `;
}

/*
=========================================================
FATAL FALLBACK
=========================================================
*/

function renderFatalError() {
  app.innerHTML = `
    <main
      class="bean-fatal"
      role="alert"
    >
      <div class="bean-fatal__content">
        <h1>Bean could not start</h1>

        <p>
          Refresh the page and try again.
        </p>

        <button
          type="button"
          data-action="reload"
        >
          Reload
        </button>
      </div>
    </main>
  `;

  const reloadButton =
    app.querySelector('[data-action="reload"]');

  reloadButton?.addEventListener(
    "click",
    () => window.location.reload()
  );
}

/*
=========================================================
BOOT
=========================================================
*/

function bootstrap() {
  try {
    renderInitialShell();

    window.dispatchEvent(
      new CustomEvent("bean:ready")
    );
  } catch (error) {
    console.error(
      "[Bean] Startup error:",
      error
    );

    renderFatalError();
  }
}

bootstrap();
```
