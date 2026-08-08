import { simulateBalanceSuite } from '../js/balance.js';

const runsFlag = process.argv.indexOf('--runs');
const runsPerProfile = runsFlag >= 0 ? Math.max(1, Number(process.argv[runsFlag + 1]) || 40) : 40;
const report = simulateBalanceSuite({ runsPerProfile });

console.log(`OING balance simulation (${runsPerProfile} seeded runs/profile)`);
console.table(Object.entries(report).map(([profile, metrics]) => ({
  profile,
  score: metrics.scoreMean,
  scoreRange: `${metrics.scoreP10}–${metrics.scoreP90}`,
  realSeconds: metrics.elapsedMean,
  round: metrics.roundMean,
  clears: metrics.clearsMean,
  maxCombo: metrics.maxComboMean,
  errors: metrics.errorsMean,
  answers: metrics.initialAnswersMean,
  easyAnswers: metrics.initialSimpleAnswersMean,
  richClear: `${metrics.richClearRatio}%`,
  roundBonus: metrics.roundTimeBonusMean,
  itemBonus: metrics.itemTimeBonusMean,
  capped: metrics.cappedRuns,
})));
console.log(JSON.stringify(report, null, 2));
