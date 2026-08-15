// One run starts with two minutes. Stage transitions and time items can extend
// real play, but the amount currently held never exceeds this cap.
export const GAME_DURATION_SECONDS = 120;
export const PRACTICE_DURATION_SECONDS = 240;
export const ITEM_REWARD_INTERVAL = 7;
export const TIME_FREEZE_SECONDS = 10;
export const MAX_ITEM_TIME_BONUS_SECONDS = 15;
export const TIME_ITEM_CAP_SCORE = 300;
export const BOARD_DROP_PITY_LIMITS = Object.freeze({ megabomb: 7, clover: 3, freeze: 3 });
export const EARLY_MEGABOMB_PITY_LIMIT = 4;
export const BEGINNER_AUTO_HINT_IDLE_MS = 6000;
export const BEGINNER_AUTO_HINT_SCORE_CEILING = 6000;
export const STRUGGLE_HINT_FAILURES = 3;
export const STAGE_TRANSITION_INPUT_GUARD_MS = 420;
export const FINAL_GESTURE_GRACE_MS = 450;
export const COMBO_WINDOW_MS = Object.freeze({
  early: 5200,
  mid: 4500,
  advanced: 3500,
  expert: 2900,
});
export const START_COUNTDOWN_STEPS = Object.freeze([3, 2, 1, 'GO!']);
export const RESULT_SCORE_THRESHOLDS = Object.freeze({
  normal: 15000,
  high: 40000,
  legend: 80000,
});

export function recordEligibleForStartStage(stage = 1) {
  return Math.max(1, Math.round(Number(stage) || 1)) === 1;
}

// Main-mode board growth is intentionally capped at 6x7. The play layout
// derives its frame from cols/rows instead of subdividing a fixed artwork
// recess, so every stage keeps square cells while the board itself grows:
// 4x4 -> 5x5 -> 6x6 -> 6x7. Later difficulty comes from targets, challenges,
// time and drop pressure; 7x7+ remains reserved for a future hard mode.
export const STAGE_CONFIG = Object.freeze([
  { stage: 1, round: 1, size: 4, cols: 4, rows: 4, target: 3, timeLimit: 120, clockChance: 0, bombChance: 0 },
  { stage: 2, round: 2, size: 5, cols: 5, rows: 5, target: 5, timeLimit: 120, clockChance: 0, bombChance: 0 },
  { stage: 3, round: 3, size: 6, cols: 6, rows: 6, target: 8, timeLimit: 120, clockChance: 0, bombChance: 0 },
  { stage: 4, round: 4, size: 6, cols: 6, rows: 6, target: 9, timeLimit: 120, clockChance: 0, bombChance: 0.08 },
  { stage: 5, round: 5, size: 6, cols: 6, rows: 7, target: 11, timeLimit: 120, clockChance: 0.015, bombChance: 0.12 },
  { stage: 6, round: 6, size: 6, cols: 6, rows: 7, target: 12, timeLimit: 120, clockChance: 0.03, bombChance: 0.16 },
  { stage: 7, round: 7, size: 6, cols: 6, rows: 7, target: 13, timeLimit: 120, clockChance: 0.035, bombChance: 0.2 },
  { stage: 8, round: 8, size: 6, cols: 6, rows: 7, target: 14, timeLimit: 120, clockChance: 0.04, bombChance: 0.24 },
  { stage: 9, round: 9, size: 6, cols: 6, rows: 7, target: 15, timeLimit: 120, clockChance: 0.045, bombChance: 0.28 },
  { stage: 10, round: 10, size: 6, cols: 6, rows: 7, target: 17, timeLimit: 120, clockChance: 0.05, bombChance: 0.32 },
]);

// Legacy export name retained so older tests/tools importing ROUND_CONFIG do
// not lose their module contract while the visible game moves to STAGE.
export const ROUND_CONFIG = STAGE_CONFIG;

export const ITEM_DEFINITIONS = Object.freeze({
  hint: { id: 'hint', initial: 3, implemented: true, asset: 'assets/icons/items/hint.webp' },
  shuffle: { id: 'shuffle', initial: 2, implemented: true, asset: 'assets/icons/items/shuffle.webp' },
  bomb: { id: 'bomb', initial: 0, implemented: true, asset: 'assets/icons/items/bomb.webp' },
  clock: { id: 'clock', initial: 0, implemented: true, asset: 'assets/icons/hud/time.webp' },
  freeze: { id: 'freeze', initial: 0, implemented: true, asset: 'assets/icons/items/freeze.webp' },
  clover: { id: 'clover', initial: 0, implemented: true, asset: 'assets/icons/items/clover.webp' },
});

// Original OING board drops. Only implemented entries enter the live pool;
// the remaining definitions reserve stable IDs for the next visual passes.
export const BOARD_DROP_ITEMS = Object.freeze({
  bomb: Object.freeze({ id: 'bomb', label: '폭탄', implemented: true, asset: 'assets/icons/items/bomb.webp' }),
  clock: Object.freeze({ id: 'clock', label: '시계', implemented: true, asset: 'assets/icons/hud/time.webp' }),
  megabomb: Object.freeze({ id: 'megabomb', label: '메가폭탄', implemented: true, asset: 'assets/icons/items/megabomb.webp' }),
  freeze: Object.freeze({ id: 'freeze', label: '타임프리즈', implemented: true, asset: 'assets/icons/items/freeze.webp' }),
  clover: Object.freeze({ id: 'clover', label: '클로버', implemented: true, asset: 'assets/icons/items/clover.webp' }),
  candy: Object.freeze({ id: 'candy', label: '콤보사탕', implemented: false, asset: null }),
});

const STAGE_SHOWCASE_DROP_IDS = Object.freeze(['megabomb', 'freeze', 'clover']);

// Learners usually finish around STAGE 4~5, while recurring rare drops open
// at STAGE 6. Preview one rare board item on STAGE 4 during the first three
// runs only; the caller persists that onboarding limit separately.
export function stageShowcaseBoardDrop(stage = 1, random = Math.random, alreadyGiven = false) {
  const level = Math.max(1, Math.round(Number(stage) || 1));
  if (alreadyGiven || level !== 4) return null;
  const roll = Math.min(0.999999, Math.max(0, Number(random?.()) || 0));
  return BOARD_DROP_ITEMS[STAGE_SHOWCASE_DROP_IDS[Math.floor(roll * STAGE_SHOWCASE_DROP_IDS.length)]];
}

function boardDropPoolFor(stage, combo, cloverGiven = false, timeBonusCapped = false) {
  const level = Math.max(1, Math.round(Number(stage) || 1));
  const streak = Math.max(0, Math.round(Number(combo) || 0));
  // 시뮬레이션(scripts/item-drop-compare.mjs)으로 확인한 사실: 콤보는 거의
  // 병목이 아니었다. 일반 플레이는 실패로 잘 끊기지 않아서 스테이지 6+에
  // 도달할 때 콤보가 이미 21 이상인 경우가 대부분(300판 중 282판)이고,
  // 예전 문턱(14/21/28)도 이미 넘어서 있었다. 진짜 병목은
  //  1) 스테이지 6+ 도달 후 실제 "뽑기"가 몇 번 안 일어난다(평균 2~3회,
  //     시간이 얼마 안 남아서) 는 점과
  //  2) 폭탄 비중(과거 14~18)이 압도적이라 뽑아도 대부분 폭탄이었다는 점.
  // 문턱은 한 단계씩 낮춰 희귀 아이템을 보는 재미를 살리되,
  // 후반에도 폭탄·메가폭탄 같은 보드 액션이 보상의 중심이 되게 한다.
  // 프리즈는 등장 가치는 유지하지만 시간 연명을 막기 위해 1슬롯만 사용한다.
  // 클로버는 게임당 1회 한정(!cloverGiven)이고 보너스가 커서 비중은 그대로 1.
  const bombWeight = streak >= 14 ? 12 : streak >= 7 ? 13 : 15;
  const pool = Array.from({ length: bombWeight }, () => 'bomb');
  if (level >= 5 && !timeBonusCapped) pool.push('clock');
  if (level >= 6 && streak >= 7) pool.push('megabomb', 'megabomb');
  if (level >= 6 && streak >= 14 && !timeBonusCapped) pool.push('freeze');
  if (level >= 6 && streak >= 21 && !cloverGiven) pool.push('clover');
  return pool.filter((id) => BOARD_DROP_ITEMS[id]?.implemented);
}

export function chooseBoardDrop(combo, random = Math.random, {
  cloverGiven = false,
  pity = {},
  previousType = null,
  rewardIndex = 0,
  stage = 1,
  timeBonusCapped = false,
} = {}) {
  const streak = Math.max(0, Math.round(Number(combo) || 0));
  const earned = Math.max(0, Math.round(Number(rewardIndex) || 0));
  const level = Math.max(1, Math.round(Number(stage) || 1));
  if (level < 3) return null;
  // The first earned board item always demonstrates the most tactile reward.
  if (earned === 0) return BOARD_DROP_ITEMS.bomb;
  const previousWasTimeItem = ['clock', 'freeze'].includes(previousType);
  if (!cloverGiven && level >= 6 && streak >= 21
    && Math.max(0, pity.clover || 0) >= BOARD_DROP_PITY_LIMITS.clover) {
    return BOARD_DROP_ITEMS.clover;
  }
  if (!timeBonusCapped && !previousWasTimeItem && level >= 6 && streak >= 14
    && Math.max(0, pity.freeze || 0) >= BOARD_DROP_PITY_LIMITS.freeze) {
    return BOARD_DROP_ITEMS.freeze;
  }
  // STAGE 6~7은 메가폭탄을 처음 접하는 보호 구간이다. 자연 드롭 확률은
  // 후반과 동일하게 유지하고 pity만 짧게 둬 regular의 등장 판 비율이
  // 20% 아래로 굶지 않게 한다. STAGE 8+는 긴 pity로 희귀도를 회복한다.
  const megabombPityLimit = level <= 7 ? EARLY_MEGABOMB_PITY_LIMIT : BOARD_DROP_PITY_LIMITS.megabomb;
  if (level >= 6 && streak >= 7
    && Math.max(0, pity.megabomb || 0) >= megabombPityLimit
    && previousType !== 'megabomb') {
    return BOARD_DROP_ITEMS.megabomb;
  }
  const pool = boardDropPoolFor(level, streak, cloverGiven, timeBonusCapped);
  if (!pool.length) return null;
  // Avoid back-to-back rare effects without forcing a clock after every bomb.
  const repeatSafePool = previousType && previousType !== 'bomb'
    ? pool.filter((id) => id !== previousType && !(previousWasTimeItem && ['clock', 'freeze'].includes(id)))
    : pool;
  const choices = repeatSafePool.length ? repeatSafePool : pool;
  const index = Math.min(choices.length - 1, Math.floor(Math.max(0, random()) * choices.length));
  return BOARD_DROP_ITEMS[choices[index]];
}

export function nextBoardDropPity(pity = {}, dropType = '', { stage = 1, combo = 0 } = {}) {
  const level = Math.max(1, Math.round(Number(stage) || 1));
  const streak = Math.max(0, Math.round(Number(combo) || 0));
  const type = String(dropType || '');
  const previousMega = Math.max(0, Math.round(Number(pity.megabomb) || 0));
  const previousClover = Math.max(0, Math.round(Number(pity.clover) || 0));
  const previousFreeze = Math.max(0, Math.round(Number(pity.freeze) || 0));
  return Object.freeze({
    megabomb: level >= 6 && streak >= 7 ? (type === 'megabomb' ? 0 : previousMega + 1) : previousMega,
    clover: level >= 6 && streak >= 21 ? (type === 'clover' ? 0 : previousClover + 1) : previousClover,
    freeze: level >= 6 && streak >= 14 ? (type === 'freeze' ? 0 : previousFreeze + 1) : previousFreeze,
  });
}

export function boardDropReward(previousCombo, nextCombo) {
  const previous = Math.max(0, Math.round(Number(previousCombo) || 0));
  const next = Math.max(0, Math.round(Number(nextCombo) || 0));
  if (Math.floor(next / ITEM_REWARD_INTERVAL) > Math.floor(previous / ITEM_REWARD_INTERVAL)) return 'milestone';
  return null;
}

export function comboAfterFailure(combo) {
  return Math.floor(Math.max(0, Math.round(Number(combo) || 0)) * 0.7);
}

export function isNearMissSum(sum) {
  return Math.abs((Number(sum) || 0) - 10) === 1;
}

export function comboAfterIncorrectSelection(combo, sum) {
  const current = Math.max(0, Math.round(Number(combo) || 0));
  return isNearMissSum(sum) ? Math.max(0, current - 1) : comboAfterFailure(current);
}

export function shouldOfferStruggleHint(stage = 1, consecutiveFailures = 0) {
  const level = Math.max(1, Math.round(Number(stage) || 1));
  const misses = Math.max(0, Math.round(Number(consecutiveFailures) || 0));
  return level <= 4 && misses >= STRUGGLE_HINT_FAILURES;
}

export function comboGainForClear(cellCount) {
  return Math.max(0, Math.round(Number(cellCount) || 0)) >= 4 ? 2 : 1;
}

export function stageProgressGainForClear(cellCount) {
  return Math.max(0, Math.round(Number(cellCount) || 0)) >= 5 ? 2 : 1;
}

export function comboWindowMsForStage(stage = 1) {
  const level = Math.max(1, Math.round(Number(stage) || 1));
  if (level <= 2) return COMBO_WINDOW_MS.early;
  if (level <= 5) return COMBO_WINDOW_MS.mid;
  if (level <= 8) return COMBO_WINDOW_MS.advanced;
  return COMBO_WINDOW_MS.expert;
}

export function comboAfterIdle(combo, stage = 1) {
  const current = Math.max(0, Math.round(Number(combo) || 0));
  const level = Math.max(1, Math.round(Number(stage) || 1));
  const decay = level >= 9 && current >= 14 ? 3 : level >= 6 ? 2 : 1;
  return Math.max(0, current - decay);
}

export function itemUnlockGrantForStage(stage = 1) {
  const level = Math.max(1, Math.round(Number(stage) || 1));
  if (level === 3) return Object.freeze({ bomb: 1 });
  if (level === 5) return Object.freeze({ clock: 1 });
  return null;
}

export function isItemUnlockedAtStage(itemId, stage = 1) {
  const level = Math.max(1, Math.round(Number(stage) || 1));
  if (itemId === 'bomb') return level >= 3;
  if (itemId === 'clock') return level >= 5;
  return ['hint', 'shuffle'].includes(itemId);
}

export function stageIntroForStage(stage = 1) {
  const level = Math.max(1, Math.round(Number(stage) || 1));
  const config = getStageConfig(level);
  if (level === 1) return Object.freeze({ kicker: 'WARM UP', title: 'STAGE 1', detail: '4×4 · 목표 3' });
  if (level === 2) return Object.freeze({ kicker: 'BOARD UP', title: 'STAGE 2', detail: '5×5 OPEN' });
  if (level === 3) return Object.freeze({ kicker: 'BOMB OPEN', title: 'STAGE 3', detail: '폭탄 해금 · 목표 8' });
  if (level === 4) return Object.freeze({ kicker: 'SPECIAL DROP', title: 'STAGE 4', detail: '희귀 아이템 체험' });
  if (level === 5) return Object.freeze({ kicker: 'CLOCK OPEN', title: 'STAGE 5', detail: '시계 해금 · 목표 11' });
  if (level === 6) return Object.freeze({ kicker: 'MISSION ON', title: 'STAGE 6', detail: `큰 조합 보너스 · 목표 ${config.target}` });
  if (level === 7) return Object.freeze({ kicker: 'CAT CHANCE', title: 'STAGE 7', detail: `고양이 수집 보너스 · 목표 ${config.target}` });
  if (level === 8) return Object.freeze({ kicker: 'CHAIN FEVER', title: 'STAGE 8', detail: `연속 성공 보너스 · 목표 ${config.target}` });
  const challenge = stageChallengeForStage(level);
  const detail = challenge
    ? `${challenge.label} 보너스 · 목표 ${config.target}`
    : `${config.cols}×${config.rows} · 목표 ${config.target}`;
  return Object.freeze({
    kicker: level >= 8 ? 'OING FEVER' : 'LEVEL UP',
    title: `STAGE ${level}`,
    detail,
  });
}

export function stageChallengeForStage(stage = 1) {
  const level = Math.max(1, Math.round(Number(stage) || 1));
  if (level < 6) return null;
  const kind = ['wide', 'cat', 'chain'][(level - 6) % 3];
  if (kind === 'wide') return Object.freeze({ kind, label: '큰 조합', requirement: 5 });
  if (kind === 'cat') return Object.freeze({ kind, label: '고양이 수집', requirement: 1 });
  return Object.freeze({ kind, label: '연속 성공', requirement: 3 });
}

export function stageChallengeBonus(stage = 1) {
  const level = Math.max(1, Math.round(Number(stage) || 1));
  return 450 + level * 75;
}

export function completesStageChallenge(challenge, {
  cellCount = 0,
  catCount = 0,
  stageStreak = 0,
} = {}) {
  if (!challenge) return false;
  if (challenge.kind === 'wide') return Math.max(0, Number(cellCount) || 0) >= challenge.requirement;
  if (challenge.kind === 'cat') return Math.max(0, Number(catCount) || 0) >= challenge.requirement;
  if (challenge.kind === 'chain') return Math.max(0, Number(stageStreak) || 0) >= challenge.requirement;
  return false;
}

export function stageChallengeProgress(challenge, {
  completed = false,
  stageStreak = 0,
} = {}) {
  if (!challenge) return null;
  const requirement = Math.max(1, Math.round(Number(challenge.requirement) || 1));
  const target = challenge.kind === 'chain' ? requirement : 1;
  const progress = completed
    ? target
    : challenge.kind === 'chain'
      ? Math.min(target, Math.max(0, Math.round(Number(stageStreak) || 0)))
      : 0;
  return Object.freeze({
    kind: challenge.kind,
    label: challenge.label,
    requirement,
    progress,
    target,
    completed: Boolean(completed),
  });
}

export function comboMilestoneCrossed(previousCombo, nextCombo) {
  const previous = Math.max(0, Math.round(Number(previousCombo) || 0));
  const next = Math.max(previous, Math.round(Number(nextCombo) || 0));
  return [8, 5, 3].find((milestone) => previous < milestone && next >= milestone) || 0;
}

export function itemRewardCountdown(combo, stage = 1) {
  if (Math.max(1, Math.round(Number(stage) || 1)) < 3) return 0;
  const streak = Math.max(0, Math.round(Number(combo) || 0));
  const remainder = streak % ITEM_REWARD_INTERVAL;
  return remainder === 0 ? ITEM_REWARD_INTERVAL : ITEM_REWARD_INTERVAL - remainder;
}

export function shouldAdvanceRound(progress, target, hasAnswer) {
  return Math.max(0, Number(progress) || 0) >= Math.max(1, Number(target) || 1);
}

export const shouldAdvanceStage = shouldAdvanceRound;

export function shouldShowBeginnerAutoHint({
  running = false, inputLocked = false, tutorialActive = false, alreadyShown = false,
  timeLeft = 0, idleMs = 0, bestScore = 0, completedRuns = 0,
} = {}) {
  const isBeginner = Math.max(0, completedRuns) < 3
    || Math.max(0, Number(bestScore) || 0) < BEGINNER_AUTO_HINT_SCORE_CEILING;
  return Boolean(running) && !inputLocked && !tutorialActive && !alreadyShown && isBeginner
    && timeLeft > 10 && timeLeft <= 40 && idleMs >= BEGINNER_AUTO_HINT_IDLE_MS;
}

export function boardDropInventoryGrant(type) {
  // Visible board drops are one-tap actions, matching the original OING.
  // Footer inventory is reserved for starting or separately granted items.
  return null;
}

export function cappedSessionTime(timeLeft = 0, bonusSeconds = 0) {
  return Math.min(
    GAME_DURATION_SECONDS,
    Math.max(0, Number(timeLeft) || 0) + Math.max(0, Number(bonusSeconds) || 0),
  );
}

export function availableItemTimeBonus(usedSeconds = 0, requestedSeconds = 0) {
  const used = Math.max(0, Number(usedSeconds) || 0);
  const requested = Math.max(0, Number(requestedSeconds) || 0);
  return Math.min(requested, Math.max(0, MAX_ITEM_TIME_BONUS_SECONDS - used));
}

// Refill time when the board actually gets bigger. This used to enumerate the
// column steps (4->5, 5->6, 6->7), which silently paid nothing once `cols`
// stopped at 6 — STAGE 4 grows into 6x7 by gaining a row, not a column, and
// that transition lost its ten seconds. Comparing cell counts states the
// intent directly and survives the next change to the board caps.
export function roundTimeBonusSeconds(round = 1) {
  const current = getStageConfig(round);
  const next = getStageConfig(current.stage + 1);
  const grew = next.cols * next.rows > current.cols * current.rows;
  if (!grew) return 0;
  // The opening 4x4 -> 5x5 step is small and comes with plenty of clock left.
  return current.stage === 1 ? 6 : 10;
}

export function stageClearBonus(stage = 1, timeLeft = 0, perfect = false) {
  const level = Math.max(1, Math.round(Number(stage) || 1));
  const time = Math.max(0, Math.floor(Number(timeLeft) || 0));
  return 220 + level * 35 + Math.min(180, time * 2) + (perfect ? 120 : 0);
}

export function specialTilePlanForStage(stage = 1, random = Math.random, { timeBonusCapped = false } = {}) {
  const config = getStageConfig(stage);
  const plan = [];
  if (!timeBonusCapped && config.timeLimit > 0 && Math.max(0, random()) < config.clockChance) plan.push('clock');
  if (Math.max(0, random()) < config.bombChance) plan.push('bomb');
  return plan;
}

export function freezeTimeline(nowMs, timeLeft, seconds = TIME_FREEZE_SECONDS) {
  const now = Math.max(0, Number(nowMs) || 0);
  const remaining = Math.max(0, Number(timeLeft) || 0);
  const duration = Math.max(0, Number(seconds) || 0) * 1000;
  const freezeEndsAt = now + duration;
  return Object.freeze({
    freezeEndsAt,
    frozenTimeLeft: remaining,
    endAt: freezeEndsAt + remaining * 1000,
  });
}

export function rebasePausedTimeline({
  endAt = 0,
  freezeEndsAt = 0,
  comboExpiresAt = 0,
  pauseStartedAt = 0,
  resumedAt = 0,
} = {}) {
  const pausedAt = Math.max(0, Number(pauseStartedAt) || 0);
  const resumed = Math.max(pausedAt, Number(resumedAt) || 0);
  const pauseDuration = resumed - pausedAt;
  const shiftLiveDeadline = (deadline) => {
    const value = Math.max(0, Number(deadline) || 0);
    return value > pausedAt ? value + pauseDuration : value;
  };
  return Object.freeze({
    pauseDuration,
    endAt: shiftLiveDeadline(endAt),
    freezeEndsAt: shiftLiveDeadline(freezeEndsAt),
    comboExpiresAt: shiftLiveDeadline(comboExpiresAt),
  });
}

// Prices and display names must come from the Apps in Toss IAP product list.
// These local records only define what a verified order will grant later.
export const PRODUCT_CATALOG = Object.freeze({
  hint5: Object.freeze({ sku: 'oing.hint.5', type: 'consumable', status: 'iap-not-connected', grants: Object.freeze({ hint: 5 }) }),
  shuffle5: Object.freeze({ sku: 'oing.shuffle.5', type: 'consumable', status: 'iap-not-connected', grants: Object.freeze({ shuffle: 5 }) }),
  bomb3: Object.freeze({ sku: 'oing.bomb.3', type: 'consumable', status: 'iap-not-connected', grants: Object.freeze({ bomb: 3 }) }),
  clock3: Object.freeze({ sku: 'oing.clock.3', type: 'consumable', status: 'iap-not-connected', grants: Object.freeze({ clock: 3 }) }),
  starter: Object.freeze({
    sku: 'oing.starter.1',
    type: 'consumable',
    status: 'iap-not-connected',
    grants: Object.freeze({ hint: 5, shuffle: 5, bomb: 2, clock: 2 }),
  }),
});

export const MESSAGES = Object.freeze({
  start: Object.freeze(['10을 찾아볼까냥?', '준비됐으면 바로 가자!', '이번 판도 깔끔하게 가자냥.']),
  tapEnd: Object.freeze(['반대쪽 끝 칸도 톡!', '끝 칸을 한 번 더 눌러봐냥.']),
  firstSuccess: Object.freeze(['오잉! 바로 찾았네!', '딱 10이다냥!', '첫 조합부터 좋은데?']),
  success: Object.freeze(['오잉! 딱 10!', '좋아!', '그거다냥!', '이번엔 인정.', '깔끔했다!']),
  combo3: Object.freeze(['손이 좀 빠른데?', '감 잡았냥?', '오, 연속인데?', '잘한다냥!']),
  combo5: Object.freeze(['지금 완전 감 잡았어!', '이대로 가라냥!', '멈추지 마!', '오잉, 좀 하는데?']),
  combo8: Object.freeze(['와, 터진다냥!', '오늘 감 좋은데?', '미쳤다냥!', '이 정도는 해야지냥.']),
  wow: Object.freeze(['와, 크게 지웠다!', '한 번에 쫙! 좋다냥.', '큰 10은 못 참지.']),
  fail: Object.freeze(['어라?', '10이 아닌데냥...', '다시 봐봐.', '앗.', '그건 내가 못 본 걸로 한다냥.']),
  nearMiss: Object.freeze(['아깝다냥, 거의 10!', '하나 차이다냥!', '오, 거의 맞았는데?']),
  struggleHint: Object.freeze(['이건 내가 살짝 보여줄게냥!', '잠깐, 여기부터 다시 봐봐!', '이 조합은 서비스다냥.']),
  nearGoal: Object.freeze(['하나만 더!', '거의 다 왔다냥!', '조금만 더!', '끝이 보인다냥!']),
  hint: Object.freeze(['여기 한번 봐봐!', '이쪽이 수상한데?', '반짝이는 칸을 봐라냥!']),
  autoHint: Object.freeze(['잠깐 막혔냥? 여기부터 봐보라냥!', '이 조합이 살짝 반짝인다냥!']),
  perfect: Object.freeze(['퍼펙트! 힌트 하나 챙겼다냥!', '판을 싹 비웠다냥! 선물이다냥!']),
  shuffle: Object.freeze(['판 좀 뒤집어볼까냥?', '숫자들 자리 바꾼다!', '내가 한번 섞어주지냥.']),
  noAnswer: Object.freeze(['어라? 없네.', '이건 내가 섞어줄게냥!', '잠깐, 판 좀 뒤집자냥.', '내가 섞어줘야겠네.']),
  bomb: Object.freeze(['펑! 시원하게 뚫었다냥!', '길이 활짝 열렸다냥!']),
  megabomb: Object.freeze(['오잉! 크게 터진다냥!', '메가폭탄 나간다냥!']),
  clock: Object.freeze(['시간 +5초!', '5초 더 달려보자냥!', '시간은 내가 챙겼다.']),
  freeze: Object.freeze(['시간이 꽁꽁 멈췄다냥!', '10초 동안 마음껏 찾아보라냥!', '째깍째깍 잠깐 쉬어간다냥!']),
  clover: Object.freeze(['클로버가 정답을 찾았다냥!', '초록빛 칸을 잘 보라냥!', '이번 정답은 오래 보여준다냥!']),
  cloverSuccess: Object.freeze(['행운 점수까지 챙겼다냥!', '클로버 보너스 성공!', '이번 조합은 점수가 더 붙는다냥!']),
  clutch: Object.freeze(['막판 집중력 인정!', '끝까지 잡았다냥!', '마지막까지 깔끔했다냥!']),
  itemDrop: Object.freeze(['아이템이 나왔다냥! 톡 눌러보라냥!', '오잉, 선물이 떨어졌다냥!']),
  challengeWide: Object.freeze(['큰 조합 노려보자냥!', '5칸 묶으면 보너스!']),
  challengeCat: Object.freeze(['고양이 한 마리 찾아봐!', '숨은 고양이 챙겨보라냥!']),
  challengeChain: Object.freeze(['연속 세 번 가보자냥!', '실수 없이 세 번, 할 수 있지?']),
  challengeComplete: Object.freeze(['보너스까지 챙겼다냥!', '이번 미션도 깔끔하게 성공!', '오, 보너스 인정.']),
  bombCollected: Object.freeze(['폭탄 챙겼다냥! 아래서 터뜨려보라냥!', '폭탄 하나 저장했다냥! 필요할 때 눌러보라냥!']),
  clockCollected: Object.freeze(['시계를 챙겼다냥! 급할 때 써보라냥!', '시간 선물 저장 완료다냥!']),
  catBonus: Object.freeze(['보너스 고양이까지 챙겼다냥!', '야옹! 점수 더 얹어준다냥!', '고양이 보너스도 놓치지 않았다냥!']),
  round: Object.freeze(['다음 판 가자냥!', '오잉, 클리어!', '깔끔했다!', '이 정도쯤이야.']),
  stage: Object.freeze(['다음 판 가자냥!', '오잉, 클리어!', '깔끔했다!', '이 정도쯤이야.']),
  lowTime: Object.freeze(['빨리빨리!', '시간 없다냥!', '10초 남았어!', '서둘러라냥!']),
  resultLow: Object.freeze([
    '워밍업 끝! 이제 감 올라온다냥',
    '첫 판부터 기록 하나 만들었네!',
    '좋아, 다음 판은 더 빨라지겠다냥',
    '합10 보는 눈이 슬슬 열린다냥',
    '이번 판 데이터 접수! 한 판 더?',
    '출발 좋았어. 이제 속도만 붙이면 돼!',
  ]),
  resultNormal: Object.freeze([
    '숫자 조합이 제대로 보이기 시작했다냥',
    '이번 판 흐름 좋았어!',
    '오, 속도가 붙었는데?',
    '콤보 감각이 살아 있다냥',
    '이번 기록, 다음 판에 넘을 수 있겠어!',
    '이 정도면 손이 기억하겠다냥',
  ]),
  resultHigh: Object.freeze([
    '속도가 장난 아니다냥',
    '숫자가 다 보이나 보다냥',
    '콤보 타이밍이 예술이다냥',
    '완전 고수의 흐름이다냥!',
    '이번 판은 인정. 진짜 빨랐어!',
    '보드가 따라오질 못하겠다냥',
  ]),
  resultLegend: Object.freeze([
    '오잉게임 마스터 인정이다냥',
    '오늘의 오잉왕 후보 확정이다냥',
    '이런 점수는 자랑부터 해야 한다냥',
    '이 정도면 숫자가 먼저 도망가겠다냥',
    '전설급 기록이다. 이번엔 진짜 인정!',
  ]),
  record: Object.freeze([
    '새 최고기록이다냥!',
    '최고점수를 갈아치웠다냥!',
    '오늘 기록은 오래 남겠다냥!',
    '오잉! 기록판 맨 위를 바꿔버렸네!',
    '신기록 폭발! 이번 판은 자랑해도 된다냥',
  ]),
  nearRecord: Object.freeze([
    '최고기록 바로 앞까지 왔다냥!',
    '다음 판에 기록 넘어가겠는데?',
    '기록 경신 흐름이 딱 보인다냥',
  ]),
  rising: Object.freeze([
    '지난 판보다 확실히 빨라졌어!',
    '점수가 계속 오르는데? 감 잡았냥?',
    '상승세 제대로 탔다냥!',
    '또 올랐어. 지금 흐름 놓치지 마!',
  ]),
  comboRecord: Object.freeze([
    '오늘 콤보 감각 최고였다냥!',
    '그 콤보는 다시 봐도 멋진데?',
    '연속 성공 리듬이 제대로였다냥',
  ]),
  stageRecord: Object.freeze([
    '새 스테이지까지 뚫었다냥!',
    '오늘 가장 멀리 갔어!',
    '보드가 커져도 문제없는데?',
  ]),
});

export function pickMessage(type, previous = '', random = Math.random) {
  const pool = MESSAGES[type] || MESSAGES.success;
  const candidates = pool.filter((message) => message !== previous);
  const options = candidates.length ? candidates : pool;
  const index = Math.min(options.length - 1, Math.floor(Math.max(0, random()) * options.length));
  return options[index];
}

export function resultMessageType(score, newRecord = false) {
  if (newRecord) return 'record';
  const tone = resultToneForScore(score);
  return tone === 'low'
    ? 'resultLow'
    : tone === 'normal'
      ? 'resultNormal'
      : tone === 'high'
        ? 'resultHigh'
        : 'resultLegend';
}

export function resultToneForScore(score) {
  const points = Math.max(0, Math.round(Number(score) || 0));
  if (points < RESULT_SCORE_THRESHOLDS.normal) return 'low';
  if (points < RESULT_SCORE_THRESHOLDS.high) return 'normal';
  if (points < RESULT_SCORE_THRESHOLDS.legend) return 'high';
  return 'legend';
}

export function pickResultMessage(score, { newRecord = false, previous = '', random = Math.random } = {}) {
  return pickMessage(resultMessageType(score, newRecord), previous, random);
}

function pickFreshMessage(type, recentMessages = [], random = Math.random) {
  const pool = MESSAGES[type] || MESSAGES.resultNormal;
  const blocked = new Set(Array.isArray(recentMessages) ? recentMessages : []);
  const fresh = pool.filter((message) => !blocked.has(message));
  const choices = fresh.length ? fresh : pool;
  const index = Math.min(choices.length - 1, Math.floor(Math.max(0, random()) * choices.length));
  return choices[index];
}

export function buildResultReaction({
  score = 0,
  newRecord = false,
  previousBest = 0,
  previousScore = null,
  recentScores = [],
  maxCombo = 0,
  previousBestCombo = 0,
  round = 1,
  previousHighestStage = 1,
} = {}, { recentMessages = [], random = Math.random } = {}) {
  const current = Math.max(0, Math.round(Number(score) || 0));
  const best = Math.max(0, Math.round(Number(previousBest) || 0));
  const last = previousScore === null || previousScore === undefined
    ? null
    : Math.max(0, Math.round(Number(previousScore) || 0));
  const scores = (Array.isArray(recentScores) ? recentScores : [])
    .filter(Number.isFinite)
    .map((value) => Math.max(0, Math.round(value)))
    .slice(-4);
  const average = scores.length
    ? scores.reduce((sum, value) => sum + value, 0) / scores.length
    : 0;
  const rising = scores.length >= 2
    && current > scores.at(-1)
    && scores.at(-1) >= scores.at(-2);
  const nearRecord = best > 0 && current < best && current / best >= 0.9;
  const comboRecord = maxCombo > 2 && maxCombo > Math.max(0, Number(previousBestCombo) || 0);
  const stageRecord = round > Math.max(1, Number(previousHighestStage) || 1);

  let type = resultMessageType(current, newRecord);
  if (newRecord) type = 'record';
  else if (stageRecord) type = 'stageRecord';
  else if (comboRecord) type = 'comboRecord';
  else if (nearRecord) type = 'nearRecord';
  else if (rising || (last !== null && current > last && current >= average)) type = 'rising';

  return Object.freeze({ type, message: pickFreshMessage(type, recentMessages, random) });
}

export function buildScoreComparisons(score, previousScore, previousBest) {
  const current = Math.max(0, Math.round(Number(score) || 0));
  const best = Math.max(0, Math.round(Number(previousBest) || 0));
  const last = previousScore === null || previousScore === undefined
    ? null
    : Math.max(0, Math.round(Number(previousScore) || 0));

  let bestText = '첫 기록을 만들었다냥!';
  let bestTone = 'first';
  if (best > 0 && current > best) {
    bestText = `최고기록보다 +${(current - best).toLocaleString('ko-KR')}점이다냥!`;
    bestTone = 'up';
  } else if (best > 0 && current < best) {
    const gap = best - current;
    if (current === 0) bestText = `최고기록까지 ${gap.toLocaleString('ko-KR')}점 남았다냥`;
    else if (gap <= 150) bestText = `최고기록까지 딱 ${gap.toLocaleString('ko-KR')}점 차이다냥!`;
    else bestText = `최고 기록의 ${Math.round((current / best) * 100)}%까지 왔다냥`;
    bestTone = 'down';
  } else if (best > 0) {
    bestText = '최고기록과 똑같이 해냈다냥!';
    bestTone = 'same';
  }

  let previousText = '';
  let previousTone = '';
  if (last !== null && current > last) {
    previousText = `지난 판보다 +${(current - last).toLocaleString('ko-KR')}점 올랐다냥!`;
    previousTone = 'up';
  } else if (last !== null && current < last) {
    previousText = `지난 판 ${last.toLocaleString('ko-KR')}점 · 다음 판은 더 올라가보자냥!`;
    previousTone = 'neutral';
  } else if (last !== null) {
    previousText = '지난 판과 똑같은 점수다냥!';
    previousTone = 'same';
  }

  return {
    bestText,
    bestTone,
    previousText,
    previousTone,
    hasPrevious: last !== null,
  };
}

export function resultRetryLabel({
  score = 0,
  previousBest = 0,
  newRecord = false,
  recordEligible = true,
  maxCombo = 0,
  round = 1,
} = {}) {
  if (!recordEligible) return 'STAGE 1부터 도전!';
  if (newRecord) return '신기록 또 넘기기!';
  const current = Math.max(0, Math.round(Number(score) || 0));
  const best = Math.max(0, Math.round(Number(previousBest) || 0));
  if (best > 0 && current < best && (best - current <= 150 || current / best >= 0.9)) {
    return '최고기록 넘기기!';
  }
  return '한 판 더!';
}

export function comboMultiplier(combo) {
  return 1 + Math.min(Math.max(combo - 1, 0), 9) * 0.15;
}

export function scoreForClear(cellCount, combo) {
  const base = cellCount <= 2
    ? 210
    : 210 + (cellCount - 2) * 210 + Math.max(0, cellCount - 3) * 40;
  return Math.round(base * comboMultiplier(combo));
}

export function scoreForWideClear(cellCount, combo) {
  const extraCells = Math.max(0, Math.round(Number(cellCount) || 0) - 4);
  return Math.round(extraCells * 120 * comboMultiplier(combo));
}

// The original OING cat cell adds five base points before its integer combo
// multiplier. V2 scores use a larger scale, so 120 preserves the same
// meaningful "lucky catch" feeling without overpowering the clear itself.
export function scoreForCatBonus(catCount, combo) {
  const cats = Math.max(0, Math.round(Number(catCount) || 0));
  return Math.round(cats * 120 * comboMultiplier(combo));
}

export function scoreForCloverBonus(basePoints) {
  return Math.round(Math.max(0, Number(basePoints) || 0) * 0.5);
}

export function scoreForClutch(timeLeft, combo) {
  const remaining = Math.max(0, Number(timeLeft) || 0);
  if (remaining > 10) return 0;
  const urgency = remaining <= 3 ? 180 : 90;
  return urgency + Math.min(10, Math.max(0, Math.round(Number(combo) || 0))) * 10;
}

export function scoreForBomb(valueSum, cellCount = 0) {
  const value = Math.max(0, Math.round(Number(valueSum) || 0));
  const cells = Math.max(0, Math.round(Number(cellCount) || 0));
  return 180 + cells * 55 + value * 4;
}

export function scoreForMegaBomb(valueSum, cellCount = 0) {
  const value = Math.max(0, Math.round(Number(valueSum) || 0));
  const cells = Math.max(0, Math.round(Number(cellCount) || 0));
  return 320 + cells * 70 + value * 4;
}

export function getStageConfig(stageNumber) {
  const stage = Math.max(1, Math.round(Number(stageNumber) || 1));
  const fixed = STAGE_CONFIG[stage - 1];
  if (fixed) return fixed;
  const last = STAGE_CONFIG.at(-1);
  const extra = stage - last.stage;
  return {
    stage,
    round: stage,
    size: last.size,
    cols: last.cols,
    rows: last.rows,
    target: Math.min(30, last.target + extra * 2),
    timeLimit: GAME_DURATION_SECONDS,
    clockChance: Math.min(0.065, last.clockChance + extra * 0.002),
    bombChance: Math.min(0.58, last.bombChance + extra * 0.02),
  };
}

export const getRoundConfig = getStageConfig;
