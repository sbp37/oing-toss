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
assert.ok(suite.expert.challengeBonusMean > suite.regular.challengeBonusMean);
assert.ok(suite.novice.roundMean >= 3 && suite.novice.roundMean <= 5.5, 'novices should usually finish around stages 3-5');
assert.ok(suite.regular.roundMean >= 5 && suite.regular.roundMean <= 7.5, 'regular players should usually finish around stages 5-7');
assert.ok(suite.expert.roundMean >= 7.5 && suite.expert.roundMean <= 10.5, 'experts should usually reach stages 8-10+');
assert.ok(suite.expert.roundTimeBonusMean <= 52,
  'stage time stays bounded: 26s of growth milestones plus at most 4s per flat clear');
assert.ok(suite.expert.itemTimeBonusMean <= 15, 'rare clock and freeze rewards must not dominate survival time');
assert.equal(suite.novice.cappedRuns, 0);

console.log('balance.test.mjs: seeded novice/regular/expert progression passed');
