import assert from 'node:assert/strict';
import {
  BOARD_DIFFICULTY,
  BoardModel,
  EASY_BOARD_BONUS,
  bombRect,
  cellListStats,
  findBestBombTarget,
  megaBombCells,
  megaBombRect,
  normalizeRect,
  rectStats,
} from '../js/board.js';
import { scoreForBomb, scoreForClear, scoreForMegaBomb } from '../js/data.js';

for (const size of [4, 5, 6]) {
  for (let run = 0; run < 250; run += 1) {
    const board = new BoardModel(size);
    const answers = board.findAnswers();
    const profile = BOARD_DIFFICULTY[size];
    assert.ok(answers.length >= profile.minimumAnswers, `${size}x${size} board must start with enough choices`);
    assert.ok(
      answers.filter((answer) => answer.count === 2).length >= profile.minimumSimpleAnswers,
      `${size}x${size} board must keep its round-specific simple-answer floor`,
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
    const easyAnswer = board.findEasyAnswer();
    assert.equal(easyAnswer.count, 2, `${size}x${size} onboarding answer should prefer a pair`);
    assert.equal(
      (easyAnswer.r2 - easyAnswer.r1 + 1) * (easyAnswer.c2 - easyAnswer.c1 + 1),
      2,
      `${size}x${size} onboarding pair should be adjacent`,
    );
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
assert.equal(scoreForBomb(37), 57, 'bomb score keeps the original sum plus 20 idea');
assert.equal(scoreForMegaBomb(37), 77, 'mega bomb score keeps the original sum plus 40 idea');

console.log('board.test.mjs: 750 regular and 300 early-assist boards plus scoring assertions passed');
