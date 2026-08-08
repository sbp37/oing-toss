export const GAME_DURATION_SECONDS = 180;
export const COMBO_WINDOW_MS = 3200;
export const ITEM_REWARD_INTERVAL = 7;
export const TIME_FREEZE_SECONDS = 15;
export const START_COUNTDOWN_STEPS = Object.freeze([3, 2, 1, 'GO!']);

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
  1: Object.freeze(['bomb', 'bomb', 'bomb', 'clock', 'clock']),
  2: Object.freeze(['bomb', 'bomb', 'clock', 'clock', 'megabomb']),
  3: Object.freeze(['clock', 'clock', 'megabomb', 'megabomb', 'freeze', 'freeze', 'bomb']),
});

export function chooseBoardDrop(combo, random = Math.random, { cloverGiven = false } = {}) {
  const streak = Math.max(0, Math.round(Number(combo) || 0));
  const tier = streak >= 21 ? 3 : streak >= 14 ? 2 : 1;
  // Clover is a late-run surprise, not an early seven-combo reward.
  if (streak >= 21 && !cloverGiven && Math.max(0, random()) < 0.15) return BOARD_DROP_ITEMS.clover;
  const pool = BOARD_DROP_POOLS[tier].filter((id) => BOARD_DROP_ITEMS[id]?.implemented);
  if (!pool.length) return null;
  const index = Math.min(pool.length - 1, Math.floor(Math.max(0, random()) * pool.length));
  return BOARD_DROP_ITEMS[pool[index]];
}

export function boardDropReward(previousCombo, nextCombo) {
  const previous = Math.max(0, Math.round(Number(previousCombo) || 0));
  const next = Math.max(0, Math.round(Number(nextCombo) || 0));
  if (Math.floor(next / ITEM_REWARD_INTERVAL) > Math.floor(previous / ITEM_REWARD_INTERVAL)) return 'milestone';
  return null;
}

export function itemRewardCountdown(combo) {
  const streak = Math.max(0, Math.round(Number(combo) || 0));
  const remainder = streak % ITEM_REWARD_INTERVAL;
  return remainder === 0 ? ITEM_REWARD_INTERVAL : ITEM_REWARD_INTERVAL - remainder;
}

export function shouldAdvanceRound(progress, target, hasAnswer) {
  const clears = Math.max(0, Math.round(Number(progress) || 0));
  const required = Math.max(1, Math.round(Number(target) || 1));
  return clears >= required && !hasAnswer;
}

export function boardDropInventoryGrant(type) {
  // Visible board drops are one-tap actions, matching the original OING.
  // Footer inventory is reserved for starting or separately granted items.
  return null;
}

export function comboWindowMsForProgress(round = 1, successCount = 0) {
  const stage = Math.max(1, Math.round(Number(round) || 1));
  const clears = Math.max(0, Math.round(Number(successCount) || 0));
  if (stage === 1 || clears < 8) return 5600;
  if (stage <= 3 || clears < 18) return 4800;
  if (stage <= 5 || clears < 35) return 4100;
  if (clears < 55) return 3500;
  return COMBO_WINDOW_MS;
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
  fail: Object.freeze(['앗, 10이 아니다냥', '조금 아깝다냥', '다시 골라보자냥']),
  hint: Object.freeze(['여기 한번 보라냥!', '이쪽이 수상하다냥!', '반짝이는 칸을 이어보라냥!']),
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
  if (score < 900) return 'resultLow';
  if (score < 2800) return 'resultNormal';
  if (score < 6000) return 'resultHigh';
  return 'resultLegend';
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
    ? 240
    : 240 + (cellCount - 2) * 180 + Math.max(0, cellCount - 3) * 35;
  return Math.round(base * comboMultiplier(combo));
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
