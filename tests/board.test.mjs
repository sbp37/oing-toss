import assert from 'node:assert/strict';
import {
  BOARD_DIFFICULTY,
  BOARD_ASSIST_PROFILES,
  BoardModel,
  EASY_BOARD_BONUS,
  boardAssistForSuccessCount,
  bonusCatTargetForDimensions,
  bonusCatTargetForSize,
  bombRect,
  cellListStats,
  findBestBombTarget,
  megaBombCells,
  megaBombRect,
  normalizeRect,
  rectStats,
} from '../js/board.js';
import { getRoundConfig, scoreForBomb, scoreForCatBonus, scoreForClear, scoreForMegaBomb } from '../js/data.js';

for (const size of [4, 5, 6]) {
  for (let run = 0; run < 250; run += 1) {
    const board = new BoardModel(size);
    const answers = board.findAnswers();
    const profile = BOARD_DIFFICULTY[size];
    assert.equal(board.bonusCats.size, bonusCatTargetForSize(size), `${size}x${size} board must show its promised cat bonuses`);
    for (const key of board.bonusCats) {
      const [row, col] = key.split(':').map(Number);
      assert.equal(board.grid[row][col], null, 'a cat bonus replaces a number and contributes zero to the sum');
      assert.ok(
        answers.some((answer) => row >= answer.r1 && row <= answer.r2 && col >= answer.c1 && col <= answer.c2),
        'every cat bonus must be collectable inside at least one sum-ten rectangle',
      );
    }
    assert.ok(answers.length >= profile.minimumAnswers, `${size}x${size} board must start with enough choices`);
    assert.ok(
      answers.filter((answer) => answer.count === 2).length >= profile.minimumSimpleAnswers,
      `${size}x${size} board must keep its round-specific simple-answer floor`,
    );
    assert.ok(
      answers.filter((answer) => answer.count === 2
        && (answer.r2 - answer.r1 + 1) * (answer.c2 - answer.c1 + 1) === 2).length
        >= profile.minimumAdjacentPairs,
      `${size}x${size} board must keep its adjacent-pair floor`,
    );
    assert.ok(
      answers.filter((answer) => answer.count >= 3).length >= profile.minimumRichAnswers,
      `${size}x${size} board must keep its round-specific rich-answer floor`,
    );
    assert.equal(board.shuffleRemaining(), true, `${size}x${size} shuffle must succeed`);
    assert.ok(board.findAnswer(), `${size}x${size} shuffled board must keep an answer`);
  }
}

for (const size of [4, 5, 6]) {
  for (let run = 0; run < 100; run += 1) {
    const board = new BoardModel(size);
    board.generate(size, { easy: true });
    const answers = board.findAnswers();
    const profile = BOARD_DIFFICULTY[size];
    assert.ok(
      answers.length >= profile.minimumAnswers + EASY_BOARD_BONUS.minimumAnswers,
      `${size}x${size} early board must expose extra answers`,
    );
    assert.ok(
      answers.filter((answer) => answer.count === 2).length
        >= profile.minimumSimpleAnswers + EASY_BOARD_BONUS.minimumSimpleAnswers,
      `${size}x${size} early board must expose extra simple pairs`,
    );
    assert.ok(
      answers.filter((answer) => answer.count === 2
        && (answer.r2 - answer.r1 + 1) * (answer.c2 - answer.c1 + 1) === 2).length
        >= profile.minimumAdjacentPairs + EASY_BOARD_BONUS.minimumAdjacentPairs,
      `${size}x${size} early board must expose extra adjacent pairs`,
    );
    const easyAnswer = board.findEasyAnswer();
    assert.equal(easyAnswer.count, 2, `${size}x${size} onboarding answer should prefer a pair`);
    assert.equal(
      (easyAnswer.r2 - easyAnswer.r1 + 1) * (easyAnswer.c2 - easyAnswer.c1 + 1),
      2,
      `${size}x${size} onboarding pair should be adjacent`,
    );
  }
}

assert.equal(boardAssistForSuccessCount(0), 'starter');
assert.equal(boardAssistForSuccessCount(1), 'starter');
assert.equal(boardAssistForSuccessCount(4), 'starter');
assert.equal(boardAssistForSuccessCount(5), 'guided');
assert.equal(boardAssistForSuccessCount(11), 'guided');
assert.equal(boardAssistForSuccessCount(12), 'standard');
assert.equal(BOARD_ASSIST_PROFILES.starter.minimumAdjacentPairs, 3);

assert.deepEqual(getRoundConfig(1), { round: 1, size: 4, cols: 4, rows: 4, target: 3 });
assert.deepEqual(getRoundConfig(3), { round: 3, size: 6, cols: 6, rows: 6, target: 7 });
assert.deepEqual(getRoundConfig(4), { round: 4, size: 7, cols: 7, rows: 7, target: 9 });
assert.deepEqual(getRoundConfig(5), { round: 5, size: 7, cols: 7, rows: 8, target: 11 });
assert.deepEqual(getRoundConfig(6), { round: 6, size: 7, cols: 7, rows: 9, target: 13 });
assert.deepEqual(getRoundConfig(7), { round: 7, size: 7, cols: 7, rows: 10, target: 15 });
assert.deepEqual(getRoundConfig(20), { round: 20, size: 7, cols: 7, rows: 10, target: 25 });

for (const size of [7, 8, 9]) {
  for (let run = 0; run < 8; run += 1) {
    const board = new BoardModel(size);
    const profile = BOARD_DIFFICULTY[size];
    const answers = board.findAnswers();
    assert.equal(board.grid.length, size);
    assert.equal(board.grid[0].length, size);
    assert.ok(answers.length >= profile.minimumAnswers, `${size}x${size} late board must keep enough answers`);
    assert.equal(board.bonusCats.size, bonusCatTargetForSize(size));
    assert.ok(board.findAnswer(), `${size}x${size} late board must keep a sum-ten answer`);
  }
}

for (const rows of [8, 9, 10]) {
  for (let run = 0; run < 8; run += 1) {
    const board = new BoardModel(7);
    board.generate(7, { cols: 7, rows });
    assert.equal(board.cols, 7);
    assert.equal(board.rows, rows);
    assert.equal(board.grid.length, rows);
    assert.ok(board.grid.every((row) => row.length === 7), `7x${rows} board must keep seven columns`);
    assert.equal(board.bonusCats.size, bonusCatTargetForDimensions(rows, 7));
    assert.ok(board.findAnswer(), `7x${rows} vertical board must keep a sum-ten answer`);
    assert.equal(board.shuffleRemaining(), true, `7x${rows} shuffle must succeed`);
    assert.ok(board.findAnswer(), `7x${rows} shuffled board must keep a sum-ten answer`);
  }
}

assert.deepEqual(normalizeRect({ r: 3, c: 2 }, { r: 1, c: 0 }), { r1: 1, r2: 3, c1: 0, c2: 2 });
assert.deepEqual(bombRect(4, 0, 0), { r1: 0, r2: 1, c1: 0, c2: 1 });
assert.deepEqual(bombRect(5, 2, 2), { r1: 1, r2: 3, c1: 1, c2: 3 });
assert.deepEqual(bombRect(6, 5, 5), { r1: 4, r2: 5, c1: 4, c2: 5 });
assert.deepEqual(megaBombRect(6, 3, 3), { r1: 1, r2: 5, c1: 1, c2: 5 });
assert.deepEqual(megaBombRect(6, 0, 0), { r1: 0, r2: 2, c1: 0, c2: 2 });
assert.deepEqual(findBestBombTarget([
  [9, null, null, null],
  [null, 1, 2, null],
  [null, 3, 4, null],
  [null, null, null, 8],
]), {
  row: 1,
  col: 1,
  rect: { r1: 0, r2: 2, c1: 0, c2: 2 },
  stats: { sum: 19, count: 5 },
});
assert.deepEqual(rectStats([[4, 6], [null, 8]], { r1: 0, c1: 0, r2: 0, c2: 1 }), { sum: 10, count: 2 });
const catStatsModel = new BoardModel(4);
catStatsModel.grid = [[4, 6], [null, 8]];
catStatsModel.bonusCats = new Set(['1:0']);
assert.deepEqual(catStatsModel.stats({ r1: 0, c1: 0, r2: 1, c2: 0 }), { sum: 4, count: 1, catCount: 1 });
const megaGrid = Array.from({ length: 6 }, () => Array(6).fill(2));
megaGrid[3][3] = null;
const megaCells = megaBombCells(megaGrid, 3, 3);
assert.equal(megaCells.length, 12, 'mega bomb clears at most twelve nearby number cells');
assert.ok(megaCells.every(({ r, c }) => Math.abs(r - 3) <= 2 && Math.abs(c - 3) <= 2));
assert.deepEqual(cellListStats(megaGrid, megaCells), { sum: 24, count: 12 });
const megaModel = new BoardModel(6);
megaModel.grid = megaGrid.map((row) => row.slice());
const megaTarget = megaModel.megaBombTarget(3, 3);
assert.equal(megaModel.removeCells(megaTarget.cells), 12);
assert.equal(megaTarget.stats.count, 12);
assert.equal(megaModel.grid.flat().filter((value) => value === null).length, 13);
assert.ok(scoreForClear(3, 5) > scoreForClear(3, 1), 'combo multiplier must increase score');
assert.ok(scoreForClear(4, 1) > scoreForClear(2, 1) * 2, 'large rectangles must earn a meaningful bonus');
assert.equal(scoreForCatBonus(1, 1), 120, 'one cat grants a visible base bonus on the V2 score scale');
assert.ok(scoreForCatBonus(1, 5) > scoreForCatBonus(1, 1), 'cat bonus follows the live combo multiplier');
assert.equal(scoreForBomb(37), 231, 'bomb reward must be meaningful on the V2 score scale');
assert.equal(scoreForMegaBomb(37), 368, 'mega bomb reward must exceed a normal bomb without replacing core clears');

console.log('board.test.mjs: 750 regular and 300 early-assist boards plus scoring assertions passed');
