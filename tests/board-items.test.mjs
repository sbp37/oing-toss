import assert from 'node:assert/strict';
import test from 'node:test';
import { BoardItemField, rankBoardItemCells } from '../js/board-items.js';
import { chooseBoardDrop } from '../js/data.js';

test('combo-seven pool only returns currently implemented drops', () => {
  assert.equal(chooseBoardDrop(7, () => 0).id, 'bomb');
  assert.equal(chooseBoardDrop(7, () => 0.999).id, 'clock');
  for (const combo of [7, 14, 21, 35]) {
    for (const random of [0, 0.24, 0.49, 0.74, 0.999]) {
      assert.ok(['bomb', 'clock'].includes(chooseBoardDrop(combo, () => random).id));
    }
  }
});

test('drops prefer empty cells next to playable numbers', () => {
  const ranked = rankBoardItemCells([
    [1, null, null],
    [2, null, 3],
    [null, null, null],
  ]);
  assert.deepEqual(ranked[0], { row: 1, col: 1 });
});

test('unused visible drops carry into the next board and reappear after a clear', () => {
  const field = new BoardItemField();
  field.queue('bomb', { earnedAtCombo: 7 });
  const first = field.place([
    [1, null],
    [2, 7],
  ]);
  assert.equal(first.length, 1);
  assert.equal(field.items.size, 1);
  field.carry();
  assert.equal(field.items.size, 0);
  assert.equal(field.pending.length, 1);
  assert.equal(field.place([[1, 9], [4, 6]]).length, 0);
  const restored = field.place([[1, null], [4, 6]]);
  assert.equal(restored.length, 1);
  assert.equal(restored[0].type, 'bomb');
});

test('consumed drops are removed without affecting queued rewards', () => {
  const field = new BoardItemField();
  const item = field.set('clock', 1, 2);
  field.queue('bomb');
  assert.equal(field.delete(`${item.row}:${item.col}`), true);
  assert.equal(field.items.size, 0);
  assert.equal(field.pending[0].type, 'bomb');
});
