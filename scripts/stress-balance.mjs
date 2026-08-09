import { simulateBalanceSuite } from '../js/balance.js';

const runsPerProfile = 120;
const report = simulateBalanceSuite({ runsPerProfile, seed: 20260809 });

const checks = [
  ['novice stage band', report.novice.roundMean >= 3 && report.novice.roundMean <= 5.5],
  ['regular stage band', report.regular.roundMean >= 5 && report.regular.roundMean <= 7.5],
  ['expert stage band', report.expert.roundMean >= 7.5 && report.expert.roundMean <= 10.5],
  ['score separates novice/regular', report.novice.scoreMean < report.regular.scoreMean],
  ['score separates regular/expert', report.regular.scoreMean < report.expert.scoreMean],
  ['no runaway capped runs', Object.values(report).every((metrics) => metrics.cappedRuns === 0)],
  ['expert item time remains scarce', report.expert.itemTimeBonusMean <= 15],
];

console.log(`OING stress balance (${runsPerProfile} seeded runs/profile)`);
console.table(Object.entries(report).map(([profile, metrics]) => ({
  profile,
  score: metrics.scoreMean,
  scoreRange: `${metrics.scoreP10}-${metrics.scoreP90}`,
  stage: metrics.roundMean,
  realSeconds: metrics.elapsedMean,
  maxCombo: metrics.maxComboMean,
  shapes: metrics.initialShapePatternsMean,
  values: metrics.initialValuePatternsMean,
  directions: metrics.initialOrientationsMean,
  itemTime: metrics.itemTimeBonusMean,
  cappedRuns: metrics.cappedRuns,
})));

const failures = checks.filter(([, passed]) => !passed).map(([label]) => label);
if (failures.length) throw new Error(`Balance stress checks failed: ${failures.join(', ')}`);
console.log(`PASS: ${checks.length}/${checks.length} long-run balance envelopes`);
