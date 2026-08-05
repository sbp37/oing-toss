const BEST_SCORE_KEY = 'oing_toss_v2_best_score';
const SETTINGS_KEY = 'oing_toss_v2_settings';
const TUTORIAL_KEY = 'oing_toss_v2_drag_tutorial_done';

function safeRead(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

export const storageAdapter = {
  getBestScore() {
    const value = Number(safeRead(BEST_SCORE_KEY, '0'));
    return Number.isFinite(value) ? value : 0;
  },
  saveBestScore(score) {
    try { localStorage.setItem(BEST_SCORE_KEY, String(Math.max(0, Math.round(score)))); } catch {}
  },
  getSettings() {
    try {
      return { sound: true, haptic: true, ...JSON.parse(safeRead(SETTINGS_KEY, '{}')) };
    } catch {
      return { sound: true, haptic: true };
    }
  },
  saveSettings(settings) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
  },
  hasSeenDragTutorial() {
    return safeRead(TUTORIAL_KEY, '0') === '1';
  },
  markDragTutorialSeen() {
    try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch {}
  },
};

export const rankingAdapter = {
  mode: 'mock',
  async open() {
    return { connected: false, message: '랭킹은 다음 버전에서 연결됩니다.' };
  },
};

export function runtimeConfig() {
  const params = new URLSearchParams(location.search);
  const testMode = params.get('test') === '1';
  const requested = Number(params.get('duration'));
  return {
    testMode,
    duration: testMode && requested > 0 ? Math.min(requested, 90) : 90,
    forceTutorial: testMode && params.get('tutorial') === '1',
  };
}

export function useFutureItem(itemId, context = {}) {
  return { implemented: false, itemId, context };
}
