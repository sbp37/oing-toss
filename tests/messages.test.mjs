import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildScoreComparisons,
  buildResultReaction,
  pickResultMessage,
  resultRetryLabel,
  resultMessageType,
  resultToneForScore,
  stageIntroForStage,
} from '../js/data.js';
import { buildLocalRecordSummary, buildShareText } from '../js/adapters.js';

test('live cat messages keep the OING nyang voice across score tiers', () => {
  assert.equal(resultMessageType(800, false), 'resultLow');
  assert.equal(resultMessageType(5000, false), 'resultNormal');
  assert.equal(resultMessageType(20000, false), 'resultHigh');
  assert.equal(resultMessageType(50000, false), 'resultLegend');
  assert.equal(resultMessageType(200, true), 'record');
  for (const score of [800, 5000, 20000, 50000]) {
    assert.match(pickResultMessage(score, { random: () => 0 }), /냥/);
  }
});

test('result score tiers follow the classic score scale', () => {
  // 실측 기반 눈금: 첫 세션 1~2천, 자리잡은 플레이어 1만대, 상위권 3만대.
  assert.equal(resultToneForScore(1999), 'low');
  assert.equal(resultToneForScore(2000), 'normal');
  assert.equal(resultToneForScore(11999), 'normal');
  assert.equal(resultToneForScore(12000), 'high');
  assert.equal(resultToneForScore(34999), 'high');
  assert.equal(resultToneForScore(35000), 'legend');
});

test('score comparisons cover first run, previous run, record and near-record cases', () => {
  const firstRun = buildScoreComparisons(400, null, 0);
  assert.match(firstRun.bestText, /첫 기록/);
  assert.equal(firstRun.hasPrevious, false);
  assert.equal(firstRun.previousText, '');
  assert.equal(buildScoreComparisons(800, 500, 700).hasPrevious, true);
  assert.match(buildScoreComparisons(800, 500, 700).previousText, /\+300점/);
  assert.match(buildScoreComparisons(900, 1200, 1000).bestText, /100점 차이/);
  assert.match(buildScoreComparisons(1500, 1200, 1300).bestText, /\+200점/);
  assert.doesNotMatch(buildScoreComparisons(800, 1200, 1500).previousText, /낮|실패|아쉽/);
});

test('result retry copy points toward the next positive goal', () => {
  assert.equal(resultRetryLabel({ recordEligible: false }), 'STAGE 1부터 도전!');
  assert.equal(resultRetryLabel({ newRecord: true }), '신기록 또 넘기기!');
  // A record within reach becomes the exact number still to find.
  assert.equal(resultRetryLabel({ score: 900, previousBest: 1000 }), '100점만 더!');
  assert.equal(
    resultRetryLabel({ score: 58000, previousBest: 60000, round: 5 }),
    '2,000점만 더!',
    'the gap is formatted for reading, not printed raw',
  );
  // Too far from the record to be a nudge: the next stage is the goal instead.
  assert.equal(resultRetryLabel({ score: 400, previousBest: 10000, round: 2 }), '이번엔 STAGE 3 가보자');
  assert.equal(resultRetryLabel({ score: 400, previousBest: 10000, round: 6 }), '이번엔 STAGE 7 가보자');
  // A first run has no record to chase and no stage worth naming yet.
  assert.equal(resultRetryLabel({ score: 400, previousBest: 0, round: 1 }), '한 판 더!');
  // Every label stays short enough to sit on one button line.
  for (const label of [
    resultRetryLabel({ score: 900, previousBest: 1000 }),
    resultRetryLabel({ score: 400, previousBest: 10000, round: 6 }),
    resultRetryLabel({ newRecord: true }),
  ]) {
    assert.ok(label.length <= 16, `retry label too long: ${label}`);
  }
});

test('result reactions reward records, progress and streaks without a losing aftertaste', () => {
  const record = buildResultReaction({ score: 2000, newRecord: true }, { random: () => 0 });
  assert.equal(record.type, 'record');
  const rising = buildResultReaction({
    score: 1800,
    previousBest: 2200,
    previousScore: 1400,
    recentScores: [900, 1100, 1400],
    round: 4,
    previousHighestStage: 4,
  }, { random: () => 0 });
  assert.equal(rising.type, 'rising');
  const stage = buildResultReaction({ score: 1200, round: 6, previousHighestStage: 5 }, { random: () => 0 });
  assert.equal(stage.type, 'stageRecord');
  for (const reaction of [record, rising, stage]) assert.doesNotMatch(reaction.message, /아쉽|실패|봐준다|못했/);
});

test('stage intros are a single plain title with no goal or mission copy', () => {
  for (const stage of [1, 2, 5, 6, 9, 12]) {
    const intro = stageIntroForStage(stage);
    assert.equal(intro.title, `STAGE ${stage}`);
    assert.equal(intro.kicker, undefined, 'no kicker line');
    assert.equal(intro.detail, undefined, 'no detail line');
  }
});

test('share copy contains score, combo, stage and the original challenge tone', () => {
  const text = buildShareText({ score: 12580, maxCombo: 7, round: 3 });
  assert.match(text, /12,580점/);
  assert.match(text, /최고 콤보 7/);
  assert.match(text, /STAGE 3/);
  assert.match(text, /이겨보라냥/);
});

test('local records summarize the latest seven real runs without inventing rankings', () => {
  const summary = buildLocalRecordSummary([100, 300, 200, 500, 700, 600, 900, 1200], 1500);
  assert.deepEqual([...summary.recent], [300, 200, 500, 700, 600, 900, 1200]);
  assert.equal(summary.best, 1500);
  assert.equal(summary.average, 629);
  assert.equal(summary.last, 1200);
  assert.equal(summary.count, 7);
  assert.equal(summary.delta, 300);
  assert.equal(summary.trendTone, 'up');
  assert.match(summary.trendText, /\+300점/);
  const empty = buildLocalRecordSummary([], 0);
  assert.equal(empty.count, 0);
  assert.equal(empty.trendTone, 'new');
});
