import assert from 'node:assert/strict';
import test from 'node:test';
import { BoardItemField, rankBoardItemCells } from '../js/board-items.js';
import { getRoundConfig, availableItemTimeBonus, boardDropInventoryGrant, boardDropReward, boardDropRewardForRun, cappedSessionTime, chooseBoardDrop, comboAfterFailure, comboAfterIdle, comboAfterIncorrectSelection, comboMilestoneCrossed, comboWindowMsForStage, freezeTimeline, gardenRevealPercent, isItemUnlockedAtStage, itemRewardCountdown, itemUnlockGrantForStage, isNearMissSum, isWowClear, isNiceClear, nextBoardDropPity, nextGardenRevealBest, rebasePausedTimeline, roundTimeBonusSeconds, shouldAdvanceRound, needsRescueShuffle, stageEndDecision, NORMAL_CLEAR_MIN_PROGRESS, normalClearThresholdForStage, shouldOfferStruggleHint, specialTilePlanForStage, stageClearBonus, stageShowcaseBoardDrop, successFeedbackLevel } from '../js/data.js';

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

test('board growth pays time bonuses scaled to the step, flat clears pay small ones', () => {
  // The square ladder grows in nine-cell-plus jumps (16→25→36) that pay the
  // full ten, one small 36→42 step that pays six, and holds sizes between.
  // Baseline economy, unchanged pending the full-clear simulations.
  assert.equal(roundTimeBonusSeconds(1), 10);
  assert.equal(roundTimeBonusSeconds(2), 0, 'the early same-size clear predates the stage-3 flat bonus');
  assert.equal(roundTimeBonusSeconds(3), 10);
  assert.equal(roundTimeBonusSeconds(4), 4);
  assert.equal(roundTimeBonusSeconds(5), 6);
  assert.equal(roundTimeBonusSeconds(6), 4, 'same-size clears at the 6x7 cap pay a small bonus');
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

test('five cells in one clear is the WOW threshold, matching the original', () => {
  assert.equal(isWowClear(2), false);
  assert.equal(isWowClear(4), false, 'four cells already pay a wide bonus but do not stop the screen');
  assert.equal(isWowClear(5), true);
  assert.equal(isWowClear(8), true);

  // NICE is the step below WOW and never overlaps it: exactly four cells.
  assert.equal(isNiceClear(2), false);
  assert.equal(isNiceClear(3), false);
  assert.equal(isNiceClear(4), true);
  assert.equal(isNiceClear(5), false, 'five cells belong to WOW alone');
  assert.equal(isNiceClear(7), false);
  for (const cells of [2, 3, 4, 5, 6, 8]) {
    assert.ok(!(isNiceClear(cells) && isWowClear(cells)), `${cells} cells must not fire both tiers`);
  }
  // The rank system is untouched by NICE: four cells on their own still rank
  // as a plain clear (or its cat/combo rank), so nothing outranks WOW.
  assert.equal(successFeedbackLevel({ wow: false }), 1);
  assert.equal(successFeedbackLevel({ wow: true }), 4);
  assert.equal(successFeedbackLevel({ emptiesBoard: true, wow: true }), 5);
  assert.equal(successFeedbackLevel({ catCount: 1 }), 2);
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

test('combo milestones past eight step every eight and this is the only place that decides it', () => {
  // This is the single rule successFeedbackLevel and the combo banner both
  // read from; ui.js no longer computes its own landing check
  // (combo === 3 || combo === 5 || ...), which used to disagree with this
  // crossing check whenever a wide clear stepped over a boundary instead of
  // landing on it (15 -> 17 skips 16 by value but still crosses it).
  assert.equal(comboMilestoneCrossed(2, 3), 3);
  assert.equal(comboMilestoneCrossed(4, 6), 5, '5 crossed');
  assert.equal(comboMilestoneCrossed(7, 9), 8, '8 crossed');
  assert.equal(comboMilestoneCrossed(15, 16), 16);
  assert.equal(comboMilestoneCrossed(15, 17), 16, 'a +2 jump that steps over 16 still crosses it');
  assert.equal(comboMilestoneCrossed(16, 17), 0, 'no boundary lies strictly between 16 and 17');
  assert.equal(comboMilestoneCrossed(23, 25), 24, '24 crossed');
  assert.equal(comboMilestoneCrossed(31, 33), 32, '32 crossed');
});

test('a combo milestone always ranks at least 3, so "딱 10!" never shows alongside the banner', () => {
  // handleSuccess only shows the "딱 10!" pop when successLevel <= 2 and
  // only shows the combo banner when comboMilestone is truthy. If a
  // milestone could ever produce rank <= 2 the two would render together;
  // this is the invariant that guarantees they cannot.
  for (const comboMilestone of [3, 5, 8, 16, 24, 32]) {
    const level = successFeedbackLevel({ comboMilestone, catCount: 0 });
    assert.ok(level >= 3, `milestone ${comboMilestone} produced rank ${level}, which would show 딱 10!`);
  }
  // The same must hold when a milestone lands alongside a cat bonus — that
  // alone would only earn rank 2.
  assert.equal(successFeedbackLevel({ comboMilestone: 8, catCount: 1 }), 3);

  // An ordinary drop without a milestone also ranks 3, for the same reason:
  // showComboReward's pop would otherwise share the frame with 딱 10!.
  assert.equal(successFeedbackLevel({ earnedDrop: { id: 'bomb' }, comboMilestone: 0 }), 3);

  // Full ladder, sanity-checked end to end.
  assert.equal(successFeedbackLevel({}), 1, 'a plain clear with no other signal ranks 1');
  assert.equal(successFeedbackLevel({ catCount: 1 }), 2, 'a cat bonus ranks 2');
  assert.equal(successFeedbackLevel({ wow: true }), 4, 'a WOW clear owns the frame');
  assert.equal(successFeedbackLevel({ earnedDrop: { id: 'megabomb' } }), 4, 'a rare drop outranks an ordinary one');
  assert.equal(successFeedbackLevel({ emptiesBoard: true, wow: true, comboMilestone: 8 }), 5, 'emptying the board always wins');
});

test('the garden reveal percentage and its run-best both move only the right way', () => {
  // Clearing more cells raises the percentage; this is what makes the
  // ordering fix in handleSuccess (track after model.remove, not before)
  // matter — reading it one success early always understated the reveal.
  assert.equal(gardenRevealPercent(0, 36), 0);
  assert.equal(gardenRevealPercent(9, 36), 25, 'a quarter of the board cleared');
  assert.equal(gardenRevealPercent(18, 36), 50, 'reveal increases as more cells clear');
  // A bomb blast clears extra cells beyond the matched rectangle; whatever
  // count is passed in must be reflected, matching that the fix reads the
  // model after both this.model.remove(rect) and this.model.removeCells
  // (the bomb's blastCells) have already run.
  assert.equal(gardenRevealPercent(26, 36), 72, 'the match plus a bomb blast both count');
  // Clearing the whole board — including the clear that ends the stage —
  // must read as a full reveal, not the stage-1-early undercount.
  assert.equal(gardenRevealPercent(36, 36), 100, 'a fully cleared board reveals 100%');
  assert.equal(gardenRevealPercent(40, 36), 100, 'cleared cannot exceed the board');
  assert.equal(gardenRevealPercent(5, 0), 0, 'a board with no cells has nothing to reveal');

  // The run's best never falls: a smaller reveal later in the run, or on a
  // later stage, must not erase an earlier larger one.
  assert.equal(nextGardenRevealBest(0, 25), 25);
  assert.equal(nextGardenRevealBest(70, 40), 70, 'a weaker clear does not lower the run best');
  assert.equal(nextGardenRevealBest(40, 70), 70, 'a stronger clear does raise it');
  assert.equal(nextGardenRevealBest(100, 0), 100);
});

test('board items appear only when a seven-combo boundary is crossed', () => {
  assert.equal(boardDropReward(0, 1, 0), null);
  assert.equal(boardDropReward(1, 2, 0), null);
  assert.equal(boardDropReward(6, 7, 1), 'milestone');
  assert.equal(boardDropReward(6, 8, 1), 'milestone');
  assert.equal(boardDropReward(7, 8, 2), null);
  assert.equal(boardDropReward(13, 14, 2), 'milestone');
});

// Drives the same bookkeeping advanceCombo() does: a success calls the rule
// and then raises the run's high-water mark, while a failure only lowers the
// live combo. Returns the combo value at each payout.
function runPayouts(steps) {
  let combo = 0;
  let best = 0;
  const payouts = [];
  for (const step of steps) {
    if (step.fail) {
      combo = step.to;
      continue;
    }
    const reward = boardDropRewardForRun({
      previousCombo: combo,
      nextCombo: step.to,
      bestComboBefore: best,
    });
    if (reward) payouts.push(step.to);
    combo = step.to;
    best = Math.max(best, combo);
  }
  return payouts;
}

test('each seven-combo boundary pays once per run, however often it is re-crossed', () => {
  const climb = (from, to) => Array.from({ length: to - from }, (_, i) => ({ to: from + i + 1 }));

  // 7 -> 5 -> 7 must pay exactly once.
  assert.deepEqual(
    runPayouts([...climb(0, 7), { fail: true, to: 5 }, ...climb(5, 7)]),
    [7],
    'rebuilding to seven after a failure must not re-earn the drop',
  );

  // 14 -> 10 -> 14 must pay for 14 exactly once (plus the earlier 7).
  assert.deepEqual(
    runPayouts([...climb(0, 14), { fail: true, to: 10 }, ...climb(10, 14)]),
    [7, 14],
    'rebuilding to fourteen must not re-earn that boundary',
  );

  // The pathological case from the field: oscillating across a boundary.
  const oscillation = [...climb(0, 14)];
  for (let cycle = 0; cycle < 5; cycle += 1) {
    oscillation.push({ fail: true, to: 9 }, ...climb(9, 14));
  }
  assert.deepEqual(
    runPayouts(oscillation),
    [7, 14],
    'five rebuilds across the same boundary still pay only for the first crossing',
  );

  // A clean climb pays every new boundary.
  assert.deepEqual(runPayouts(climb(0, 21)), [7, 14, 21]);

  // A wide clear gains two combo and may step over a boundary; still once.
  assert.deepEqual(
    runPayouts([{ to: 2 }, { to: 4 }, { to: 6 }, { to: 8 }, { to: 10 }, { to: 12 }, { to: 14 }]),
    [8, 14],
    'jumping a boundary with a +2 gain pays exactly once for it',
  );

  // A fresh run starts from zero, so the same boundaries pay again.
  assert.deepEqual(runPayouts(climb(0, 7)), [7], 'a new run re-arms every boundary');
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

test('a stage ends only on an empty board; a dry board takes a rescue instead', () => {
  // Full-clear rule: cells on the board mean the stage is still going, no
  // matter what — running out of answers triggers the rescue shuffle, never
  // a transition with tiles left behind.
  assert.equal(shouldAdvanceRound({ boardEmpty: true }), true);
  assert.equal(shouldAdvanceRound({ boardEmpty: false }), false);
  assert.equal(shouldAdvanceRound({}), false);
  assert.equal(needsRescueShuffle({ hasAnswer: false, boardEmpty: false }), true);
  assert.equal(needsRescueShuffle({ hasAnswer: true, boardEmpty: false }), false);
  assert.equal(needsRescueShuffle({ hasAnswer: false, boardEmpty: true }), false);

  // Stage-end triage: an empty board advances (PERFECT when unassisted).
  // Out of tens, the stage ends normally once enough of the board is gone
  // — progress-based, so it means the same on a 4x4 and a 6x7 — and the
  // rescue shuffle fires at most once per stage, only on a young board.
  assert.equal(NORMAL_CLEAR_MIN_PROGRESS, 0.78);
  assert.equal(stageEndDecision({ boardEmpty: true, remaining: 0, initialPlayable: 17 }), 'advance');
  assert.equal(stageEndDecision({ hasAnswer: true, remaining: 20, initialPlayable: 38 }), 'continue');
  assert.equal(stageEndDecision({ hasAnswer: false, remaining: 6, initialPlayable: 38 }), 'normal', '84% cleared ends the stage');
  assert.equal(stageEndDecision({ hasAnswer: false, remaining: 1, initialPlayable: 17 }), 'normal', 'one orphan number never triggers a shuffle');
  assert.equal(stageEndDecision({ hasAnswer: false, remaining: 20, initialPlayable: 38 }), 'rescue', 'a young dry board earns its one rescue');
  assert.equal(stageEndDecision({ hasAnswer: false, remaining: 20, initialPlayable: 38, stageRescues: 1 }), 'normal',
    'a second dry-out ends the stage instead of shuffling again');
  assert.equal(stageEndDecision({ hasAnswer: false, remaining: 10, initialPlayable: 38, threshold: 0.7 }), 'normal', 'the threshold is tunable');
  assert.equal(normalClearThresholdForStage(1), 0.6, 'learning stages end normally from 60% so beginners never meet the shuffle');
  assert.equal(normalClearThresholdForStage(2), 0.6);
  assert.equal(normalClearThresholdForStage(3), NORMAL_CLEAR_MIN_PROGRESS);

  // No stage config carries a target any more; nothing may reintroduce one.
  for (const stage of [1, 3, 5, 10, 16]) {
    assert.equal(getRoundConfig(stage).target, undefined, `stage ${stage} must not define a target`);
  }
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
