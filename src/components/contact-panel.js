"use strict";

/*
=========================================================
BEAN — CONTACT PANEL
=========================================================

Owns:
- Conversation/contact details UI
- Profile summary
- Quick actions
- Shared content shortcuts
- Contact action events

Does not own:
- Backend
- Authentication
- Message data
- Media storage
- Blocking logic
=========================================================
*/

/*
=========================================================
HELPERS
=========================================================
*/

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/*
=========================================================
ICONS
=========================================================
*/

const icons = {
  close: `
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
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
      <path
        d="M22 16.92v3a2 2 0 0 1-2.18 2
        19.79 19.79 0 0 1-8.63-3.07
        19.5 19.5 0 0 1-6-6
        19.79 19.79 0 0 1-3.07-8.67
        A2 2 0 0 1 4.11 2h3
        a2 2 0 0 1 2 1.72
        12.84 12.84 0 0 0 .7 2.81
        2 2 0 0 1-.45 2.11L8.09 9.91
        a16 16 0 0 0 6 6l1.27-1.27
        a2 2 0 0 1 2.11-.45
        12.84 12.84 0 0 0 2.81.7
        A2 2 0 0 1 22 16.92z"
      />
    </svg>
  `,

  video: `
    <svg
      viewBox="0 0 24 24"
      width="19"
      height="19"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="5"
        width="13"
        height="14"
        rx="2"
      />
      <path d="m16 10 5-3v10l-5-3z" />
    </svg>
  `,

  search: `
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
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  `,

  bell: `
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
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  `,

  media: `
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
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  `,

  file: `
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
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  `,

  link: `
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
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  `,

  block: `
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
      <circle cx="12" cy="12" r="9" />
      <path d="m5.7 5.7 12.6 12.6" />
    </svg>
  `,
};

/*
=========================================================
ACTION BUTTON
=========================================================
*/

function createQuickAction({
  action,
  label,
  icon,
}) {
  return `
    <button
      class="bean-contact-panel__quick-action"
      type="button"
      data-contact-action="${action}"
      aria-label="${label}"
      title="${label}"
    >
      <span class="bean-contact-panel__quick-icon">
        ${icon}
      </span>

      <span class="bean-contact-panel__quick-label">
        ${label}
      </span>
    </button>
  `;
}

/*
=========================================================
DETAIL ROW
=========================================================
*/

function createDetailRow({
  action,
  label,
  icon,
  danger = false,
}) {
  return `
    <button
      class="bean-contact-panel__row${danger ? " is-danger" : ""}"
      type="button"
      data-contact-action="${action}"
    >
      <span class="bean-contact-panel__row-icon">
        ${icon}
      </span>

      <span class="bean-contact-panel__row-label">
        ${label}
      </span>

      <span
        class="bean-contact-panel__row-arrow"
        aria-hidden="true"
      >
        ›
      </span>
    </button>
  `;
}

/*
=========================================================
CREATE PANEL
=========================================================
*/

export function createContactPanel(conversation) {
  if (
    !conversation ||
    typeof conversation.id !== "string"
  ) {
    return "";
  }

  const name = escapeHTML(conversation.name);
  const initials = escapeHTML(conversation.initials);

  const beanId = escapeHTML(
    conversation.beanId ??
    `bean@${conversation.id}`
  );

  return `
    <aside
      class="bean-contact-panel"
      id="contactPanel"
      aria-label="Conversation details"
    >

      <header class="bean-contact-panel__header">

        <h2 class="bean-contact-panel__title">
          Details
        </h2>

        <button
          class="bean-contact-panel__close"
          type="button"
          data-contact-action="close"
          aria-label="Close details"
          title="Close"
        >
          ${icons.close}
        </button>

      </header>

      <div class="bean-contact-panel__body">

        <section class="bean-contact-panel__profile">

          <div
            class="bean-avatar bean-contact-panel__avatar"
            aria-hidden="true"
          >
            ${initials}
          </div>

          <h3 class="bean-contact-panel__name">
            ${name}
          </h3>

          <div class="bean-contact-panel__bean-id">
            ${beanId}
          </div>

          <div class="bean-contact-panel__presence">
            <span
              class="bean-contact-panel__presence-dot"
              aria-hidden="true"
            ></span>

            Online
          </div>

        </section>

        <section
          class="bean-contact-panel__quick-actions"
          aria-label="Quick actions"
        >

          ${createQuickAction({
            action: "voice",
            label: "Call",
            icon: icons.phone,
          })}

          ${createQuickAction({
            action: "video",
            label: "Video",
            icon: icons.video,
          })}

          ${createQuickAction({
            action: "search",
            label: "Search",
            icon: icons.search,
          })}

          ${createQuickAction({
            action: "mute",
            label: "Mute",
            icon: icons.bell,
          })}

        </section>

        <section class="bean-contact-panel__section">

          <div class="bean-contact-panel__section-title">
            Shared
          </div>

          <div class="bean-contact-panel__rows">

            ${createDetailRow({
              action: "media",
              label: "Media",
              icon: icons.media,
            })}

            ${createDetailRow({
              action: "files",
              label: "Files",
              icon: icons.file,
            })}

            ${createDetailRow({
              action: "links",
              label: "Links",
              icon: icons.link,
            })}

          </div>

        </section>

        <section class="bean-contact-panel__section">

          <div class="bean-contact-panel__section-title">
            Privacy
          </div>

          <div class="bean-contact-panel__rows">

            ${createDetailRow({
              action: "block",
              label: "Block contact",
              icon: icons.block,
              danger: true,
            })}

          </div>

        </section>

      </div>

    </aside>
  `;
}

/*
=========================================================
INITIALIZE PANEL
=========================================================
*/

export function initContactPanel(onAction) {
  const panel =
    document.getElementById("contactPanel");

  if (!panel) {
    return;
  }

  panel.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest(
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

    if (typeof onAction === "function") {
      onAction(action);
    }
  });
}
