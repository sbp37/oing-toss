const PLAY_ASSETS = Object.freeze([
  'assets/backgrounds/play-bg@2x.webp',
  'assets/characters/cat-peek.webp',
  'assets/characters/cat-wave.webp',
  'assets/characters/cat-cheer.webp',
  'assets/characters/cat-success.webp',
  'assets/characters/cat-fail.webp',
  'assets/icons/hud/time.webp',
  'assets/icons/hud/score.webp',
  'assets/decor/star.webp',
  'assets/icons/items/hint.webp',
  'assets/icons/items/shuffle.webp',
  'assets/ui/button-pause.webp',
  'assets/ui/tile-normal.webp',
  'assets/ui/tile-empty.webp',
  'assets/ui/tile-selected.webp',
  'assets/ui/tile-success.webp',
  'assets/ui/tile-hint.webp',
]);

const RESULT_ASSETS = Object.freeze([
  'assets/characters/cat-cheer.webp',
  'assets/characters/cat-success.webp',
  'assets/characters/cat-fail.webp',
  'assets/icons/navigation/home.webp',
  'assets/icons/navigation/trophy.webp',
]);

const imageCache = new Map();

export function preloadImages(paths) {
  paths.forEach((src) => {
    if (imageCache.has(src)) return;
    const image = new Image();
    image.decoding = 'async';
    image.src = src;
    imageCache.set(src, image);
    image.decode?.().catch(() => {});
  });
}

function scheduleIdle(callback) {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(callback, { timeout: 1400 });
  } else {
    window.setTimeout(callback, 420);
  }
}

export function schedulePlayAssetsPreload() {
  const schedule = () => scheduleIdle(() => preloadImages(PLAY_ASSETS));
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });
}

export function preloadResultAssets() {
  scheduleIdle(() => preloadImages(RESULT_ASSETS));
}
