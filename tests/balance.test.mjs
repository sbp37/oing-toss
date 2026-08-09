import assert from 'node:assert/strict';
import { simulateBalanceSuite, simulateRun } from '../js/balance.js';

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
assert.ok(suite.novice.roundMean >= 3 && suite.novice.roundMean <= 5.5, 'novices should usually finish around stages 3-5');
assert.ok(suite.regular.roundMean >= 5 && suite.regular.roundMean <= 7.5, 'regular players should usually finish around stages 5-7');
assert.ok(suite.expert.roundMean >= 7.5 && suite.expert.roundMean <= 10.5, 'experts should usually reach stages 8-10+');
assert.ok(suite.expert.roundTimeBonusMean <= 30, 'only the three board-size milestones may add stage time');
assert.ok(suite.expert.itemTimeBonusMean <= 5, 'rare clocks must not dominate survival time');
assert.equal(suite.novice.cappedRuns, 0);

console.log('balance.test.mjs: seeded novice/regular/expert progression passed');
