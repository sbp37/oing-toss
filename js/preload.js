const PLAY_CRITICAL_ASSETS = Object.freeze([
  'assets/backgrounds/play-bg-rose-morning-v2.webp',
  'assets/ui/play-control-pause-v3.webp',
  'assets/ui/play-control-sound-v3.webp',
  'assets/ui/play-stage-badge-v3.webp',
  'assets/ui/play-timer-pill-v3.webp',
  'assets/ui/play-status-bar-v5.webp',
  'assets/ui/play-top-controls-v4.webp',
  'assets/ui/item-dock-v4.webp',
  'assets/ui/speech-bubble-wide-v3.webp',
  'assets/characters/cat-peek.webp',
  'assets/characters/cat-wave.webp',
  'assets/characters/cat-idle.webp',
  'assets/icons/hud/time.webp',
  'assets/icons/hud/score.webp',
  'assets/decor/star.webp',
  'assets/icons/items/hint.webp',
  'assets/icons/items/shuffle.webp',
  'assets/icons/items/bomb.webp',
  'assets/ui/tiles-syrup-v4/tile-mint.webp',
]);

const PLAY_DEFERRED_ASSETS = Object.freeze([
  'assets/backgrounds/board-secret-garden-v1.webp',
  'assets/characters/cat-cheer.webp',
  'assets/characters/cat-success.webp',
  'assets/characters/cat-fail.webp',
  'assets/icons/items/megabomb.webp',
  'assets/icons/items/freeze.webp',
  'assets/icons/items/clover.webp',
]);

const RESULT_ASSETS = Object.freeze([
  'assets/characters/cat-cheer.webp',
  'assets/characters/cat-success.webp',
  'assets/characters/cat-fail.webp',
  'assets/icons/navigation/home.webp',
  'assets/icons/navigation/trophy.webp',
]);

const imageCache = new Map();

export function preloadImages(paths, { urgent = false } = {}) {
  const requests = paths.map((src) => {
    if (imageCache.has(src)) {
      const cached = imageCache.get(src);
      if (urgent) cached.image.fetchPriority = 'high';
      return cached.ready;
    }
    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = urgent ? 'high' : 'low';
    const ready = new Promise((resolve) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
    });
    image.src = src;
    imageCache.set(src, { image, ready });
    image.decode?.().catch(() => {});
    return ready;
  });
  return Promise.all(requests);
}

function scheduleIdle(callback) {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(callback, { timeout: 1400 });
  } else {
    window.setTimeout(callback, 420);
  }
}

export function schedulePlayAssetsPreload() {
  const afterFirstPaint = () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        scheduleIdle(async () => {
          await preloadImages(PLAY_CRITICAL_ASSETS);
          scheduleIdle(() => preloadImages(PLAY_DEFERRED_ASSETS));
        });
      });
    });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', afterFirstPaint, { once: true });
  } else {
    afterFirstPaint();
  }
}

export function preloadPlayAssets({ urgent = false } = {}) {
  return preloadImages(PLAY_CRITICAL_ASSETS, { urgent });
}

export function preloadResultAssets() {
  scheduleIdle(() => preloadImages(RESULT_ASSETS));
}
