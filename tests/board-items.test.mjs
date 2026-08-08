import assert from 'node:assert/strict';
import test from 'node:test';
import { BoardItemField, rankBoardItemCells } from '../js/board-items.js';
import { boardDropInventoryGrant, boardDropReward, chooseBoardDrop, comboWindowMsForProgress, freezeTimeline, itemRewardCountdown, shouldAdvanceRound } from '../js/data.js';

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
  assert.equal(comboWindowMsForProgress(1, 0), 5600);
  assert.equal(comboWindowMsForProgress(2, 14), 5600);
  assert.equal(comboWindowMsForProgress(3, 20), 4800);
  assert.equal(comboWindowMsForProgress(4, 24), 4100);
  assert.equal(comboWindowMsForProgress(6, 58), 3500);
  assert.equal(comboWindowMsForProgress(7, 75), 3200);
});

test('board items appear only when a seven-combo boundary is crossed', () => {
  assert.equal(boardDropReward(0, 1, 0), null);
  assert.equal(boardDropReward(1, 2, 0), null);
  assert.equal(boardDropReward(6, 7, 1), 'milestone');
  assert.equal(boardDropReward(6, 8, 1), 'milestone');
  assert.equal(boardDropReward(7, 8, 2), null);
  assert.equal(boardDropReward(13, 14, 2), 'milestone');
});

test('the reward countdown makes the sixth combo an explicit one-more moment', () => {
  assert.equal(itemRewardCountdown(0), 7);
  assert.equal(itemRewardCountdown(1), 6);
  assert.equal(itemRewardCountdown(5), 2);
  assert.equal(itemRewardCountdown(6), 1);
  assert.equal(itemRewardCountdown(7), 7);
  assert.equal(itemRewardCountdown(13), 1);
});

test('a round waits until its goal is met and no sum-ten answer remains', () => {
  assert.equal(shouldAdvanceRound(3, 3, true), false);
  assert.equal(shouldAdvanceRound(2, 3, false), false);
  assert.equal(shouldAdvanceRound(3, 3, false), true);
  assert.equal(shouldAdvanceRound(5, 3, false), true);
});

test('combo-seven pool only returns currently implemented drops', () => {
  assert.ok(['bomb', 'clock'].includes(chooseBoardDrop(7, () => 0.1).id));
  assert.equal(chooseBoardDrop(7, () => 0, { cloverGiven: true }).id, 'bomb');
  assert.equal(chooseBoardDrop(7, () => 0.999, { cloverGiven: true }).id, 'clock');
  for (const random of [0, 0.24, 0.49, 0.74, 0.999]) {
    assert.ok(['bomb', 'clock'].includes(chooseBoardDrop(7, () => random, { cloverGiven: true }).id));
  }
  assert.equal(chooseBoardDrop(21, () => 0.1).id, 'clover');
  assert.equal(chooseBoardDrop(14, () => 0.999, { cloverGiven: true }).id, 'megabomb');
  assert.equal(chooseBoardDrop(21, () => 0.7, { cloverGiven: true }).id, 'freeze');
  for (const combo of [14, 21, 35]) {
    for (const random of [0, 0.24, 0.49, 0.74, 0.999]) {
      assert.ok(['bomb', 'clock', 'megabomb', 'freeze'].includes(
        chooseBoardDrop(combo, () => random, { cloverGiven: true }).id,
      ));
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

test('round transition can bank basic drops while advanced drops remain queued', () => {
  const field = new BoardItemField();
  field.set('bomb', 0, 0);
  field.set('freeze', 0, 1);
  field.queue('clock', { earnedAtCombo: 7 });
  field.queue('clover', { earnedAtCombo: 14 });
  assert.deepEqual(field.extractTypes(new Set(['bomb', 'clock'])).map((item) => item.type).sort(), ['bomb', 'clock']);
  assert.deepEqual([...field.items.values()].map((item) => item.type), ['freeze']);
  assert.deepEqual(field.pending.map((item) => item.type), ['clover']);
});
