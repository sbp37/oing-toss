import assert from 'node:assert/strict';
import {
  BOARD_DIFFICULTY,
  BOARD_ASSIST_PROFILES,
  BoardModel,
  EASY_BOARD_BONUS,
  boardAssistForSuccessCount,
  boardPacingForRound,
  bonusCatTargetForDimensions,
  bonusCatTargetForSize,
  bombRect,
  cellListStats,
  findBestBombTarget,
  megaBombCells,
  megaBombRect,
  normalizeRect,
  numberBagForRound,
  tripleUnitCountForRound,
  adjacentSeedCountForRound,
  rectStats,
} from '../js/board.js';
import { comboGainForClear, getRoundConfig, scoreForBomb, scoreForCatBonus, scoreForClear, scoreForMegaBomb, scoreForWideClear, shouldShowBeginnerAutoHint } from '../js/data.js';

for (const size of [4, 5, 6]) {
  for (let run = 0; run < 250; run += 1) {
    const board = new BoardModel(size);
    const answers = board.findAnswers();
    assert.equal(board.bonusCats.size, bonusCatTargetForSize(size), `${size}x${size} board must show its promised cat bonuses`);
    for (const key of board.bonusCats) {
      const [row, col] = key.split(':').map(Number);
      assert.equal(board.grid[row][col], null, 'a cat bonus replaces a number and contributes zero to the sum');
      assert.ok(
        answers.some((answer) => row >= answer.r1 && row <= answer.r2 && col >= answer.c1 && col <= answer.c2),
        'every cat bonus must be collectable inside at least one sum-ten rectangle',
      );
    }
    assert.ok(answers.length >= 1, `${size}x${size} board must start with a playable choice`);
    assert.equal(board.shuffleRemaining(), true, `${size}x${size} shuffle must succeed`);
    assert.ok(board.findAnswer(), `${size}x${size} shuffled board must keep an answer`);
  }
}

for (const numberCount of [15, 23, 33, 46, 52, 59, 65, 110]) {
  for (const round of [1, 3, 5, 8]) {
    const bag = numberBagForRound(numberCount, round);
    assert.equal(bag.length, numberCount, 'scaled original bag must fit the playable number slots');
    assert.equal(bag.reduce((sum, value) => sum + value, 0) % 10, 0, 'scaled original bag must be fully divisible into sum-ten groups');
    assert.ok(bag.every((value) => value >= 1 && value <= 9));
  }
}
const easyBag = numberBagForRound(110, 1);
const hardBag = numberBagForRound(110, 8);
assert.ok(easyBag.filter((value) => value === 5).length > hardBag.filter((value) => value === 5).length, 'early bags must contain more easy-to-read fives');
for (const bag of [easyBag]) {
  assert.equal(bag.filter((value) => value === 1).length, bag.filter((value) => value === 9).length);
  assert.equal(bag.filter((value) => value === 2).length, bag.filter((value) => value === 8).length);
  assert.equal(bag.filter((value) => value === 3).length, bag.filter((value) => value === 7).length);
  assert.equal(bag.filter((value) => value === 4).length, bag.filter((value) => value === 6).length);
}
assert.equal(tripleUnitCountForRound(110, 1), 0);
assert.ok(tripleUnitCountForRound(110, 8) >= 7, 'late bags replace some obvious pairs with sum-ten triples');
assert.equal(adjacentSeedCountForRound(1), 3);
assert.equal(adjacentSeedCountForRound(3), 2);
assert.equal(adjacentSeedCountForRound(6), 1);
assert.deepEqual(boardPacingForRound(1), { targetAnswers: 6, maximumAnswers: 8, minimumAnswers: 4, minimumAdjacentPairs: 3, maximumAdjacentPairs: 5, minimumRichAnswers: 1 });
assert.deepEqual(boardPacingForRound(5), { targetAnswers: 12, maximumAnswers: 15, minimumAnswers: 9, minimumAdjacentPairs: 1, maximumAdjacentPairs: 3, minimumRichAnswers: 5 });
assert.equal(boardPacingForRound(7, 'starter').minimumAdjacentPairs, 2);

assert.equal(boardAssistForSuccessCount(0), 'starter');
assert.equal(boardAssistForSuccessCount(1), 'starter');
assert.equal(boardAssistForSuccessCount(4), 'starter');
assert.equal(boardAssistForSuccessCount(14), 'starter');
assert.equal(boardAssistForSuccessCount(15), 'guided');
assert.equal(boardAssistForSuccessCount(35), 'guided');
assert.equal(boardAssistForSuccessCount(54), 'guided');
assert.equal(boardAssistForSuccessCount(55), 'standard');
assert.equal(BOARD_ASSIST_PROFILES.starter.minimumAdjacentPairs, 3);
assert.equal(EASY_BOARD_BONUS.minimumAnswers, 1);

assert.deepEqual(getRoundConfig(1), { stage: 1, round: 1, size: 4, cols: 4, rows: 4, target: 3, timeLimit: 120, clockChance: 0, bombChance: 0 });
assert.deepEqual(
  [1, 2, 3, 4, 5].map((stage) => {
    const config = getRoundConfig(stage);
    return [config.cols, config.rows, config.target];
  }),
  [[4, 4, 3], [5, 5, 5], [6, 6, 7], [6, 6, 9], [7, 7, 11]],
);
assert.deepEqual(
  [6, 7, 8].map((stage) => {
    const config = getRoundConfig(stage);
    return [config.cols, config.rows, config.target];
  }),
  [[7, 8, 12], [7, 9, 14], [7, 10, 16]],
);
assert.equal(getRoundConfig(20).size, 7);
assert.equal(getRoundConfig(20).rows, 10);
assert.equal(getRoundConfig(20).timeLimit, 120);
assert.ok(getRoundConfig(20).target > getRoundConfig(10).target);
assert.ok(getRoundConfig(20).clockChance < 0.07, 'late-stage clocks must stay rare');

{
  const board = new BoardModel(6);
  const placed = board.assignSpecialTiles(['clock', 'bomb'], () => 0);
  assert.equal(placed.length, 2);
  assert.deepEqual(new Set(placed.map(({ type }) => type)), new Set(['clock', 'bomb']));
  placed.forEach(({ r, c, type }) => assert.equal(board.specialAt(r, c), type));
  assert.ok(placed.every(({ r, c }) => board.findAnswers().some((answer) => r >= answer.r1 && r <= answer.r2 && c >= answer.c1 && c <= answer.c2)));
  assert.equal(board.shuffleRemaining(), true);
  assert.equal(board.specialTiles.size, 2, 'shuffle keeps both special-tile types on playable cells');
}

for (const size of [7, 8, 9]) {
  for (let run = 0; run < 8; run += 1) {
    const board = new BoardModel(size);
    const answers = board.findAnswers();
    assert.equal(board.grid.length, size);
    assert.equal(board.grid[0].length, size);
    assert.ok(answers.length >= 1, `${size}x${size} late board must keep a playable answer`);
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
assert.deepEqual(catStatsModel.stats({ r1: 0, c1: 0, r2: 1, c2: 0 }), { sum: 4, count: 1, catCount: 1, specials: [] });
assert.equal(catStatsModel.remainingPlayableCells(), 4);
const hintModel = new BoardModel(3);
hintModel.grid = [[5, 5, 9], [2, 3, 5], [8, 8, 8]];
hintModel.bonusCats = new Set();
assert.equal(hintModel.findEasyAnswer().count, 2, 'onboarding keeps the easiest two-cell answer');
assert.ok(hintModel.findHintAnswer().count >= 3, 'live hints prioritize a richer three-cell answer');
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
assert.equal(comboGainForClear(4), 1, 'normal clears advance one combo');
assert.equal(comboGainForClear(5), 2, 'five-cell clears advance two combo');
assert.equal(scoreForWideClear(4, 8), 0, 'four-cell clears do not receive WOW score');
assert.equal(scoreForWideClear(5, 1), 120, 'five-cell clears receive a visible WOW score');
assert.ok(scoreForWideClear(6, 5) > scoreForWideClear(5, 5), 'wider clears increase the WOW reward');
assert.equal(scoreForCatBonus(1, 1), 120, 'one cat grants a visible base bonus on the V2 score scale');
assert.ok(scoreForCatBonus(1, 5) > scoreForCatBonus(1, 1), 'cat bonus follows the live combo multiplier');
assert.equal(scoreForBomb(37), 231, 'bomb reward must be meaningful on the V2 score scale');
assert.equal(scoreForMegaBomb(37), 368, 'mega bomb reward must exceed a normal bomb without replacing core clears');
assert.equal(shouldShowBeginnerAutoHint({ running: true, timeLeft: 35, idleMs: 6000, bestScore: 2000, completedRuns: 2 }), true);
assert.equal(shouldShowBeginnerAutoHint({ running: true, timeLeft: 41, idleMs: 9000, bestScore: 2000, completedRuns: 2 }), false);
assert.equal(shouldShowBeginnerAutoHint({ running: true, timeLeft: 35, idleMs: 9000, bestScore: 9000, completedRuns: 4 }), false);

console.log('board.test.mjs: 750 regular and 300 early-assist boards plus scoring assertions passed');
