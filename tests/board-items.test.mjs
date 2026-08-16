import assert from 'node:assert/strict';
import test from 'node:test';
import { BoardItemField, rankBoardItemCells } from '../js/board-items.js';
import { availableItemTimeBonus, boardDropInventoryGrant, boardDropReward, cappedSessionTime, chooseBoardDrop, comboAfterFailure, comboAfterIdle, comboAfterIncorrectSelection, comboMilestoneCrossed, comboWindowMsForStage, completesStageChallenge, freezeTimeline, isItemUnlockedAtStage, itemRewardCountdown, itemUnlockGrantForStage, isNearMissSum, nextBoardDropPity, rebasePausedTimeline, roundTimeBonusSeconds, shouldAdvanceRound, shouldOfferStruggleHint, specialTilePlanForStage, stageChallengeBonus, stageChallengeForStage, stageChallengeProgress, stageClearBonus, stageProgressGainForClear, stageShowcaseBoardDrop } from '../js/data.js';

test('all live board drops activate immediately instead of requiring a second inventory tap', () => {
  assert.equal(boardDropInventoryGrant('bomb'), null);
  assert.equal(boardDropInventoryGrant('clock'), null);
  assert.equal(boardDropInventoryGrant('megabomb'), null);
  assert.equal(boardDropInventoryGrant('freeze'), null);
  assert.equal(boardDropInventoryGrant('clover'), null);
});

test('time freeze holds the displayed time and rebases the deadline after 10 seconds', () => {
  assert.deepEqual(freezeTimeline(2000, 43.5), {
    freezeEndsAt: 12000,
    frozenTimeLeft: 43.5,
    endAt: 55500,
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

test('board growth pays big time bonuses, later flat clears pay small ones', () => {
  assert.equal(roundTimeBonusSeconds(1), 6);
  assert.equal(roundTimeBonusSeconds(2), 10);
  assert.equal(roundTimeBonusSeconds(3), 4, 'same-size clears from stage 3 pay a small bonus');
  assert.equal(roundTimeBonusSeconds(4), 10);
  assert.equal(roundTimeBonusSeconds(5), 4);
  assert.equal(roundTimeBonusSeconds(10), 4);
  assert.equal(cappedSessionTime(90, 5), 95);
  assert.equal(cappedSessionTime(117, 10), 120);
  assert.equal(cappedSessionTime(120, 15), 120);
  assert.equal(availableItemTimeBonus(0, 10), 10);
  assert.equal(availableItemTimeBonus(10, 10), 5);
  assert.equal(availableItemTimeBonus(15, 5), 0);
});

test('stage bonus and special tiles ramp in after the tutorial stages', () => {
  assert.ok(stageClearBonus(8, 30, true) > stageClearBonus(1, 0, false));
  assert.deepEqual(specialTilePlanForStage(3, () => 0), []);
  assert.deepEqual(specialTilePlanForStage(4, () => 0), ['bomb']);
  assert.deepEqual(specialTilePlanForStage(10, () => 0.9), []);
  // The bomb is the only special tile: the clock had three separate paths
  // for one +5s effect and the tile was the one nobody met (0.08 sightings
  // per run), so it is gone and the board drop plus the banked dock item
  // remain. No stage may reintroduce it.
  for (const stage of [1, 4, 6, 7, 10, 15]) {
    assert.deepEqual(
      specialTilePlanForStage(stage, () => 0).filter((type) => type !== 'bomb'),
      [],
      `stage ${stage} must plan bomb tiles only`,
    );
  }
});

test('combo grace tightens by stage and idle decay stays forgiving early', () => {
  assert.equal(comboWindowMsForStage(1), 5200);
  assert.equal(comboWindowMsForStage(3), 4500);
  assert.equal(comboWindowMsForStage(6), 3500);
  assert.equal(comboWindowMsForStage(9), 2900);
  assert.equal(comboAfterIdle(5, 2), 4);
  assert.equal(comboAfterIdle(5, 6), 3);
  assert.equal(comboAfterIdle(1, 9), 0);
  assert.equal(comboAfterIdle(20, 9), 17);
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
  assert.equal(isItemUnlockedAtStage('bomb', 2), false);
  assert.equal(isItemUnlockedAtStage('bomb', 3), true);
  assert.equal(isItemUnlockedAtStage('clock', 4), false);
  assert.equal(isItemUnlockedAtStage('clock', 5), true);
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

test('late-stage mission HUD exposes actionable progress and completion', () => {
  const wide = stageChallengeForStage(6);
  const chain = stageChallengeForStage(8);
  assert.deepEqual(stageChallengeProgress(null), null);
  assert.deepEqual(stageChallengeProgress(wide), {
    kind: 'wide', label: '큰 조합', requirement: 5, progress: 0, target: 1, completed: false,
  });
  assert.deepEqual(stageChallengeProgress(chain, { stageStreak: 2 }), {
    kind: 'chain', label: '연속 성공', requirement: 3, progress: 2, target: 3, completed: false,
  });
  assert.deepEqual(stageChallengeProgress(chain, { completed: true, stageStreak: 1 }), {
    kind: 'chain', label: '연속 성공', requirement: 3, progress: 3, target: 3, completed: true,
  });
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

test('stage four previews exactly one rare item without changing the recurring pool', () => {
  assert.equal(stageShowcaseBoardDrop(3, () => 0), null);
  assert.equal(stageShowcaseBoardDrop(4, () => 0)?.id, 'megabomb');
  assert.equal(stageShowcaseBoardDrop(4, () => 0.5)?.id, 'freeze');
  assert.equal(stageShowcaseBoardDrop(4, () => 0.999)?.id, 'clover');
  assert.equal(stageShowcaseBoardDrop(4, () => 0, true), null);
  assert.equal(stageShowcaseBoardDrop(5, () => 0), null);
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
  // Stage 5 pool: 13 bombs, clock, then the two megabomb slots that now
  // open here — 0.999 lands on megabomb, 0.845 on the clock slot.
  assert.equal(chooseBoardDrop(7, () => 0.999, { cloverGiven: true, rewardIndex: 1, stage: 5 }).id, 'megabomb');
  assert.equal(chooseBoardDrop(7, () => 0.845, { cloverGiven: true, rewardIndex: 1, stage: 5 }).id, 'clock');
  assert.notEqual(chooseBoardDrop(28, () => 0.999, { rewardIndex: 4, stage: 5 })?.id, 'clover');
  assert.notEqual(chooseBoardDrop(28, () => 0, {
    pity: { clover: 99 }, rewardIndex: 4, stage: 5,
  })?.id, 'clover', 'clover pity must stay locked before stage 6');
  assert.equal(chooseBoardDrop(10, () => 0.999, { rewardIndex: 2, stage: 5 }).id, 'freeze');
  assert.equal(chooseBoardDrop(14, () => 0.999, { rewardIndex: 2, stage: 6 }).id, 'clover');
  assert.equal(chooseBoardDrop(28, () => 0.999, { rewardIndex: 4, stage: 8 }).id, 'clover');
  assert.equal(chooseBoardDrop(28, () => 0.999, { rewardIndex: 5, stage: 8, cloverGiven: true }).id, 'freeze');

  const lateDrops = Array.from({ length: 180 }, (_, index) => chooseBoardDrop(
    35,
    () => index / 180,
    { cloverGiven: false, rewardIndex: 5, stage: 9 },
  ).id);
  const boardActions = lateDrops.filter((id) => ['bomb', 'megabomb'].includes(id)).length;
  const timeEffects = lateDrops.filter((id) => ['clock', 'freeze'].includes(id)).length;
  assert.ok(boardActions >= 145, 'late rewards must still strongly favor tactile board actions');
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

test('rare drop pity guarantees variety without chaining time effects', () => {
  assert.equal(chooseBoardDrop(21, () => 0, {
    pity: { megabomb: 4, freeze: 0 }, previousType: 'bomb', rewardIndex: 3, stage: 7,
  }).id, 'megabomb');
  assert.notEqual(chooseBoardDrop(21, () => 0, {
    pity: { megabomb: 2 }, previousType: 'bomb', rewardIndex: 3, stage: 8,
  }).id, 'megabomb', 'late stages use the longer megabomb pity limit');
  assert.equal(chooseBoardDrop(28, () => 0, {
    pity: { megabomb: 0, freeze: 3 }, previousType: 'bomb', rewardIndex: 5, stage: 8,
  }).id, 'freeze');
  assert.equal(chooseBoardDrop(28, () => 0, {
    cloverGiven: false, pity: { megabomb: 0, clover: 3, freeze: 0 }, previousType: 'bomb', rewardIndex: 5, stage: 8,
  }).id, 'clover');
  assert.equal(chooseBoardDrop(21, () => 0, {
    cloverGiven: false, pity: { megabomb: 0, clover: 3, freeze: 0 }, previousType: 'bomb', rewardIndex: 4, stage: 6,
  }).id, 'clover');
  assert.equal(nextBoardDropPity({ clover: 2 }, 'bomb', { stage: 6, combo: 21 }).clover, 3);
  assert.notEqual(chooseBoardDrop(28, () => 0.999, {
    pity: { megabomb: 0, freeze: 3 }, previousType: 'clock', rewardIndex: 5, stage: 8,
  }).id, 'freeze', 'a clock must not be followed immediately by another time effect');
  assert.deepEqual(nextBoardDropPity({ megabomb: 2, freeze: 3 }, 'megabomb', { stage: 8, combo: 28 }), {
    megabomb: 0,
    clover: 1,
    freeze: 4,
  });
  assert.deepEqual(nextBoardDropPity({ megabomb: 2, freeze: 3 }, 'freeze', { stage: 8, combo: 28 }), {
    megabomb: 3,
    clover: 1,
    freeze: 0,
  });
});

test('time-capped runs stop dropping clock and freeze without suppressing rewards', () => {
  const stageFiveReplacement = chooseBoardDrop(7, () => 0.999, {
    cloverGiven: true,
    rewardIndex: 1,
    stage: 5,
    timeBonusCapped: true,
  });
  assert.ok(['bomb', 'megabomb'].includes(stageFiveReplacement.id),
    'a capped run replaces time effects with board actions');

  const forcedFreezeReplacement = chooseBoardDrop(28, () => 0, {
    cloverGiven: true,
    pity: { megabomb: 0, freeze: 99 },
    previousType: 'bomb',
    rewardIndex: 5,
    stage: 8,
    timeBonusCapped: true,
  });
  assert.notEqual(forcedFreezeReplacement.id, 'freeze');
  assert.ok(['bomb', 'megabomb'].includes(forcedFreezeReplacement.id));

  const cappedDrops = Array.from({ length: 180 }, (_, index) => chooseBoardDrop(
    35,
    () => index / 180,
    {
      cloverGiven: false,
      pity: { megabomb: 0, clover: 0, freeze: 99 },
      previousType: 'bomb',
      rewardIndex: 5,
      stage: 9,
      timeBonusCapped: true,
    },
  ).id);
  assert.ok(cappedDrops.every((id) => !['clock', 'freeze'].includes(id)));
  assert.ok(cappedDrops.every((id) => ['bomb', 'megabomb', 'clover'].includes(id)));
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
