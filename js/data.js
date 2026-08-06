export const GAME_DURATION_SECONDS = 90;
export const COMBO_WINDOW_MS = 3200;

export const ROUND_CONFIG = Object.freeze([
  { round: 1, size: 4, target: 3 },
  { round: 2, size: 5, target: 5 },
  { round: 3, size: 6, target: 7 },
]);

export const ITEM_DEFINITIONS = Object.freeze({
  hint: { id: 'hint', initial: 3, implemented: true, asset: 'assets/icons/items/hint.webp' },
  shuffle: { id: 'shuffle', initial: 2, implemented: true, asset: 'assets/icons/items/shuffle.webp' },
  bomb: { id: 'bomb', initial: 1, implemented: true, asset: 'assets/icons/items/bomb.webp' },
  clock: { id: 'clock', initial: 1, implemented: true, asset: 'assets/icons/hud/time.webp' },
  freeze: { id: 'freeze', initial: 0, implemented: false, hook: 'useFutureItem', asset: 'assets/icons/items/freeze.webp' },
  clover: { id: 'clover', initial: 0, implemented: false, hook: 'useFutureItem', asset: 'assets/icons/items/clover.webp' },
});

// Original OING board drops. Only implemented entries enter the live pool;
// the remaining definitions reserve stable IDs for the next visual passes.
export const BOARD_DROP_ITEMS = Object.freeze({
  bomb: Object.freeze({ id: 'bomb', label: '폭탄', implemented: true, asset: 'assets/icons/items/bomb.webp' }),
  clock: Object.freeze({ id: 'clock', label: '시계', implemented: true, asset: 'assets/icons/hud/time.webp' }),
  megabomb: Object.freeze({ id: 'megabomb', label: '메가폭탄', implemented: false, asset: null }),
  freeze: Object.freeze({ id: 'freeze', label: '타임프리즈', implemented: false, asset: 'assets/icons/items/freeze.webp' }),
  clover: Object.freeze({ id: 'clover', label: '클로버', implemented: false, asset: 'assets/icons/items/clover.webp' }),
  candy: Object.freeze({ id: 'candy', label: '콤보사탕', implemented: false, asset: null }),
});

const BOARD_DROP_POOLS = Object.freeze({
  1: Object.freeze(['bomb', 'bomb', 'bomb', 'clock', 'clock']),
  2: Object.freeze(['bomb', 'bomb', 'clock', 'clock', 'megabomb']),
  3: Object.freeze(['clock', 'clock', 'megabomb', 'megabomb', 'freeze', 'bomb', 'clover']),
});

export function chooseBoardDrop(combo, random = Math.random) {
  const tier = combo >= 21 ? 3 : combo >= 14 ? 2 : 1;
  const pool = BOARD_DROP_POOLS[tier].filter((id) => BOARD_DROP_ITEMS[id]?.implemented);
  if (!pool.length) return null;
  const index = Math.min(pool.length - 1, Math.floor(Math.max(0, random()) * pool.length));
  return BOARD_DROP_ITEMS[pool[index]];
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
  start: Object.freeze(['10을 찾아볼까냥?', '합10, 준비됐지?']),
  firstSuccess: Object.freeze(['오잉! 바로 찾았네!', '딱 10이야!']),
  success: Object.freeze(['좋아!', '깔끔했어!', '바로 그거야!']),
  combo3: Object.freeze(['손이 좀 빠른데?', '콤보가 붙었어!']),
  combo5: Object.freeze(['지금 완전 감 잡았어!', '좋아, 계속 이어가자!']),
  combo8: Object.freeze(['오잉, 멈출 수가 없는데?', '완전 신났다냥!']),
  fail: Object.freeze(['앗, 이건 10이 아니네', '조금 아까웠어', '다시 골라보자!']),
  hint: Object.freeze(['여기 한번 봐봐!', '이쪽이 수상한데?']),
  shuffle: Object.freeze(['한번 섞어볼까?', '새 보드에서 찾아보자!']),
  bomb: Object.freeze(['펑! 시원하게 뚫렸어!', '좋아, 길이 열렸어!']),
  clock: Object.freeze(['시간을 조금 더 챙겼어!', '8초 더 달려보자!']),
  itemDrop: Object.freeze(['아이템이 나왔어! 톡 눌러봐!', '오잉, 선물이 떨어졌어!']),
  round: Object.freeze(['다음 판도 바로 가자!', '좋아, 한 판 더!']),
  lowTime: Object.freeze(['조금만 더!', '시간이 얼마 없어!']),
  resultHigh: Object.freeze(['이번 판 정말 좋았어!', '아주 잘 풀었어!']),
  resultNormal: Object.freeze(['제법 잘했어!', '이번 판 좋았어!']),
  resultLow: Object.freeze(['아깝다, 한 번 더!', '다음 판엔 된다냥!']),
  record: Object.freeze(['새 최고기록이야!', '최고점수 갱신!']),
});

export function pickMessage(type, previous = '') {
  const pool = MESSAGES[type] || MESSAGES.success;
  const candidates = pool.filter((message) => message !== previous);
  const options = candidates.length ? candidates : pool;
  return options[Math.floor(Math.random() * options.length)];
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

export function scoreForBomb(valueSum) {
  return Math.max(0, Math.round(Number(valueSum) || 0)) + 20;
}

export function getRoundConfig(round) {
  return ROUND_CONFIG[Math.min(Math.max(round, 1), ROUND_CONFIG.length) - 1];
}
