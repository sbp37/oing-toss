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
      return { sound: true, haptic: true, music: false, musicVolume: 0.4, ...JSON.parse(safeRead(SETTINGS_KEY, '{}')) };
    } catch {
      return { sound: true, haptic: true, music: false, musicVolume: 0.4 };
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

export function buildLocalRecordSummary(scores = [], storedBest = 0) {
  const recent = (Array.isArray(scores) ? scores : [])
    .filter(Number.isFinite)
    .map((score) => Math.max(0, Math.round(score)))
    .slice(-7);
  const savedBest = Math.max(0, Math.round(Number(storedBest) || 0));
  const best = Math.max(savedBest, ...recent, 0);
  const total = recent.reduce((sum, score) => sum + score, 0);
  const average = recent.length ? Math.round(total / recent.length) : 0;
  const last = recent.at(-1) ?? 0;
  const previous = recent.length > 1 ? recent.at(-2) : null;
  const delta = previous === null ? null : last - previous;
  const trendTone = delta === null ? 'new' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';
  const trendText = delta === null
    ? recent.length ? '첫 기록이 생겼다냥!' : '첫 판을 기다리고 있다냥!'
    : delta > 0
      ? `지난 판보다 +${delta.toLocaleString('ko-KR')}점 올랐어!`
      : delta < 0
        ? `지난 판보다 ${Math.abs(delta).toLocaleString('ko-KR')}점 낮아`
        : '지난 판과 같은 점수야!';
  return Object.freeze({
    recent: Object.freeze(recent),
    best,
    average,
    last,
    count: recent.length,
    delta,
    trendTone,
    trendText,
  });
}

export const rankingAdapter = {
  mode: 'local-records',
  async open() {
    return {
      connected: false,
      summary: buildLocalRecordSummary(
        storageAdapter.getRecentScores(),
        storageAdapter.getBestScore(),
      ),
    };
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
  const requestedRound = Number(params.get('round'));
  const requestedCombo = Number(params.get('combo'));
  return {
    testMode,
    duration: testMode && requested > 0 ? Math.min(requested, 360) : 180,
    forceTutorial: testMode && params.get('tutorial') === '1',
    forcedItem: testMode ? params.get('item') : null,
    forcedRound: testMode && requestedRound > 0 ? Math.min(30, Math.round(requestedRound)) : 1,
    forcedCombo: testMode && requestedCombo > 0 ? Math.min(99, Math.round(requestedCombo)) : 0,
  };
}

export function useFutureItem(itemId, context = {}) {
  return { implemented: false, itemId, context };
}
