"use strict";

/*
=========================================================
BEAN — SIDEBAR
=========================================================

Owns:
- Brand area
- Primary navigation
- Secondary navigation
- Profile button
- Active navigation state

Does not own:
- Page routing
- Backend
- Authentication
- Profile data
=========================================================
*/

/*
=========================================================
ICONS
=========================================================
*/

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
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8.5 19.3a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.1A1.7 1.7 0 0 0 4.7 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.5 4.7a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4h.1v4h-.1A1.7 1.7 0 0 0 19.4 15z"/>
    </svg>
  `,
};

/*
=========================================================
NAV BUTTON
=========================================================
*/

function createNavButton({
  id,
  label,
  icon,
  active = false,
}) {
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

/*
=========================================================
SIDEBAR
=========================================================
*/

export function createSidebar(activeView = "chats") {
  return `
    <aside
      class="bean-sidebar"
      aria-label="Main navigation"
    >

      <div class="bean-sidebar__top">

        <button
          class="bean-sidebar__logo"
          type="button"
          data-nav="home"
          aria-label="Bean home"
          title="Bean"
        >
          <span aria-hidden="true">B</span>
        </button>

      </div>

      <nav
        class="bean-sidebar__nav"
        aria-label="Primary navigation"
      >

        ${createNavButton({
          id: "chats",
          label: "Chats",
          icon: icons.chats,
          active: activeView === "chats",
        })}

        ${createNavButton({
          id: "contacts",
          label: "Contacts",
          icon: icons.contacts,
          active: activeView === "contacts",
        })}

        ${createNavButton({
          id: "search",
          label: "Search",
          icon: icons.search,
          active: activeView === "search",
        })}

      </nav>

      <div class="bean-sidebar__bottom">

        ${createNavButton({
          id: "settings",
          label: "Settings",
          icon: icons.settings,
          active: activeView === "settings",
        })}

        <button
          class="bean-sidebar__profile"
          type="button"
          data-nav="profile"
          aria-label="Profile"
          title="Profile"
        >
          <span
            class="bean-avatar bean-avatar--profile"
            aria-hidden="true"
          >
            SY
          </span>

          <span class="bean-status-dot"></span>
        </button>

      </div>

    </aside>
  `;
}

/*
=========================================================
SIDEBAR EVENTS
=========================================================
*/

export function initSidebar(onNavigate) {
  const sidebar =
    document.querySelector(".bean-sidebar");

  if (!sidebar) {
    console.warn(
      "Bean: sidebar element not found."
    );
    return;
  }

  sidebar.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest("[data-nav]");

    if (!button) {
      return;
    }

    const view = button.dataset.nav;

    if (!view) {
      return;
    }

    if (typeof onNavigate === "function") {
      onNavigate(view);
    }
  });
}

/*
=========================================================
ACTIVE STATE
=========================================================
*/

export function setActiveSidebarView(view) {
  const buttons =
    document.querySelectorAll(
      ".bean-sidebar [data-nav]"
    );

  buttons.forEach((button) => {
    const isActive =
      button.dataset.nav === view;

    button.classList.toggle(
      "is-active",
      isActive
    );

    if (
      button.classList.contains(
        "bean-nav-button"
      )
    ) {
      button.setAttribute(
        "aria-current",
        isActive ? "page" : "false"
      );
    }
  });
}
