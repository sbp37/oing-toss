import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASSIC_BOARD_LADDER,
  CLASSIC_COMBO_CAP,
  CLASSIC_COMBO_SOFT_RATE,
  CLASSIC_WOW_BONUS_MULTIPLIER_CAP,
  CLASSIC_START_UNLOCKS,
  CLASSIC_TIME_CAP_SECONDS,
  classicBoardChangeSeconds,
  classicBoardForIndex,
  classicBoardRuleForIndex,
  classicComboAfterFailure,
  classicComboGain,
  classicComboMultiplier,
  classicDropStage,
  classicRoundForBoard,
  classicScoreForBlast,
  classicScoreForClear,
  classicStartBoardIndex,
  classicTimeAfterBoardChange,
  classicWowBonusMultiplier,
  stageShowcaseBoardDrop,
} from '../js/data.js';
import { BoardModel, bonusCatTargetForDimensions, findAllSumTenRects } from '../js/board.js';

test('classic score is the original formula: (cells + cats×5) × min(combo, 25)', () => {
  assert.equal(classicScoreForClear(2, 0, 1), 2);
  assert.equal(classicScoreForClear(3, 0, 4), 12);
  // 고양이 칸은 totalCells에 이미 있고 +5가 따로 붙는다 (원조의 cBonus).
  assert.equal(classicScoreForClear(3, 1, 2), (3 + 5) * 2);
  // 캡을 넘으면 초과분이 1/4씩만 붙는다 (하드캡 아님).
  assert.equal(
    classicScoreForClear(2, 0, CLASSIC_COMBO_CAP + 5),
    Math.round(2 * (CLASSIC_COMBO_CAP + 5 * CLASSIC_COMBO_SOFT_RATE)),
  );
  // 콤보 0(첫 클리어)도 최소 ×1은 보장된다.
  assert.equal(classicScoreForClear(2, 0, 0), 2);
});

test('classic WOW bonus grows with combo but stays capped', () => {
  assert.equal(classicScoreForClear(5, 0, 3), 5 * 3 + 13);
  assert.equal(classicScoreForClear(6, 0, 1), 6 + 20);
  assert.equal(classicScoreForClear(4, 0, 3), 12);
  assert.equal(classicWowBonusMultiplier(1), 1);
  assert.equal(classicWowBonusMultiplier(3), 1.3);
  assert.equal(classicWowBonusMultiplier(100), CLASSIC_WOW_BONUS_MULTIPLIER_CAP);
});

test('classic combo: a five-cell WOW earns three steps toward an item', () => {
  assert.equal(classicComboGain(2), 1);
  assert.equal(classicComboGain(4), 1);
  assert.equal(classicComboGain(5), 3);
});

test('the combo multiplier keeps climbing past the cap, at a quarter rate', () => {
  assert.equal(classicComboMultiplier(1), 1);
  assert.equal(classicComboMultiplier(10), 10);
  assert.equal(classicComboMultiplier(CLASSIC_COMBO_CAP), CLASSIC_COMBO_CAP);
  assert.equal(classicComboMultiplier(CLASSIC_COMBO_CAP + 20), CLASSIC_COMBO_CAP + 5);
  // 콤보 0(첫 클리어 직전)도 최소 ×1.
  assert.equal(classicComboMultiplier(0), 1);
  // 단조 증가여야 한다 — 어느 지점에서도 콤보를 더 쌓아 손해 볼 일은 없다.
  for (let combo = 1; combo < 120; combo += 1) {
    assert.ok(classicComboMultiplier(combo + 1) > classicComboMultiplier(combo));
  }
});

test('a wrong answer always costs multiplier, above the cap as well as below', () => {
  // 캡 아래는 원조 그대로 30% 삭감.
  assert.equal(classicComboAfterFailure(10), 7);
  assert.equal(classicComboAfterFailure(1), 0);
  assert.equal(classicComboAfterFailure(0), 0);
  // 캡 위는 절반. 하드캡 시절 콤보 36 이상에서 오답이 완전 무료였던 구간을
  // 없애는 것이 이 규칙의 목적이므로, 그 성질을 직접 검증한다.
  assert.equal(classicComboAfterFailure(40), 20);
  assert.equal(classicComboAfterFailure(74), 37);
  for (const combo of [26, 30, 36, 40, 60, 74, 100]) {
    const before = classicComboMultiplier(combo);
    const after = classicComboMultiplier(classicComboAfterFailure(combo));
    assert.ok(after < before, `combo ${combo}: ${after} should be below ${before}`);
  }
});

test('classic ladder: one 5×5 opener, then a row per 판갈이 to the 9-row cap', () => {
  assert.deepEqual(
    CLASSIC_BOARD_LADDER.map((step) => [step.rows, step.cols]),
    [[5, 5], [6, 6], [7, 6], [8, 6], [9, 6]],
  );
  // 워밍업 판일수록 판갈이 보상이 작다 — 작은 판은 금방 마르니까.
  assert.deepEqual(CLASSIC_BOARD_LADDER.map((step) => step.timeFloor), [4, 5, 6, 6, 6]);
  assert.deepEqual(CLASSIC_BOARD_LADDER.map((step) => step.timeBonus), [11, 14, 19, 19, 19]);
  CLASSIC_BOARD_LADDER.forEach((step) => assert.ok(step.timeBonus > step.timeFloor));
  // 6×6부터는 가로 고정, 세로만 +1씩.
  CLASSIC_BOARD_LADDER.slice(1).forEach((step, index) => {
    assert.equal(step.cols, 6);
    assert.equal(step.rows, 6 + index);
  });
  assert.equal(classicBoardForIndex(0), CLASSIC_BOARD_LADDER[0]);
  assert.equal(classicBoardForIndex(4), CLASSIC_BOARD_LADDER[4]);
  assert.equal(classicBoardForIndex(9), CLASSIC_BOARD_LADDER[4]);
  assert.equal(classicBoardForIndex(-1), CLASSIC_BOARD_LADDER[0]);
});

test('classic number depth starts mid-run and caps at the deepest mix', () => {
  assert.equal(classicRoundForBoard(0), 5);
  assert.equal(classicRoundForBoard(3), 8);
  assert.equal(classicRoundForBoard(5), 10);
  assert.equal(classicRoundForBoard(20), 10);
});

test('classic cat bonus boards arrive on a stable four-board cadence', () => {
  assert.equal(classicBoardRuleForIndex(0), null);
  assert.equal(classicBoardRuleForIndex(1), null);
  assert.equal(classicBoardRuleForIndex(2), null);
  assert.equal(classicBoardRuleForIndex(3)?.catMultiplier, 2);
  assert.equal(classicBoardRuleForIndex(4), null);
  assert.equal(classicBoardRuleForIndex(7)?.message, '고양이 보너스 판이다냥!');
  assert.equal(classicBoardRuleForIndex(-1), null);
});

test('the first classic board change reaches the rare-item showcase gate', () => {
  assert.equal(classicDropStage(0), 3);
  assert.equal(classicDropStage(1), 4);
  assert.equal(stageShowcaseBoardDrop(classicDropStage(0), () => 0), null);
  assert.equal(stageShowcaseBoardDrop(classicDropStage(1), () => 0)?.id, 'megabomb');
});

test('판갈이 pays the finished board\'s bonus up to the classic cap', () => {
  assert.equal(classicTimeAfterBoardChange(100, 8), 108);
  assert.equal(classicTimeAfterBoardChange(100, 15), 115);
  assert.equal(classicTimeAfterBoardChange(292, 15), CLASSIC_TIME_CAP_SECONDS);
  assert.equal(classicTimeAfterBoardChange(0, 8), 8);
});

test('generateClassic fills every ladder step with a playable natural bag', () => {
  // The constructor runs the certified stage generator once; the classic
  // generator is what's under test, so reuse a single model across cases.
  const model = new BoardModel(4);
  for (const step of CLASSIC_BOARD_LADDER) {
    for (const round of [5, 7, 10]) {
      model.generateClassic(step.cols, step.rows, round);
      assert.equal(model.rows, step.rows);
      assert.equal(model.cols, step.cols);
      assert.equal(model.grid.length, step.rows);
      const catTarget = bonusCatTargetForDimensions(step.rows, step.cols);
      assert.equal(model.bonusCats.size, catTarget);
      let sum = 0;
      let numbered = 0;
      model.grid.forEach((row, r) => row.forEach((value, c) => {
        if (model.bonusCats.has(`${r}:${c}`)) {
          assert.equal(value, null);
          return;
        }
        assert.ok(value >= 1 && value <= 9, `cell ${r}:${c} has value ${value}`);
        sum += value;
        numbered += 1;
      }));
      assert.equal(numbered, step.rows * step.cols - catTarget);
      // numberBagForRound builds from complement pairs and sum-ten triples,
      // so the whole bag always sums to a multiple of ten.
      assert.equal(sum % 10, 0);
      assert.ok(findAllSumTenRects(model.grid).length >= 1, 'opening board must have an answer');
      // 판갈이 안전망: 특수 타일·인증서는 클래식 보드에 실리지 않는다.
      assert.equal(model.specialTiles.size, 0);
      assert.equal(model.lastClearPlan, null);
    }
  }
});

test('generateClassic is instant enough for a mid-timer board change', () => {
  const { rows, cols } = classicBoardForIndex(99);
  const model = new BoardModel(4);
  const started = performance.now();
  for (let i = 0; i < 30; i += 1) {
    model.generateClassic(cols, rows, 10);
  }
  const elapsed = performance.now() - started;
  // 30 boards well under 2s — a wide margin that still catches the
  // certified stage generator being invoked by mistake (it costs ~100ms+).
  assert.ok(elapsed < 2000, `30 full-size classic boards took ${elapsed.toFixed(0)}ms`);
});

test('a classic cat bonus board doubles cats without losing its opening answer', () => {
  const { rows, cols } = classicBoardForIndex(3);
  const model = new BoardModel(4);
  model.generateClassic(cols, rows, 8, { catMultiplier: 2 });
  assert.equal(model.bonusCats.size, bonusCatTargetForDimensions(rows, cols) * 2);
  assert.ok(findAllSumTenRects(model.grid).length >= 1);
});

test('classic chapters cycle in order while album ownership stays key-based', async () => {
  const {
    CLASSIC_CHAPTERS, CLASSIC_SECRET_CHAPTER,
    classicChapterForBoard, classicChapterGallery, classicDeepestChapterLabel,
  } = await import('../js/data.js');

  // The six normal scenes loop forever in a stable, non-random order.
  assert.equal(classicChapterForBoard(0).key, 'garden');
  assert.equal(classicChapterForBoard(1).key, 'forest');
  assert.equal(classicChapterForBoard(2).key, 'stream');
  assert.equal(classicChapterForBoard(3).key, 'village');
  assert.equal(classicChapterForBoard(4).key, 'sunset');
  assert.equal(classicChapterForBoard(5).key, 'night');
  assert.equal(classicChapterForBoard(6).key, 'garden');
  assert.equal(classicChapterForBoard(7).key, 'forest');
  assert.equal(classicChapterForBoard(40).key, 'sunset');
  assert.equal(classicChapterForBoard(-3).key, 'garden');
  // Thresholds must stay ordered, or a deeper board could show an earlier scene.
  CLASSIC_CHAPTERS.forEach((chapter, index) => {
    if (index > 0) assert.ok(chapter.fromBoard > CLASSIC_CHAPTERS[index - 1].fromBoard);
  });

  const fresh = classicChapterGallery({ seenKeys: [], bestScore: 0 });
  assert.equal(fresh.length, CLASSIC_CHAPTERS.length + 1);
  assert.ok(fresh.every((chapter) => !chapter.unlocked));
  assert.equal(fresh.at(-1).key, CLASSIC_SECRET_CHAPTER.key);
  assert.equal(fresh.at(-1).secret, true);
  assert.equal(CLASSIC_SECRET_CHAPTER.minScore, 15000);
  assert.equal(
    classicChapterGallery({ seenKeys: [], bestScore: 14999 }).at(-1).unlocked,
    false,
  );
  assert.equal(
    classicChapterGallery({ seenKeys: [], bestScore: 15000 }).at(-1).unlocked,
    true,
  );

  const seen = classicChapterGallery({ seenKeys: ['garden', 'forest'], bestScore: 900 });
  assert.deepEqual(
    seen.filter((chapter) => chapter.unlocked).map((chapter) => chapter.key),
    ['garden', 'forest'],
  );
  // Repeating the display loop does not reset or duplicate album ownership.
  const repeated = classicChapterGallery({
    seenKeys: ['garden', 'forest', 'garden'],
    bestScore: 900,
  });
  assert.deepEqual(
    repeated.filter((chapter) => chapter.unlocked).map((chapter) => chapter.key),
    ['garden', 'forest'],
  );
  // 점수 장면은 판을 아무리 넘겨도 안 열리고, 점수로만 열린다.
  const scored = classicChapterGallery({ seenKeys: ['garden'], bestScore: CLASSIC_SECRET_CHAPTER.minScore });
  assert.equal(scored.at(-1).unlocked, true);

  assert.equal(classicDeepestChapterLabel({ seenKeys: [], bestScore: 0 }), '모험 시작 전');
  assert.equal(
    classicDeepestChapterLabel({ seenKeys: ['garden', 'forest'], bestScore: 0 }),
    CLASSIC_CHAPTERS[1].label,
  );
  // 점수 장면이 열리면 그게 가장 깊은 도달점이다.
  assert.equal(
    classicDeepestChapterLabel({ seenKeys: ['garden'], bestScore: CLASSIC_SECRET_CHAPTER.minScore }),
    CLASSIC_SECRET_CHAPTER.label,
  );
});

test('a scene is collected by clearing its board, not by standing on it', async () => {
  const {
    CLASSIC_CHAPTER_COLLECT_RATIO, classicChapterCollected, classicChapterGallery,
  } = await import('../js/data.js');

  // 발만 디딘 판은 수집이 아니다.
  assert.equal(classicChapterCollected(0), false);
  assert.equal(classicChapterCollected(0.5), false);
  assert.equal(classicChapterCollected(CLASSIC_CHAPTER_COLLECT_RATIO - 0.01), false);
  // 기준선과 그 위는 수집.
  assert.equal(classicChapterCollected(CLASSIC_CHAPTER_COLLECT_RATIO), true);
  assert.equal(classicChapterCollected(1), true);
  // 숫자가 아닌 값은 0으로 읽어 수집되지 않는다.
  assert.equal(classicChapterCollected(undefined), false);
  assert.equal(classicChapterCollected(null), false);

  // 갤러리 요구 조건이 비율을 그대로 안내한다.
  const percent = `${Math.round(CLASSIC_CHAPTER_COLLECT_RATIO * 100)}%`;
  const rows = classicChapterGallery({ seenKeys: [], bestScore: 0 });
  assert.ok(rows.slice(0, -1).every((row) => row.requirement.includes(percent)));
});

test('classic beginners get repeated auto-hints when they stall', async () => {
  const {
    shouldShowClassicAutoHint, CLASSIC_AUTO_HINT_LIMIT, CLASSIC_AUTO_HINT_COOLDOWN_MS,
    BEGINNER_AUTO_HINT_IDLE_MS, BEGINNER_AUTO_HINT_SCORE_CEILING,
  } = await import('../js/data.js');
  const base = {
    running: true, inputLocked: false, tutorialActive: false,
    shownCount: 0, sinceLastMs: Infinity, timeLeft: 90,
    idleMs: BEGINNER_AUTO_HINT_IDLE_MS, bestScore: 0, completedRuns: 0,
  };
  // 초보가 멈춰 있으면 뜬다.
  assert.equal(shouldShowClassicAutoHint(base), true);
  // 스테이지 모드의 40초 창은 클래식엔 적용되지 않는다 — 2분 초반에도 뜬다.
  assert.equal(shouldShowClassicAutoHint({ ...base, timeLeft: 115 }), true);
  // 아직 안 멈췄으면 안 뜬다.
  assert.equal(shouldShowClassicAutoHint({ ...base, idleMs: 1000 }), false);
  // 런당 횟수 제한과 쿨다운을 지킨다.
  assert.equal(shouldShowClassicAutoHint({ ...base, shownCount: CLASSIC_AUTO_HINT_LIMIT }), false);
  assert.equal(shouldShowClassicAutoHint({ ...base, sinceLastMs: CLASSIC_AUTO_HINT_COOLDOWN_MS - 1 }), false);
  // 숙련자에겐 안 뜬다.
  assert.equal(shouldShowClassicAutoHint({
    ...base, bestScore: BEGINNER_AUTO_HINT_SCORE_CEILING, completedRuns: 5,
  }), false);
  // 튜토리얼 중이거나 시간이 거의 없으면 방해하지 않는다.
  assert.equal(shouldShowClassicAutoHint({ ...base, tutorialActive: true }), false);
  assert.equal(shouldShowClassicAutoHint({ ...base, timeLeft: 5 }), false);
});

test('past the fatigue line the board stops dropping time-givers', async () => {
  const { chooseBoardDrop } = await import('../js/data.js');
  const draw = (lateRun, seed) => chooseBoardDrop(20, () => seed, {
    cloverGiven: true, pity: {}, previousType: null,
    rewardIndex: 3, stage: 10, timeBonusCapped: false, lateRun,
  });
  const sample = (lateRun) => {
    const seen = new Set();
    for (let i = 0; i < 200; i += 1) {
      const drop = draw(lateRun, (i + 0.5) / 200);
      if (drop) seen.add(drop.id);
    }
    return seen;
  };
  const normal = sample(false);
  const late = sample(true);
  // 평시 후반 풀에는 시간 아이템이 존재한다.
  assert.ok(normal.has('clock') || normal.has('freeze'));
  // 피로선 너머에서는 시간 아이템이 사라지고 보드 액션만 남는다.
  assert.ok(!late.has('clock'));
  assert.ok(!late.has('freeze'));
  assert.ok(late.has('bomb'));
  // 프리즈 pity가 가득 차 있어도 피로선 너머에서는 프리즈를 강제하지 않는다.
  const pityForced = chooseBoardDrop(20, () => 0.99, {
    cloverGiven: true, pity: { freeze: 99 }, previousType: null,
    rewardIndex: 3, stage: 10, timeBonusCapped: false, lateRun: true,
  });
  assert.notEqual(pityForced?.id, 'freeze');
});

test('refund fatigue starts past the ladder and never drops below the floor', async () => {
  const { CLASSIC_REFUND_FATIGUE, classicRefundWithFatigue } = await import('../js/data.js');
  const { fromBoard, perBoard, floor } = CLASSIC_REFUND_FATIGUE;

  // 사다리 안(1..6판)은 전액 지급.
  for (let n = 1; n <= fromBoard; n += 1) {
    assert.equal(classicRefundWithFatigue(19, n), 19);
  }
  // 선을 넘으면 판마다 perBoard씩 깎인다.
  assert.equal(classicRefundWithFatigue(19, fromBoard + 1), 19 - perBoard);
  assert.equal(classicRefundWithFatigue(19, fromBoard + 4), 19 - perBoard * 4);
  // 깊은 판에서도 바닥 밑으로는 안 내려간다.
  assert.equal(classicRefundWithFatigue(19, fromBoard + 200), floor);
  assert.equal(classicRefundWithFatigue(4, fromBoard + 10), floor);
  // 원래 지급액이 바닥보다 크면 피로가 지급액을 늘리는 일은 없다.
  for (let n = 1; n <= 40; n += 1) {
    assert.ok(classicRefundWithFatigue(19, n) <= 19);
  }
  // 비정상 입력은 전액 지급으로 읽는다.
  assert.equal(classicRefundWithFatigue(19, undefined), 19);
  assert.equal(classicRefundWithFatigue(19, null), 19);
  assert.equal(classicRefundWithFatigue(undefined, 9), floor);
});

test('판갈이 pays in proportion to how much of the board was cleared', () => {
  const small = CLASSIC_BOARD_LADDER[0];
  const big = classicBoardForIndex(4);
  // 아무것도 못 지우고 막히면 floor, 다 비우면 ceiling.
  assert.equal(classicBoardChangeSeconds(small, 0), small.timeFloor);
  assert.equal(classicBoardChangeSeconds(small, 1), small.timeBonus);
  assert.equal(classicBoardChangeSeconds(big, 0), big.timeFloor);
  assert.equal(classicBoardChangeSeconds(big, 1), big.timeBonus);
  // 중간은 단조 증가 — "대충 부수고 넘어가기"가 이득이 되는 구간이 없어야 한다.
  let previous = -1;
  for (let step = 0; step <= 10; step += 1) {
    const paid = classicBoardChangeSeconds(big, step / 10);
    assert.ok(paid >= previous, `ratio ${step / 10} paid ${paid} after ${previous}`);
    previous = paid;
  }
  // 범위를 벗어난 비율도 잘라서 처리한다.
  assert.equal(classicBoardChangeSeconds(big, -1), big.timeFloor);
  assert.equal(classicBoardChangeSeconds(big, 4), big.timeBonus);
  // 완전 클리어는 대충 넘긴 판보다 확실히 많이 받아야 의미가 있다.
  assert.ok(classicBoardChangeSeconds(big, 1) - classicBoardChangeSeconds(big, 0.4) >= 6);
});

test('blast payouts share the clear scale, minus the WOW bonus', () => {
  assert.equal(classicScoreForBlast(4, 0, 3), 12);
  assert.equal(classicScoreForBlast(3, 1, 2), (3 + 5) * 2);
  // 폭발은 찾아낸 답이 아니므로 5칸 이상 보너스는 붙지 않는다.
  assert.equal(classicScoreForBlast(6, 0, 1), 6);
  assert.equal(classicScoreForClear(6, 0, 1), 6 + 20);
});

test('a personal best permanently buys a later starting board', () => {
  assert.equal(classicStartBoardIndex(0), 0);
  assert.equal(classicStartBoardIndex(1499), 0);
  assert.equal(classicStartBoardIndex(1500), 1);
  assert.equal(classicStartBoardIndex(3999), 1);
  assert.equal(classicStartBoardIndex(4000), 2);
  assert.equal(classicStartBoardIndex(99999), 2);
  // 해금 문턱은 오름차순이어야 하고, 사다리 밖을 가리켜서는 안 된다.
  CLASSIC_START_UNLOCKS.forEach((unlock, index) => {
    assert.ok(unlock.boardIndex < CLASSIC_BOARD_LADDER.length);
    if (index > 0) {
      assert.ok(unlock.minScore > CLASSIC_START_UNLOCKS[index - 1].minScore);
      assert.ok(unlock.boardIndex > CLASSIC_START_UNLOCKS[index - 1].boardIndex);
    }
  });
});

test('drops ramp with board depth, so an unlocked start is not a rarity handout', () => {
  // 첫 판은 스테이지 3 수준 — 폭탄만.
  assert.equal(classicDropStage(0), 3);
  assert.equal(classicDropStage(2), 5);
  assert.equal(classicDropStage(7), 10);
  assert.equal(classicDropStage(30), 10);
  // 해금으로 3번째 판에서 시작해도 최심 풀이 바로 열리지는 않는다.
  assert.ok(classicDropStage(classicStartBoardIndex(4000)) < 10);
});
