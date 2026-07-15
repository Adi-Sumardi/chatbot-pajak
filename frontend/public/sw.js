const CACHE_NAME = "chatbot-pajak-v3";
const STATIC_ASSETS = [
  "/",
  "/chat",
  "/scanner",
  "/settings",
  "/login",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/apple-touch-icon.png",
];

// Install - cache static assets. Deliberately does NOT call skipWaiting():
// the new worker stays in "waiting" state until the page asks it to take
// over (see the message listener below), so users get a reload prompt
// instead of silently running mismatched JS/CSS against a new backend.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Some pages may not be available yet during build
      });
    })
  );
});

// Activate - clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Let the page trigger activation of a waiting worker once the user
// confirms the "update available" reload prompt.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Fetch - network first, fallback to cache
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip non-HTTP schemes (like chrome-extension://)
  if (!request.url.startsWith("http")) return;

  // Skip API calls - always go to network
  if (request.url.includes("/api/")) return;

  // Skip SSE streaming
  if (request.headers.get("accept")?.includes("text/event-stream")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses for static assets
        if (response.ok && request.url.match(/\.(js|css|png|jpg|svg|woff2?)$/)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // For navigation requests, show offline page
          if (request.mode === "navigate") {
            return caches.match("/chat");
          }
          return new Response("Offline", { status: 503 });
        });
      })
  );
});
