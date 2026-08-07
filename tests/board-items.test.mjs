import assert from 'node:assert/strict';
import test from 'node:test';
import { BoardItemField, rankBoardItemCells } from '../js/board-items.js';
import { boardDropInventoryGrant, boardDropReward, chooseBoardDrop, comboWindowMsForProgress, freezeTimeline } from '../js/data.js';

test('all live board drops activate immediately instead of requiring a second inventory tap', () => {
  assert.equal(boardDropInventoryGrant('bomb'), null);
  assert.equal(boardDropInventoryGrant('clock'), null);
  assert.equal(boardDropInventoryGrant('megabomb'), null);
  assert.equal(boardDropInventoryGrant('freeze'), null);
  assert.equal(boardDropInventoryGrant('clover'), null);
});

test('time freeze holds the displayed time and rebases the deadline after 15 seconds', () => {
  assert.deepEqual(freezeTimeline(2000, 43.5), {
    freezeEndsAt: 17000,
    frozenTimeLeft: 43.5,
    endAt: 60500,
  });
});

test('combo timing starts forgiving and tightens as the run advances', () => {
  assert.equal(comboWindowMsForProgress(1, 0), 5200);
  assert.equal(comboWindowMsForProgress(2, 6), 4400);
  assert.equal(comboWindowMsForProgress(3, 14), 3700);
  assert.equal(comboWindowMsForProgress(3, 24), 3200);
});

test('the first short chain guarantees an early board item, then seven-combo milestones take over', () => {
  assert.equal(boardDropReward(0, 1, 0), null);
  assert.equal(boardDropReward(1, 2, 0), 'starter');
  assert.equal(boardDropReward(1, 2, 1), null);
  assert.equal(boardDropReward(6, 7, 1), 'milestone');
  assert.equal(boardDropReward(7, 8, 2), null);
  assert.equal(boardDropReward(13, 14, 2), 'milestone');
});

test('combo-seven pool only returns currently implemented drops', () => {
  assert.equal(chooseBoardDrop(7, () => 0).id, 'bomb');
  assert.equal(chooseBoardDrop(7, () => 0.999).id, 'clock');
  for (const random of [0, 0.24, 0.49, 0.74, 0.999]) {
    assert.ok(['bomb', 'clock'].includes(chooseBoardDrop(7, () => random).id));
  }
  assert.equal(chooseBoardDrop(14, () => 0.999).id, 'freeze');
  assert.equal(chooseBoardDrop(21, () => 0.5).id, 'megabomb');
  for (const combo of [14, 21, 35]) {
    for (const random of [0, 0.24, 0.49, 0.74, 0.999]) {
      assert.ok(['bomb', 'clock', 'megabomb', 'freeze', 'clover'].includes(chooseBoardDrop(combo, () => random).id));
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
