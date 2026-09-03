"use strict";

/* =========================================================
   BEAN — SIDEBAR
   Primary application navigation
   ========================================================= */


const icons = {
  chats: `
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
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>
    </svg>
  `,

  contacts: `
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
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 21a8 8 0 0 1 16 0"/>
    </svg>
  `,

  search: `
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
      <circle cx="11" cy="11" r="7"/>
      <path d="m20 20-4-4"/>
    </svg>
  `,

  settings: `
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
      <circle cx="12" cy="12" r="3"/>
      <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1A7 7 0 0 0 15 6l-.3-2.6h-4L10.4 6A7 7 0 0 0 8.8 7L6.4 6 4.4 9.5 6.3 11a7 7 0 0 0 0 2l-1.9 1.5L6.4 18l2.4-1a7 7 0 0 0 1.6 1l.3 2.6h4L15 18a7 7 0 0 0 1.6-1l2.4 1 2-3.5-2-1.5a7 7 0 0 0 0-1z"/>
    </svg>
  `,
};


/* =========================================================
   NAV BUTTON
   ========================================================= */

function createNavButton(
  id,
  label,
  icon,
  activeView
) {
  const active = id === activeView;

  return `
    <button
      class="bean-nav-button${active ? " is-active" : ""}"
      type="button"
      data-nav="${id}"
      aria-label="${label}"
      aria-current="${active ? "page" : "false"}"
      title="${label}"
    >
      ${icon}
    </button>
  `;
}


/* =========================================================
   SIDEBAR MARKUP
   ========================================================= */

export function createSidebar(
  activeView = "chats"
) {
  return `
    <aside
      class="bean-sidebar"
      aria-label="Main navigation"
    >

      <div class="bean-sidebar__top">

        <button
          class="bean-sidebar__logo"
          type="button"
          data-nav="chats"
          aria-label="Bean home"
          title="Bean"
        >
          B
        </button>

      </div>


      <nav
        class="bean-sidebar__nav"
        aria-label="Primary navigation"
      >

        ${createNavButton(
          "chats",
          "Chats",
          icons.chats,
          activeView
        )}

        ${createNavButton(
          "contacts",
          "Contacts",
          icons.contacts,
          activeView
        )}

        ${createNavButton(
          "search",
          "Search",
          icons.search,
          activeView
        )}

      </nav>


      <div class="bean-sidebar__bottom">

        ${createNavButton(
          "settings",
          "Settings",
          icons.settings,
          activeView
        )}

        <button
          class="bean-sidebar__profile"
          type="button"
          data-nav="profile"
          aria-label="Open profile"
          title="Profile"
        >
          <span
            class="bean-avatar bean-avatar--profile"
            aria-hidden="true"
          >
            SY
          </span>

          <span
            class="bean-status-dot is-online"
            aria-hidden="true"
          ></span>
        </button>

      </div>

    </aside>
  `;
}


/* =========================================================
   INITIALIZE SIDEBAR
   ========================================================= */

export function initSidebar(
  onNavigate
) {
  const sidebar =
    document.querySelector(
      ".bean-sidebar"
    );

  if (!sidebar) {
    return;
  }

  sidebar.addEventListener(
    "click",
    (event) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const button =
        target.closest("[data-nav]");

      if (!button) {
        return;
      }

      const view =
        button.dataset.nav;

      if (!view) {
        return;
      }

      setActiveSidebarView(view);

      if (
        typeof onNavigate === "function"
      ) {
        onNavigate(view);
      }
    }
  );
}


/* =========================================================
   ACTIVE STATE
   ========================================================= */

export function setActiveSidebarView(
  view
) {
  const buttons =
    document.querySelectorAll(
      ".bean-sidebar [data-nav]"
    );

  buttons.forEach((button) => {
    const active =
      button.dataset.nav === view;

    if (
      button.classList.contains(
        "bean-nav-button"
      )
    ) {
      button.classList.toggle(
        "is-active",
        active
      );

      button.setAttribute(
        "aria-current",
        active
          ? "page"
          : "false"
      );
    }
  });
}
