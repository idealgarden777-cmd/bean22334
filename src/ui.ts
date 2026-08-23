import {
  getAuthState,
  logout
} from "./auth";

import {
  ensureCurrentIdentity,
  resolveBeanId,
  type BeanIdentity
} from "./identity";

import {
  listConversations,
  openDirectConversationWithUser,
  type ConversationSummary
} from "./conversations";

import {
  loadMessages,
  decryptMessages,
  sendTextMessage,
  type DecryptedMessage
} from "./messages";

import {
  subscribeToConversation,
  type ConversationRealtimeSubscription
} from "./realtime";

import {
  subscribeToConversationPresence,
  type ConversationPresenceSubscription
} from "./presence";

import {
  getOwnProfile,
  type OwnBeanProfile
} from "./profile";

import {
  searchDiscovery,
  type DiscoveryResult
} from "./discovery";

import {
  getSettings,
  resolveTheme
} from "./settings";

import {
  onConversationOpened,
  onConversationClosed
} from "./notifications";

import {
  createError,
  normalizeError,
  type BeanError
} from "./errors";


/* ============================================================
   BEAN — SIGNATURESI
   UI Orchestrator

   Responsibilities:
   - Own top-level DOM shell
   - Render navigation and primary screens
   - Coordinate feature modules
   - Manage active conversation UI state
   - Render loading / empty / error states
   - Handle basic user interactions
   - Apply runtime theme attributes

   Must NOT own:
   - Authentication implementation
   - Database queries directly
   - Encryption
   - Realtime transport
   - Presence transport
   - Business rules
   - Profile persistence
   - Accessibility engine
   - CSS design tokens

   Architecture:

   feature modules
        ↓
      ui.ts
        ↓
       DOM

   UI must never query Supabase directly.
   ============================================================ */


/* ============================================================
   SCREEN TYPES
   ============================================================ */

export type BeanScreen =
  | "chats"
  | "discover"
  | "work"
  | "profile"
  | "settings";


/* ============================================================
   UI STATE
   ============================================================ */

interface UiState {
  initialized: boolean;

  screen: BeanScreen;

  identity: BeanIdentity | null;

  profile: OwnBeanProfile | null;

  conversations:
    ConversationSummary[];

  activeConversation:
    ConversationSummary | null;

  messages:
    DecryptedMessage[];

  discoveryResults:
    DiscoveryResult[];

  loading:
    boolean;

  error:
    BeanError | null;
}


const state: UiState = {
  initialized:
    false,

  screen:
    "chats",

  identity:
    null,

  profile:
    null,

  conversations:
    [],

  activeConversation:
    null,

  messages:
    [],

  discoveryResults:
    [],

  loading:
    false,

  error:
    null
};


/* ============================================================
   RUNTIME REFERENCES
   ============================================================ */

let root:
  HTMLElement | null = null;


let conversationRealtime:
  ConversationRealtimeSubscription | null =
    null;


let conversationPresence:
  ConversationPresenceSubscription | null =
    null;


/* ============================================================
   HTML ESCAPE

   All dynamic strings rendered through innerHTML must pass
   through this helper.
   ============================================================ */

function escapeHtml(
  value:
    string
): string {
  return value
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


/* ============================================================
   ERROR MESSAGE
   ============================================================ */

function getSafeErrorMessage(
  error:
    BeanError | null
): string {
  return (
    error?.userMessage ??
    "Something went wrong."
  );
}


/* ============================================================
   ROOT GUARD
   ============================================================ */

function requireRoot():
  HTMLElement {
  if (!root) {
    throw createError(
      "CONFIGURATION_ERROR",
      "ui",
      {
        message:
          "Bean UI root is unavailable."
      }
    );
  }


  return root;
}


/* ============================================================
   THEME
   ============================================================ */

function applyTheme():
  void {
  const settings =
    getSettings();


  const resolved =
    resolveTheme();


  document.documentElement
    .dataset.theme =
      resolved;


  document.documentElement
    .dataset.themePreference =
      settings.theme;


  document.documentElement
    .dataset.density =
      settings.density;


  document.documentElement
    .dataset.reduceMotion =
      settings.reduceMotion
        ? "true"
        : "false";
}


/* ============================================================
   BASE SHELL
   ============================================================ */

function renderShell():
  void {
  const app =
    requireRoot();


  app.innerHTML = `
    <div class="bean-app">

      <aside
        class="bean-sidebar"
        aria-label="Bean navigation"
      >
        <div class="bean-sidebar__brand">
          <button
            class="bean-brand"
            type="button"
            data-action="home"
            aria-label="Bean home"
          >
            <span
              class="bean-brand__mark"
              aria-hidden="true"
            >
              B
            </span>

            <span class="bean-brand__name">
              Bean
            </span>
          </button>
        </div>


        <nav class="bean-nav">
          ${renderNavigationButton(
            "chats",
            "Chats"
          )}

          ${renderNavigationButton(
            "discover",
            "Discover"
          )}

          ${renderNavigationButton(
            "work",
            "Work"
          )}
        </nav>


        <div class="bean-sidebar__bottom">
          <button
            class="bean-user-button"
            type="button"
            data-action="profile"
          >
            ${renderCurrentUserCompact()}
          </button>
        </div>
      </aside>


      <main
        class="bean-main"
        id="bean-main"
      >
        ${renderCurrentScreen()}
      </main>

    </div>
  `;


  bindShellEvents();
}


/* ============================================================
   NAV BUTTON
   ============================================================ */

function renderNavigationButton(
  screen:
    BeanScreen,
  label:
    string
): string {
  const selected =
    state.screen ===
      screen;


  return `
    <button
      class="bean-nav__item"
      type="button"
      data-screen="${screen}"
      aria-current="${
        selected
          ? "page"
          : "false"
      }"
    >
      <span>
        ${escapeHtml(label)}
      </span>
    </button>
  `;
}


/* ============================================================
   USER COMPACT
   ============================================================ */

function renderCurrentUserCompact():
  string {
  const profile =
    state.profile;


  const identity =
    state.identity;


  const displayName =
    profile?.displayName ??
    identity?.profile.displayName ??
    "Bean";


  const beanId =
    identity?.beanId ??
    "";


  return `
    <span
      class="bean-user-button__avatar"
      aria-hidden="true"
    >
      ${escapeHtml(
        displayName
          .charAt(0)
          .toUpperCase() ||
        "B"
      )}
    </span>

    <span class="bean-user-button__text">
      <strong>
        ${escapeHtml(displayName)}
      </strong>

      ${
        beanId
          ? `
            <small>
              ${escapeHtml(beanId)}
            </small>
          `
          : ""
      }
    </span>
  `;
}


/* ============================================================
   SCREEN RENDERER
   ============================================================ */

function renderCurrentScreen():
  string {
  if (
    state.loading
  ) {
    return renderLoadingScreen();
  }


  if (
    state.error
  ) {
    return renderErrorScreen();
  }


  switch (
    state.screen
  ) {
    case "chats":
      return renderChatsScreen();

    case "discover":
      return renderDiscoverScreen();

    case "work":
      return renderWorkScreen();

    case "profile":
      return renderProfileScreen();

    case "settings":
      return renderSettingsScreen();
  }
}


/* ============================================================
   LOADING
   ============================================================ */

function renderLoadingScreen():
  string {
  return `
    <section
      class="bean-state-screen"
      aria-busy="true"
      aria-live="polite"
    >
      <div class="bean-state-screen__content">
        <div
          class="bean-spinner"
          aria-hidden="true"
        ></div>

        <p>
          Loading...
        </p>
      </div>
    </section>
  `;
}


/* ============================================================
   ERROR
   ============================================================ */

function renderErrorScreen():
  string {
  return `
    <section
      class="bean-state-screen"
      role="alert"
    >
      <div class="bean-state-screen__content">

        <h1>
          Something went wrong
        </h1>

        <p>
          ${escapeHtml(
            getSafeErrorMessage(
              state.error
            )
          )}
        </p>

        <button
          type="button"
          class="bean-primary-button"
          data-action="retry"
        >
          Try again
        </button>

      </div>
    </section>
  `;
}


/* ============================================================
   CHATS SCREEN
   ============================================================ */

function renderChatsScreen():
  string {
  return `
    <section class="chat-layout">

      <aside
        class="chat-list"
        aria-label="Conversations"
      >
        <header class="chat-list__header">

          <div>
            <h1>
              Chats
            </h1>
          </div>

          <button
            type="button"
            class="bean-icon-button"
            data-action="new-chat"
            aria-label="Start new chat"
          >
            +
          </button>

        </header>


        <div class="chat-list__items">

          ${
            state.conversations.length ===
              0
              ? renderConversationEmpty()
              : state.conversations
                  .map(
                    renderConversationItem
                  )
                  .join("")
          }

        </div>
      </aside>


      <section
        class="conversation-panel"
        aria-label="Conversation"
      >
        ${
          state.activeConversation
            ? renderConversationPanel()
            : renderConversationPlaceholder()
        }
      </section>

    </section>
  `;
}


/* ============================================================
   CONVERSATION EMPTY
   ============================================================ */

function renderConversationEmpty():
  string {
  return `
    <div class="bean-empty">
      <p>
        No conversations yet.
      </p>

      <button
        type="button"
        class="bean-secondary-button"
        data-action="new-chat"
      >
        Start a conversation
      </button>
    </div>
  `;
}


/* ============================================================
   CONVERSATION ITEM
   ============================================================ */

function renderConversationItem(
  summary:
    ConversationSummary
): string {
  const accountId =
    state.identity?.id;


  const peer =
    summary.participants.find(
      (
        participant
      ) =>
        participant.userId !==
          accountId
    );


  const title =
    summary.conversation.kind ===
      "direct"
      ? (
          peer?.profile
            ?.displayName ??
          peer?.beanId ??
          "Bean user"
        )
      : (
          summary.conversation
            .title ??
          "Conversation"
        );


  const subtitle =
    summary.conversation.kind ===
      "direct"
      ? (
          peer?.beanId ??
          ""
        )
      : "";


  const selected =
    state.activeConversation
      ?.conversation.id ===
    summary.conversation.id;


  return `
    <button
      type="button"
      class="conversation-item"
      data-conversation-id="${
        summary.conversation.id
      }"
      aria-current="${
        selected
          ? "true"
          : "false"
      }"
    >

      <span
        class="conversation-item__avatar"
        aria-hidden="true"
      >
        ${escapeHtml(
          title
            .charAt(0)
            .toUpperCase() ||
          "B"
        )}
      </span>


      <span class="conversation-item__content">

        <strong>
          ${escapeHtml(title)}
        </strong>

        ${
          subtitle
            ? `
              <small>
                ${escapeHtml(subtitle)}
              </small>
            `
            : ""
        }

      </span>

    </button>
  `;
}


/* ============================================================
   CONVERSATION PLACEHOLDER
   ============================================================ */

function renderConversationPlaceholder():
  string {
  return `
    <div class="conversation-placeholder">
      <div class="conversation-placeholder__content">

        <div
          class="conversation-placeholder__mark"
          aria-hidden="true"
        >
          B
        </div>

        <h2>
          Bean
        </h2>

        <p>
          Select a conversation or start a new one.
        </p>

      </div>
    </div>
  `;
}


/* ============================================================
   ACTIVE CONVERSATION
   ============================================================ */

function renderConversationPanel():
  string {
  const conversation =
    state.activeConversation;


  if (!conversation) {
    return "";
  }


  const accountId =
    state.identity?.id;


  const peer =
    conversation.participants.find(
      (
        participant
      ) =>
        participant.userId !==
          accountId
    );


  const title =
    conversation.conversation.kind ===
      "direct"
      ? (
          peer?.profile
            ?.displayName ??
          peer?.beanId ??
          "Bean user"
        )
      : (
          conversation.conversation
            .title ??
          "Conversation"
        );


  const beanId =
    peer?.beanId ??
    "";


  return `
    <div class="conversation">

      <header class="conversation__header">

        <div class="conversation__identity">

          <strong>
            ${escapeHtml(title)}
          </strong>

          ${
            beanId
              ? `
                <small>
                  ${escapeHtml(beanId)}
                </small>
              `
              : ""
          }

        </div>


        <div class="conversation__actions">

          <button
            type="button"
            class="bean-icon-button"
            data-action="voice-call"
            aria-label="Voice call"
          >
            Call
          </button>

          <button
            type="button"
            class="bean-icon-button"
            data-action="video-call"
            aria-label="Video call"
          >
            Video
          </button>

        </div>

      </header>


      <div
        class="conversation__messages"
        id="message-list"
        aria-live="polite"
      >
        ${renderMessages()}
      </div>


      <footer class="conversation__composer">

        <form
          class="message-composer"
          id="message-form"
        >
          <textarea
            class="message-composer__input"
            name="message"
            rows="1"
            maxlength="50000"
            placeholder="Message"
            aria-label="Message"
          ></textarea>

          <button
            type="submit"
            class="message-composer__send"
          >
            Send
          </button>
        </form>

      </footer>

    </div>
  `;
}


/* ============================================================
   MESSAGES
   ============================================================ */

function renderMessages():
  string {
  if (
    state.messages.length ===
      0
  ) {
    return `
      <div class="bean-empty">
        <p>
          No messages yet.
        </p>
      </div>
    `;
  }


  return [
    ...state.messages
  ]
    .reverse()
    .map(
      renderMessage
    )
    .join("");
}


/* ============================================================
   MESSAGE
   ============================================================ */

function renderMessage(
  message:
    DecryptedMessage
): string {
  const mine =
    message.senderId ===
      state.identity?.id;


  if (
    message.deletedAt
  ) {
    return `
      <article
        class="message ${
          mine
            ? "message--mine"
            : ""
        }"
      >
        <div class="message__bubble message__bubble--deleted">
          Message removed
        </div>
      </article>
    `;
  }


  const content =
    message.decryptionFailed
      ? "Unable to decrypt this message."
      : (
          message.content ??
          ""
        );


  return `
    <article
      class="message ${
        mine
          ? "message--mine"
          : ""
      }"
      data-message-id="${
        message.id
      }"
    >
      <div class="message__bubble">

        <p>
          ${escapeHtml(content)}
        </p>

        <small class="message__meta">
          ${
            message.editedAt
              ? "Edited"
              : ""
          }
        </small>

      </div>
    </article>
  `;
}


/* ============================================================
   DISCOVER
   ============================================================ */

function renderDiscoverScreen():
  string {
  return `
    <section class="bean-page">

      <header class="bean-page__header">
        <h1>
          Discover
        </h1>

        <p>
          Find people, professionals and businesses.
        </p>
      </header>


      <form
        class="bean-search"
        id="discover-form"
      >
        <input
          type="search"
          name="query"
          placeholder="Search name or bean@username"
          autocomplete="off"
          aria-label="Search Bean"
        />

        <button
          type="submit"
          class="bean-primary-button"
        >
          Search
        </button>
      </form>


      <div class="discover-results">

        ${
          state.discoveryResults
            .map(
              renderDiscoveryResult
            )
            .join("")
        }

      </div>

    </section>
  `;
}


/* ============================================================
   DISCOVERY RESULT
   ============================================================ */

function renderDiscoveryResult(
  result:
    DiscoveryResult
): string {
  return `
    <article class="discover-card">

      <div
        class="discover-card__avatar"
        aria-hidden="true"
      >
        ${escapeHtml(
          result.displayName
            .charAt(0)
            .toUpperCase() ||
          "B"
        )}
      </div>


      <div class="discover-card__body">

        <strong>
          ${escapeHtml(
            result.displayName
          )}
        </strong>

        <small>
          ${escapeHtml(
            result.beanId
          )}
        </small>

        ${
          result.bio
            ? `
              <p>
                ${escapeHtml(
                  result.bio
                )}
              </p>
            `
            : ""
        }

      </div>


      <button
        type="button"
        class="bean-secondary-button"
        data-action="message-user"
        data-user-id="${
          result.userId
        }"
      >
        Message
      </button>

    </article>
  `;
}


/* ============================================================
   WORK
   ============================================================ */

function renderWorkScreen():
  string {
  return `
    <section class="bean-page">

      <header class="bean-page__header">

        <h1>
          Work
        </h1>

        <p>
          Services, projects and professional opportunities.
        </p>

      </header>


      <div class="bean-empty">

        <p>
          Bean Work is ready for its dedicated interface.
        </p>

      </div>

    </section>
  `;
}


/* ============================================================
   PROFILE
   ============================================================ */

function renderProfileScreen():
  string {
  const profile =
    state.profile;


  const identity =
    state.identity;


  if (
    !profile ||
    !identity
  ) {
    return `
      <section class="bean-page">
        <div class="bean-empty">
          Profile unavailable.
        </div>
      </section>
    `;
  }


  return `
    <section class="bean-page">

      <header class="profile-header">

        <div
          class="profile-header__avatar"
          aria-hidden="true"
        >
          ${escapeHtml(
            profile.displayName
              .charAt(0)
              .toUpperCase() ||
            "B"
          )}
        </div>


        <div>

          <h1>
            ${escapeHtml(
              profile.displayName
            )}
          </h1>

          ${
            identity.beanId
              ? `
                <p>
                  ${escapeHtml(
                    identity.beanId
                  )}
                </p>
              `
              : ""
          }

        </div>

      </header>


      ${
        profile.bio
          ? `
            <p class="profile-bio">
              ${escapeHtml(
                profile.bio
              )}
            </p>
          `
          : ""
      }


      <div class="profile-actions">

        <button
          type="button"
          class="bean-secondary-button"
          data-screen="settings"
        >
          Settings
        </button>

        <button
          type="button"
          class="bean-danger-button"
          data-action="logout"
        >
          Sign out
        </button>

      </div>

    </section>
  `;
}


/* ============================================================
   SETTINGS
   ============================================================ */

function renderSettingsScreen():
  string {
  const settings =
    getSettings();


  return `
    <section class="bean-page">

      <header class="bean-page__header">

        <h1>
          Settings
        </h1>

      </header>


      <div class="settings-list">

        <div class="settings-row">

          <div>
            <strong>
              Theme
            </strong>

            <small>
              ${escapeHtml(
                settings.theme
              )}
            </small>
          </div>

        </div>


        <div class="settings-row">

          <div>
            <strong>
              Read receipts
            </strong>
          </div>

          <span>
            ${
              settings.readReceipts
                ? "On"
                : "Off"
            }
          </span>

        </div>


        <div class="settings-row">

          <div>
            <strong>
              Typing indicators
            </strong>
          </div>

          <span>
            ${
              settings.typingIndicators
                ? "On"
                : "Off"
            }
          </span>

        </div>


        <div class="settings-row">

          <div>
            <strong>
              Message previews
            </strong>
          </div>

          <span>
            ${
              settings.messagePreviews
                ? "On"
                : "Off"
            }
          </span>

        </div>

      </div>

    </section>
  `;
}


/* ============================================================
   SCREEN CHANGE
   ============================================================ */

async function changeScreen(
  screen:
    BeanScreen
): Promise<void> {
  state.screen =
    screen;

  state.error =
    null;


  renderShell();


  await bindScreenEvents();
}


/* ============================================================
   LOAD APP DATA
   ============================================================ */

async function loadInitialData():
  Promise<void> {
  state.loading =
    true;

  state.error =
    null;


  renderShell();


  try {
    state.identity =
      await ensureCurrentIdentity();


    state.profile =
      await getOwnProfile();


    state.conversations =
      await listConversations();


    state.loading =
      false;


    renderShell();


    await bindScreenEvents();
  } catch (error) {
    state.loading =
      false;


    state.error =
      normalizeError(
        error,
        {
          source:
            "ui"
        }
      );


    renderShell();

    bindShellEvents();
  }
}


/* ============================================================
   OPEN CONVERSATION
   ============================================================ */

async function openConversation(
  conversationId:
    string
): Promise<void> {
  const summary =
    state.conversations.find(
      (
        item
      ) =>
        item.conversation.id ===
          conversationId
    );


  if (!summary) {
    return;
  }


  await closeActiveConversation();


  state.activeConversation =
    summary;

  state.messages =
    [];


  await onConversationOpened(
    conversationId
  );


  try {
    const page =
      await loadMessages({
        conversationId,

        limit:
          40
      });


    state.messages =
      await decryptMessages(
        page.messages
      );


    await subscribeActiveConversation(
      conversationId
    );


    renderShell();

    await bindScreenEvents();

    scrollMessagesToBottom();
  } catch (error) {
    state.error =
      normalizeError(
        error,
        {
          source:
            "ui"
        }
      );


    renderShell();
    bindShellEvents();
  }
}


/* ============================================================
   REALTIME ACTIVE CONVERSATION
   ============================================================ */

async function subscribeActiveConversation(
  conversationId:
    string
): Promise<void> {
  conversationRealtime =
    await subscribeToConversation(
      conversationId,
      (
        event
      ) => {
        if (
          event.event ===
            "message.insert" ||
          event.event ===
            "message.update"
        ) {
          void reloadActiveMessages();
        }
      }
    );


  conversationPresence =
    await subscribeToConversationPresence(
      conversationId,
      () => {
        /*
         * Presence UI indicators will be progressively
         * rendered later without altering transport logic.
         */
      }
    );
}


/* ============================================================
   RELOAD ACTIVE MESSAGES
   ============================================================ */

async function reloadActiveMessages():
  Promise<void> {
  const conversationId =
    state.activeConversation
      ?.conversation.id;


  if (!conversationId) {
    return;
  }


  try {
    const page =
      await loadMessages({
        conversationId,

        limit:
          40
      });


    state.messages =
      await decryptMessages(
        page.messages
      );


    renderShell();

    await bindScreenEvents();

    scrollMessagesToBottom();
  } catch (error) {
    console.warn(
      "[Bean:ui] Message reload failed.",
      error
    );
  }
}


/* ============================================================
   CLOSE ACTIVE CONVERSATION
   ============================================================ */

async function closeActiveConversation():
  Promise<void> {
  const conversationId =
    state.activeConversation
      ?.conversation.id;


  if (
    conversationRealtime
  ) {
    await conversationRealtime
      .unsubscribe();

    conversationRealtime =
      null;
  }


  if (
    conversationPresence
  ) {
    await conversationPresence
      .unsubscribe();

    conversationPresence =
      null;
  }


  if (
    conversationId
  ) {
    onConversationClosed(
      conversationId
    );
  }


  state.activeConversation =
    null;

  state.messages =
    [];
}


/* ============================================================
   SEND MESSAGE
   ============================================================ */

async function handleMessageSubmit(
  form:
    HTMLFormElement
): Promise<void> {
  const conversationId =
    state.activeConversation
      ?.conversation.id;


  if (!conversationId) {
    return;
  }


  const textarea =
    form.querySelector<
      HTMLTextAreaElement
    >(
      'textarea[name="message"]'
    );


  if (!textarea) {
    return;
  }


  const text =
    textarea.value;


  if (
    !text.trim()
  ) {
    return;
  }


  textarea.disabled =
    true;


  try {
    await sendTextMessage({
      conversationId,

      text
    });


    textarea.value =
      "";


    await reloadActiveMessages();
  } catch (error) {
    state.error =
      normalizeError(
        error,
        {
          source:
            "ui",

          fallbackCode:
            "MESSAGE_SEND_FAILED"
        }
      );


    renderShell();

    bindShellEvents();
  } finally {
    textarea.disabled =
      false;
  }
}


/* ============================================================
   DISCOVERY SEARCH
   ============================================================ */

async function handleDiscoverySearch(
  form:
    HTMLFormElement
): Promise<void> {
  const field =
    form.querySelector<
      HTMLInputElement
    >(
      'input[name="query"]'
    );


  if (!field) {
    return;
  }


  try {
    const result =
      await searchDiscovery({
        query:
          field.value
      });


    state.discoveryResults =
      result.items;


    renderShell();

    await bindScreenEvents();
  } catch (error) {
    state.error =
      normalizeError(
        error,
        {
          source:
            "ui"
        }
      );


    renderShell();
    bindShellEvents();
  }
}


/* ============================================================
   OPEN DIRECT MESSAGE FROM DISCOVER
   ============================================================ */

async function openDirectMessage(
  userId:
    string
): Promise<void> {
  try {
    const summary =
      await openDirectConversationWithUser(
        userId
      );


    const existingIndex =
      state.conversations.findIndex(
        (
          item
        ) =>
          item.conversation.id ===
            summary.conversation.id
      );


    if (
      existingIndex === -1
    ) {
      state.conversations.unshift(
        summary
      );
    } else {
      state.conversations[
        existingIndex
      ] =
        summary;
    }


    state.screen =
      "chats";


    renderShell();

    await bindScreenEvents();


    await openConversation(
      summary.conversation.id
    );
  } catch (error) {
    state.error =
      normalizeError(
        error,
        {
          source:
            "ui"
        }
      );


    renderShell();
    bindShellEvents();
  }
}


/* ============================================================
   NEW CHAT

   Minimal temporary flow until dedicated composer UI exists.
   ============================================================ */

async function startNewChat():
  Promise<void> {
  const value =
    window.prompt(
      "Enter Bean ID, for example bean@samuel"
    );


  if (!value) {
    return;
  }


  try {
    const identity =
      await resolveBeanId(
        value
      );


    if (!identity) {
      throw createError(
        "IDENTITY_NOT_FOUND",
        "ui"
      );
    }


    await openDirectMessage(
      identity.id
    );
  } catch (error) {
    state.error =
      normalizeError(
        error,
        {
          source:
            "ui"
        }
      );


    renderShell();
    bindShellEvents();
  }
}


/* ============================================================
   SHELL EVENTS
   ============================================================ */

function bindShellEvents():
  void {
  const app =
    requireRoot();


  const screenButtons =
    app.querySelectorAll<
      HTMLButtonElement
    >(
      "[data-screen]"
    );


  for (
    const button of
    screenButtons
  ) {
    button.addEventListener(
      "click",
      () => {
        const screen =
          button.dataset.screen;


        if (
          isBeanScreen(
            screen
          )
        ) {
          void changeScreen(
            screen
          );
        }
      }
    );
  }


  app.querySelector(
    '[data-action="profile"]'
  )?.addEventListener(
    "click",
    () => {
      void changeScreen(
        "profile"
      );
    }
  );


  app.querySelector(
    '[data-action="home"]'
  )?.addEventListener(
    "click",
    () => {
      void changeScreen(
        "chats"
      );
    }
  );


  app.querySelector(
    '[data-action="retry"]'
  )?.addEventListener(
    "click",
    () => {
      state.error =
        null;

      void loadInitialData();
    }
  );


  app.querySelector(
    '[data-action="logout"]'
  )?.addEventListener(
    "click",
    () => {
      void logout();
    }
  );
}


/* ============================================================
   SCREEN EVENTS
   ============================================================ */

async function bindScreenEvents():
  Promise<void> {
  const app =
    requireRoot();


  /* ========================================================
     CONVERSATION ITEMS
     ======================================================== */

  const conversationButtons =
    app.querySelectorAll<
      HTMLButtonElement
    >(
      "[data-conversation-id]"
    );


  for (
    const button of
    conversationButtons
  ) {
    button.addEventListener(
      "click",
      () => {
        const id =
          button.dataset
            .conversationId;


        if (id) {
          void openConversation(
            id
          );
        }
      }
    );
  }


  /* ========================================================
     MESSAGE FORM
     ======================================================== */

  const messageForm =
    app.querySelector<
      HTMLFormElement
    >(
      "#message-form"
    );


  messageForm?.addEventListener(
    "submit",
    (
      event
    ) => {
      event.preventDefault();

      void handleMessageSubmit(
        messageForm
      );
    }
  );


  /* ========================================================
     NEW CHAT
     ======================================================== */

  const newChatButtons =
    app.querySelectorAll(
      '[data-action="new-chat"]'
    );


  for (
    const button of
    newChatButtons
  ) {
    button.addEventListener(
      "click",
      () => {
        void startNewChat();
      }
    );
  }


  /* ========================================================
     DISCOVERY
     ======================================================== */

  const discoveryForm =
    app.querySelector<
      HTMLFormElement
    >(
      "#discover-form"
    );


  discoveryForm?.addEventListener(
    "submit",
    (
      event
    ) => {
      event.preventDefault();

      void handleDiscoverySearch(
        discoveryForm
      );
    }
  );


  /* ========================================================
     MESSAGE USER
     ======================================================== */

  const messageButtons =
    app.querySelectorAll<
      HTMLButtonElement
    >(
      '[data-action="message-user"]'
    );


  for (
    const button of
    messageButtons
  ) {
    button.addEventListener(
      "click",
      () => {
        const userId =
          button.dataset
            .userId;


        if (userId) {
          void openDirectMessage(
            userId
          );
        }
      }
    );
  }
}


/* ============================================================
   SCREEN TYPE GUARD
   ============================================================ */

function isBeanScreen(
  value:
    string | undefined
): value is BeanScreen {
  return (
    value === "chats" ||
    value === "discover" ||
    value === "work" ||
    value === "profile" ||
    value === "settings"
  );
}


/* ============================================================
   SCROLL
   ============================================================ */

function scrollMessagesToBottom():
  void {
  window.requestAnimationFrame(
    () => {
      const list =
        document.getElementById(
          "message-list"
        );


      if (!list) {
        return;
      }


      list.scrollTop =
        list.scrollHeight;
    }
  );
}


/* ============================================================
   INITIALIZE UI

   Called by core.ts after:
   auth
   identity
   settings
   crypto
   etc. are ready.
   ============================================================ */

export async function initializeUI(
  appRoot:
    HTMLElement
): Promise<void> {
  if (
    state.initialized
  ) {
    return;
  }


  const auth =
    getAuthState();


  if (
    auth.status !==
      "authenticated"
  ) {
    throw createError(
      "AUTH_REQUIRED",
      "ui"
    );
  }


  root =
    appRoot;


  applyTheme();


  state.initialized =
    true;


  renderShell();


  bindShellEvents();


  await loadInitialData();
}


/* ============================================================
   RESET UI

   Used on logout/account replacement.
   ============================================================ */

export async function resetUI():
  Promise<void> {
  await closeActiveConversation();


  state.initialized =
    false;

  state.screen =
    "chats";

  state.identity =
    null;

  state.profile =
    null;

  state.conversations =
    [];

  state.activeConversation =
    null;

  state.messages =
    [];

  state.discoveryResults =
    [];

  state.loading =
    false;

  state.error =
    null;


  if (root) {
    root.innerHTML =
      "";
  }


  root =
    null;
}
