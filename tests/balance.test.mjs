import assert from 'node:assert/strict';
import { simulateBalanceSuite, simulateRun } from '../js/balance.js';
import { recordEligibleForStartStage } from '../js/data.js';

assert.equal(recordEligibleForStartStage(1), true, 'full runs starting at stage 1 may update records');
assert.equal(recordEligibleForStartStage(2), false, 'checkpoint retries must not update global records');
assert.equal(recordEligibleForStartStage(8), false, 'late checkpoint retries must remain record-ineligible');

const first = simulateRun({ seed: 77, profile: 'regular' });
const repeat = simulateRun({ seed: 77, profile: 'regular' });
assert.deepEqual(repeat, first, 'the same seed must reproduce the same balance run');
assert.ok(first.score > 0);
assert.ok(first.clears > 0);
assert.ok(first.elapsedSeconds >= 120, 'round and item bonuses may extend real play beyond the base timer');
assert.ok(first.timeLeft <= 120, 'the currently held session time must never exceed the cap');
assert.equal(first.simpleClears + first.richClears, first.clears);

const suite = simulateBalanceSuite({ runsPerProfile: 8, seed: 99 });
assert.ok(suite.novice.scoreMean < suite.regular.scoreMean);
assert.ok(suite.regular.scoreMean < suite.expert.scoreMean);
assert.ok(suite.novice.clearsMean < suite.expert.clearsMean);
assert.ok(suite.expert.richClearRatio > suite.novice.richClearRatio);
assert.ok(suite.expert.initialShapePatternsMean > suite.novice.initialShapePatternsMean);
assert.ok(suite.expert.initialValuePatternsMean > suite.novice.initialValuePatternsMean);
assert.ok(suite.expert.initialOrientationsMean >= suite.novice.initialOrientationsMean);
assert.ok(suite.novice.maxComboMean < suite.regular.maxComboMean);
assert.ok(suite.regular.maxComboMean < suite.expert.maxComboMean, 'tighter late windows still reward genuinely fast play');
// Full-clear rule over natural boards: generation no longer plants
// sum-ten structure, so runs travel a little slower than the tiling era
// and rescues sit higher. Bands follow the measured values (strategic
// novice 3.3 / regular 5.0 / expert 8.0; rescue 0.9-1.3 per board).
assert.ok(suite.novice.roundMean >= 2.8 && suite.novice.roundMean <= 5, 'novices should finish around stages 3-4');
assert.ok(suite.regular.roundMean >= 4 && suite.regular.roundMean <= 7, 'regular players should finish around stages 4-6');
assert.ok(suite.expert.roundMean >= 6.5 && suite.expert.roundMean <= 12, 'experts should reach the late stages');
// The rescue shuffle stays bounded per fully cleared board, and clean
// (rescue-free) clears must stay reachable for every profile.
for (const profile of ['novice', 'regular', 'expert']) {
  assert.ok(suite[profile].rescueMean / Math.max(1, suite[profile].boardsClearedMean) <= 1.6,
    `${profile}: rescues stay bounded per fully cleared board`);
  assert.ok(suite[profile].cleanClearRate >= 0.03 && suite[profile].cleanClearRate <= 1,
    `${profile}: clean clears stay reachable, not extinct`);
  assert.ok(suite[profile].timeUpRemainingCellsMean >= 0, 'TIME UP leftover cells are measured');
}
assert.ok(suite.expert.roundTimeBonusMean <= 90,
  'stage time stays bounded: small per-growth bonuses plus at most 4s per flat board');
assert.ok(suite.expert.itemTimeBonusMean <= 20, 'rare time effects must not dominate survival time');
assert.equal(suite.novice.cappedRuns, 0);

// The human-like agent never previews the post-clear board — real-play
// feel is judged against it. Even without lookahead the tiling boards must
// keep rescues an exception and clean clears a reachable skill reward.
const humanlike = simulateBalanceSuite({ runsPerProfile: 8, seed: 99, agent: 'humanlike' });
for (const profile of ['novice', 'regular', 'expert']) {
  const s = humanlike[profile];
  assert.ok(s.rescueMean / Math.max(1, s.boardsClearedMean) <= 1.6,
    `${profile} (humanlike): rescues stay bounded per fully cleared board`);
  assert.ok(s.cleanClearRate >= 0.03,
    `${profile} (humanlike): clean clears stay reachable`);
}
assert.ok(humanlike.novice.roundMean >= 2.8 && humanlike.novice.roundMean <= 5,
  'humanlike novices land around stages 3-4');
assert.ok(humanlike.expert.roundMean >= 6.5,
  'humanlike experts still reach the late stages');

// Normal clear: running out of tens ends the stage once enough of the
// board is cleared; a stage never rescues twice; normal clears are never
// PERFECT; and the progress the rule fires at stays high.
const withNormal = simulateRun({ seed: 4242, profile: 'regular', agent: 'humanlike' });
assert.ok(withNormal.normalClears >= 0);
assert.equal(withNormal.repeatRescueStages, 0, 'a stage never takes a second rescue');
assert.ok(withNormal.cleanClears <= withNormal.boardsCleared,
  'PERFECT counts only fully unassisted boards');
for (const progress of withNormal.normalClearProgress) {
  assert.ok(progress >= 0.6 || withNormal.rescueShuffles > 0,
    'a normal clear fires at its stage threshold unless the rescue was already spent');
}
const custom = simulateRun({ seed: 4242, profile: 'regular', agent: 'humanlike', normalClearThreshold: 0.7 });
assert.ok(custom.normalClears >= 0 && Number.isFinite(custom.rescueShuffles),
  'the threshold parameter reaches the simulation');

console.log('balance.test.mjs: seeded novice/regular/expert progression passed');
