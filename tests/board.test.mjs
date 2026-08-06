import assert from 'node:assert/strict';
import { BoardModel, normalizeRect, rectStats } from '../js/board.js';
import { scoreForClear } from '../js/data.js';

for (const size of [4, 5, 6]) {
  for (let run = 0; run < 250; run += 1) {
    const board = new BoardModel(size);
    const answers = board.findAnswers();
    const minimumRichAnswers = size === 6 ? 3 : 2;
    assert.ok(answers.length > 0, `${size}x${size} board must start with an answer`);
    assert.ok(
      answers.filter((answer) => answer.count >= 3).length >= minimumRichAnswers,
      `${size}x${size} board must include varied 3+ cell answers`,
    );
    assert.equal(board.shuffleRemaining(), true, `${size}x${size} shuffle must succeed`);
    assert.ok(board.findAnswer(), `${size}x${size} shuffled board must keep an answer`);
  }
}

assert.deepEqual(normalizeRect({ r: 3, c: 2 }, { r: 1, c: 0 }), { r1: 1, r2: 3, c1: 0, c2: 2 });
assert.deepEqual(rectStats([[4, 6], [null, 8]], { r1: 0, c1: 0, r2: 0, c2: 1 }), { sum: 10, count: 2 });
assert.ok(scoreForClear(3, 5) > scoreForClear(3, 1), 'combo multiplier must increase score');
assert.ok(scoreForClear(4, 1) > scoreForClear(2, 1) * 2, 'large rectangles must earn a meaningful bonus');

console.log('board.test.mjs: 750 generated/shuffled boards and scoring assertions passed');
