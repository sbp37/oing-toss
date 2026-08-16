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
// A stage now lasts exactly as long as its board has answers, so the stage
// number counts boards emptied rather than targets met — the same run reaches
// a higher number than it did under the old target gate, and the bands below
// are calibrated to that meaning.
assert.ok(suite.novice.roundMean >= 4 && suite.novice.roundMean <= 7, 'novices should clear a handful of boards');
assert.ok(suite.regular.roundMean >= 6.5 && suite.regular.roundMean <= 11, 'regular players should roughly double that');
assert.ok(suite.expert.roundMean >= 11 && suite.expert.roundMean <= 20, 'experts should keep boards turning over');
assert.ok(suite.expert.roundTimeBonusMean <= 90,
  'stage time stays bounded: small per-growth bonuses plus at most 4s per flat board');
assert.ok(suite.expert.itemTimeBonusMean <= 15, 'rare clock and freeze rewards must not dominate survival time');
assert.equal(suite.novice.cappedRuns, 0);

console.log('balance.test.mjs: seeded novice/regular/expert progression passed');
