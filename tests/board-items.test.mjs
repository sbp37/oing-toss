import assert from 'node:assert/strict';
import test from 'node:test';
import { BoardItemField, rankBoardItemCells } from '../js/board-items.js';
import { boardDropInventoryGrant, boardDropReward, cappedSessionTime, chooseBoardDrop, comboAfterFailure, comboAfterIdle, comboAfterIncorrectSelection, comboMilestoneCrossed, comboWindowMsForStage, completesStageChallenge, freezeTimeline, itemRewardCountdown, itemUnlockGrantForStage, isNearMissSum, rebasePausedTimeline, roundTimeBonusSeconds, shouldAdvanceRound, shouldOfferStruggleHint, specialTilePlanForStage, stageChallengeBonus, stageChallengeForStage, stageClearBonus, stageProgressGainForClear } from '../js/data.js';

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

test('background pause rebases game, freeze and combo deadlines together', () => {
  assert.deepEqual(rebasePausedTimeline({
    endAt: 62000,
    freezeEndsAt: 17000,
    comboExpiresAt: 6500,
    pauseStartedAt: 2000,
    resumedAt: 12000,
  }), {
    pauseDuration: 10000,
    endAt: 72000,
    freezeEndsAt: 27000,
    comboExpiresAt: 16500,
  });
  assert.deepEqual(rebasePausedTimeline({
    endAt: 62000,
    freezeEndsAt: 0,
    comboExpiresAt: 0,
    pauseStartedAt: 2000,
    resumedAt: 12000,
  }), {
    pauseDuration: 10000,
    endAt: 72000,
    freezeEndsAt: 0,
    comboExpiresAt: 0,
  });
});

test('only major board-size transitions refill time and held time stays capped', () => {
  assert.equal(roundTimeBonusSeconds(1), 5);
  assert.equal(roundTimeBonusSeconds(2), 10);
  assert.equal(roundTimeBonusSeconds(3), 0);
  assert.equal(roundTimeBonusSeconds(4), 15);
  assert.equal(roundTimeBonusSeconds(5), 0);
  assert.equal(roundTimeBonusSeconds(10), 0);
  assert.equal(cappedSessionTime(90, 5), 95);
  assert.equal(cappedSessionTime(117, 10), 120);
  assert.equal(cappedSessionTime(120, 15), 120);
});

test('stage bonus and special tiles ramp in after the tutorial stages', () => {
  assert.ok(stageClearBonus(8, 30, true) > stageClearBonus(1, 0, false));
  assert.deepEqual(specialTilePlanForStage(3, () => 0), []);
  assert.deepEqual(specialTilePlanForStage(4, () => 0), ['bomb']);
  assert.deepEqual(specialTilePlanForStage(6, () => 0), ['clock', 'bomb']);
  assert.deepEqual(specialTilePlanForStage(7, () => 0), ['clock', 'bomb']);
  assert.deepEqual(specialTilePlanForStage(10, () => 0.9), []);
});

test('combo grace tightens by stage and idle decay stays forgiving early', () => {
  assert.equal(comboWindowMsForStage(1), 5200);
  assert.equal(comboWindowMsForStage(3), 4500);
  assert.equal(comboWindowMsForStage(6), 3800);
  assert.equal(comboWindowMsForStage(9), 3300);
  assert.equal(comboAfterIdle(5, 2), 4);
  assert.equal(comboAfterIdle(5, 6), 3);
  assert.equal(comboAfterIdle(1, 9), 0);
});

test('large five-cell answers accelerate the goal without making ordinary answers ambiguous', () => {
  assert.equal(stageProgressGainForClear(2), 1);
  assert.equal(stageProgressGainForClear(4), 1);
  assert.equal(stageProgressGainForClear(5), 2);
  assert.equal(stageProgressGainForClear(8), 2);
});

test('bomb and clock inventory unlock only when their teaching stages begin', () => {
  assert.equal(itemUnlockGrantForStage(2), null);
  assert.deepEqual(itemUnlockGrantForStage(3), { bomb: 1 });
  assert.equal(itemUnlockGrantForStage(4), null);
  assert.deepEqual(itemUnlockGrantForStage(5), { clock: 1 });
  assert.equal(itemUnlockGrantForStage(6), null);
});

test('late stages rotate optional skill bonuses without replacing the main goal', () => {
  assert.equal(stageChallengeForStage(5), null);
  assert.equal(stageChallengeForStage(6).kind, 'wide');
  assert.equal(stageChallengeForStage(7).kind, 'cat');
  assert.equal(stageChallengeForStage(8).kind, 'chain');
  assert.equal(stageChallengeForStage(9).kind, 'wide');
  assert.equal(completesStageChallenge(stageChallengeForStage(6), { cellCount: 4 }), false);
  assert.equal(completesStageChallenge(stageChallengeForStage(6), { cellCount: 5 }), true);
  assert.equal(completesStageChallenge(stageChallengeForStage(7), { catCount: 1 }), true);
  assert.equal(completesStageChallenge(stageChallengeForStage(8), { stageStreak: 2 }), false);
  assert.equal(completesStageChallenge(stageChallengeForStage(8), { stageStreak: 3 }), true);
  assert.ok(stageChallengeBonus(10) > stageChallengeBonus(6));
});

test('a wrong rectangle trims combo by thirty percent instead of erasing it', () => {
  assert.equal(comboAfterFailure(1), 0);
  assert.equal(comboAfterFailure(5), 3);
  assert.equal(comboAfterFailure(10), 7);
  assert.equal(comboAfterFailure(21), 14);
});

test('near-ten mistakes receive a smaller combo penalty and early struggle help', () => {
  assert.equal(isNearMissSum(9), true);
  assert.equal(isNearMissSum(11), true);
  assert.equal(isNearMissSum(8), false);
  assert.equal(comboAfterIncorrectSelection(8, 9), 7);
  assert.equal(comboAfterIncorrectSelection(8, 11), 7);
  assert.equal(comboAfterIncorrectSelection(8, 7), comboAfterFailure(8));
  assert.equal(shouldOfferStruggleHint(4, 3), true);
  assert.equal(shouldOfferStruggleHint(5, 3), false);
  assert.equal(shouldOfferStruggleHint(3, 2), false);
});

test('two-combo WOW clears cannot skip celebration thresholds', () => {
  assert.equal(comboMilestoneCrossed(2, 3), 3);
  assert.equal(comboMilestoneCrossed(4, 6), 5);
  assert.equal(comboMilestoneCrossed(7, 9), 8);
  assert.equal(comboMilestoneCrossed(8, 10), 0);
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
  assert.equal(itemRewardCountdown(6, 2), 0, 'tutorial stages do not tease locked rewards');
  assert.equal(itemRewardCountdown(0, 3), 7);
  assert.equal(itemRewardCountdown(1, 3), 6);
  assert.equal(itemRewardCountdown(5, 3), 2);
  assert.equal(itemRewardCountdown(6, 3), 1);
  assert.equal(itemRewardCountdown(7, 3), 7);
  assert.equal(itemRewardCountdown(13, 5), 1);
});

test('stage advances only when its explicit success target is reached', () => {
  assert.equal(shouldAdvanceRound(3, 3, true), true);
  assert.equal(shouldAdvanceRound(2, 3, false), false);
  assert.equal(shouldAdvanceRound(3, 3, false), true);
  assert.equal(shouldAdvanceRound(5, 3, false), true);
});

test('combo-seven rewards unlock variety gradually while board actions stay dominant', () => {
  assert.equal(chooseBoardDrop(7, () => 0.999, { rewardIndex: 0, stage: 2 }), null);
  assert.equal(chooseBoardDrop(7, () => 0.999, { rewardIndex: 0, stage: 3 }).id, 'bomb');
  assert.equal(chooseBoardDrop(7, () => 0, { cloverGiven: true, rewardIndex: 1, stage: 3 }).id, 'bomb');
  assert.equal(chooseBoardDrop(7, () => 0.999, { cloverGiven: true, rewardIndex: 1, stage: 3 }).id, 'bomb');
  assert.equal(chooseBoardDrop(7, () => 0.999, { cloverGiven: true, rewardIndex: 1, stage: 5 }).id, 'clock');
  assert.equal(chooseBoardDrop(14, () => 0.999, { rewardIndex: 2, stage: 6 }).id, 'megabomb');
  assert.equal(chooseBoardDrop(21, () => 0.999, { rewardIndex: 3, stage: 7 }).id, 'freeze');
  assert.equal(chooseBoardDrop(28, () => 0.999, { rewardIndex: 4, stage: 8 }).id, 'clover');
  assert.equal(chooseBoardDrop(28, () => 0.999, { rewardIndex: 5, stage: 8, cloverGiven: true }).id, 'freeze');

  const lateDrops = Array.from({ length: 180 }, (_, index) => chooseBoardDrop(
    35,
    () => index / 180,
    { cloverGiven: false, rewardIndex: 5, stage: 9 },
  ).id);
  const bombs = lateDrops.filter((id) => id === 'bomb').length;
  const timeEffects = lateDrops.filter((id) => ['clock', 'freeze'].includes(id)).length;
  assert.ok(bombs >= 135, 'late rewards must still strongly favor tactile board actions');
  assert.ok(timeEffects <= 22, 'clock and freeze rewards must not enable endless survival');
  assert.ok(lateDrops.includes('megabomb'));
  assert.ok(lateDrops.includes('clover'));
});

test('earned drops teach with a bomb without forcing a clock after it', () => {
  assert.equal(chooseBoardDrop(7, () => 0.999, { rewardIndex: 0, stage: 3 }).id, 'bomb');
  assert.equal(chooseBoardDrop(7, () => 0, {
    rewardIndex: 1,
    previousType: 'bomb',
    cloverGiven: true,
    stage: 5,
  }).id, 'bomb');
  assert.equal(chooseBoardDrop(14, () => 0.999, {
    rewardIndex: 2,
    previousType: 'clock',
    cloverGiven: true,
    stage: 6,
  }).id, 'megabomb');
  assert.notEqual(chooseBoardDrop(21, () => 0.999, {
    rewardIndex: 4,
    previousType: 'freeze',
    cloverGiven: true,
    stage: 8,
  }).id, 'freeze');
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
