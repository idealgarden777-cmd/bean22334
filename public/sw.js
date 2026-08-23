/* ============================================================
   BEAN — SIGNATURESI
   Service Worker

   Responsibilities:
   - Cache the application shell
   - Cache versioned static assets
   - Provide basic offline startup
   - Remove outdated caches

   Must NOT cache:
   - Authentication/session responses
   - Supabase/API requests
   - Messages
   - Private media/uploads
   - Realtime traffic
   ============================================================ */

"use strict";


/* ============================================================
   CACHE VERSION
   ============================================================ */

const CACHE_VERSION = "bean-v1";

const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;

const VALID_CACHES = new Set([
  STATIC_CACHE,
  PAGE_CACHE
]);


/* ============================================================
   APP SHELL
   Keep this list small and deterministic.
   ============================================================ */

const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icons/favicon-32.png",
  "/icons/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png"
];


/* ============================================================
   INSTALL
   ============================================================ */

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);

      /*
       * addAll() would fail the entire installation if even one
       * optional icon is missing.
       *
       * Cache each shell resource independently instead.
       */
      await Promise.allSettled(
        APP_SHELL.map(async (url) => {
          const request = new Request(url, {
            cache: "reload"
          });

          const response = await fetch(request);

          if (response.ok) {
            await cache.put(request, response);
          }
        })
      );

      await self.skipWaiting();
    })()
  );
});


/* ============================================================
   ACTIVATE
   ============================================================ */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames.map((cacheName) => {
          if (
            cacheName.startsWith("bean-") &&
            !VALID_CACHES.has(cacheName)
          ) {
            return caches.delete(cacheName);
          }

          return Promise.resolve(false);
        })
      );

      await self.clients.claim();
    })()
  );
});


/* ============================================================
   REQUEST CLASSIFICATION
   ============================================================ */

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}


function isSensitivePath(url) {
  const path = url.pathname;

  return (
    path.startsWith("/api/") ||
    path.startsWith("/auth/") ||
    path.startsWith("/realtime/") ||
    path.startsWith("/media/") ||
    path.startsWith("/uploads/")
  );
}


function isStaticAsset(request, url) {
  if (!isSameOrigin(url)) {
    return false;
  }

  if (url.pathname.startsWith("/assets/")) {
    return true;
  }

  if (url.pathname.startsWith("/icons/")) {
    return true;
  }

  return (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font"
  );
}


/* ============================================================
   STATIC ASSET STRATEGY
   Cache First

   Vite production assets use content hashes, making cache-first
   appropriate for /assets/*.
   ============================================================ */

async function handleStaticAsset(request) {
  const cache = await caches.open(STATIC_CACHE);

  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response.ok) {
    await cache.put(request, response.clone());
  }

  return response;
}


/* ============================================================
   NAVIGATION STRATEGY
   Network First

   Always prefer the latest application shell.
   If offline, return the last successfully cached shell.
   ============================================================ */

async function handleNavigation(request) {
  const cache = await caches.open(PAGE_CACHE);

  try {
    const response = await fetch(request);

    if (response.ok) {
      await cache.put("/", response.clone());
    }

    return response;
  } catch {
    const cachedPage =
      await cache.match("/") ||
      await caches.match("/");

    if (cachedPage) {
      return cachedPage;
    }

    return new Response(
      "Bean is currently offline.",
      {
        status: 503,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      }
    );
  }
}


/* ============================================================
   FETCH
   ============================================================ */

self.addEventListener("fetch", (event) => {
  const { request } = event;

  /*
   * Never interfere with writes.
   */
  if (request.method !== "GET") {
    return;
  }

  /*
   * Range requests are commonly used by audio/video.
   * Browser/network should handle them directly.
   */
  if (request.headers.has("range")) {
    return;
  }

  const url = new URL(request.url);

  /*
   * Never cache cross-origin requests.
   *
   * This automatically keeps Supabase, Signaturesi Accounts,
   * TURN/STUN and other external services out of Cache Storage.
   */
  if (!isSameOrigin(url)) {
    return;
  }

  /*
   * Explicit protection for sensitive application routes.
   */
  if (isSensitivePath(url)) {
    return;
  }

  /*
   * SPA navigation.
   */
  if (request.mode === "navigate") {
    event.respondWith(
      handleNavigation(request)
    );

    return;
  }

  /*
   * Versioned/static frontend resources.
   */
  if (isStaticAsset(request, url)) {
    event.respondWith(
      handleStaticAsset(request)
    );
  }
});


/* ============================================================
   MESSAGE CHANNEL
   Allows the application to activate a newly installed
   service worker after a controlled UI update.
   ============================================================ */

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});
