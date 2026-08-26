import { CHALLENGE_PARAM, PUBLIC_SITE_URL, shareOgImageFor } from './data.js';
import { isAppsInTossWebView } from './leaderboard.js';

const BEST_SCORE_KEY = 'oing_toss_v3_best_score';
const LAST_SCORE_KEY = 'oing_toss_v3_last_score';
const RECENT_SCORES_KEY = 'oing_toss_v3_recent_scores';
const CANDY_KEY = 'oing_toss_v3_candy';
const FED_COUNT_KEY = 'oing_toss_v3_fed_count';
const CANDY_STARTER_KEY = 'oing_toss_v3_candy_starter';
const PENDING_SHARE_HINTS_KEY = 'oing_toss_v3_pending_share_hints';
const CHALLENGE_KEY = 'oing_toss_v3_challenge';
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
// 희귀 보드 아이템을 처음 본 적이 있는지. 카드처럼 누적값에서 되짚을 수 있는
// 값이 아니라 - "봤다"는 사실 자체가 기록이라 - 키 하나에 종류 목록으로 담는다.
// 종류마다 키를 만들면 아이템이 늘 때마다 키가 늘어난다.
const RARE_ITEM_INTRO_KEY = 'oing_toss_v3_rare_item_intro_seen';

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
  // 별사탕 잔고와 먹인 횟수. 기기 안에만 남는다.
  getCandy() {
    const value = Number(safeRead(CANDY_KEY, '0'));
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  },
  addCandy(amount) {
    const next = this.getCandy() + Math.max(0, Math.round(Number(amount) || 0));
    try { localStorage.setItem(CANDY_KEY, String(next)); } catch {}
    return next;
  },
  spendCandy(amount) {
    const cost = Math.max(0, Math.round(Number(amount) || 0));
    const balance = this.getCandy();
    if (balance < cost) return false;
    try { localStorage.setItem(CANDY_KEY, String(balance - cost)); } catch {}
    return true;
  },
  // 첫 판이 끝날 때 딱 한 번, 잔고를 minimum까지 올려 준다. 올린 만큼을
  // 돌려주고, 이미 충분하거나 이미 받았으면 0이다.
  //
  // 조건을 "아직 한 번도 안 먹였으면"으로 두면 안 된다 - 사탕을 모으기만
  // 하고 안 주는 사람에게 매 판 보충이 나가 경제가 무너진다. 받았다는
  // 사실 자체를 따로 적어 두고, 그 한 번으로 끝낸다.
  claimCandyStarter(minimum = 0) {
    const target = Math.max(0, Math.round(Number(minimum) || 0));
    if (safeRead(CANDY_STARTER_KEY, '') === '1') return 0;
    try { localStorage.setItem(CANDY_STARTER_KEY, '1'); } catch {}
    const balance = this.getCandy();
    if (balance >= target) return 0;
    const topUp = target - balance;
    this.addCandy(topUp);
    return topUp;
  },

  // 친구 초대로 약속한 힌트. 기기에 적어 둔다.
  //
  // 예전에는 게임 객체의 변수에만 쌓았다. 그런데 이 보상은 결과 화면에서
  // 받고 다음 판 시작에 지급되므로, 그 사이에 앱을 닫거나 새로고침하면
  // 통째로 사라졌다 - 친구에게 초대장까지 보낸 사람이 아무것도 못 받는
  // 것이다. 토스가 sendViral을 보냈다는 것은 지급이 확정됐다는 뜻이므로,
  // 그 순간 기기에 남겨야 한다.
  // 도전장으로 받은 점수. 링크를 타고 들어온 뒤 앱을 껐다 켜도 남아 있어야
  // 한다 - 받자마자 바로 한 판 하는 사람만 있는 게 아니다. 넘고 나면 지운다.
  getChallengeScore() {
    const value = Number(safeRead(CHALLENGE_KEY, '0'));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  },

  saveChallengeScore(score) {
    const value = Math.max(0, Math.round(Number(score) || 0));
    if (value <= 0) return this.clearChallengeScore();
    try { localStorage.setItem(CHALLENGE_KEY, String(value)); } catch {}
    return value;
  },

  clearChallengeScore() {
    try { localStorage.removeItem(CHALLENGE_KEY); } catch {}
    return 0;
  },

  getPendingShareHints() {
    const value = Number(safeRead(PENDING_SHARE_HINTS_KEY, '0'));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  },

  addPendingShareHints(amount) {
    const next = this.getPendingShareHints() + Math.max(0, Math.round(Number(amount) || 0));
    try { localStorage.setItem(PENDING_SHARE_HINTS_KEY, String(next)); } catch {}
    return next;
  },

  // 지급이 끝난 뒤에 그만큼만 덜어낸다.
  //
  // 처음에는 읽으면서 바로 0으로 만들었다. 그러면 지급 쪽이 실패했을 때
  // 보상이 조용히 사라진다 - 친구에게 초대장까지 보낸 사람에게 제일
  // 나쁜 결말이다. 두 갈래 중 하나를 골라야 한다면 "잃는 것"보다 "다시
  // 시도할 수 있는 것"이 낫다. 그래서 지급을 확인한 뒤에 덜어낸다.
  //
  // 저장이 실패하면(사파리 비공개 모드 등) 값이 남아 다음 판에 한 번 더
  // 지급될 수 있다. 그것은 감수한다 - 잃는 쪽이 더 나쁘다.
  consumePendingShareHints(amount) {
    const used = Math.max(0, Math.round(Number(amount) || 0));
    if (used <= 0) return this.getPendingShareHints();
    const next = Math.max(0, this.getPendingShareHints() - used);
    try { localStorage.setItem(PENDING_SHARE_HINTS_KEY, String(next)); } catch {}
    return next;
  },

  getFedCount() {
    const value = Number(safeRead(FED_COUNT_KEY, '0'));
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  },
  markFed() {
    const next = this.getFedCount() + 1;
    try { localStorage.setItem(FED_COUNT_KEY, String(next)); } catch {}
    return next;
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
  getSeenRareItems() {
    try {
      const values = JSON.parse(safeRead(RARE_ITEM_INTRO_KEY, '[]'));
      return Array.isArray(values) ? values.filter((value) => typeof value === 'string') : [];
    } catch {
      return [];
    }
  },
  markRareItemSeen(type) {
    if (typeof type !== 'string' || !type) return this.getSeenRareItems();
    const seen = this.getSeenRareItems();
    if (seen.includes(type)) return seen;
    const next = [...seen, type];
    try { localStorage.setItem(RARE_ITEM_INTRO_KEY, JSON.stringify(next)); } catch {}
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

// 공유 글귀.
//
// 예전 글귀는 "8,235점 냈다냥! ... 이겨보라냥!"이었다. 그런데 정작 링크를
// 눌러도 이길 대상이 없어서 그냥 첫 화면이 떴다 - 받는 사람에게는 남의
// 자랑일 뿐이었다. 이제 점수가 링크에 실려 가므로 그 말이 사실이 된다.
// 되받아친 판(beat)은 말이 달라진다. 진 사람이 다시 던지는 자리라
// "이겼다"가 앞에 와야 다음 한 판이 걸린다.
export function buildShareText({ score, maxCombo, round, classic = null, beatScore = 0 }) {
  const points = Math.max(0, Math.round(Number(score) || 0)).toLocaleString('ko-KR');
  const progress = classic
    ? `${Math.max(1, Math.round(Number(round) || 1))}판 진행`
    : `STAGE ${Math.max(1, Math.round(Number(round) || 1))} 도달`;
  const beat = Math.max(0, Math.round(Number(beatScore) || 0));
  if (beat > 0) {
    return `${beat.toLocaleString('ko-KR')}점 넘었다냥! 내 기록은 ${points}점이다냥. 다시 해보라냥!`;
  }
  return `오잉게임에서 ${points}점 냈다냥! 최고 콤보 ${Math.max(0, Math.round(Number(maxCombo) || 0))}, ${progress}. 이겨보라냥!`;
}

// 공유는 한 군데로 모아둔다 - 결과 화면이든 장면이든 같은 경로를 타야
// 브라우저마다 다르게 실패하는 일이 없다.
//
// 실기기 제보: 토스 안에서 만들어진 링크(location.href)는 앱인토스 내부
// 주소라 받은 사람이 열면 오류가 난다. 토스 안에서는 링크를 아예 싣지 않고
// "토스에서 검색" 안내를 글귀에 넣는다. 공개 웹에서는 지금 주소를 그대로.
function shareableUrl(challengeScore = 0) {
  if (typeof location === 'undefined') return '';
  if (isAppsInTossWebView()) return '';
  if (!/^https?:$/.test(location.protocol)) return '';
  const base = location.href.split('?')[0];
  // 웹에서도 같은 규칙을 쓴다. 토스 밖에서 받은 링크로도 도전장이 돈다.
  const target = Math.max(0, Math.round(Number(challengeScore) || 0));
  return target > 0 ? `${base}?${CHALLENGE_PARAM}=${target}` : base;
}

// 토스 안에서 쓸 링크. 다리가 만들어 주는 "토스 앱에서 열리는" 주소이고,
// 못 만들면 빈 문자열이라 예전처럼 글만 나간다 - 링크가 없다고 공유가
// 실패하지는 않는다. 판마다 다시 부르지 않도록 한 번 만든 것을 재사용한다.
const tossShareLinkCache = new Map();

// 번들 안의 상대 경로를 공개 주소로 바꾼다. 링크 미리보기는 토스 밖에서
// 열리므로 앱 안의 경로로는 그림을 못 가져온다.
function publicImageUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return '';
  if (/^https?:\/\//.test(imageUrl)) return imageUrl;
  return PUBLIC_SITE_URL.replace(/\/$/, '') + '/' + imageUrl.replace(/^\//, '');
}

async function tossShareLink(imageUrl = '', challengeScore = 0) {
  if (!isAppsInTossWebView()) return '';
  // 미리보기 그림은 카드마다 미리 구워 둔 1200x600 PNG를 쓴다. 카드가
  // 아니면 공통 배너로 떨어진다. 카드 원본을 그대로 넘기지 않는 이유는
  // 세로로 길고 webp라 미리보기가 제대로 안 그려지기 때문이다.
  // imageUrl 원본은 클립보드 공유가 계속 쓴다(거기서는 실제 그림이 간다).
  const ogImageUrl = publicImageUrl(shareOgImageFor(imageUrl));
  // 도전 점수는 링크에 실어 보낸다. 받는 사람이 이 주소로 앱을 열면
  // Environment.initialURL이 그대로 돌려주고, challenge.js가 읽는다.
  const target = Math.max(0, Math.round(Number(challengeScore) || 0));
  const pathQuery = target > 0 ? `${CHALLENGE_PARAM}=${target}` : '';
  // 점수마다 링크가 다르므로 그림만으로는 구분이 안 된다. 둘을 함께 열쇠로.
  const cacheKey = `${ogImageUrl}|${pathQuery}`;
  if (!tossShareLinkCache.has(cacheKey)) {
    tossShareLinkCache.set(cacheKey, import('./vendor/toss-game-center-v1.js')
      .then((module) => (typeof module.createTossShareLink === 'function'
        ? module.createTossShareLink(ogImageUrl, pathQuery)
        : ''))
      .catch(() => ''));
  }
  try {
    const link = await tossShareLinkCache.get(cacheKey);
    return typeof link === 'string' ? link : '';
  } catch {
    return '';
  }
}

// 토스 웹뷰에는 navigator.share가 없어서, 예전에는 공유 버튼이 조용히
// 클립보드에 글만 복사하고 끝났다. 네이티브 공유 시트를 연다.
async function tossShareSheet(message) {
  if (!isAppsInTossWebView()) return false;
  try {
    const module = await import('./vendor/toss-game-center-v1.js');
    if (!module.isTossShareSupported?.()) return false;
    return await module.sendTossShareMessage(message);
  } catch {
    return false;
  }
}

// 클립보드에 그림까지 담아 본다. 브라우저가 webp 붙여넣기를 대부분 막아서
// 캔버스로 png로 바꿔 넣는다. 안 되면 조용히 글만 복사된다.
async function copyImageAndText(imageUrl, text) {
  try {
    if (typeof ClipboardItem !== 'function' || !navigator.clipboard?.write) return false;
    const response = await fetch(imageUrl);
    if (!response.ok) return false;
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!png) return false;
    await navigator.clipboard.write([new ClipboardItem({
      'image/png': png,
      'text/plain': new Blob([text], { type: 'text/plain' }),
    })]);
    return true;
  } catch {
    return false;
  }
}

// 카드/장면 그림을 파일로 함께 공유한다. 못 가져오거나 이 브라우저가 파일
// 공유를 모르면 조용히 글만 나간다 - 그림은 더해주는 것이지 조건이 아니다.
async function fetchShareImage(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    const name = imageUrl.split('/').pop() || 'oing-card.webp';
    return new File([blob], name, { type: blob.type || 'image/webp' });
  } catch {
    return null;
  }
}

async function shareTextAndUrl(text, { imageUrl = null, challengeScore = 0 } = {}) {
  // 공개 웹은 지금 주소를, 토스 안에서는 토스가 만들어 준 링크를 싣는다.
  // 실기기 제보 "공유하기 눌러도 링크가 안 뜬다"가 이 두 번째 경우였다.
  // 카드 그림이 있으면 링크 미리보기에 그 그림이 뜨도록 함께 넘긴다.
  const url = shareableUrl(challengeScore) || await tossShareLink(imageUrl || '', challengeScore);
  const fullText = url ? text : `${text} 토스에서 '오잉게임'을 검색하면 바로 할 수 있다냥!`;
  try {
    // 토스 안에서는 네이티브 공유 시트가 먼저다. navigator.share가 없어
    // 조용히 클립보드로 떨어지던 자리다.
    if (await tossShareSheet(url ? `${fullText}\n${url}` : fullText)) {
      return { ok: true, method: 'toss-share', withUrl: Boolean(url) };
    }
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      const payload = { title: '오잉게임', text: fullText };
      if (url) payload.url = url;
      if (imageUrl && typeof navigator.canShare === 'function') {
        const file = await fetchShareImage(imageUrl);
        if (file && navigator.canShare({ files: [file] })) payload.files = [file];
      }
      try {
        await navigator.share(payload);
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        // 파일이 낀 공유를 거부하는 웹뷰가 있다 - 글만으로 한 번 더.
        if (!payload.files) throw error;
        delete payload.files;
        await navigator.share(payload);
      }
      return { ok: true, method: 'native-share', withUrl: Boolean(url) };
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      const copyText = `${fullText}\n${url}`.trim();
      // 그림까지 담기면 붙여넣을 때 카드가 같이 간다. 못 담으면 글만.
      if (imageUrl && await copyImageAndText(imageUrl, copyText)) {
        return { ok: true, method: 'clipboard-image', withUrl: Boolean(url) };
      }
      await navigator.clipboard.writeText(copyText);
      return { ok: true, method: 'clipboard', withUrl: Boolean(url) };
    }
    return { ok: false, reason: 'share-unavailable', text: fullText, url };
  } catch (error) {
    if (error?.name === 'AbortError') return { ok: false, reason: 'cancelled' };
    return { ok: false, reason: 'share-failed', error };
  }
}

export const shareAdapter = {
  async shareChapter(chapter, { imageUrl = null } = {}) {
    const label = chapter?.label || '장면';
    return shareTextAndUrl(`오잉게임에서 '${label}' 장면을 모았다냥!`, { imageUrl });
  },
  // 결과 공유는 곧 도전장이다. 방금 낸 점수가 그대로 상대가 넘어야 할 벽이 된다.
  async shareResult(result) {
    return shareTextAndUrl(buildShareText(result), {
      challengeScore: Math.max(0, Math.round(Number(result?.score) || 0)),
    });
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
