"use strict";

/* =========================================================
   BEAN — CONTACT PANEL
   Minimal conversation details panel
   ========================================================= */


/* =========================================================
   ICONS
   ========================================================= */

const icons = {
  close: `
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="m6 6 12 12"/>
      <path d="m18 6-12 12"/>
    </svg>
  `,

  copy: `
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="10" height="10" rx="2"/>
      <path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
    </svg>
  `,

  phone: `
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2
        19.8 19.8 0 0 1-8.6-3.1
        19.5 19.5 0 0 1-6-6
        19.8 19.8 0 0 1-3.1-8.6
        A2 2 0 0 1 4.1 2h3
        a2 2 0 0 1 2 1.7"
      />
    </svg>
  `,

  video: `
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="14" height="14" rx="3"/>
      <path d="m17 10 4-2v8l-4-2z"/>
    </svg>
  `,

  user: `
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 21a8 8 0 0 1 16 0"/>
    </svg>
  `,
};


/* =========================================================
   HELPERS
   ========================================================= */

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function getInitials(conversation) {
  if (conversation?.initials) {
    return conversation.initials;
  }

  const parts = String(
    conversation?.name ?? ""
  )
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "B";
  }

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase();
}


/* =========================================================
   ACTION BUTTON
   ========================================================= */

function createAction(
  action,
  label,
  icon
) {
  return `
    <button
      class="bean-contact-action"
      type="button"
      data-contact-action="${action}"
      aria-label="${label}"
    >
      <span
        class="bean-contact-action__icon"
        aria-hidden="true"
      >
        ${icon}
      </span>

      <span>
        ${label}
      </span>
    </button>
  `;
}


/* =========================================================
   SHARED FILES
   ========================================================= */

function createSharedFiles(files = []) {
  if (!files.length) {
    return `
      <p class="bean-contact-empty">
        No shared files yet.
      </p>
    `;
  }

  return files
    .slice(0, 3)
    .map((file) => `
      <div class="bean-shared-file">

        <div
          class="bean-shared-file__icon"
          aria-hidden="true"
        >
          ${escapeHTML(file.type || "FILE")}
        </div>

        <div class="bean-shared-file__info">
          <span class="bean-shared-file__name">
            ${escapeHTML(file.name)}
          </span>

          <span class="bean-shared-file__meta">
            ${escapeHTML(file.size || "")}
          </span>
        </div>

      </div>
    `)
    .join("");
}


/* =========================================================
   PANEL
   ========================================================= */

export function createContactPanel(
  conversation
) {
  if (!conversation) {
    return "";
  }

  const online =
    conversation.status === "online";

  const initials =
    getInitials(conversation);

  const beanId =
    conversation.beanId ||
    `bean@${String(
      conversation.name || "user"
    )
      .toLowerCase()
      .replace(/\s+/g, ".")}`;

  return `
    <aside
      class="bean-contact-panel"
      id="contactPanel"
      aria-label="Contact details"
    >

      <header class="bean-contact-panel__header">

        <h2>
          Details
        </h2>

        <button
          class="bean-icon-button"
          type="button"
          data-contact-action="close"
          aria-label="Close details"
          title="Close"
        >
          ${icons.close}
        </button>

      </header>


      <div class="bean-contact-panel__content">

        <section class="bean-contact-profile">

          <div class="bean-contact-profile__avatar-wrap">

            <div class="bean-contact-profile__avatar">
              ${escapeHTML(initials)}
            </div>

            ${
              online
                ? `
                  <span
                    class="bean-contact-profile__status"
                    aria-hidden="true"
                  ></span>
                `
                : ""
            }

          </div>


          <h3 class="bean-contact-profile__name">
            ${escapeHTML(conversation.name)}
          </h3>

          <p class="bean-contact-profile__presence">
            ${online ? "Online" : "Offline"}
          </p>

        </section>


        <section class="bean-contact-card">

          <span class="bean-contact-card__label">
            Bean ID
          </span>

          <div class="bean-contact-id">

            <span>
              ${escapeHTML(beanId)}
            </span>

            <button
              class="bean-contact-id__copy"
              type="button"
              data-contact-action="copy-id"
              data-bean-id="${escapeHTML(beanId)}"
              aria-label="Copy Bean ID"
              title="Copy Bean ID"
            >
              ${icons.copy}
            </button>

          </div>

        </section>


        <section class="bean-contact-card">

          <span class="bean-contact-card__label">
            About
          </span>

          <p class="bean-contact-about">
            ${escapeHTML(
              conversation.about ||
              "Available on Bean."
            )}
          </p>

        </section>


        <section class="bean-contact-section">

          <h3 class="bean-contact-section__title">
            Quick actions
          </h3>

          <div class="bean-contact-actions">

            ${createAction(
              "voice",
              "Voice call",
              icons.phone
            )}

            ${createAction(
              "video",
              "Video call",
              icons.video
            )}

            ${createAction(
              "profile",
              "View profile",
              icons.user
            )}

          </div>

        </section>


        <section class="bean-contact-section">

          <div class="bean-contact-section__heading">

            <h3 class="bean-contact-section__title">
              Shared files
            </h3>

            <button
              class="bean-contact-section__link"
              type="button"
              data-contact-action="files"
            >
              View all
            </button>

          </div>

          <div class="bean-shared-files">
            ${createSharedFiles(
              conversation.files
            )}
          </div>

        </section>

      </div>

    </aside>
  `;
}


/* =========================================================
   INITIALIZE
   ========================================================= */

export function initContactPanel(
  container,
  onAction
) {
  if (
    !(container instanceof Element)
  ) {
    return;
  }

  container.addEventListener(
    "click",
    async (event) => {
      const target =
        event.target;

      if (
        !(target instanceof Element)
      ) {
        return;
      }

      const button =
        target.closest(
          "[data-contact-action]"
        );

      if (!button) {
        return;
      }

      const action =
        button.dataset.contactAction;

      if (!action) {
        return;
      }


      /* ===================================================
         COPY BEAN ID
         =================================================== */

      if (action === "copy-id") {
        const beanId =
          button.dataset.beanId;

        if (beanId) {
          try {
            await navigator.clipboard.writeText(
              beanId
            );
          } catch {
            console.warn(
              "Bean: clipboard access unavailable."
            );
          }
        }
      }


      /* ===================================================
         CALLBACK
         =================================================== */

      if (
        typeof onAction ===
        "function"
      ) {
        onAction(action);
      }
    }
  );
}
