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
// 2026-08 토스 실기기 제보: "자꾸 자기가 먼저 알려주니까 김샌다."
// 6초는 판을 한 번 훑는 시간이라, 아직 찾는 중인 사람에게 답을 들이밀었다.
// 진짜 막혀서 손이 멈춘 순간(10초)으로 올린다.
export const BEGINNER_AUTO_HINT_IDLE_MS = 10000;
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
// Classic scale, matched to the measured skill tiers (fresh-account bots
// and simulation): a first session lands around 1-2k, a settled player
// around 10-15k, a fast one 30-50k. The old 15k/40k/80k were stage-mode
// numbers - under them virtually every classic run fell into the lowest
// pool, which is why the result cat sounded flat no matter how well a run
// went.
// 2026-08 쫄깃함 패스 이후 재보정: carry cap으로 보통 6천, 숙련 1만 중반이
// 새 평균이 됐다. normal은 초보 분포가 그대로라 유지, high는 보통의 잘한
// 판(p85~p90), legend는 숙련의 평균급 판에 맞춘다.
export const RESULT_SCORE_THRESHOLDS = Object.freeze({
  normal: 2000,
  high: 7000,
  legend: 15000,
});

export function recordEligibleForStartStage(stage = 1) {
  return Math.max(1, Math.round(Number(stage) || 1)) === 1;
}

// Main-mode board growth is capped at 6x7, holds every size for two stages,
// and only ever grows in square steps: 4x4, then 5x5 twice, then 6x6 twice,
// then 6x7. The in-between rectangles (4x5, 5x6) are gone — growing a
// rectangle into the next square shrank the board's height on screen, so a
// bigger stage read as a smaller board. A repeated size raises the value
// mix one phase instead, which is the original OING's own difficulty model.
// 7x7+ remains reserved for a future hard mode. `size` doubles as the
// column count for the board generator.
//
// There is deliberately no success target here. A stage ends when its board
// is completely empty — every number and bonus cat cleared — and only then.
export const STAGE_CONFIG = Object.freeze([
  { stage: 1, round: 1, size: 4, cols: 4, rows: 4, timeLimit: 120, bombChance: 0 },
  { stage: 2, round: 2, size: 5, cols: 5, rows: 5, timeLimit: 120, bombChance: 0 },
  { stage: 3, round: 3, size: 5, cols: 5, rows: 5, timeLimit: 120, bombChance: 0 },
  { stage: 4, round: 4, size: 6, cols: 6, rows: 6, timeLimit: 120, bombChance: 0.08 },
  { stage: 5, round: 5, size: 6, cols: 6, rows: 6, timeLimit: 120, bombChance: 0.12 },
  { stage: 6, round: 6, size: 6, cols: 6, rows: 7, timeLimit: 120, bombChance: 0.16 },
  { stage: 7, round: 7, size: 6, cols: 6, rows: 7, timeLimit: 120, bombChance: 0.2 },
  { stage: 8, round: 8, size: 6, cols: 6, rows: 7, timeLimit: 120, bombChance: 0.24 },
  { stage: 9, round: 9, size: 6, cols: 6, rows: 7, timeLimit: 120, bombChance: 0.28 },
  { stage: 10, round: 10, size: 6, cols: 6, rows: 7, timeLimit: 120, bombChance: 0.32 },
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

function boardDropPoolFor(stage, combo, cloverGiven = false, timeBonusCapped = false, lateRun = false) {
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
  // Past the refund-fatigue line the run is supposed to be converging; a
  // clock or a freeze there reopens the time economy the fatigue just
  // closed (measured: they stretched a near-expert run past its simulated
  // ceiling). Board-action items keep dropping - the reward beat stays -
  // but the time-givers stop.
  if (level >= 5 && !timeBonusCapped && !lateRun) pool.push('clock');
  // Reachability pass: across three full instrumented runs (casual to
  // near-perfect pace) freeze and clover never appeared once — the old
  // level>=6 + streak 14/21 gates sat past where most runs end. Megabomb
  // and freeze now open on STAGE 5 and clover's streak halves, so a decent
  // run meets each rare item while the bomb-heavy weighting still keeps
  // board actions dominant (see the late-drop distribution test).
  if (level >= 5 && streak >= 7) pool.push('megabomb', 'megabomb');
  if (level >= 5 && streak >= 10 && !timeBonusCapped && !lateRun) pool.push('freeze');
  if (level >= 6 && streak >= 14 && !cloverGiven) pool.push('clover');
  return pool.filter((id) => BOARD_DROP_ITEMS[id]?.implemented);
}

export function boardDropPoolAfterRepeat(pool = [], previousType = null) {
  const choices = Array.isArray(pool) ? pool.filter(Boolean) : [];
  if (!previousType || !choices.length) return choices;
  const previousWasTimeItem = ['clock', 'freeze'].includes(previousType);
  if (previousType !== 'bomb') {
    const filtered = choices.filter((id) => id !== previousType
      && !(previousWasTimeItem && ['clock', 'freeze'].includes(id)));
    return filtered.length ? filtered : choices;
  }

  const alternatives = choices.filter((id) => id !== 'bomb');
  if (!alternatives.length) return choices;
  const bombCount = choices.length - alternatives.length;
  const reducedBombCount = Math.max(1, Math.ceil(bombCount * 0.45));
  return [
    ...Array.from({ length: reducedBombCount }, () => 'bomb'),
    ...alternatives,
  ];
}

export function chooseBoardDrop(combo, random = Math.random, {
  cloverGiven = false,
  pity = {},
  previousType = null,
  rewardIndex = 0,
  stage = 1,
  timeBonusCapped = false,
  lateRun = false,
} = {}) {
  const streak = Math.max(0, Math.round(Number(combo) || 0));
  const earned = Math.max(0, Math.round(Number(rewardIndex) || 0));
  const level = Math.max(1, Math.round(Number(stage) || 1));
  if (level < 3) return null;
  // The first earned board item always demonstrates the most tactile reward.
  if (earned === 0) return BOARD_DROP_ITEMS.bomb;
  const previousWasTimeItem = ['clock', 'freeze'].includes(previousType);
  if (!cloverGiven && level >= 6 && streak >= 14
    && Math.max(0, pity.clover || 0) >= BOARD_DROP_PITY_LIMITS.clover) {
    return BOARD_DROP_ITEMS.clover;
  }
  if (!timeBonusCapped && !lateRun && !previousWasTimeItem && level >= 5 && streak >= 10
    && Math.max(0, pity.freeze || 0) >= BOARD_DROP_PITY_LIMITS.freeze) {
    return BOARD_DROP_ITEMS.freeze;
  }
  // STAGE 6~7은 메가폭탄을 처음 접하는 보호 구간이다. 자연 드롭 확률은
  // 후반과 동일하게 유지하고 pity만 짧게 둬 regular의 등장 판 비율이
  // 20% 아래로 굶지 않게 한다. STAGE 8+는 긴 pity로 희귀도를 회복한다.
  const megabombPityLimit = level <= 7 ? EARLY_MEGABOMB_PITY_LIMIT : BOARD_DROP_PITY_LIMITS.megabomb;
  if (level >= 5 && streak >= 7
    && Math.max(0, pity.megabomb || 0) >= megabombPityLimit
    && previousType !== 'megabomb') {
    return BOARD_DROP_ITEMS.megabomb;
  }
  const pool = boardDropPoolFor(level, streak, cloverGiven, timeBonusCapped, lateRun);
  if (!pool.length) return null;
  // Rare effects never repeat immediately. Bomb stays possible because it is
  // the core board action, but its weight drops after a bomb so the reward
  // sequence does not feel visually identical for several milestones.
  const choices = boardDropPoolAfterRepeat(pool, previousType);
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
    megabomb: level >= 5 && streak >= 7 ? (type === 'megabomb' ? 0 : previousMega + 1) : previousMega,
    clover: level >= 6 && streak >= 14 ? (type === 'clover' ? 0 : previousClover + 1) : previousClover,
    freeze: level >= 5 && streak >= 10 ? (type === 'freeze' ? 0 : previousFreeze + 1) : previousFreeze,
  });
}

export function boardDropReward(previousCombo, nextCombo) {
  const previous = Math.max(0, Math.round(Number(previousCombo) || 0));
  const next = Math.max(0, Math.round(Number(nextCombo) || 0));
  if (Math.floor(next / ITEM_REWARD_INTERVAL) > Math.floor(previous / ITEM_REWARD_INTERVAL)) return 'milestone';
  return null;
}

// Each seven-combo boundary pays once per run. boardDropReward alone compares
// the two ends of a single step, so a combo that falls back below a boundary
// and climbs over it again re-earns the drop every time — a run that broke
// and rebuilt around 14 could farm the same reward indefinitely.
//
// The rule lives here rather than inline at the call site so it is testable:
// measure the step from the run's high-water mark, never from the current
// combo. A rebuild inside ground the run has already covered pays nothing,
// while the first crossing of each new boundary pays exactly once — including
// when a wide clear jumps two combo in one step.
export function boardDropRewardForRun({
  previousCombo = 0,
  nextCombo = 0,
  bestComboBefore = 0,
} = {}) {
  const floor = Math.max(
    Math.max(0, Math.round(Number(previousCombo) || 0)),
    Math.max(0, Math.round(Number(bestComboBefore) || 0)),
  );
  return boardDropReward(floor, nextCombo);
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

// ── Classic mode (원조 스타일 2분 모드) ──────────────────────────────
// The original OING is one continuous two-minute score attack: a fixed
// board, a board reset with +15s whenever the answers dry up, and a score
// that is literally cells × combo where the combo never times out — only a
// wrong answer cuts it to 70%. These helpers reproduce those rules on the
// original's own number scale, so the mode can be felt side by side with
// the stage ladder without touching the ladder's tuning.
export const CLASSIC_COMBO_CAP = 25;
export const CLASSIC_COMBO_SOFT_RATE = 0.25;
export const CLASSIC_WOW_BONUS_MULTIPLIER_CAP = 4;
export const CLASSIC_TIME_CAP_SECONDS = 300;
// 2026-08 쫄깃함 패스: 판갈이 환급은 시계를 이 선 위로 올리지 못한다.
// 원조의 긴장("시간 쫌만 더!")은 시간을 은행처럼 쌓을 수 없다는 데서
// 왔다. 시작 2분은 그대로라 배우는 구간은 여유롭고, 한 번 이 선 아래로
// 내려오면 런이 끝날 때까지 60초 안쪽에서 논다. 시뮬(프로필별 30판):
// 초보 2.3분 / 보통 2.8분 / 숙련 3.1분, 검수 4종이 권한 "2분대 중심,
// 숙련 3분대"의 정중앙이다. 이미 선 위에 있는 시계를 깎지는 않는다 -
// 환급 직후 시계가 뚝 떨어지는 혼란을 만들지 않기 위해서다.
// 시계·프리즈 아이템은 이 선을 넘겨 벌 수 있다(cappedSessionTime, 120초
// 상한) - 아이템이 "선을 뚫는 프리미엄"이 된다.
// 보상형 광고. 그룹 ID는 토스 콘솔의 인앱 광고 > 광고 그룹에서 만든 값이고,
// 그룹 하나가 보상 하나를 뜻한다(이어하기 20초 / 힌트 1 / 셔플 1).
// 비어 있으면 그 광고 자리는 게임에 아예 나타나지 않는다.
export const AD_GROUP_IDS = Object.freeze({
  continue: 'ait.v2.live.ca1448c32e4a47f3',
  hint: '',
  shuffle: '',
});

// 친구 공유 리워드(토스 콘솔 '공유 리워드'의 UUID). 친구에게 초대장을
// 보낸 만큼 힌트를 받는다. 받은 힌트는 다음 판 시작에 지급된다 - 판 재고는
// 판마다 새로 만들어지므로, 쌓아두는 잔고를 만들지 않기 위해서다.
// 공개 웹 주소. 토스 안에서 만든 공유 링크의 미리보기 그림(og:image)은
// 공개 주소여야 해서, 번들 안의 상대 경로를 이 주소로 바꿔 넘긴다.
export const PUBLIC_SITE_URL = 'https://sbp37.github.io/oing-toss/';

export const SHARE_REWARD_MODULE_ID = '89c3bed0-84a2-4542-91d3-ca383982d4e1';

// TIME UP 이어하기가 주는 시간. 30초는 고수 기준 후반 판 하나를 통째로 더
// 도는 양이라 점수를 20% 넘게 부풀리고, 15초는 6x7 판을 훑는 시간을 빼면
// 답 한둘로 끝나 광고 본 값이 안 나온다. 20초가 그 사이의 균형점이다.
// 판당 1회. 모두에게 무료로 열린 같은 기회라 랭킹 규칙의 일부로 취급한다.
export const AD_CONTINUE_SECONDS = 20;

// 이어하기 제안을 보여주는 시간. 지나면 결과로 넘어간다 - 광고를 볼 생각이
// 없는 사람을 오래 붙잡는 것이 더 나쁘다.
export const AD_CONTINUE_OFFER_MS = 7000;

export const CLASSIC_TIME_CARRY_CAP_SECONDS = 60;
// The board ladder folds the stage mode's onboarding ramp into the classic
// loop itself: two 6×6 learning boards give a first-timer enough visible
// answers without changing the physical tile size after the first clear,
// then one extra row per 판갈이 up to 6×8. Keeping six columns from the
// first board holds the tile width steady while the scan field grows
// downward. With a combo
// that never times out, the small boards are where the multiplier spools
// up and the tall boards are where it pays out — the scan field a player
// earns grows with how deep they got. Each step carries its own 판갈이
// bonus: small boards dry fast, so a flat +15s would turn the opening
// into a time fountain.
// timeFloor is what a board pays for merely drying up; timeBonus is what a
// board pays when it is emptied outright. Everything between is earned in
// proportion to how much of the board the player actually cleared — see
// classicBoardChangeSeconds. A flat refund made "clear it properly" and
// "break a few and move on" worth the same number of seconds, which is
// the one thing a puzzle game cannot afford.
// 2026-08 페이싱 패스: 환급 상한 11/14/19/19 → 10/12/16/16, 바닥 4/5/6/6 →
// 4/5/5/5. 시뮬레이션(프로필별 30~40판)에서 보통 실력의 런이 평균 4.0분,
// 숙련이 6.6분까지 늘어져 "2분 스코어 어택"이라는 약속과 멀어져 있었다.
// 아래 피로 상수와 함께 줄이면 초보 2.5분(변화 없음), 보통 3.5분, 숙련
// 4.5분으로 수렴한다. 판갈이 한 번의 보상이 원조(+15초)보다 약간 작아지는
// 대신, 판갈이 빈도가 원조보다 훨씬 높다는 차이를 흡수한다.
export const CLASSIC_BOARD_LADDER = Object.freeze([
  Object.freeze({ rows: 6, cols: 6, timeFloor: 4, timeBonus: 10 }),
  Object.freeze({ rows: 6, cols: 6, timeFloor: 5, timeBonus: 12 }),
  Object.freeze({ rows: 7, cols: 6, timeFloor: 5, timeBonus: 16 }),
  Object.freeze({ rows: 8, cols: 6, timeFloor: 5, timeBonus: 16 }),
]);

// Seconds the finished board pays out. The ratio is how much of it the
// player cleared, so the last stubborn corner of a 6×8 is worth real time
// and the difference between a tidy finish and a messy one is felt.
// Past the ladder's last scene the night gets stingy: each further 판갈이
// pays half a second less, and no board change ever pays under the floor.
// This is what bounds a run. Below the fatigue line the time economy of a
// fast player is close to balanced, so the 120s buffer can stretch for
// twenty minutes; a slope, however gentle, makes the economy mathematically
// net-negative and every run converges. Tuned by simulation (10 runs per
// cell): a 3.0s-per-move player never reaches the line (3.2min runs,
// unchanged), a 2.0s player grazes it (4.4 to 4.3min), while the 1.2s
// ceiling drops from 19.5min/141k to 6.5min/38k. The floor keeps the
// 판갈이 beat itself alive - a board change that pays nothing reads as a
// punishment, not an event.
// 2026-08 페이싱 패스: 6판/-0.5초 → 5판/-1초 → 5판/-1.5초. 완만한 기울기로는
// 숙련의 시간 경제가 20판 가까이 흑자를 유지해 런이 6분대까지 늘어졌다.
// 1차(-1초)로 숙련 4.5분까지 내렸고, 실기기 확인에서 "길이는 좋은데 고수는
// 아직 늘어질 수 있겠다"는 피드백에 따라 -1.5초로 한 번 더 조였다.
// 시뮬(30판): 숙련 4.5→4.1분(p90 4.3), 초보 2.5분·보통 3.4분은 그대로 —
// 6판 이후에만 작용하는 기울기라 꼬리만 깎인다.
export const CLASSIC_REFUND_FATIGUE = Object.freeze({
  fromBoard: 5,   // boards 1..5 always pay in full
  perBoard: 1.5,  // seconds shaved per board past the line
  floor: 2,       // the least any 판갈이 pays
});

export function classicRefundWithFatigue(seconds, finishedBoardNumber = 1) {
  const paid = Math.max(0, Number(seconds) || 0);
  const past = Math.max(0, Math.round(Number(finishedBoardNumber) || 0) - CLASSIC_REFUND_FATIGUE.fromBoard);
  if (past <= 0) return paid;
  return Math.max(CLASSIC_REFUND_FATIGUE.floor, paid - CLASSIC_REFUND_FATIGUE.perBoard * past);
}

export function classicBoardChangeSeconds(board, clearedRatio = 0) {
  const floor = Math.max(0, Number(board?.timeFloor) || 0);
  const ceiling = Math.max(floor, Number(board?.timeBonus) || 0);
  const ratio = Math.min(1, Math.max(0, Number(clearedRatio) || 0));
  return Math.round(floor + (ceiling - floor) * ratio);
}

export function classicBoardForIndex(boardIndex = 0) {
  const index = Math.max(0, Math.round(Number(boardIndex) || 0));
  return CLASSIC_BOARD_LADDER[Math.min(index, CLASSIC_BOARD_LADDER.length - 1)];
}

const CLASSIC_CAT_BONUS_RULE = Object.freeze({
  id: 'cat-double',
  catMultiplier: 2,
  message: '고양이 보너스 판이다냥!',
});

// One readable twist at a time: every fourth board doubles the existing
// cat target. The first three boards remain the plain learning ramp, and
// the fixed cadence makes the rule feel earned rather than random.
export function classicBoardRuleForIndex(boardIndex = 0) {
  const index = Math.max(0, Math.round(Number(boardIndex) || 0));
  return (index + 1) % 4 === 0 ? CLASSIC_CAT_BONUS_RULE : null;
}

export function classicComboGain(cellCount) {
  return Math.round(Number(cellCount) || 0) >= 5 ? 3 : 1;
}

// A hard cap at 25 meant a skilled run spent most of its length with the
// combo doing nothing — the HUD read ×74 while the maths used 25, and the
// WOW bonus was decoration. Past the cap each combo is still worth a
// quarter of one, so the ceiling keeps runaway scores in check while the
// number on screen never stops mattering.
export function classicComboMultiplier(combo) {
  const value = Math.max(1, Math.round(Number(combo) || 0));
  return Math.min(value, CLASSIC_COMBO_CAP)
    + Math.max(0, value - CLASSIC_COMBO_CAP) * CLASSIC_COMBO_SOFT_RATE;
}

// Above the cap a 30% cut was free — 36×0.7 still lands on 25.2, so a
// mistake cost a strong player literally nothing. It halves up there
// instead. Below the cap the original's 30% stands, because that is where
// a learner lives and where the penalty already stings.
export function classicComboAfterFailure(combo) {
  const value = Math.max(0, Math.round(Number(combo) || 0));
  return Math.floor(value * (value > CLASSIC_COMBO_CAP ? 0.5 : 0.7));
}

// The original core stays intact: (cells + cats×5) × combo. A five-cell-plus
// WOW used to add a flat +10 per extra cell, so the biggest visual moment
// became rounding error once the multiplier climbed. Its bonus now follows
// 15% of the live multiplier and caps at x4: clearly worth hunting, but never
// large enough to replace the combo economy or blow up the score scale.
export function classicWowBonusMultiplier(combo) {
  const multiplier = classicComboMultiplier(combo);
  return Math.min(
    CLASSIC_WOW_BONUS_MULTIPLIER_CAP,
    1 + Math.max(0, multiplier - 1) * 0.15,
  );
}

export function classicScoreForClear(cellCount, catCount, combo) {
  const cells = Math.max(0, Math.round(Number(cellCount) || 0));
  const cats = Math.max(0, Math.round(Number(catCount) || 0));
  const wideBonus = cells >= 5
    ? Math.round((cells - 4) * 10 * classicWowBonusMultiplier(combo))
    : 0;
  return Math.round((cells + cats * 5) * classicComboMultiplier(combo) + wideBonus);
}

// Bombs pay on the same scale as a clear so an item never reads as a
// different currency, minus the WOW bonus — a blast is not a found answer.
export function classicScoreForBlast(cellCount, catCount, combo) {
  const cells = Math.max(0, Math.round(Number(cellCount) || 0));
  const cats = Math.max(0, Math.round(Number(catCount) || 0));
  return Math.round((cells + cats * 5) * classicComboMultiplier(combo));
}

// Each 판갈이 deepens the number mix one step: the first board draws the
// mid-run bag (round 5), then +1 per board up to the deepest (round 10).
export function classicRoundForBoard(boardIndex = 0) {
  return Math.min(10, 5 + Math.max(0, Math.round(Number(boardIndex) || 0)));
}

// ── 고양이의 모험 (classic chapters) ──────────────────────────────────
// The hidden picture behind the board is one leg of a journey, and the
// journey is the run: every third 판갈이 moves the cat to the next scene,
// so how far a player got is something they *saw*, not just a number. The
// last scene is score-gated instead — a place only a high score reaches.
// 2026-08 실기기 피드백: 판갈이마다 장면이 바뀌던 때는 몇 판만 해도 여섯
// 장면이 다 열려 수집이 끝나 버렸다. 세 판에 한 장면이면 보통 실력의 첫
// 런이 두세 장면, 여섯 장면 완주는 여러 세션에 걸친다 — 모으는 재미가
// 남는다. fromBoard는 그 장면이 처음 걸리는 boardIndex다.
// `art` is the asset stem; a scene whose file is not in place yet simply
// falls back to the original garden painting (see the chapter background
// rules in play-layout-v1.css), so chapters can ship art one at a time.
// Display order and album ownership are deliberately separate. The board
// walks this six-scene loop forever, while the album stores stable scene
// keys and therefore never re-locks a picture when the display wraps.
// 2026-08 2차: 3판에 한 장면도 여전히 빨랐다. 실측(판당 도달 판 수 초보
// 3.4 / 보통 7.9 / 숙련 13.9)으로 보면 보통이 첫 런에 장면 넷을 열어버린다.
// 네 판에 한 장면이면 첫 런은 둘, 일곱 장 완주는 서너 런에 걸린다.
export const CLASSIC_CHAPTER_BOARDS_PER_SCENE = 4;

export const CLASSIC_CHAPTERS = Object.freeze([
  Object.freeze({ key: 'garden', label: '비밀의 정원', fromBoard: 0, art: 'chapter-garden', hasArt: true }),
  Object.freeze({ key: 'forest', label: '이끼 숲길', fromBoard: 3, art: 'chapter-forest', hasArt: true }),
  Object.freeze({ key: 'stream', label: '반짝이는 개울', fromBoard: 6, art: 'chapter-stream', hasArt: true }),
  Object.freeze({ key: 'village', label: '고양이 마을', fromBoard: 9, art: 'chapter-village', hasArt: true }),
  Object.freeze({ key: 'sunset', label: '노을 언덕', fromBoard: 12, art: 'chapter-sunset', hasArt: true }),
  Object.freeze({ key: 'night', label: '별밤 지붕', fromBoard: 15, art: 'chapter-night', hasArt: true }),
]);

// Reaching a scene is not collecting it - the album asks for the board to
// actually be opened up. But the bar has to sit BELOW where a board
// naturally dies: boards dry up with no answers left at roughly 63-73%
// cleared (simulated novice to expert means), so the original 0.8 was
// above what normal play can reach - fresh-account QA bots finished their
// first session with zero cards, and an expert bot missed three of the
// one-shot mid scenes across 23 boards. At 0.6 an ordinary dried board
// collects and a badly abandoned one does not.
export const CLASSIC_CHAPTER_COLLECT_RATIO = 0.6;

export function classicChapterCollected(clearedRatio = 0) {
  return (Number(clearedRatio) || 0) >= CLASSIC_CHAPTER_COLLECT_RATIO;
}

// A scene goes live in two steps: drop assets/backgrounds/<art>.webp, then
// flip its hasArt to true. Until then the board falls back to the garden
// painting and never requests the missing file.
export function classicChapterArtUrl(chapter) {
  return chapter?.hasArt && chapter.art ? `assets/backgrounds/${chapter.art}.webp` : null;
}

// The album shows all seven scenes at once, so it reads a downscaled twin
// rather than seven full paintings. Null until the art actually ships, which
// is what lets the card fall back to its placeholder.
export function classicChapterThumbUrl(chapter) {
  return chapter?.hasArt && chapter.art ? `assets/backgrounds/thumbs/${chapter.art}.webp` : null;
}

// Reached by score alone, so it stays visible as a goal for players who
// already know every scene the ladder can show them.
// 보통의 잘한 판(p90 부근)에 맞춘다. 점수 경제가 바뀔 때마다 같은 자리로
// 따라간다: 15,000 → 10,000 → (쫄깃함 패스) 8,000.
export const CLASSIC_SECRET_CHAPTER = Object.freeze({
  key: 'aurora',
  label: '오로라 항구',
  minScore: 8000,
  art: 'chapter-aurora',
  hasArt: true,
});

// The first 6×6 board is a learning ramp with a gentler number mix and
// refund. A personal best buys the right to start further in; this is the
// only progress in the game that survives a run ending.
export const CLASSIC_START_UNLOCKS = Object.freeze([
  Object.freeze({ boardIndex: 1, minScore: 1500 }),
  Object.freeze({ boardIndex: 2, minScore: 4000 }),
]);

export function classicStartBoardIndex(bestScore = 0) {
  const best = Math.max(0, Math.round(Number(bestScore) || 0));
  let index = 0;
  for (const unlock of CLASSIC_START_UNLOCKS) {
    if (best >= unlock.minScore) index = unlock.boardIndex;
  }
  return index;
}

// Board drops ramp with depth rather than with the number mix, so an
// unlocked start does not hand out late-run rarities on its first board.
export function classicDropStage(boardIndex = 0) {
  return Math.min(10, 3 + Math.max(0, Math.round(Number(boardIndex) || 0)));
}

export function classicChapterForBoard(boardIndex = 0) {
  const index = Math.max(0, Math.round(Number(boardIndex) || 0));
  const scene = Math.floor(index / CLASSIC_CHAPTER_BOARDS_PER_SCENE);
  return CLASSIC_CHAPTERS[scene % CLASSIC_CHAPTERS.length];
}

// One row per scene for the gallery: unlocked once its board has actually
// been cleared to the collect ratio (the ladder chapters) or once the score
// bar is cleared (the secret one).
export function classicChapterGallery({ seenKeys = [], bestScore = 0 } = {}) {
  const seen = new Set(seenKeys);
  const best = Math.max(0, Math.round(Number(bestScore) || 0));
  const ladder = CLASSIC_CHAPTERS.map((chapter) => ({
    ...chapter,
    unlocked: seen.has(chapter.key),
    requirement: `${chapter.fromBoard + 1}번째 판 ${Math.round(CLASSIC_CHAPTER_COLLECT_RATIO * 100)}%`,
    secret: false,
  }));
  return [...ladder, {
    ...CLASSIC_SECRET_CHAPTER,
    fromBoard: null,
    unlocked: best >= CLASSIC_SECRET_CHAPTER.minScore,
    requirement: `${CLASSIC_SECRET_CHAPTER.minScore.toLocaleString('ko-KR')}점`,
    secret: true,
  }];
}

// 오잉 카드 - 판이 아니라 "플레이한 행동"으로 모으는 수집물.
//
// 아홉 장 중 점수로 잠기는 것은 딱 두 장이다. 점수는 실력 천장이라, 캐주얼한
// 사람은 아무리 오래 해도 못 넘을 수 있다. 그러면 그 카드는 "언젠가 얻을 것"이
// 아니라 "못 얻는 것"이 된다. 나머지 일곱 장은 느려도 반드시 도달하는
// 누적·출석 조건에 묶어, 오래 한 사람이 반드시 보상받게 했다.
//
// goal은 봇으로 실제 클래식 판을 돌려 잰 판당 평균에서 뽑았다
// (초보 154칸·5칸+ 11회·고양이 6.5 / 보통 680·58·20.5 / 고수 2090·238·67.5).
// 근거와 재현 방법은 HANDOFF.md에 있다.
//
// art는 그림 파일 이름이다. 파일명이 카드 key와 다른 것은, 그림을 그린 쪽의
// 이름을 그대로 두는 편이 나중에 원본을 찾기 쉽기 때문이다. 05와 09의 파일명에
// 남은 20000/30000은 문턱을 정하기 전에 붙은 이름이고, 그림 안에는 숫자가
// 없으므로 조건과 어긋나지 않는다.
export const OING_CARDS = Object.freeze([
  Object.freeze({ key: 'first-run', label: '첫 걸음', art: 'card-01-first-run-v1', hasArt: true,
    metric: 'runs', goal: 1, requirement: '첫 판 끝내기' }),
  Object.freeze({ key: 'ten-runs', label: '단골 손님', art: 'card-02-ten-runs-v1', hasArt: true,
    metric: 'runs', goal: 10, requirement: '10판 플레이' }),
  Object.freeze({ key: 'cats-300', label: '고양이 친구', art: 'card-03-hundred-cats-v1', hasArt: true,
    metric: 'cats', goal: 300, requirement: '고양이 300마리' }),
  Object.freeze({ key: 'big-300', label: '시원한 손', art: 'card-04-big-clears-v1', hasArt: true,
    metric: 'bigClears', goal: 300, requirement: '5칸 이상 한 번에 300번' }),
  Object.freeze({ key: 'score-4000', label: '반짝이는 기록', art: 'card-05-score-20000-v1', hasArt: true,
    metric: 'bestScore', goal: 4000, requirement: '한 판 4,000점' }),
  Object.freeze({ key: 'days-7', label: '일주일 개근', art: 'card-06-seven-days-v1', hasArt: true,
    metric: 'playDays', goal: 7, requirement: '서로 다른 7일 플레이' }),
  Object.freeze({ key: 'cells-20000', label: '대청소', art: 'card-07-cells-20000-v1', hasArt: true,
    metric: 'cellsCleared', goal: 20000, requirement: '지운 칸 20,000개' }),
  Object.freeze({ key: 'days-30', label: '한 달의 친구', art: 'card-08-thirty-days-v1', hasArt: true,
    metric: 'playDays', goal: 30, requirement: '서로 다른 30일 플레이' }),
  Object.freeze({ key: 'score-10000', label: '오잉 고수', art: 'card-09-score-30000-v1', hasArt: true,
    metric: 'bestScore', goal: 10000, requirement: '한 판 10,000점' }),
]);

// 카드는 두 벌로 나눠 쓴다. 격자에는 썸네일만 깔고, 원본은 눌러서 크게 볼 때만
// 받는다. 아홉 장이 한꺼번에 뜨는 자리에 원본을 깔면 기록 창을 열 때마다
// 1.4MB를 받게 된다.
export function oingCardArtUrl(card) {
  return card?.hasArt && card.art ? `assets/cards/${card.art}.webp` : null;
}

export function oingCardThumbUrl(card) {
  return card?.hasArt && card.art ? `assets/cards/thumbs/${card.art}.webp` : null;
}

// 아직 못 얻은 카드는 전부 같은 뒷면 한 장을 쓴다. 한 번 받으면 브라우저가
// 아홉 칸 모두에 다시 쓰므로 요청도 한 번뿐이다.
// 뒷면 그림이 저장소에 들어오면 이 값을 true로 바꾼다. 없는 파일을 참조하면
// 잠긴 칸마다 404가 나므로, 그림보다 코드가 먼저 들어오는 순서를 견디게 한다.
export const OING_CARD_BACK_READY = true;

// 진행도를 함께 돌려주는 이유: 참고한 수집형 게임들처럼 "6/9"가 보여야
// 다음 한 장이 손에 닿는 것처럼 느껴진다. 잠긴 칸이 그냥 회색이면 목표가
// 아니라 벽으로 읽힌다.
export function oingCardRows(totals = {}) {
  const value = (metric) => Math.max(0, Math.round(Number(totals[metric]) || 0));
  return OING_CARDS.map((card) => {
    const current = value(card.metric);
    const unlocked = current >= card.goal;
    return {
      ...card,
      current: Math.min(current, card.goal),
      unlocked,
      progress: card.goal > 0 ? Math.min(1, current / card.goal) : 0,
    };
  });
}

// 이번 판에 새로 열린 카드는 "판 시작 때 열려 있던 목록"과 "지금 목록"의
// 차집합이다. 카드마다 획득 플래그를 따로 저장하지 않는 이유가 여기에 있다 -
// 저장해두면 조건을 손보는 순간 이미 열린 카드와 어긋나기 시작하고, 갤러리와
// 결과 화면이 서로 다른 말을 하게 된다. 판정은 언제나 누적값 하나에서 나온다.
//
// 돌려주는 fresh는 OING_CARDS 순서를 그대로 따르므로 마지막 원소가 가장
// 어려운 조건의 카드다. 결과 화면은 그 한 장을 크게 보여준다.
export function newlyUnlockedOingCards(totals = {}, previousKeys = []) {
  const before = new Set(previousKeys);
  const rows = oingCardRows(totals);
  const unlocked = rows.filter((card) => card.unlocked);
  return {
    fresh: unlocked.filter((card) => !before.has(card.key)),
    unlockedCount: unlocked.length,
    total: rows.length,
  };
}

// The deepest scene a player has actually reached — the home card's one-line
// answer to "how far did the cat get?".
export function classicDeepestChapterLabel({ seenKeys = [], bestScore = 0 } = {}) {
  const gallery = classicChapterGallery({ seenKeys, bestScore });
  const unlocked = gallery.filter((chapter) => chapter.unlocked);
  return unlocked.length ? unlocked.at(-1).label : '모험 시작 전';
}

export function classicTimeAfterBoardChange(timeLeft = 0, bonusSeconds = 15) {
  const current = Math.max(0, Number(timeLeft) || 0);
  const bonus = Math.max(0, Number(bonusSeconds) || 0);
  // 환급은 carry cap 위로는 못 올린다. 이미 위라면 그대로 둔다(위 주석).
  return Math.max(current, Math.min(current + bonus, CLASSIC_TIME_CARRY_CAP_SECONDS));
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

// The stage-entry card is one line of plain text, like the original's
// board-change pop — the stage number is the only information a transition
// needs to convey. Everything else (unlocks, bonuses) announces itself when
// it actually happens.
export function stageIntroForStage(stage = 1) {
  const level = Math.max(1, Math.round(Number(stage) || 1));
  return Object.freeze({ title: `STAGE ${level}` });
}

// The single source of truth for "did this success cross a combo
// milestone" — 3, 5, 8, then every 8 (16, 24, 32, ...). Both the success
// feedback rank and the combo banner call this, so they can never disagree
// about which clears count as a milestone. A wide clear can gain two combo
// in one step, so this checks whether a boundary sits strictly between the
// two values, not whether nextCombo lands exactly on one; when a jump spans
// several boundaries at once (in principle, not in current play), the
// highest one crossed is reported, since that is the moment worth
// celebrating.
// How much of the board a run has cleared at once, as a percentage of the
// board's total cells. Pulled out as a pure function (rather than reading
// `this.model` inline) so the reveal math — and the "best never falls"
// guarantee below — can be tested without a DOM.
export function gardenRevealPercent(clearedCells, totalCells) {
  const total = Math.max(0, Math.round(Number(totalCells) || 0));
  if (total <= 0) return 0;
  const cleared = Math.max(0, Math.min(total, Math.round(Number(clearedCells) || 0)));
  return Math.round((cleared / total) * 100);
}

// A run's garden-reveal record can only climb, the same way a high score
// can only climb: a weaker clear later in the run must not overwrite a
// stronger one from earlier.
export function nextGardenRevealBest(previousBest, percent) {
  const previous = Math.max(0, Math.min(100, Math.round(Number(previousBest) || 0)));
  const next = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  return Math.max(previous, next);
}

// Drops worth taking the lead of a success moment. Bomb and clock are the
// everyday rewards; these three are the ones a player should stop and look
// at, so they outrank an ordinary combo-7 drop in successFeedbackLevel.
export const RARE_BOARD_DROP_IDS = Object.freeze(['megabomb', 'freeze', 'clover']);

// 희귀 아이템이 보드에 처음 나타난 그 한 번만 읽어주는 줄.
//
// 폭탄과 시계는 눌러보면 뭘 하는지 바로 알지만, 이 셋은 눌렀을 때 일어나는
// 일이 화면 밖(시간, 다음 점수)에 있어서 처음 본 사람은 그냥 지나친다.
// 그렇다고 판을 멈추고 설명하면 2분짜리 판에서 시간을 빼앗는 셈이라,
// 기존 토스트 한 줄로 흘려보내고 다시는 말하지 않는다.
export const RARE_BOARD_ITEM_INTROS = Object.freeze({
  megabomb: '메가폭탄! 주변을 크게 터뜨려!',
  freeze: '타임프리즈! 잠깐 시간이 멈춰!',
  clover: '클로버! 다음 점수 보너스!',
});

// 처음 보는 것만 골라낸다. 배치가 한 번에 여러 종류를 놓아도 한 줄만
// 내보내는 판단은 부르는 쪽이 한다 - 판을 멈추지 않는 것이 우선이다.
export function unseenRareBoardItemTypes(placedTypes = [], seenTypes = []) {
  const seen = new Set(seenTypes);
  const out = [];
  for (const type of placedTypes) {
    if (!RARE_BOARD_ITEM_INTROS[type]) continue;
    if (seen.has(type) || out.includes(type)) continue;
    out.push(type);
  }
  return out;
}

// The original OING's one signature moment: five or more cells in a single
// sum-ten clear earns the big centred "WOW!" and its fanfare. Four-cell
// clears already pay a wide-clear bonus and a double combo step, but five is
// where the original stopped the screen, and that threshold is what makes it
// feel earned rather than routine.
export function isWowClear(cellCount) {
  return Math.max(0, Math.round(Number(cellCount) || 0)) >= 5;
}

// One step below WOW. Measured over the live generator, four-cell clears are
// 4-19% of a stage's moves while five-plus stay at 0-4%, so four is frequent
// enough to reward the hunt for a wider shape and rare enough that marking it
// still means something. It is deliberately a different kind of feedback, not
// a smaller WOW: a tag on the score pop where the clear happened, no centred
// card and no fanfare, so five cells keeps the screen-stopping moment alone.
export function isNiceClear(cellCount) {
  return Math.max(0, Math.round(Number(cellCount) || 0)) === 4;
}

// LEVEL 5 board emptied · 4 WOW or rare item · 3 combo milestone
// or an ordinary drop · 2 cat bonus · 1 plain clear. Higher ranks own the
// frame for a success; lower-ranked flourishes (the "딱 10!" pop, the combo
// banner) stand down for whichever rank actually applies. This is a pure
// function specifically so the ranking and the combo banner's milestone
// check can share one answer — comboMilestone here must already be
// comboMilestoneCrossed's result, not recomputed.
export function successFeedbackLevel({
  emptiesBoard = false,
  wow = false,
  earnedDrop = null,
  comboMilestone = 0,
  catCount = 0,
} = {}) {
  if (emptiesBoard) return 5;
  const rareDrop = Boolean(earnedDrop) && RARE_BOARD_DROP_IDS.includes(earnedDrop.id);
  if (wow || rareDrop) return 4;
  if (comboMilestone || earnedDrop) return 3;
  if (catCount > 0) return 2;
  return 1;
}

export function comboMilestoneCrossed(previousCombo, nextCombo) {
  const previous = Math.max(0, Math.round(Number(previousCombo) || 0));
  const next = Math.max(previous, Math.round(Number(nextCombo) || 0));
  if (next > 8) {
    const previousBand = Math.floor(Math.max(previous, 8) / 8);
    const nextBand = Math.floor(next / 8);
    if (nextBand > previousBand) return nextBand * 8;
  }
  return [8, 5, 3].find((milestone) => previous < milestone && next >= milestone) || 0;
}

export function itemRewardCountdown(combo, stage = 1) {
  return itemRewardStatus(combo, combo, stage).remaining;
}

export function itemRewardStatus(combo, bestCombo = 0, stage = 1) {
  if (Math.max(1, Math.round(Number(stage) || 1)) < 3) {
    return Object.freeze({ remaining: 0, progress: 0, target: 0 });
  }
  const current = Math.max(0, Math.round(Number(combo) || 0));
  const highWater = Math.max(current, Math.max(0, Math.round(Number(bestCombo) || 0)));
  const target = (Math.floor(highWater / ITEM_REWARD_INTERVAL) + 1) * ITEM_REWARD_INTERVAL;
  const remaining = Math.max(1, target - current);
  const progress = Math.max(0, (ITEM_REWARD_INTERVAL - Math.min(ITEM_REWARD_INTERVAL, remaining))
    / ITEM_REWARD_INTERVAL);
  return Object.freeze({ remaining, progress, target });
}

// A stage ends when — and only when — its board is completely empty. Running
// out of answers while cells remain never ends a stage any more: that case
// triggers the rescue shuffle instead, so the player never sees a board
// taken away with tiles still on it.
export function shouldAdvanceRound({ boardEmpty = false } = {}) {
  return Boolean(boardEmpty);
}

export const shouldAdvanceStage = shouldAdvanceRound;

// True when the board is stuck but not finished: numbers remain and none of
// them make ten. The caller answers with a rescue shuffle, not a transition.
export function needsRescueShuffle({ hasAnswer = false, boardEmpty = false } = {}) {
  return !boardEmpty && !hasAnswer;
}

// Running out of tens is the normal way a stage ends — the rule, not an
// assist. Once this share of the board's starting playable cells is gone
// and no legal answer remains, the stage simply completes and the
// leftover tiles are cleaned up by the transition. Progress-based, so it
// means the same thing on a 4x4 and a 6x7.
export const NORMAL_CLEAR_MIN_PROGRESS = 0.78;

// Learning stages must not meet the rescue shuffle: measured dry-outs on
// stages 1-2 cluster at 60-77% progress, so those two stages end normally
// from 60% on — a beginner's board finishing beats a beginner's board
// reshuffling. From stage 3 the standard line applies.
export function normalClearThresholdForStage(stage = 1) {
  return Math.max(1, Math.round(Number(stage) || 1)) <= 2 ? 0.6 : NORMAL_CLEAR_MIN_PROGRESS;
}

// How a stage step resolves once a selection settles:
//  'advance'  — the player emptied the board (PERFECT when unassisted);
//  'continue' — answers remain, play on;
//  'normal'   — no answer left and enough of the board is cleared (or the
//               stage already spent its one rescue): the stage ends,
//               leftovers vanish as part of the transition — not PERFECT,
//               not a failure, just how a stage finishes;
//  'rescue'   — no answer while the board is still young, at most once
//               per stage.
export function stageEndDecision({
  hasAnswer = false, boardEmpty = false, remaining = 0, initialPlayable = 0,
  stageRescues = 0, threshold = NORMAL_CLEAR_MIN_PROGRESS,
} = {}) {
  if (boardEmpty) return 'advance';
  if (hasAnswer) return 'continue';
  const cleared = initialPlayable > 0 ? 1 - remaining / initialPlayable : 1;
  if (cleared >= threshold) return 'normal';
  return stageRescues === 0 ? 'rescue' : 'normal';
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

// Classic runs are one continuous clock rather than a 40s stage, so the
// stage-mode window above never opens. A beginner here gets the same help
// on the same idle trigger, capped per run so it teaches without solving
// the game: whenever they stall, the cat points at an answer.
export const CLASSIC_AUTO_HINT_LIMIT = 2;
export const CLASSIC_AUTO_HINT_COOLDOWN_MS = 30000;
// 2026-08 실기기 피드백: "내가 찾을 수 있는데 알려줘서 김샌다."
// 3.2초는 꼬리 판을 훑는 시간도 안 된다 - 아직 읽는 중인 사람에게 답을
// 들이미는 길이였다. 진짜 막힌 순간(7초)으로 올린다. 같은 판 재발화도
// 9초에서 14초로 늘려, 한 판에 두 번 이상 나오는 일이 드물어진다.
// 짝을 이루는 수정이 game.js에 있다: 드래그를 시작하거나 답을 낼 때마다
// lastInteractionAt을 갱신한다. 그 전에는 idleMs가 "마지막 힌트 이후
// 시간"이라, 열심히 지우는 중에도 시계가 계속 흘러 힌트가 떴다.
export const CLASSIC_SPARSE_HINT_IDLE_MS = 11000;

export function shouldShowClassicAutoHint({
  running = false, inputLocked = false, tutorialActive = false,
  shownCount = 0, sinceLastMs = Infinity, timeLeft = 0, idleMs = 0,
  bestScore = 0, completedRuns = 0,
  boardIndex = 0, lastShownBoard = -1,
} = {}) {
  const isBeginner = Math.max(0, completedRuns) < 3
    || Math.max(0, Number(bestScore) || 0) < BEGINNER_AUTO_HINT_SCORE_CEILING;
  // 한 판에 한 번. 이게 유저와의 약속이다 - 이 판에서 이미 도왔으면
  // 아무리 오래 멈춰 있어도 다시 나서지 않는다.
  const firstOnThisBoard = Math.round(Number(boardIndex) || 0)
    !== Math.round(Number(lastShownBoard) || 0);
  return Boolean(running) && !inputLocked && !tutorialActive && isBeginner
    && firstOnThisBoard
    && Math.max(0, shownCount) < CLASSIC_AUTO_HINT_LIMIT
    && sinceLastMs >= CLASSIC_AUTO_HINT_COOLDOWN_MS
    && timeLeft > 8
    && idleMs >= BEGINNER_AUTO_HINT_IDLE_MS;
}

// A nearly-cleared classic board can still contain a valid answer whose
// digits are visually isolated by large picture windows. This is not a
// beginner rule: after a short, genuine stall, every player may receive one
// quiet pointer per board. It never shuffles or solves the board for them.
//
// 2026-08 실측 보강: 꼬리 구간(잔여 40% 이하)에서 인접 두 칸 답이 남아 있는
// 수는 26%뿐이다(초반 100%). 남은 절반이 빈칸 건너 답이나 2D 박스라, 판당
// 1회로는 그 수색 노동의 절반도 못 덮었다. 그래서 같은 판에서도 다시 켤 수
// 있게 하되, 그 재발화는 읽기 쉬운 답(adjacent-pair/near-triple/small-2d,
// board.js answerReadabilityClass 기준)이 하나도 없고 쿨다운이 지난 때로
// 한정한다. bestReadability 기본값이 easy인 이유: 호출자가 가독성을 재지
// 않으면 재발화는 절대 일어나지 않아야 안전하다.
// 같은 판 재발화를 껐다(Infinity). 꼬리 구간의 수색 노동을 덜어주려던
// 장치였는데, 실기기에서는 "한 판에 두 번씩 나온다"로 체감됐다. 한 판에
// 한 번이라는 약속이 훨씬 중요하다. 꼬리가 정말 안 풀리면 힌트 아이템이
// 있고, 그건 유저가 스스로 고르는 것이다.
export const CLASSIC_SPARSE_HINT_REPEAT_MS = Infinity;

export function shouldShowClassicSparseHint({
  running = false, inputLocked = false, tutorialActive = false,
  boardIndex = 0, lastShownBoard = -1, timeLeft = 0, idleMs = 0,
  remaining = 0, initialPlayable = 0,
  bestReadability = 'adjacent-pair', sinceLastShownMs = Infinity,
} = {}) {
  const initial = Math.max(1, Math.round(Number(initialPlayable) || 0));
  const left = Math.max(0, Math.round(Number(remaining) || 0));
  const sparseLimit = Math.min(12, Math.ceil(initial * 0.38));
  const firstOnThisBoard = Math.round(Number(boardIndex) || 0) !== Math.round(Number(lastShownBoard) || 0);
  const hardTail = ['spaced-pair', 'large'].includes(String(bestReadability));
  const repeatDue = hardTail && sinceLastShownMs >= CLASSIC_SPARSE_HINT_REPEAT_MS;
  return Boolean(running) && !inputLocked && !tutorialActive
    && (firstOnThisBoard || repeatDue)
    && timeLeft > 6
    && idleMs >= CLASSIC_SPARSE_HINT_IDLE_MS
    && left >= 2
    && left <= sparseLimit;
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
  // Non-growth clears used to pay nothing, which made STAGE 4 the run's
  // dead stretch (rising target, no time back) and killed STAGE 6+ as a
  // countdown nobody outruns: an instrumented near-perfect run still died
  // on STAGE 7. A small flat bonus keeps clears feeling rewarded and lets
  // strong runs actually reach the late-stage content; the 120s session
  // cap still bounds total run length.
  if (!grew) return current.stage >= 3 ? 4 : 0;
  // The one-axis ladder grows in small steps (+4~6 cells), so each growth
  // pays the small bonus; a big jump (a future mode, or a config change back
  // to two-axis growth) still earns the full ten. Scaling by the actual step
  // keeps total refill time bounded now that growth happens five times.
  return next.cols * next.rows - current.cols * current.rows >= 9 ? 10 : 6;
}

export function stageClearBonus(stage = 1, timeLeft = 0, perfect = false) {
  const level = Math.max(1, Math.round(Number(stage) || 1));
  const time = Math.max(0, Math.floor(Number(timeLeft) || 0));
  return scaled(220 + level * 35 + Math.min(180, time * 2) + (perfect ? 120 : 0));
}

// The clock existed on three separate paths — a special tile baked into the
// board, a one-tap board drop, and the banked dock item — for one +5s
// effect. The special tile was the one nobody met: its chance runs 1.5-5%
// per board, which measured at 0.08 appearances per run, or roughly one
// sighting every twelve games. It is retired here, leaving the two paths
// that actually differ: found-and-spent now, or banked for later.
//
// The special bomb tile stays. It reads as the same kind of thing but the
// numbers disagree: at 8-32% per board it shows up 0.55 times a run and
// climbs late, and unlike the one-tap drop it rewards folding the tile into
// a match. `clockChance` is gone from the stage table along with the tile
// badge, its aria copy and the board's placement filter, so nothing in the
// codebase still implies a clock can be baked into the grid.
export function specialTilePlanForStage(stage = 1, random = Math.random) {
  const config = getStageConfig(stage);
  const plan = [];
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
  hint: Object.freeze(['여기 한번 봐봐!', '이쪽이 수상한데?', '반짝이는 칸을 봐라냥!']),
  autoHint: Object.freeze(['막혔냥? 여기 봐보라냥!', '반짝이는 칸을 보라냥!']),
  adContinue: Object.freeze(['20초 더 간다냥!', '한 번 더 달려보자냥!']),
  // 판이 열릴 때의 출발 안내. 정답을 알려주는 말이 아니라 조작을 가르치는
  // 말이어야 한다 - 초기 오잉의 '슥 밀거나, 양끝을 톡톡!' 자리다.
  openingGift: Object.freeze([
    '노란 두 칸을 슥 이어봐라냥!',
    '이렇게 슥 밀면 된다냥!',
    '노란 칸끼리 이어보라냥. 이게 기본이다냥!',
  ]),
  perfect: Object.freeze(['퍼펙트! 안 막혔다냥!', '싹 비웠다냥, 최고다냥!']),
  rescue: Object.freeze(['막혔네, 섞어줄게냥!', '잠깐, 판 좀 다듬는다냥!', '요렇게 섞으면 된다냥!']),
  shuffle: Object.freeze(['판 좀 뒤집어볼까냥?', '숫자들 자리 바꾼다!', '내가 한번 섞어주지냥.']),
  bomb: Object.freeze(['펑! 시원하게 뚫었다냥!', '길이 활짝 열렸다냥!']),
  megabomb: Object.freeze(['오잉! 크게 터진다냥!', '메가폭탄 나간다냥!']),
  clock: Object.freeze(['시간 +5초!', '5초 더 달려보자냥!', '시간은 내가 챙겼다.']),
  freeze: Object.freeze(['시간이 꽁꽁 멈췄다냥!', '10초간 시간 정지다냥!', '째깍째깍 잠깐 쉬어간다냥!']),
  clover: Object.freeze(['클로버가 정답을 찾았다냥!', '초록빛 칸을 잘 보라냥!', '정답을 오래 보여준다냥!']),
  cloverSuccess: Object.freeze(['행운 점수까지 챙겼다냥!', '클로버 보너스 성공!', '점수가 더 붙는다냥!']),
  clutch: Object.freeze(['막판 집중력 인정!', '끝까지 잡았다냥!', '마지막까지 깔끔했다냥!']),
  itemDrop: Object.freeze(['아이템이다냥! 톡 눌러봐!', '오잉, 선물이 떨어졌다냥!']),
  bombCollected: Object.freeze(['폭탄 챙겼다냥!', '폭탄 저장 완료다냥!']),
  clockCollected: Object.freeze(['시계 챙겼다냥!', '시간 선물 저장 완료다냥!']),
  catBonus: Object.freeze(['보너스 고양이까지 챙겼다냥!', '야옹! 점수 더 얹어준다냥!', '고양이 보너스까지!']),
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
    '괜찮아, 다들 여기서 시작한다냥',
    '방금 그 조합 봤어? 소질 있다냥',
    '숫자랑 인사는 끝났으니 이제 진짜다냥',
  ]),
  resultNormal: Object.freeze([
    '숫자 조합이 제대로 보이기 시작했다냥',
    '이번 판 흐름 좋았어!',
    '오, 속도가 붙었는데?',
    '콤보 감각이 살아 있다냥',
    '이번 기록, 다음 판에 넘을 수 있겠어!',
    '이 정도면 손이 기억하겠다냥',
    '판갈이 넘어가는 맛을 알아버렸구나냥',
    '중간에 그 큰 조합, 나 살짝 소름 돋았다냥',
    '이제 초보라고 하면 다들 안 믿는다냥',
  ]),
  resultHigh: Object.freeze([
    '속도가 장난 아니다냥',
    '숫자가 다 보이나 보다냥',
    '콤보 타이밍이 예술이다냥',
    '완전 고수의 흐름이다냥!',
    '이번 판은 인정. 진짜 빨랐어!',
    '보드가 따라오질 못하겠다냥',
    '내가 판을 새로 까는 속도보다 빠르다냥',
    '이 점수, 친구들한테 보여줘야 한다냥',
    '깊은 판까지 갔다 왔구나. 밤 풍경 봤어?',
  ]),
  resultLegend: Object.freeze([
    '오잉게임 마스터 인정이다냥',
    '오늘의 오잉왕 후보 확정이다냥',
    '이런 점수는 자랑부터 해야 한다냥',
    '이 정도면 숫자가 먼저 도망가겠다냥',
    '전설급 기록이다. 이번엔 진짜 인정!',
    '나 이런 점수 처음 본다냥. 진심으로.',
    '손끝에서 불꽃 냄새가 난다냥',
    '이 기록은 액자에 걸어야 한다냥',
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

// ══════════════════════════════════════════════════════════════════════════
// 원조 오잉 결과창 멘트 이식.
// 구조가 핵심이다: 7단계 점수 구간(lines+goals), 다음 구간이 코앞일 때의
// 목표 멘트, 그리고 과거 기록 대비 오늘 판을 판정하는 스마트 리액트 9종.
// 원문에서 바꾼 것: 아직 랭킹이 없으므로 랭킹·1위·TOP10·친구 기록류는
// 자기 기록/모험 표현으로 치환했고, 랭킹 도발(taunts)과 오늘 첫 판
// (firstOfDay)은 해당 기능이 생길 때까지 보류. 원조의 규칙 두 가지는
// 그대로 지킨다 — 낮은 구간일수록 "못했다" 뉘앙스 금지, 그리고 도발
// (drill)은 아쉬운 판(below)에는 절대 내보내지 않는다.
// ══════════════════════════════════════════════════════════════════════════
// 2026-08 쫄깃함 패스 이후 재보정: 위 구간을 15000/7000/4000으로 내렸다.
// carry cap으로 점수 규모가 보통 6천, 숙련 1만 중반이 됐기 때문.
// 아래 구간(2600 이하)은 초보 분포가 거의 그대로라 소폭만 내렸다.
export const CLASSIC_RESULT_TIERS = Object.freeze([
  Object.freeze({ min: 15000, lines: Object.freeze([
    '이 점수는 오잉게임 역사에 박제된다냥 📜👑',
    '전설 위의 전설, 신화급 기록이다냥 🌌',
    '이 판은 두고두고 회자될 거다냥 🏛️',
    '오잉게임이 널 영원히 기억할 거다냥 ✨',
    '만오천 고지를 넘은 사람은 정말 몇 없다냥 🏔️',
    '이건 실력이 아니라 경지다냥 🧘',
    '숫자판이 항복 선언했다냥 🏳️',
    '오늘의 기록이 내일의 전설이 된다냥 🌠',
    '이 점수 실제로 본 사람 거의 없다냥, 방금 네가 해냈다냥 📸',
  ]), goals: Object.freeze([
    '🎯 이제 목표는 자기 자신뿐이다냥 🌌',
    '🎯 이 기록 위엔 하늘뿐이다냥 ☁️',
    '🎯 다음 신화를 써보자냥 📜',
    '🎯 정상의 풍경을 즐겨보라냥 ⛰️',
    '🎯 이 자리를 지키는 게 다음 도전이다냥 😼',
  ]) }),
  Object.freeze({ min: 7000, lines: Object.freeze([
    '이건 인간의 반응속도가 아니다냥 🤖',
    '오잉게임 전설이 되는 중이다냥 📜👑',
    '이 정도면 아이템 운도 실력이다냥 🍀🏆',
    '숫자판이 무서워하는 소리가 들린다냥 😱',
    '이 점수는 앞으로도 쉽게 안 나온다냥, 자랑해도 된다냥 🎉',
    '이제는 최고기록이랑 싸우는 단계다냥 👑',
    '이 기록 넘는 건 미래의 나뿐이다냥 🐱',
    '숫자가 아니라 전설을 남기고 있다냥 📜',
    '오늘의 오잉왕 후보 확정이다냥 👑',
    '이런 점수는 캡처부터 해야 한다냥 📸',
    '기록판이 긴장하고 있다냥 😼',
    '손가락에 날개 달린 거 아니냥? 🪽',
    '오늘은 오잉게임이 널 기억할 것 같다냥 🐱',
    '최고를 넘어 전설이 되고 있다냥 🌟',
    '이런 플레이는 매일 나오는 게 아니다냥 🎇',
    '이 기록, 한동안 아무도 못 깰 것 같다냥 😎',
  ]), goals: Object.freeze([
    '🎯 이제 상대는 자기 최고기록뿐이다냥 👑',
    '🎯 이 기록 넘는 건 미래의 너다냥 🏆',
    '🎯 다음 전설을 써 내려가보자냥 📜',
    '🎯 한계를 또 한 번 넘어보자냥 🚀',
    '🎯 새로운 역사를 만들어보자냥 ✨',
    '🎯 다음 목표는 만오천 고지다냥 🏔️',
  ]) }),
  Object.freeze({ min: 4000, lines: Object.freeze([
    '말도 안 되는 실력이다냥 🏆',
    '이 정도면 최상위권 실력이다냥 👑',
    '완전 고수의 향기다냥...! 🔥',
    '오잉게임 마스터 인정이다냥 🎖️',
    '이 점수 실화냥? 대단하다냥 😳',
    '진짜 손이 안 보였을 것 같다냥 ⚡',
    '오늘 기록판 흔들어놓을 기세다냥 😤',
    '손끝에 우승 DNA가 흐른다냥 🏅',
    '이 실력 친구들한테 자랑해도 된다냥 📢',
    '오잉게임 역사에 이름 남기는 중이다냥 📜',
    '어제의 기록쯤은 넘볼 수 있겠다냥 🐱',
    '집중력이 폭발했다냥 ⚡',
    '오늘 감각이 정말 좋다냥 🐱',
    '누구나 인정하는 고수다냥 👏',
    '전설 등급이 슬슬 보인다냥 👀',
  ]), goals: Object.freeze([
    '🎯 오늘 감각이면 전설도 꿈이 아니다냥 🔥',
    '🎯 최고기록 갱신까지 달려보자냥 🚀',
    '🎯 전설 등급도 노려볼 만하다냥 😼',
    '🎯 이 흐름 이어가면 더 갈 수 있다냥 💪',
    '🎯 한 판이면 기록이 훌쩍 뛴다냥 🏃',
    '🎯 다음 목표는 만오천 고지다냥 🏔️',
    '🎯 콤보를 끝까지 안 끊기게 가보자냥 ⚡',
  ]) }),
  Object.freeze({ min: 2600, lines: Object.freeze([
    '속도가 장난 아니다냥 ⚡',
    '숫자가 다 보이나보다냥 😳',
    '머리 회전이 빠르다냥 🧠',
    '와, 이번 판 진짜 잘했다냥 🙌',
    '콤보 타이밍이 예술이다냥 ✨',
    '다음 판도 이 흐름 기대한다냥! 🐱',
    '이 페이스면 기록이 몇 계단은 그냥 오른다냥 📈',
    '오늘 컨디션 물올랐다냥, 한 판만 더 가보자냥 🔥',
    '이 흐름 잡았으면 놓치지 말라냥! 🐱',
    '벌써 고수 냄새가 난다냥 👃',
    '숫자가 저절로 눈에 들어오는 경지다냥 👀',
    '손이 점점 빨라지고 있다냥 ⚡',
    '실력이 눈에 띄게 늘었다냥 🌟',
  ]), goals: Object.freeze([
    '🎯 조금만 더 하면 고수 반열이다냥 👑',
    '🎯 이 감각 그대로 이어가보자냥 🐱',
    '🎯 한 판 더 하면 확 달라질 수 있다냥 💪',
    '🎯 최고기록도 노려볼 만하다냥 👀',
    '🎯 조금만 더 집중하면 기록이 바뀐다냥 👑',
    '🎯 긴 콤보 한 번이면 확 뛴다냥 ⚡',
    '🎯 이 페이스면 6천 고지도 보인다냥 🔥',
    '🎯 실수만 줄이면 자기 기록 갱신이다냥 🏆',
  ]) }),
  Object.freeze({ min: 1500, lines: Object.freeze([
    '감 좋다냥! 콤보가 착착 붙는다냥 ✨',
    '패턴이 눈에 딱딱 걸린다냥 🔍',
    '오, 이번 판 흐름 괜찮았다냥? 🐱',
    '숫자 조합 보는 눈이 늘고 있다냥 👀',
    '안정적으로 잘 하고 있다냥! 🐱',
    '이 정도면 중수는 훌쩍 넘었다냥 😎',
    '이 페이스 유지하면 기록판에 이름 올린다냥 🐱',
    '몸이 기억하기 시작했다냥, 계속 가보라냥 🐱',
    '오늘 중에 자기 최고기록 갈아치울 수도 있다냥 🐱',
    '한 끗만 더 다듬으면 확 달라진다냥 💪',
    '이제 진짜 실력이 붙기 시작했다냥 😎',
    '감각이 살아나고 있다냥 😼',
    '지금이 가장 많이 늘 때다냥 📈',
    '플레이가 훨씬 안정적이다냥 👏',
  ]), goals: Object.freeze([
    '🎯 조금만 더 다듬으면 고수 반열이다냥 🔥',
    '🎯 이번엔 최고기록도 노려보라냥 🏆',
    '🎯 지금 감각이면 충분히 가능하다냥 💪',
    '🎯 이 감각 그대로 이어가보자냥 🐱',
    '🎯 한 번만 터지면 기록이 확 오른다냥 🔥',
    '🎯 콤보 한 번만 길게 이어보라냥 ✨',
    '🎯 다음 판은 실수 하나만 줄여보자냥 🐾',
    '🎯 고양이까지 챙기면 점수가 더 붙는다냥 🐱',
    '🎯 남은 시간 끝까지 써보자냥 ⏱️',
    '🎯 고수 반열까지 이제 몇 판 안 남았다냥 👀',
    '🎯 오늘 안에 기록 하나 갈아치워보자냥 🌟',
  ]) }),
  Object.freeze({ min: 500, lines: Object.freeze([
    '숫자 조합이 눈에 들어오기 시작했다냥 👀',
    '한 판 한 판 늘고 있다냥, 이 감각 기억해두라냥 🐱',
    '다음 판엔 조금 더 잘 보일 거다냥 🐱',
    '조금씩 요령이 붙고 있다냥 🐱',
    '나쁘지 않은 페이스다냥, 계속 가보라냥! 🐱',
    '한 판 더 하면 확 달라질 거다냥, 가보라냥 🐱',
    '숫자 사이 거리감이 슬슬 익숙해진다냥 🐱',
    '이 판이 다음 판 실력이 된다냥, 계속해보라냥 🐱',
    '감 잡히면 순식간에 는다냥, 조금만 더 가보라냥 💪',
    '다들 이렇게 시작했다냥, 걱정 말라냥 🐱',
    '이제 게임이 보이기 시작했다냥 😼',
    '성장 속도가 꽤 빠르다냥 📈',
    '시작이 아주 좋다냥 😺',
    '감은 잡았다냥, 이제 속도만 올리면 된다냥 💪',
    '오늘 최고기록 충분히 노려볼 만하다냥 🔥',
  ]), goals: Object.freeze([
    '🎯 이제 중수는 코앞이다냥 🐱',
    '🎯 감각을 이어가면 금방 오른다냥 🌟',
    '🎯 다음 판이 기대된다냥 😸',
    '🎯 조금만 더 하면 확 달라진다냥 🔥',
    '🎯 이 흐름 놓치지 말라냥 💪',
    '🎯 다음 판부터 진짜 시작이다냥 😼',
    '🎯 콤보 감만 잡으면 쭉쭉 오른다냥 📈',
    '🎯 고양이 챙기는 재미도 붙여보라냥 🐾',
  ]) }),
  Object.freeze({ min: 0, lines: Object.freeze([
    '오잉게임 은근 중독성 있다냥? 몇 판 더 하면 감 잡힌다냥 🐱',
    '합이 10 되는 조합, 눈에 익으면 확 빨라진다냥 🐱',
    '고양이는 챙겼냥? 다음 판도 기대한다냥 🐾',
    '워밍업 한 판이었다고 생각하면 딱이다냥 🐱',
    '처음엔 다 이렇다냥, 몇 판 더 해보면 확 달라진다냥 🐱',
    '오늘의 한 판, 그 자체로 의미있다냥 🙂',
    '천천히 봐도 된다냥, 급할 거 없다냥 🐱',
    '그냥 눌러보는 것부터가 시작이다냥 🐱',
    '다음 판엔 분명 다를 거다냥, 한 판만 더 가보라냥 🐱',
    '몸 풀렸으니 이제 진짜 시작이다냥 🔥',
    '시작이 제일 어려운 거다냥 🐱',
    '아직 몸이 풀리는 중이다냥 ☀️',
    '누구나 여기서 시작했다냥 😺',
    '금방 재미가 붙을 거다냥 🐱',
    '오늘 첫걸음도 충분히 멋지다냥 🌼',
    '모험은 아직 시작도 안 했다냥 😼',
    '한 판만 더 하면 달라질 것 같다냥 😸',
  ]), goals: Object.freeze([
    '🎯 다음 판엔 분명 더 잘할 거다냥 🐾',
    '🎯 감만 잡으면 금방 성장한다냥 😸',
    '🎯 조금만 더 하면 게임이 보이기 시작한다냥 👀',
    '🎯 한 판만 더 가보자냥! 🔥',
    '🎯 시작이 반이다냥, 계속 가보라냥 😺',
    '🎯 고양이 한 마리만 구해보자냥 🐱',
    '🎯 이번엔 콤보 5개 이어보기다냥 ✨',
    '🎯 어제의 나보다 한 칸만 더 가보자냥 🐾',
  ]) }),
]);

// 다음 구간이 코앞일 때 — 남은 점수를 들이대지 않고 부드럽게.
export const CLASSIC_NEAR_GOAL_TEMPLATES = Object.freeze([
  '🎯 {next}점이 코앞이다냥!',
  '🎯 조금만 더 가면 {next}점이다냥!',
  '🎯 {next}점, 거의 다 왔다냥!',
  '🎯 이 흐름이면 {next}점도 금방이다냥!',
  '🎯 다음 판엔 {next}점 넘어보자냥!',
  '🎯 {next}점 문턱에 걸쳐 있다냥, 한 발만 더냥!',
  '🎯 {next}점까지 손 뻗으면 닿는다냥!',
  '🎯 다음 판 한 콤보면 {next}점이다냥!',
]);

// 과거 기록 대비 오늘 판의 판정별 대사.
export const CLASSIC_SMART_REACT = Object.freeze({
  record: Object.freeze([
    '🏆 새 기록이다냥!! 이 순간을 기억하라냥 🎉',
    '🏆 최고기록 갱신이다냥! 오늘의 너는 어제의 너를 이겼다냥 👑',
    '🏆 신기록이다냥!! 손끝이 반짝인다냥 ✨',
    '🎉 방금 그거 역대급이다냥! 자기 기록을 깼다냥 🏆',
    '👑 최고점 경신이다냥! 이 감각 잊지 말라냥',
    '✨ 새 최고기록이다냥! 실력이 한 계단 올라갔다냥 📈',
    '🔥 신기록이다냥!! 오늘 컨디션 예술이다냥',
    '💫 자기 최고를 넘었다냥! 방금 그 판 명장면이다냥',
  ]),
  near: Object.freeze([
    '😼 최고기록까지 딱 {diff}점이었다냥... 다음 판이다냥!',
    '👀 최고기록 코앞이었다냥! {diff}점 차이다냥',
    '🔥 조금만 더! 최고기록이 바로 앞이다냥 ({diff}점 남았다냥)',
    '😻 {diff}점만 더 갔으면 신기록이었다냥! 아까비다냥',
    '💦 최고기록이 {diff}점 앞에서 손 흔들고 있었다냥',
    '🎯 {diff}점 차이다냥... 이건 다음 판에 넘는다냥',
    '😤 최고기록 바로 밑이다냥! {diff}점, 곧 깬다냥',
    '✨ 자기 최고랑 {diff}점 차이다냥, 감 잡혔다냥 다시 가자냥',
    '🐾 {diff}점 남았다냥! 신기록 냄새가 난다냥',
  ]),
  above: Object.freeze([
    '📈 오늘 평소보다 확실히 좋다냥! 감각 살아있다냥 ✨',
    '😳 오늘 판은 유난히 날카로웠다냥, 컨디션 좋아 보인다냥!',
    '📈 평소 페이스를 훌쩍 넘었다냥! 이 흐름 아깝다냥, 한 판 더냥',
    '✨ 오늘따라 손이 다르다냥, 컨디션 최고다냥',
    '🚀 평소보다 확 치고 올라갔다냥! 물 만났다냥',
    '😸 오늘 유난히 잘 풀린다냥, 이 감각 붙잡아라냥',
    '🔥 평소 실력 위로 점프했다냥! 지금이 기회다냥',
    '👏 오늘 판 좋다냥! 자기 평균을 가볍게 넘었다냥',
  ]),
  rising: Object.freeze([
    '📊 판마다 점수가 오르고 있다냥! 지금 물올랐다냥 🔥',
    '📈 3판 연속 상승세다냥, 여기서 멈추기 아깝다냥',
    '🚀 계속 오르는 중이다냥! 어디까지 가나 보자냥',
    '😼 판이 갈수록 좋아진다냥, 감 잡았다냥',
    '📈 우상향이다냥! 다음 판도 더 오를 것 같다냥',
    '🔥 점점 잘하고 있다냥! 리듬 제대로 탔다냥',
    '🌊 파도 제대로 탔다냥! 이 흐름 그대로 밀어붙이라냥',
    '🎢 점수가 계단을 그리며 오르는 중이다냥, 다음 칸도 가보자냥',
    '⏫ 어제의 나를 매 판 이기고 있다냥, 멋지다냥',
  ]),
  below: Object.freeze([
    '🐾 이런 판도 있는 거다냥~ 손은 풀렸으니 다음 판 가보자냥',
    '😽 평소 실력 어디 안 갔다냥, 잠깐 숨 고르는 판이었다냥',
    '🍵 아쉬운 판이었냥? 원래 그 다음 판이 진짜다냥',
    '🐱 오늘 숫자들이 좀 얄미웠다냥, 다시 가보자냥',
    '🌱 이번 판은 워밍업이라 치자냥, 다음 판 기대된다냥',
    '😌 누구나 이런 판 있다냥~ 금방 원래대로 돌아온다냥',
    '☕ 잠깐 쉬어가는 판이었다냥, 손 풀렸으니 이제부터다냥',
    '🐾 괜찮다냥! 이 판은 그냥 다음 판을 위한 발판이다냥',
  ]),
  around: Object.freeze([
    '🐾 딱 평소 페이스다냥, 안정적이다냥',
    '😸 오늘도 꾸준하다냥! 이 페이스 나쁘지 않다냥',
    '🐱 늘 하던 만큼은 해줬다냥, 다음 판이 진짜 승부다냥',
    '👌 무난하게 한 판 뽑았다냥~ 슬슬 한 방 노려보자냥',
    '🎯 평소 실력 그대로다냥, 살짝만 더 밀면 신기록이다냥',
    '😺 흔들림 없다냥! 이런 판이 쌓여서 실력이 된다냥',
    '🍀 안정적인 한 판이었다냥, 리듬 탔다냥',
    '🐾 꾸준함이 무기다냥! 이 페이스 유지하라냥',
    '😼 늘 하던 실력이다냥~ 오늘은 한 끗을 노려보자냥',
    '✨ 편안한 한 판이다냥, 다음 판에 욕심 내보자냥',
    '🎮 딱 자기 페이스다냥! 여기서 한 뼘만 더 가보자냥',
    '🐱 안정권이다냥~ 이제 슬슬 자기 기록에 도전하라냥',
    '👍 평소만큼 해냈다냥, 다음 판은 조금 더 노려보자냥',
    '🌟 균형 잡힌 한 판이다냥, 이 리듬에서 한 번 터뜨려보자냥',
  ]),
  drill: Object.freeze([
    '😼 방금 5-5 두 쌍 지나친 거 다 봤다냥',
    '🫡 나쁘지 않다냥. 근데 어제의 너는 더 빨랐다냥',
    '🐱 고양이들이 "좀 더 하라냥"고 전해달란다냥',
    '😼 손은 풀린 것 같은데, 본실력은 언제 나오냥?',
  ]),
  plateau: Object.freeze([
    '🧗 요즘 딱 이 근처에서 맴돈다냥~ 한 끗만 더 밀면 벽 뚫린다냥!',
    '💪 조금만 더 해보라냥~ 다음 계단이 코앞이다냥',
    '🎯 실력은 이미 쌓였다냥, 이제 한 판만 제대로 터뜨리면 된다냥',
    '😼 몸에 익었다냥~ 이제 한 끗 차이로 확 오른다냥',
    '⛰️ 정체기는 폭발 직전이라는 뜻이다냥, 한 판 더 가보자냥',
    '🔓 벽에 손 닿았다냥, 살짝만 더 힘주면 넘는다냥',
    '🐾 계속 비슷하다냥? 그럼 이제 슬슬 깰 타이밍이다냥!',
    '🚪 문 앞까지 왔다냥~ 이 벽만 넘으면 새 기록이다냥',
  ]),
});

function pickFrom(pool, recentMessages = [], random = Math.random) {
  const blocked = new Set(recentMessages);
  const fresh = pool.filter((line) => !blocked.has(line));
  const choices = fresh.length ? fresh : pool;
  return choices[Math.min(choices.length - 1, Math.floor(Math.max(0, random()) * choices.length))];
}

export function classicResultTierFor(score) {
  const value = Math.max(0, Math.round(Number(score) || 0));
  return CLASSIC_RESULT_TIERS.find((tier) => value >= tier.min) || CLASSIC_RESULT_TIERS.at(-1);
}

// The original's judgement thresholds, verbatim: personalisation needs three
// past runs; record only counts against a real previous best; near is 90% of
// a four-digit best; above/below compare to the recent average with floors so
// a brand-new account can't trip them; plateau fires half the time when four
// runs sit within 15% of their mean; drill swaps in at low odds on good or
// ordinary runs and never on a down one.
export function buildClassicResultReaction({
  score = 0,
  newRecord = false,
  previousBest = 0,
  recentScores = [],
} = {}, { recentMessages = [], random = Math.random } = {}) {
  const current = Math.max(0, Math.round(Number(score) || 0));
  const best = Math.max(0, Math.round(Number(previousBest) || 0));
  const past = (Array.isArray(recentScores) ? recentScores : [])
    .filter(Number.isFinite)
    .map((value) => Math.max(0, Math.round(value)));
  const average = past.length
    ? past.slice(-4).reduce((sum, value) => sum + value, 0) / Math.min(4, past.length)
    : 0;
  const say = (type, pool, message) => {
    const text = message ?? pickFrom(pool, recentMessages, random);
    return Object.freeze({ type, message: text });
  };

  if (newRecord && best >= 500) return say('record', CLASSIC_SMART_REACT.record);

  const personalized = past.length >= 3;
  if (personalized) {
    if (best >= 1000 && current < best && current / best >= 0.9) {
      const template = pickFrom(CLASSIC_SMART_REACT.near, recentMessages, random);
      return Object.freeze({
        type: 'near',
        message: template.replaceAll('{diff}', (best - current).toLocaleString('ko-KR')),
      });
    }
    const last = past.at(-1);
    const beforeLast = past.at(-2);
    if (current > last && last > beforeLast) return say('rising', CLASSIC_SMART_REACT.rising);
    if (average >= 800 && current <= average * 0.6) return say('below', CLASSIC_SMART_REACT.below);
    if (average >= 200 && current >= average * 1.35) {
      if (random() < 0.15) return say('drill', CLASSIC_SMART_REACT.drill);
      return say('above', CLASSIC_SMART_REACT.above);
    }
    const window = [...past.slice(-3), current];
    const windowAvg = window.reduce((sum, value) => sum + value, 0) / window.length;
    if (windowAvg > 0 && past.length >= 3) {
      const spread = Math.max(...window) - Math.min(...window);
      if (spread <= windowAvg * 0.15 && random() < 0.5) {
        return say('plateau', CLASSIC_SMART_REACT.plateau);
      }
    }
    if (random() < 0.2) return say('drill', CLASSIC_SMART_REACT.drill);
    return say('around', CLASSIC_SMART_REACT.around);
  }

  // Fresh accounts speak in tiers. When the next tier is within reach the
  // goal points at it by name; otherwise the tier's own lines and goals mix.
  const tier = classicResultTierFor(current);
  const tierIndex = CLASSIC_RESULT_TIERS.indexOf(tier);
  const nextTier = tierIndex > 0 ? CLASSIC_RESULT_TIERS[tierIndex - 1] : null;
  if (nextTier && current >= nextTier.min * 0.85 && random() < 0.5) {
    const template = pickFrom(CLASSIC_NEAR_GOAL_TEMPLATES, recentMessages, random);
    return Object.freeze({
      type: 'nearGoal',
      message: template.replaceAll('{next}', nextTier.min.toLocaleString('ko-KR')),
    });
  }
  if (random() < 0.3 && tier.goals.length) return say('tierGoal', tier.goals);
  return say('tier', tier.lines);
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
  const stage = Math.max(1, Math.round(Number(round) || 1));
  if (isRecordInReach(current, best)) {
    return `${(best - current).toLocaleString('ko-KR')}점만 더!`;
  }
  if (best > 0 && stage >= 2) return `이번엔 STAGE ${stage + 1} 가보자`;
  return '한 판 더!';
}

// Whether the run ended close enough that the record is the natural next
// goal. The result card and the retry button both read from this, so the
// headline and the button always tell the same story about the run —
// they used to disagree, one talking about the last run while the other
// counted down to the record. Wider than a quarter of the record reads as a
// chore rather than a nudge, with a floor so early tiny records still count.
export function isRecordInReach(score = 0, previousBest = 0) {
  const current = Math.max(0, Math.round(Number(score) || 0));
  const best = Math.max(0, Math.round(Number(previousBest) || 0));
  const gap = best - current;
  return best > 0 && gap > 0 && gap <= Math.max(1500, best * 0.25);
}

// The secret garden's collection ladder. Rescued cats are the only currency,
// and every tier is reachable by ordinary play — the first lands inside a
// single run so the ladder introduces itself, and the spacing widens so the
// last tiers stay a long-term reason to come back.
export const GARDEN_MILESTONES = Object.freeze([
  Object.freeze({ id: 'sprout', cats: 3, label: '새싹', asset: 'assets/decor/flower.webp', copy: '첫 싹이 돋았다냥!' }),
  Object.freeze({ id: 'flowers', cats: 10, label: '꽃밭', asset: 'assets/decor/flower.webp', copy: '꽃밭이 넓어졌다냥!' }),
  Object.freeze({ id: 'hearts', cats: 25, label: '하트꽃', asset: 'assets/decor/heart.webp', copy: '정원에 하트가 피었다냥!' }),
  Object.freeze({ id: 'stars', cats: 50, label: '별꽃', asset: 'assets/decor/star.webp', copy: '밤이면 별꽃이 빛난다냥!' }),
  Object.freeze({ id: 'sparkle', cats: 100, label: '반짝임', asset: 'assets/decor/sparkle.webp', copy: '정원이 반짝이기 시작했다냥!' }),
  Object.freeze({ id: 'cloud', cats: 200, label: '구름다리', asset: 'assets/decor/cloud.webp', copy: '구름까지 이어진 정원이다냥!' }),
]);

export function gardenProgress(catsRescued = 0) {
  const cats = Math.max(0, Math.round(Number(catsRescued) || 0));
  const unlocked = GARDEN_MILESTONES.filter((milestone) => cats >= milestone.cats);
  const next = GARDEN_MILESTONES.find((milestone) => cats < milestone.cats) || null;
  // Progress is measured inside the current step, not from zero, so the bar
  // restarts after each unlock instead of crawling for the last two tiers.
  const floor = unlocked.length ? unlocked.at(-1).cats : 0;
  const span = next ? Math.max(1, next.cats - floor) : 1;
  return Object.freeze({
    cats,
    unlocked: Object.freeze(unlocked.map((milestone) => milestone.id)),
    latest: unlocked.length ? unlocked.at(-1) : null,
    next,
    remaining: next ? next.cats - cats : 0,
    progress: next ? Math.min(1, Math.max(0, (cats - floor) / span)) : 1,
    complete: !next,
  });
}

export function comboMultiplier(combo) {
  return 1 + Math.min(Math.max(combo - 1, 0), 9) * 0.15;
}

// Every score in the game runs through this divisor. The original OING pays
// (cells + cats*5) x combo — a five-cell clear at combo 7 is "+84", a number
// you read at a glance and feel. Ours had drifted an order of magnitude
// higher, where "+798" is just a shape. One knob keeps every relationship
// between clears, bombs, cats and bonuses exactly as tuned while bringing
// the figures back into a range that means something.
const SCORE_SCALE = 0.1;
const scaled = (points) => Math.max(1, Math.round(points * SCORE_SCALE));

export function scoreForClear(cellCount, combo) {
  const base = cellCount <= 2
    ? 210
    : 210 + (cellCount - 2) * 210 + Math.max(0, cellCount - 3) * 40;
  return scaled(base * comboMultiplier(combo));
}

export function scoreForWideClear(cellCount, combo) {
  const extraCells = Math.max(0, Math.round(Number(cellCount) || 0) - 4);
  return extraCells ? scaled(extraCells * 120 * comboMultiplier(combo)) : 0;
}

// The original OING cat cell adds five base points before its integer combo
// multiplier. V2 scores use a larger scale, so 120 preserves the same
// meaningful "lucky catch" feeling without overpowering the clear itself.
export function scoreForCatBonus(catCount, combo) {
  const cats = Math.max(0, Math.round(Number(catCount) || 0));
  return cats ? scaled(cats * 120 * comboMultiplier(combo)) : 0;
}

export function scoreForCloverBonus(basePoints) {
  return Math.round(Math.max(0, Number(basePoints) || 0) * 0.5);
}

export function scoreForClutch(timeLeft, combo) {
  const remaining = Math.max(0, Number(timeLeft) || 0);
  if (remaining > 10) return 0;
  const urgency = remaining <= 3 ? 180 : 90;
  return scaled(urgency + Math.min(10, Math.max(0, Math.round(Number(combo) || 0))) * 10);
}

export function scoreForBomb(valueSum, cellCount = 0) {
  const value = Math.max(0, Math.round(Number(valueSum) || 0));
  const cells = Math.max(0, Math.round(Number(cellCount) || 0));
  return scaled(180 + cells * 55 + value * 4);
}

export function scoreForMegaBomb(valueSum, cellCount = 0) {
  const value = Math.max(0, Math.round(Number(valueSum) || 0));
  const cells = Math.max(0, Math.round(Number(cellCount) || 0));
  return scaled(320 + cells * 70 + value * 4);
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
    timeLimit: GAME_DURATION_SECONDS,
    bombChance: Math.min(0.58, last.bombChance + extra * 0.02),
  };
}

export const getRoundConfig = getStageConfig;
