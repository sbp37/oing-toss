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
// Full-clear rule over backbone boards: every board now carries a complete
// clear path by construction, so runs travel farther than the pre-backbone
// baseline. Bands follow the measured values (novice 3.9 / regular 6.0 /
// expert 10.0 at the unchanged time economy).
assert.ok(suite.novice.roundMean >= 3 && suite.novice.roundMean <= 5, 'novices should finish around stages 3-4');
assert.ok(suite.regular.roundMean >= 4.5 && suite.regular.roundMean <= 7, 'regular players should finish around stages 5-6');
assert.ok(suite.expert.roundMean >= 7 && suite.expert.roundMean <= 12, 'experts should reach the late stages');
// The rescue shuffle must stay an exception, not the game playing itself:
// roughly 0-1 rescue per fully cleared board, and clean (rescue-free)
// clears must stay genuinely reachable for every profile.
for (const profile of ['novice', 'regular', 'expert']) {
  assert.ok(suite[profile].rescueMean / Math.max(1, suite[profile].boardsClearedMean) <= 1.2,
    `${profile}: rescues stay around 0-1 per fully cleared board`);
  assert.ok(suite[profile].cleanClearRate >= 0.05 && suite[profile].cleanClearRate <= 1,
    `${profile}: clean clears stay reachable, not a lottery`);
  assert.ok(suite[profile].timeUpRemainingCellsMean >= 0, 'TIME UP leftover cells are measured');
}
assert.ok(suite.expert.roundTimeBonusMean <= 90,
  'stage time stays bounded: small per-growth bonuses plus at most 4s per flat board');
assert.ok(suite.expert.itemTimeBonusMean <= 20, 'rare clock and freeze rewards must not dominate survival time');
assert.equal(suite.novice.cappedRuns, 0);

// The human-like agent never previews the post-clear board — real-play
// feel is judged against it. Even without lookahead the tiling boards must
// keep rescues an exception and clean clears a reachable skill reward.
const humanlike = simulateBalanceSuite({ runsPerProfile: 8, seed: 99, agent: 'humanlike' });
for (const profile of ['novice', 'regular', 'expert']) {
  const s = humanlike[profile];
  assert.ok(s.rescueMean / Math.max(1, s.boardsClearedMean) <= 1.1,
    `${profile} (humanlike): rescues stay around 0-1 per fully cleared board`);
  assert.ok(s.cleanClearRate >= 0.1,
    `${profile} (humanlike): clean clears are a skill reward, not a lottery`);
}
assert.ok(humanlike.novice.roundMean >= 3 && humanlike.novice.roundMean <= 5,
  'humanlike novices land around stages 3-4');
assert.ok(humanlike.expert.roundMean >= 7,
  'humanlike experts still reach the late stages');

console.log('balance.test.mjs: seeded novice/regular/expert progression passed');
