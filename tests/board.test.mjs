import assert from 'node:assert/strict';
import { BOARD_DIFFICULTY, BoardModel, bombRect, normalizeRect, rectStats } from '../js/board.js';
import { scoreForBomb, scoreForClear } from '../js/data.js';

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

assert.deepEqual(normalizeRect({ r: 3, c: 2 }, { r: 1, c: 0 }), { r1: 1, r2: 3, c1: 0, c2: 2 });
assert.deepEqual(bombRect(4, 0, 0), { r1: 0, r2: 1, c1: 0, c2: 1 });
assert.deepEqual(bombRect(5, 2, 2), { r1: 1, r2: 3, c1: 1, c2: 3 });
assert.deepEqual(bombRect(6, 5, 5), { r1: 4, r2: 5, c1: 4, c2: 5 });
assert.deepEqual(rectStats([[4, 6], [null, 8]], { r1: 0, c1: 0, r2: 0, c2: 1 }), { sum: 10, count: 2 });
assert.ok(scoreForClear(3, 5) > scoreForClear(3, 1), 'combo multiplier must increase score');
assert.ok(scoreForClear(4, 1) > scoreForClear(2, 1) * 2, 'large rectangles must earn a meaningful bonus');
assert.equal(scoreForBomb(37), 57, 'bomb score keeps the original sum plus 20 idea');

console.log('board.test.mjs: 750 generated/shuffled boards and scoring assertions passed');
