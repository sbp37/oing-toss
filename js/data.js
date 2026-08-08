export const GAME_DURATION_SECONDS = 120;
export const PRACTICE_DURATION_SECONDS = 240;
export const ITEM_REWARD_INTERVAL = 7;
export const TIME_FREEZE_SECONDS = 15;
export const BEGINNER_AUTO_HINT_IDLE_MS = 6000;
export const BEGINNER_AUTO_HINT_SCORE_CEILING = 6000;
export const START_COUNTDOWN_STEPS = Object.freeze([3, 2, 1, 'GO!']);
export const RESULT_SCORE_THRESHOLDS = Object.freeze({
  normal: 6000,
  high: 15000,
  legend: 30000,
});

export const ROUND_CONFIG = Object.freeze([
  { round: 1, size: 4, cols: 4, rows: 4, target: 3 },
  { round: 2, size: 5, cols: 5, rows: 5, target: 5 },
  { round: 3, size: 6, cols: 6, rows: 6, target: 7 },
  { round: 4, size: 7, cols: 7, rows: 7, target: 9 },
  { round: 5, size: 7, cols: 7, rows: 8, target: 11 },
  { round: 6, size: 7, cols: 7, rows: 9, target: 13 },
  { round: 7, size: 7, cols: 7, rows: 10, target: 15 },
]);

export const ITEM_DEFINITIONS = Object.freeze({
  hint: { id: 'hint', initial: 3, implemented: true, asset: 'assets/icons/items/hint.webp' },
  shuffle: { id: 'shuffle', initial: 2, implemented: true, asset: 'assets/icons/items/shuffle.webp' },
  bomb: { id: 'bomb', initial: 1, implemented: true, asset: 'assets/icons/items/bomb.webp' },
  clock: { id: 'clock', initial: 1, implemented: true, asset: 'assets/icons/hud/time.webp' },
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

const BOARD_DROP_POOLS = Object.freeze({
  // Time items are memorable but must not create an endless reward loop.
  // Seven-combo rewards therefore stay frequent while most drops affect the
  // board instead of extending the two-minute session.
  1: Object.freeze(['bomb', 'bomb', 'bomb', 'bomb', 'clock']),
  2: Object.freeze(['bomb', 'bomb', 'bomb', 'megabomb', 'megabomb', 'clock']),
  3: Object.freeze(['bomb', 'bomb', 'bomb', 'bomb', 'megabomb', 'megabomb', 'megabomb', 'megabomb', 'megabomb', 'clock', 'freeze']),
});

export function chooseBoardDrop(combo, random = Math.random, {
  cloverGiven = false,
  previousType = null,
  rewardIndex = 0,
} = {}) {
  const streak = Math.max(0, Math.round(Number(combo) || 0));
  const earned = Math.max(0, Math.round(Number(rewardIndex) || 0));
  // The first earned board item always demonstrates the most tactile reward.
  if (earned === 0) return BOARD_DROP_ITEMS.bomb;
  const tier = streak >= 21 ? 3 : streak >= 14 ? 2 : 1;
  // Clover is a late-run surprise, not an early seven-combo reward.
  if (streak >= 21 && !cloverGiven && (earned >= 3 || Math.max(0, random()) < 0.15)) {
    return BOARD_DROP_ITEMS.clover;
  }
  const pool = BOARD_DROP_POOLS[tier].filter((id) => BOARD_DROP_ITEMS[id]?.implemented);
  if (!pool.length) return null;
  // Back-to-back identical drops feel like a missed reward. Preserve the
  // weighted pool while choosing from another available type when possible.
  const variedPool = pool.some((id) => id !== previousType)
    ? pool.filter((id) => id !== previousType)
    : pool;
  const index = Math.min(variedPool.length - 1, Math.floor(Math.max(0, random()) * variedPool.length));
  return BOARD_DROP_ITEMS[variedPool[index]];
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

export function comboGainForClear(cellCount) {
  return Math.max(0, Math.round(Number(cellCount) || 0)) >= 5 ? 2 : 1;
}

export function comboMilestoneCrossed(previousCombo, nextCombo) {
  const previous = Math.max(0, Math.round(Number(previousCombo) || 0));
  const next = Math.max(previous, Math.round(Number(nextCombo) || 0));
  return [8, 5, 3].find((milestone) => previous < milestone && next >= milestone) || 0;
}

export function itemRewardCountdown(combo) {
  const streak = Math.max(0, Math.round(Number(combo) || 0));
  const remainder = streak % ITEM_REWARD_INTERVAL;
  return remainder === 0 ? ITEM_REWARD_INTERVAL : ITEM_REWARD_INTERVAL - remainder;
}

export function shouldAdvanceRound(progress, target, hasAnswer) {
  // A board is a stage. Clear counts are feedback, not a gate that forces
  // another generated board before the player may advance.
  return !hasAnswer;
}

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

export function roundTimeBonusSeconds(round = 1) {
  const stage = Math.max(1, Math.round(Number(round) || 1));
  if (stage <= 4) return 2;
  return 3;
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
  start: Object.freeze(['10을 찾아보자냥!', '슥 밀어서 10이다냥!', '준비됐으면 바로 가자냥!']),
  tapEnd: Object.freeze(['반대쪽 끝 칸도 톡 눌러보라냥!', '끝 칸을 한 번 더 눌러보라냥!']),
  firstSuccess: Object.freeze(['오잉, 바로 찾았다냥!', '딱 10이다냥!', '첫 조합부터 좋다냥!']),
  success: Object.freeze(['좋다냥!', '깔끔하다냥!', '바로 그거다냥!', '눈에 쏙 들어왔다냥!']),
  combo3: Object.freeze(['손이 빠르다냥!', '콤보가 착착 붙는다냥!', '감이 올라온다냥!']),
  combo5: Object.freeze(['지금 완전 감 잡았다냥!', '계속 이어가자냥!', '숫자가 다 보이나 보다냥!']),
  combo8: Object.freeze(['완전 신났다냥!', '손가락에 날개 달렸냥?', '집중력이 폭발했다냥!']),
  wow: Object.freeze(['와, 큰 조합이다냥!', '한 번에 쫙 지웠다냥!', '이런 큰 10을 기다렸다냥!']),
  fail: Object.freeze(['앗, 10이 아니다냥', '조금 아깝다냥', '다시 골라보자냥']),
  hint: Object.freeze(['여기 한번 보라냥!', '이쪽이 수상하다냥!', '반짝이는 칸을 이어보라냥!']),
  autoHint: Object.freeze(['잠깐 막혔냥? 여기부터 봐보라냥!', '이 조합이 살짝 반짝인다냥!']),
  perfect: Object.freeze(['퍼펙트! 힌트 하나 챙겼다냥!', '판을 싹 비웠다냥! 선물이다냥!']),
  shuffle: Object.freeze(['한번 섞어보자냥!', '새 판에서 다시 찾아보자냥!', '숫자들 자리 바꾼다냥!']),
  bomb: Object.freeze(['펑! 시원하게 뚫었다냥!', '길이 활짝 열렸다냥!']),
  megabomb: Object.freeze(['오잉! 크게 터진다냥!', '메가폭탄 나간다냥!']),
  clock: Object.freeze(['시간을 더 챙겼다냥!', '8초 더 달려보자냥!']),
  freeze: Object.freeze(['시간이 꽁꽁 멈췄다냥!', '15초 동안 마음껏 찾아보라냥!', '째깍째깍 잠깐 쉬어간다냥!']),
  clover: Object.freeze(['클로버가 정답을 찾았다냥!', '초록빛 칸을 잘 보라냥!', '이번 정답은 오래 보여준다냥!']),
  itemDrop: Object.freeze(['아이템이 나왔다냥! 톡 눌러보라냥!', '오잉, 선물이 떨어졌다냥!']),
  bombCollected: Object.freeze(['폭탄 챙겼다냥! 아래서 터뜨려보라냥!', '폭탄 하나 저장했다냥! 필요할 때 눌러보라냥!']),
  clockCollected: Object.freeze(['시계를 챙겼다냥! 급할 때 써보라냥!', '시간 선물 저장 완료다냥!']),
  catBonus: Object.freeze(['보너스 고양이까지 챙겼다냥!', '야옹! 점수 더 얹어준다냥!', '고양이 보너스도 놓치지 않았다냥!']),
  round: Object.freeze(['다음 판도 바로 가자냥!', '더 찾아보자냥!', '새 판도 끊지 말고 가자냥!']),
  lowTime: Object.freeze(['조금만 더다냥!', '시간이 얼마 없다냥!', '마지막까지 눈 크게 뜨라냥!']),
  resultLow: Object.freeze([
    '워밍업 한 판이었다고 생각하면 딱이다냥',
    '처음엔 다 이렇다냥, 몇 판 더 하면 확 달라진다냥',
    '몸 풀렸으니 이제 진짜 시작이다냥',
    '합10 조합이 눈에 익으면 확 빨라진다냥',
  ]),
  resultNormal: Object.freeze([
    '숫자 조합이 눈에 들어오기 시작했다냥',
    '한 판 한 판 늘고 있다냥, 이 감각 기억해두라냥',
    '감은 잡았다냥, 이제 속도만 올리면 된다냥',
    '오, 이번 판 흐름 괜찮았다냥?',
  ]),
  resultHigh: Object.freeze([
    '속도가 장난 아니다냥',
    '숫자가 다 보이나 보다냥',
    '콤보 타이밍이 예술이다냥',
    '완전 고수의 향기다냥...!',
  ]),
  resultLegend: Object.freeze([
    '오잉게임 마스터 인정이다냥',
    '오늘의 오잉왕 후보 확정이다냥',
    '이런 점수는 자랑부터 해야 한다냥',
  ]),
  record: Object.freeze(['새 최고기록이다냥!', '최고점수를 갈아치웠다냥!', '오늘 기록은 오래 남겠다냥!']),
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
    previousText = `지난 판보다 ${(last - current).toLocaleString('ko-KR')}점 낮지만 감은 살아 있다냥`;
    previousTone = 'down';
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

export function scoreForBomb(valueSum) {
  return 120 + Math.max(0, Math.round(Number(valueSum) || 0)) * 3;
}

export function scoreForMegaBomb(valueSum) {
  return 220 + Math.max(0, Math.round(Number(valueSum) || 0)) * 4;
}

export function getRoundConfig(round) {
  const stage = Math.max(1, Math.round(Number(round) || 1));
  const fixed = ROUND_CONFIG[stage - 1];
  if (fixed) return fixed;
  const last = ROUND_CONFIG.at(-1);
  return {
    round: stage,
    size: last.size,
    cols: last.cols,
    rows: last.rows,
    target: Math.min(25, last.target + (stage - last.round) * 2),
  };
}
