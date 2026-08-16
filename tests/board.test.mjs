import assert from 'node:assert/strict';
import {
  BOARD_DIFFICULTY,
  BOARD_ASSIST_PROFILES,
  BoardModel,
  EASY_BOARD_BONUS,
  analyzeAnswerDiversity,
  analyzeAnswerSpread,
  boardAssistForPerformance,
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
import { comboGainForClear, comboMultiplier, getRoundConfig, scoreForBomb, scoreForCatBonus, scoreForClear, scoreForCloverBonus, scoreForClutch, scoreForMegaBomb, scoreForWideClear, shouldShowBeginnerAutoHint } from '../js/data.js';

const originalRandom = Math.random;
let randomState = 20260809;
Math.random = () => {
  randomState += 0x6d2b79f5;
  let mixed = randomState;
  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
};

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
// Seeding and pacing follow difficultyPhaseForStage: the gentler one-axis
// ladder maps each stage onto the old band scale by matching cell counts,
// so stage 3 (25 cells, like the old stage 2) still seeds three pairs and
// stage 5 (36 cells, like the old stage 4) gets the old stage-4 pacing.
assert.equal(adjacentSeedCountForRound(1), 4);
assert.equal(adjacentSeedCountForRound(3), 3);
assert.equal(adjacentSeedCountForRound(5), 1);
assert.equal(adjacentSeedCountForRound(6), 0);
assert.deepEqual(boardPacingForRound(1), {
  targetAnswers: 6, maximumAnswers: 8, minimumAnswers: 4,
  maximumSimpleAnswers: 6,
  minimumAdjacentPairs: 3, maximumAdjacentPairs: 5, minimumRichAnswers: 1,
  minimumShapePatterns: 3, minimumValuePatterns: 4, minimumOrientations: 2,
  minimumAnswerZones: 3, maximumDominantCellShare: 0.52,
});
assert.deepEqual(boardPacingForRound(5), {
  targetAnswers: 11, maximumAnswers: 14, minimumAnswers: 8,
  maximumSimpleAnswers: 5,
  minimumAdjacentPairs: 1, maximumAdjacentPairs: 2, minimumRichAnswers: 4,
  minimumShapePatterns: 5, minimumValuePatterns: 5, minimumOrientations: 2,
  minimumAnswerZones: 4, maximumDominantCellShare: 0.46,
});
assert.equal(boardPacingForRound(7, 'starter').minimumAdjacentPairs, 1);

for (const stage of [1, 3, 5, 8, 10]) {
  const config = getRoundConfig(stage);
  const pacing = boardPacingForRound(stage);
  const samples = [];
  for (let run = 0; run < 16; run += 1) {
    const board = new BoardModel(config.cols);
    board.generate(config.cols, { cols: config.cols, rows: config.rows, round: stage });
    const answers = board.findAnswers();
    samples.push({
      simpleAnswers: answers.filter((answer) => answer.count === 2).length,
      adjacentPairs: answers.filter((answer) => answer.count === 2
        && (answer.r2 - answer.r1 + 1) * (answer.c2 - answer.c1 + 1) === 2).length,
      ...analyzeAnswerDiversity(board.grid, answers),
      ...analyzeAnswerSpread(board.grid, answers),
    });
  }
  const mean = (key) => samples.reduce((sum, sample) => sum + sample[key], 0) / samples.length;
  assert.ok(mean('shapePatterns') >= pacing.minimumShapePatterns, `stage ${stage} must vary answer shapes across boards`);
  assert.ok(mean('valuePatterns') >= pacing.minimumValuePatterns, `stage ${stage} must vary number combinations across boards`);
  assert.ok(mean('orientations') >= pacing.minimumOrientations, `stage ${stage} must mix answer directions across boards`);
  assert.ok(mean('answerZones') >= pacing.minimumAnswerZones - 0.1, `stage ${stage} must spread answers around the board`);
  assert.ok(mean('dominantCellShare') <= pacing.maximumDominantCellShare + 0.05, `stage ${stage} must not funnel most answers through one cell`);
  assert.ok(mean('simpleAnswers') <= pacing.maximumSimpleAnswers + 0.75, `stage ${stage} must limit obvious two-number answers`);
  assert.ok(mean('adjacentPairs') <= pacing.maximumAdjacentPairs + 0.4, `stage ${stage} must respect its adjacent-pair difficulty`);
}

assert.equal(boardAssistForSuccessCount(0), 'starter');
assert.equal(boardAssistForSuccessCount(1), 'starter');
assert.equal(boardAssistForSuccessCount(4), 'starter');
assert.equal(boardAssistForSuccessCount(14), 'starter');
assert.equal(boardAssistForSuccessCount(15), 'guided');
assert.equal(boardAssistForSuccessCount(35), 'guided');
assert.equal(boardAssistForSuccessCount(54), 'guided');
assert.equal(boardAssistForSuccessCount(55), 'standard');
assert.equal(boardAssistForPerformance({ stage: 1, maxCombo: 20 }), 'starter');
assert.equal(boardAssistForPerformance({ stage: 2, successCount: 8, failureCount: 1, maxCombo: 5 }), 'guided');
assert.equal(boardAssistForPerformance({ stage: 3, successCount: 10, failureCount: 0, maxCombo: 10 }), 'standard');
assert.equal(boardAssistForPerformance({ stage: 4, successCount: 5, failureCount: 4, maxCombo: 2 }), 'starter');
assert.equal(boardAssistForPerformance({ stage: 5, successCount: 20, failureCount: 1, maxCombo: 12 }), 'standard');
assert.equal(boardAssistForPerformance({ stage: 6, successCount: 8, failureCount: 8, maxCombo: 2 }), 'guided');
assert.equal(BOARD_ASSIST_PROFILES.starter.minimumAdjacentPairs, 3);
assert.equal(EASY_BOARD_BONUS.minimumAnswers, 1);

assert.deepEqual(getRoundConfig(1), { stage: 1, round: 1, size: 4, cols: 4, rows: 4, timeLimit: 120, bombChance: 0 });
// The ladder grows one axis per stage, rows first: tile size on a phone is
// set by the column count, so the two width steps (to 5 and to 6 columns)
// each sit between rows-only stages that hold tile size steady.
assert.deepEqual(
  [1, 2, 3, 4, 5].map((stage) => {
    const config = getRoundConfig(stage);
    return [config.cols, config.rows];
  }),
  [[4, 4], [4, 5], [5, 5], [5, 6], [6, 6]],
);
// The board stops growing at 6x7 so the late-stage numerals stay readable and
// the cell keeps its near-square proportion; difficulty rides on `target` and
// the value mix and bomb odds from STAGE 6 on instead of a bigger board.
assert.deepEqual(
  [6, 7, 8, 9, 10].map((stage) => {
    const config = getRoundConfig(stage);
    return [config.cols, config.rows];
  }),
  [[6, 7], [6, 7], [6, 7], [6, 7], [6, 7]],
);
{
  // The board never shrinks and never passes its caps: `rows` sets the type
  // size, and `cols` past 6 both clutters the board and flattens the square
  // tile art. Stages carry no target at all — a board runs until it is dry.
  const dimensions = Array.from({ length: 20 }, (_, index) => getRoundConfig(index + 1));
  dimensions.forEach((config, index) => {
    if (index === 0) return;
    const previous = dimensions[index - 1];
    assert.ok(config.cols >= previous.cols && config.rows >= previous.rows,
      `STAGE ${index + 1} must not shrink the board`);
    assert.ok(config.cols === previous.cols || config.rows === previous.rows,
      `STAGE ${index + 1} may grow only one axis, so tiles shrink as rarely as possible`);
  });
  assert.ok(dimensions.every((config) => config.rows <= 7), 'no stage may exceed seven rows');
  assert.ok(dimensions.every((config) => config.cols <= 6), 'no stage may exceed six columns');
}
assert.equal(getRoundConfig(20).size, 6);
assert.equal(getRoundConfig(20).rows, 7);
assert.equal(getRoundConfig(20).timeLimit, 120);
assert.equal(getRoundConfig(20).target, undefined, 'extrapolated stages must not reintroduce a target');
// The clock tile is retired: no stage config may carry a chance for it, and
// the board must refuse to place one even if a caller asks.
assert.equal(getRoundConfig(20).clockChance, undefined, 'no stage may define a clock-tile chance');
assert.ok(getRoundConfig(20).bombChance < 0.6, 'late-stage bomb tiles must stay bounded');

{
  const board = new BoardModel(6);
  // A clock tile can no longer reach the board even when a caller asks for
  // one: the type is filtered out at placement, so the retired mechanic
  // cannot return through a stale call site.
  const placed = board.assignSpecialTiles(['clock', 'bomb'], () => 0);
  assert.equal(placed.length, 1, 'only the bomb tile may be placed');
  assert.deepEqual(new Set(placed.map(({ type }) => type)), new Set(['bomb']));
  placed.forEach(({ r, c, type }) => assert.equal(board.specialAt(r, c), type));
  assert.ok(placed.every(({ r, c }) => board.findAnswers().some((answer) => r >= answer.r1 && r <= answer.r2 && c >= answer.c1 && c <= answer.c2)));
  assert.equal(board.shuffleRemaining(), true);
  assert.equal(board.specialTiles.size, 1, 'shuffle keeps the bomb tile on a playable cell');
  assert.deepEqual(board.assignSpecialTiles(['clock'], () => 0), [], 'a clock-only request places nothing');
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
const denseBombTarget = findBestBombTarget(Array.from({ length: 7 }, () => Array(7).fill(5)));
assert.equal(denseBombTarget.stats.count, 6, 'inventory bomb targets at most six live number cells');
assert.deepEqual(rectStats([[4, 6], [null, 8]], { r1: 0, c1: 0, r2: 0, c2: 1 }), { sum: 10, count: 2 });
const catStatsModel = new BoardModel(4);
catStatsModel.grid = [[4, 6], [null, 8]];
catStatsModel.bonusCats = new Set(['1:0']);
assert.deepEqual(catStatsModel.stats({ r1: 0, c1: 0, r2: 1, c2: 0 }), { sum: 4, count: 1, catCount: 1, specials: [] });
assert.equal(catStatsModel.remainingPlayableCells(), 4);
const hintModel = new BoardModel(3);
hintModel.grid = [[5, 5, 9], [2, 3, 5], [8, 8, 8]];
hintModel.bonusCats = new Set();
assert.deepEqual(analyzeAnswerDiversity(hintModel.grid, hintModel.findAnswers()), {
  shapePatterns: 3,
  valuePatterns: 3,
  orientations: 2,
});
assert.deepEqual(analyzeAnswerSpread(hintModel.grid, hintModel.findAnswers()), {
  answerZones: 3,
  dominantCellShare: 2 / 3,
});
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
assert.equal(comboMultiplier(10), comboMultiplier(80), 'combo score multiplier remains capped for long streaks');
assert.ok(scoreForClear(4, 1) > scoreForClear(2, 1) * 2, 'large rectangles must earn a meaningful bonus');
assert.equal(comboGainForClear(3), 1, 'small clears advance one combo');
assert.equal(comboGainForClear(4), 2, 'four-cell clears advance two combo');
assert.equal(scoreForWideClear(4, 8), 0, 'four-cell clears do not receive WOW score');
assert.equal(scoreForWideClear(5, 1), 120, 'five-cell clears receive a visible WOW score');
assert.ok(scoreForWideClear(6, 5) > scoreForWideClear(5, 5), 'wider clears increase the WOW reward');
assert.equal(scoreForCatBonus(1, 1), 120, 'one cat grants a visible base bonus on the V2 score scale');
assert.ok(scoreForCatBonus(1, 5) > scoreForCatBonus(1, 1), 'cat bonus follows the live combo multiplier');
assert.equal(scoreForBomb(37, 9), 823, 'bomb reward must reflect both cleared cells and their value');
assert.equal(scoreForMegaBomb(37, 12), 1308, 'mega bomb reward must feel rarer and stronger than a normal bomb');
assert.equal(scoreForCloverBonus(823), 412, 'clover adds a clear half-score bonus to the next success');
assert.equal(scoreForClutch(11, 8), 0, 'ordinary play does not receive the final countdown bonus');
assert.equal(scoreForClutch(8, 8), 170, 'the last ten seconds add a modest skill bonus');
assert.equal(scoreForClutch(2, 8), 260, 'the last three seconds carry the strongest clutch reward');
assert.equal(shouldShowBeginnerAutoHint({ running: true, timeLeft: 35, idleMs: 6000, bestScore: 2000, completedRuns: 2 }), true);
assert.equal(shouldShowBeginnerAutoHint({ running: true, timeLeft: 41, idleMs: 9000, bestScore: 2000, completedRuns: 2 }), false);
assert.equal(shouldShowBeginnerAutoHint({ running: true, timeLeft: 35, idleMs: 9000, bestScore: 9000, completedRuns: 4 }), false);

Math.random = originalRandom;
console.log('board.test.mjs: 750 regular and 300 early-assist boards plus scoring assertions passed');
