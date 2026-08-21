const BEST_SCORE_KEY = 'oing_toss_v3_best_score';
const LAST_SCORE_KEY = 'oing_toss_v3_last_score';
const RECENT_SCORES_KEY = 'oing_toss_v3_recent_scores';
const SETTINGS_KEY = 'oing_toss_v3_settings';
const TUTORIAL_KEY = 'oing_toss_v3_drag_tutorial_done';
const HIGHEST_STAGE_KEY = 'oing_toss_v3_highest_stage';
const BEST_COMBO_KEY = 'oing_toss_v3_best_combo';
const RECENT_RESULT_MESSAGES_KEY = 'oing_toss_v3_recent_result_messages';
const RARE_SHOWCASE_COUNT_KEY = 'oing_toss_v3_rare_showcase_count';
const CATS_RESCUED_KEY = 'oing_toss_v3_cats_rescued';
const CLEAN_CLEARS_KEY = 'oing_toss_v3_clean_clears';
// Classic mode scores live on the original's scale (cells × combo), an
// order of magnitude below the stage mode's — they keep their own record.
const CLASSIC_BEST_SCORE_KEY = 'oing_toss_v3_classic_best_score';
const CLASSIC_RECENT_SCORES_KEY = 'oing_toss_v3_classic_recent_scores';
const CLASSIC_CHAPTERS_SEEN_KEY = 'oing_toss_v3_classic_chapters_seen';
// 도감 카드가 보는 평생 누적값들. 점수는 실력 천장이라 캐주얼한 사람은 영영
// 못 넘을 수 있지만, 이 값들은 느려도 반드시 쌓인다 - 카드 아홉 장 중 일곱
// 장을 여기에 묶어둔 이유다. 전부 새 키라 기존 저장값은 건드리지 않는다.
const RUNS_PLAYED_KEY = 'oing_toss_v3_runs_played';
const BIG_CLEARS_KEY = 'oing_toss_v3_big_clears';
const CELLS_CLEARED_KEY = 'oing_toss_v3_cells_cleared';
const PLAY_DAYS_KEY = 'oing_toss_v3_play_days';
const CLASSIC_BEST_COMBO_KEY = 'oing_toss_v3_classic_best_combo';

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
  getClassicBestScore() {
    const value = Number(safeRead(CLASSIC_BEST_SCORE_KEY, '0'));
    return Number.isFinite(value) ? value : 0;
  },
  saveClassicBestScore(score) {
    try { localStorage.setItem(CLASSIC_BEST_SCORE_KEY, String(Math.max(0, Math.round(score)))); } catch {}
  },
  getClassicRecentScores() {
    try {
      const values = JSON.parse(safeRead(CLASSIC_RECENT_SCORES_KEY, '[]'));
      return Array.isArray(values)
        ? values.filter(Number.isFinite).map((value) => Math.max(0, Math.round(value))).slice(-7)
        : [];
    } catch {
      return [];
    }
  },
  saveClassicRunScore(score) {
    const value = Math.max(0, Math.round(Number(score) || 0));
    const recent = [...this.getClassicRecentScores(), value].slice(-7);
    try { localStorage.setItem(CLASSIC_RECENT_SCORES_KEY, JSON.stringify(recent)); } catch {}
  },
  // Chapters a player has actually reached in play. Stored as keys rather
  // than a count so reordering or inserting a scene later cannot silently
  // re-lock somebody's gallery.
  getSeenChapters() {
    try {
      const values = JSON.parse(safeRead(CLASSIC_CHAPTERS_SEEN_KEY, '[]'));
      return Array.isArray(values) ? values.filter((value) => typeof value === 'string') : [];
    } catch {
      return [];
    }
  },
  markChapterSeen(key) {
    if (typeof key !== 'string' || !key) return this.getSeenChapters();
    const seen = this.getSeenChapters();
    if (seen.includes(key)) return seen;
    const next = [...seen, key];
    try { localStorage.setItem(CLASSIC_CHAPTERS_SEEN_KEY, JSON.stringify(next)); } catch {}
    return next;
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
      return { sound: true, haptic: true, music: true, musicVolume: 0.4, ...JSON.parse(safeRead(SETTINGS_KEY, '{}')) };
    } catch {
      return { sound: true, haptic: true, music: true, musicVolume: 0.4 };
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
  getHighestStage() {
    const value = Number(safeRead(HIGHEST_STAGE_KEY, '1'));
    return Number.isFinite(value) ? Math.max(1, Math.round(value)) : 1;
  },
  saveHighestStage(stage) {
    const next = Math.max(this.getHighestStage(), Math.max(1, Math.round(Number(stage) || 1)));
    try { localStorage.setItem(HIGHEST_STAGE_KEY, String(next)); } catch {}
    return next;
  },
  getBestCombo() {
    const value = Number(safeRead(BEST_COMBO_KEY, '0'));
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  },
  saveBestCombo(combo) {
    const next = Math.max(this.getBestCombo(), Math.max(0, Math.round(Number(combo) || 0)));
    try { localStorage.setItem(BEST_COMBO_KEY, String(next)); } catch {}
    return next;
  },
  getRareShowcaseCount() {
    const value = Number(safeRead(RARE_SHOWCASE_COUNT_KEY, '0'));
    return Number.isFinite(value) ? Math.min(3, Math.max(0, Math.round(value))) : 0;
  },
  markRareShowcaseSeen() {
    const next = Math.min(3, this.getRareShowcaseCount() + 1);
    try { localStorage.setItem(RARE_SHOWCASE_COUNT_KEY, String(next)); } catch {}
    return next;
  },
  // Every stage ends in a full clear now, so "best reveal %" stopped being a
  // record — 100 became the norm. The garden's long-term number is instead
  // how many boards were emptied without a single rescue shuffle.
  getCleanClears() {
    const value = Number(safeRead(CLEAN_CLEARS_KEY, '0'));
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  },
  addCleanClears(count) {
    const next = this.getCleanClears() + Math.max(0, Math.round(Number(count) || 0));
    try { localStorage.setItem(CLEAN_CLEARS_KEY, String(next)); } catch {}
    return next;
  },
  // 아래 넷은 모두 같은 모양이다: 읽고, 더하고, 더한 값을 돌려준다.
  // 돌려주는 이유는 부른 쪽이 곧바로 "이번에 카드가 열렸나"를 판단하기 위해서다.
  getRunsPlayed() {
    const value = Number(safeRead(RUNS_PLAYED_KEY, '0'));
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  },
  addRunPlayed() {
    const next = this.getRunsPlayed() + 1;
    try { localStorage.setItem(RUNS_PLAYED_KEY, String(next)); } catch {}
    return next;
  },
  getBigClears() {
    const value = Number(safeRead(BIG_CLEARS_KEY, '0'));
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  },
  addBigClears(count) {
    const next = this.getBigClears() + Math.max(0, Math.round(Number(count) || 0));
    try { localStorage.setItem(BIG_CLEARS_KEY, String(next)); } catch {}
    return next;
  },
  getCellsCleared() {
    const value = Number(safeRead(CELLS_CLEARED_KEY, '0'));
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  },
  addCellsCleared(count) {
    const next = this.getCellsCleared() + Math.max(0, Math.round(Number(count) || 0));
    try { localStorage.setItem(CELLS_CLEARED_KEY, String(next)); } catch {}
    return next;
  },
  getClassicBestCombo() {
    const value = Number(safeRead(CLASSIC_BEST_COMBO_KEY, '0'));
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  },
  saveClassicBestCombo(combo) {
    const next = Math.max(this.getClassicBestCombo(), Math.max(0, Math.round(Number(combo) || 0)));
    try { localStorage.setItem(CLASSIC_BEST_COMBO_KEY, String(next)); } catch {}
    return next;
  },
  // 출석은 연속이 아니라 "서로 다른 날 수"로 센다. 하루 빠졌다고 초기화되면
  // 캐주얼한 게임에서 스트레스가 되고, 오래 쉬었다 돌아온 사람을 벌주게 된다.
  // 기기 시계와 localStorage에만 기대므로 앱 데이터를 지우면 사라진다.
  getPlayDays() {
    try {
      const values = JSON.parse(safeRead(PLAY_DAYS_KEY, '[]'));
      return Array.isArray(values) ? values.filter((value) => typeof value === 'string') : [];
    } catch {
      return [];
    }
  },
  addPlayDay(today = null) {
    const day = typeof today === 'string' && today
      ? today
      : new Date().toLocaleDateString('sv-SE');
    const days = this.getPlayDays();
    if (days.includes(day)) return days;
    const next = [...days, day];
    try { localStorage.setItem(PLAY_DAYS_KEY, JSON.stringify(next)); } catch {}
    return next;
  },
  getCatsRescued() {
    const value = Number(safeRead(CATS_RESCUED_KEY, '0'));
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  },
  addCatsRescued(count) {
    const next = this.getCatsRescued() + Math.max(0, Math.round(Number(count) || 0));
    try { localStorage.setItem(CATS_RESCUED_KEY, String(next)); } catch {}
    return next;
  },
  getRecentResultMessages() {
    try {
      const values = JSON.parse(safeRead(RECENT_RESULT_MESSAGES_KEY, '[]'));
      return Array.isArray(values)
        ? values.filter((value) => typeof value === 'string' && value.trim()).slice(-8)
        : [];
    } catch {
      return [];
    }
  },
  rememberResultMessage(message) {
    const value = typeof message === 'string' ? message.trim() : '';
    if (!value) return this.getRecentResultMessages();
    const recent = [...this.getRecentResultMessages().filter((item) => item !== value), value].slice(-8);
    try { localStorage.setItem(RECENT_RESULT_MESSAGES_KEY, JSON.stringify(recent)); } catch {}
    return recent;
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
      // Classic is the mode the records screen is about now, so the trend
      // bars and the average read the classic run history.
      summary: buildLocalRecordSummary(
        storageAdapter.getClassicRecentScores(),
        storageAdapter.getClassicBestScore(),
      ),
    };
  },
};

export function buildShareText({ score, maxCombo, round, classic = null }) {
  const points = Math.max(0, Math.round(Number(score) || 0)).toLocaleString('ko-KR');
  const progress = classic
    ? `${Math.max(1, Math.round(Number(round) || 1))}판 진행`
    : `STAGE ${Math.max(1, Math.round(Number(round) || 1))} 도달`;
  return `오잉게임에서 ${points}점 냈다냥! 최고 콤보 ${Math.max(0, Math.round(Number(maxCombo) || 0))}, ${progress}. 이겨보라냥!`;
}

// 공유는 한 군데로 모아둔다 - 결과 화면이든 장면이든 같은 경로를 타야
// 브라우저마다 다르게 실패하는 일이 없다.
async function shareTextAndUrl(text) {
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
}

export const shareAdapter = {
  async shareChapter(chapter) {
    const label = chapter?.label || '장면';
    return shareTextAndUrl(`오잉게임에서 '${label}' 장면을 모았다냥!`);
  },
  async shareResult(result) {
    return shareTextAndUrl(buildShareText(result));
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
  const requestedStage = Number(params.get('stage'));
  const requestedCombo = Number(params.get('combo'));
  return {
    testMode,
    duration: testMode && requested > 0 ? Math.min(requested, 360) : null,
    forceTutorial: testMode && params.get('tutorial') === '1',
    forcedItem: testMode ? params.get('item') : null,
    forcedRound: testMode && (requestedStage > 0 || requestedRound > 0)
      ? Math.min(99, Math.round(requestedStage || requestedRound))
      : null,
    forcedCombo: testMode && requestedCombo > 0 ? Math.min(99, Math.round(requestedCombo)) : 0,
  };
}

export function useFutureItem(itemId, context = {}) {
  return { implemented: false, itemId, context };
}
