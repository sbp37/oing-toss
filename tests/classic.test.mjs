import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASSIC_COMBO_CAP,
  CLASSIC_TIME_CAP_SECONDS,
  CLASSIC_VARIANTS,
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
  // 고양이 칸은 totalCells에 이미 포함되고 +5가 따로 붙는다 (원조의 cBonus).
  assert.equal(classicScoreForClear(3, 1, 2), (3 + 5) * 2);
  // 콤보 배율은 25에서 캡.
  assert.equal(classicScoreForClear(2, 0, CLASSIC_COMBO_CAP + 5), 2 * CLASSIC_COMBO_CAP);
  // 콤보 0(첫 클리어 전 상태)도 최소 ×1은 보장된다.
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

test('classic board ramp starts mid-depth and caps at the deepest mix', () => {
  assert.equal(classicRoundForBoard(0), 5);
  assert.equal(classicRoundForBoard(3), 8);
  assert.equal(classicRoundForBoard(5), 10);
  assert.equal(classicRoundForBoard(20), 10);
});

test('판갈이 grants +15s up to the classic cap', () => {
  assert.equal(classicTimeAfterBoardChange(100), 115);
  assert.equal(classicTimeAfterBoardChange(292), CLASSIC_TIME_CAP_SECONDS);
  assert.equal(classicTimeAfterBoardChange(0), 15);
});

test('generateClassic fills the exact dimensions with a playable natural bag', () => {
  // The constructor runs the certified stage generator once; the classic
  // generator is what's under test, so reuse a single model across cases.
  const model = new BoardModel(4);
  for (const variant of Object.values(CLASSIC_VARIANTS)) {
    for (const round of [5, 7, 10]) {
      model.generateClassic(variant.cols, variant.rows, round);
      assert.equal(model.rows, variant.rows);
      assert.equal(model.cols, variant.cols);
      assert.equal(model.grid.length, variant.rows);
      const catTarget = bonusCatTargetForDimensions(variant.rows, variant.cols);
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
      assert.equal(numbered, variant.rows * variant.cols - catTarget);
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
  const { rows, cols } = CLASSIC_VARIANTS.wide;
  const model = new BoardModel(4);
  const started = performance.now();
  for (let i = 0; i < 30; i += 1) {
    model.generateClassic(cols, rows, 10);
  }
  const elapsed = performance.now() - started;
  // 30 boards well under 2s — a wide margin that still catches the
  // certified stage generator being invoked by mistake (it costs ~100ms+).
  assert.ok(elapsed < 2000, `30 wide classic boards took ${elapsed.toFixed(0)}ms`);
});
