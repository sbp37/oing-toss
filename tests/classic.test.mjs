import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASSIC_BOARD_LADDER,
  CLASSIC_COMBO_CAP,
  CLASSIC_TIME_CAP_SECONDS,
  classicBoardForIndex,
  classicComboAfterFailure,
  classicComboGain,
  classicRoundForBoard,
  classicScoreForClear,
  classicTimeAfterBoardChange,
} from '../js/data.js';
import { BoardModel, bonusCatTargetForDimensions, findAllSumTenRects } from '../js/board.js';

test('classic score is the original formula: (cells + cats×5) × min(combo, 25)', () => {
  assert.equal(classicScoreForClear(2, 0, 1), 2);
  assert.equal(classicScoreForClear(3, 0, 4), 12);
  // 고양이 칸은 totalCells에 이미 있고 +5가 따로 붙는다 (원조의 cBonus).
  assert.equal(classicScoreForClear(3, 1, 2), (3 + 5) * 2);
  // 콤보 배율은 25에서 캡.
  assert.equal(classicScoreForClear(2, 0, CLASSIC_COMBO_CAP + 5), 2 * CLASSIC_COMBO_CAP);
  // 콤보 0(첫 클리어)도 최소 ×1은 보장된다.
  assert.equal(classicScoreForClear(2, 0, 0), 2);
});

test('classic WOW pays +10 per cell beyond four, outside the multiplier', () => {
  assert.equal(classicScoreForClear(5, 0, 3), 5 * 3 + 10);
  assert.equal(classicScoreForClear(6, 0, 1), 6 + 20);
  assert.equal(classicScoreForClear(4, 0, 3), 12);
});

test('classic combo: +2 only from five cells, wrong answer cuts to 70%', () => {
  assert.equal(classicComboGain(2), 1);
  assert.equal(classicComboGain(4), 1);
  assert.equal(classicComboGain(5), 2);
  assert.equal(classicComboAfterFailure(10), 7);
  assert.equal(classicComboAfterFailure(1), 0);
  assert.equal(classicComboAfterFailure(0), 0);
});

test('classic ladder: one 5×5 opener, then a row per 판갈이 to the 9-row cap', () => {
  assert.deepEqual(
    CLASSIC_BOARD_LADDER.map((step) => [step.rows, step.cols]),
    [[5, 5], [6, 6], [7, 6], [8, 6], [9, 6]],
  );
  // 워밍업 판일수록 판갈이 시간 보상이 작다 — 작은 판은 금방 마르니까.
  assert.deepEqual(CLASSIC_BOARD_LADDER.map((step) => step.timeBonus), [8, 11, 15, 15, 15]);
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

test('classic chapters open by board depth, and the last one by score', async () => {
  const {
    CLASSIC_CHAPTERS, CLASSIC_SECRET_CHAPTER,
    classicChapterForBoard, classicChapterGallery, classicDeepestChapterLabel,
  } = await import('../js/data.js');

  // 첫 판은 정원, 두 판마다 다음 장면.
  assert.equal(classicChapterForBoard(0).key, 'garden');
  assert.equal(classicChapterForBoard(1).key, 'garden');
  assert.equal(classicChapterForBoard(2).key, 'forest');
  assert.equal(classicChapterForBoard(9).key, 'sunset');
  assert.equal(classicChapterForBoard(10).key, 'night');
  // 사다리 끝을 넘어도 마지막 장면에 머문다.
  assert.equal(classicChapterForBoard(40).key, 'night');
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

  const seen = classicChapterGallery({ seenKeys: ['garden', 'forest'], bestScore: 900 });
  assert.deepEqual(
    seen.filter((chapter) => chapter.unlocked).map((chapter) => chapter.key),
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
