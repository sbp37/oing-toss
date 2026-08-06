const BEST_SCORE_KEY = 'oing_toss_v2_best_score';
const LAST_SCORE_KEY = 'oing_toss_v2_last_score';
const RECENT_SCORES_KEY = 'oing_toss_v2_recent_scores';
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
  getLastScore() {
    const raw = safeRead(LAST_SCORE_KEY, '');
    if (raw === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
  },
  getRecentScores() {
    try {
      const values = JSON.parse(safeRead(RECENT_SCORES_KEY, '[]'));
      return Array.isArray(values)
        ? values.filter(Number.isFinite).map((value) => Math.max(0, Math.round(value))).slice(-7)
        : [];
    } catch {
      return [];
    }
  },
  saveRunScore(score) {
    const value = Math.max(0, Math.round(Number(score) || 0));
    const recent = [...this.getRecentScores(), value].slice(-7);
    try {
      localStorage.setItem(LAST_SCORE_KEY, String(value));
      localStorage.setItem(RECENT_SCORES_KEY, JSON.stringify(recent));
    } catch {}
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

export function buildShareText({ score, maxCombo, round }) {
  const points = Math.max(0, Math.round(Number(score) || 0)).toLocaleString('ko-KR');
  return `오잉게임에서 ${points}점 냈다냥! 최고 콤보 ${Math.max(0, Math.round(Number(maxCombo) || 0))}, ROUND ${Math.max(1, Math.round(Number(round) || 1))}까지 갔다냥. 이겨보라냥!`;
}

export const shareAdapter = {
  async shareResult(result) {
    const text = buildShareText(result);
    const url = typeof location === 'undefined' ? '' : location.href.split('?')[0];
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: '오잉게임', text, url });
        return { ok: true, method: 'native-share' };
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${text}\n${url}`.trim());
        return { ok: true, method: 'clipboard' };
      }
      return { ok: false, reason: 'share-unavailable', text, url };
    } catch (error) {
      if (error?.name === 'AbortError') return { ok: false, reason: 'cancelled' };
      return { ok: false, reason: 'share-failed', error };
    }
  },
};

// Boundary for the future Apps in Toss IAP SDK. The web prototype intentionally
// stays disabled; paid grants must be verified by a server before reaching the
// inventory ledger with source="iap" and a stable order/grant ID.
export const purchaseAdapter = Object.freeze({
  mode: 'disabled',
  supportsPurchases: false,
  async listProducts() {
    return [];
  },
  async purchase() {
    return { ok: false, reason: 'iap-not-connected' };
  },
  async restorePendingOrders() {
    return [];
  },
});

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
