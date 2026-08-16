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
// Full-clear rule: a stage ends only when its board is completely empty, so
// runs travel fewer, fuller stages. Bands follow the measured baseline
// (novice 3.1 / regular 4.5 / expert 7.0 at the unchanged time economy).
assert.ok(suite.novice.roundMean >= 2.3 && suite.novice.roundMean <= 4.2, 'novices should finish around stages 3-4');
assert.ok(suite.regular.roundMean >= 3.5 && suite.regular.roundMean <= 6, 'regular players should finish around stages 4-6');
assert.ok(suite.expert.roundMean >= 5.5 && suite.expert.roundMean <= 10, 'experts should reach the late stages');
// The rescue shuffle must stay an exception, not the game playing itself,
// and clean clears must remain achievable.
assert.ok(suite.expert.rescueMean / Math.max(1, suite.expert.boardsClearedMean) <= 3.2,
  'rescues per fully cleared board stay bounded');
for (const profile of ['novice', 'regular', 'expert']) {
  assert.ok(suite[profile].cleanClearRate >= 0 && suite[profile].cleanClearRate <= 1,
    'clean-clear rate is a proportion of fully cleared boards');
  assert.ok(suite[profile].timeUpRemainingCellsMean >= 0, 'TIME UP leftover cells are measured');
}
assert.ok(suite.expert.roundTimeBonusMean <= 90,
  'stage time stays bounded: small per-growth bonuses plus at most 4s per flat board');
assert.ok(suite.expert.itemTimeBonusMean <= 15, 'rare clock and freeze rewards must not dominate survival time');
assert.equal(suite.novice.cappedRuns, 0);

console.log('balance.test.mjs: seeded novice/regular/expert progression passed');
