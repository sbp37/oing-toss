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
  bomb: { id: 'bomb', initial: 0, implemented: false, hook: 'useFutureItem', asset: 'assets/icons/items/bomb.webp' },
  clock: { id: 'clock', initial: 0, implemented: false, hook: 'useFutureItem', asset: 'assets/icons/hud/time.webp' },
  freeze: { id: 'freeze', initial: 0, implemented: false, hook: 'useFutureItem', asset: 'assets/icons/items/freeze.webp' },
  clover: { id: 'clover', initial: 0, implemented: false, hook: 'useFutureItem', asset: 'assets/icons/items/clover.webp' },
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

export function getRoundConfig(round) {
  return ROUND_CONFIG[Math.min(Math.max(round, 1), ROUND_CONFIG.length) - 1];
}
