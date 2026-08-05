export const GAME_DURATION_SECONDS = 90;
export const COMBO_WINDOW_MS = 2600;

export const ROUND_CONFIG = Object.freeze([
  { round: 1, size: 4, target: 3 },
  { round: 2, size: 5, target: 5 },
  { round: 3, size: 6, target: 7 },
]);

export const ITEM_DEFINITIONS = Object.freeze({
  hint: { id: 'hint', initial: 3, implemented: true, asset: 'assets/icons/items/hint.webp' },
  shuffle: { id: 'shuffle', initial: 2, implemented: true, asset: 'assets/icons/items/shuffle.webp' },
  bomb: { id: 'bomb', initial: 0, implemented: false, hook: 'useFutureItem', asset: 'assets/icons/items/bomb.webp' },
  clock: { id: 'clock', initial: 0, implemented: false, hook: 'useFutureItem', asset: 'assets/icons/hud/time.webp' },
  freeze: { id: 'freeze', initial: 0, implemented: false, hook: 'useFutureItem', asset: 'assets/icons/items/freeze.webp' },
  clover: { id: 'clover', initial: 0, implemented: false, hook: 'useFutureItem', asset: 'assets/icons/items/clover.webp' },
});

export const MESSAGES = Object.freeze({
  start: Object.freeze(['10을 찾아보자냥!', '슥 밀어서 10이다냥!']),
  firstSuccess: Object.freeze(['오잉, 찾았다냥!', '딱 10이다냥!']),
  success: Object.freeze(['좋다냥!', '깔끔하다냥!', '바로 그거다냥!']),
  combo3: Object.freeze(['손이 빠르다냥!', '콤보가 붙었다냥!']),
  combo5: Object.freeze(['감 잡았구냥!', '계속 이어가자냥!']),
  combo8: Object.freeze(['완전 신났다냥!', '콤보가 쭉쭉이다냥!']),
  fail: Object.freeze(['앗, 10이 아니다냥', '조금 아깝다냥', '다시 골라보자냥']),
  hint: Object.freeze(['여기 보라냥!', '이쪽이 수상하다냥!']),
  shuffle: Object.freeze(['한번 섞어보자냥!', '새로 찾아보자냥!']),
  round: Object.freeze(['다음 판도 가자냥!', '더 찾아보자냥!']),
  lowTime: Object.freeze(['조금만 더다냥!', '시간이 얼마 없다냥!']),
  resultHigh: Object.freeze(['이번 판 최고다냥!', '아주 잘 풀었다냥!']),
  resultNormal: Object.freeze(['제법 잘했다냥!', '이번 판 좋았다냥!']),
  resultLow: Object.freeze(['아깝다냥, 한 번 더!', '다음 판엔 된다냥!']),
  record: Object.freeze(['새 기록이다냥!', '최고점수 갱신이다냥!']),
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
  const base = cellCount * 100 + 40;
  return Math.round(base * comboMultiplier(combo));
}

export function getRoundConfig(round) {
  return ROUND_CONFIG[Math.min(Math.max(round, 1), ROUND_CONFIG.length) - 1];
}
