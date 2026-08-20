// Offline shell.
//
// Bump CACHE when a release ships: the old cache is dropped on activate, so a
// stale build can never half-survive into a new one. Nothing here calls
// skipWaiting - a new worker takes over the next time the game is launched
// rather than swapping code out from under a run in progress.
const CACHE = 'oing-v1';

// Enough to boot with no network: the document, the styles, every module the
// entry pulls in, the two fonts, the home art and the app icons. Everything
// else (play backgrounds, chapter scenes, sounds) is cached the first time it
// is actually fetched, so a first offline launch still reaches the home screen
// and a second one plays.
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'css/ui-chrome.css',
  'css/play-layout-v1.css',
  'css/claude-polish.css',
  'js/game.js',
  'js/adapters.js',
  'js/audio.js',
  'js/balance.js',
  'js/board-items.js',
  'js/board.js',
  'js/data.js',
  'js/haptic.js',
  'js/input.js',
  'js/inventory.js',
  'js/music.js',
  'js/navigation.js',
  'js/preload.js',
  'js/telemetry.js',
  'js/ui.js',
  'assets/fonts/Jua-Korean-Game.woff2',
  'assets/fonts/Pretendard-OING.woff2',
  'assets/backgrounds/home-bg@2x.webp',
  'assets/ui/logo-v2.webp',
  'assets/characters/cat-idle.webp',
  'assets/icons/app/icon-192.png',
  'assets/icons/app/icon-512.png',
  'assets/icons/app/icon-maskable-512.png',
  'assets/icons/app/apple-touch-icon.png',
  'assets/icons/app/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // One miss must not fail the whole install - a renamed asset would otherwise
    // leave the game with no worker at all.
    await Promise.all(SHELL.map((url) => cache.add(url).catch(() => {})));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The document goes to the network first so a new build is picked up as soon
  // as there is a connection, and falls back to the cached shell when there is
  // not. Range requests (the audio element seeking) are left to the network -
  // a cached 200 cannot answer a 206.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE);
        cache.put('index.html', fresh.clone()).catch(() => {});
        return fresh;
      } catch {
        return (await caches.match('index.html')) || Response.error();
      }
    })());
    return;
  }

  if (request.headers.has('range')) return;

  // Everything else is content-addressed by filename in this project, so cache
  // first is safe and is what makes a second launch instant.
  event.respondWith((async () => {
    const hit = await caches.match(request);
    if (hit) return hit;
    try {
      const fresh = await fetch(request);
      if (fresh.ok && fresh.type === 'basic') {
        const cache = await caches.open(CACHE);
        cache.put(request, fresh.clone()).catch(() => {});
      }
      return fresh;
    } catch {
      return Response.error();
    }
  })());
});
