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
  assert.equal(resultMessageType(5000, false), 'resultLow');
  assert.equal(resultMessageType(20000, false), 'resultNormal');
  assert.equal(resultMessageType(50000, false), 'resultHigh');
  assert.equal(resultMessageType(90000, false), 'resultLegend');
  assert.equal(resultMessageType(200, true), 'record');
  for (const score of [5000, 20000, 50000, 90000]) {
    assert.match(pickResultMessage(score, { random: () => 0 }), /냥/);
  }
});

test('result score tiers follow the current score scale', () => {
  assert.equal(resultToneForScore(14999), 'low');
  assert.equal(resultToneForScore(15000), 'normal');
  assert.equal(resultToneForScore(39999), 'normal');
  assert.equal(resultToneForScore(40000), 'high');
  assert.equal(resultToneForScore(79999), 'high');
  assert.equal(resultToneForScore(80000), 'legend');
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
  assert.equal(resultRetryLabel({ score: 900, previousBest: 1000 }), '최고기록 넘기기!');
  assert.equal(resultRetryLabel({ score: 400, previousBest: 1000, maxCombo: 7 }), '한 판 더!');
  assert.equal(resultRetryLabel({ score: 400, previousBest: 1000, round: 2 }), '한 판 더!');
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

test('stage intro copy gives every board-size milestone a visible identity', () => {
  assert.equal(stageIntroForStage(2).detail, '5×5 OPEN');
  assert.equal(stageIntroForStage(3).detail, '폭탄 해금 · 목표 8');
  assert.equal(stageIntroForStage(5).detail, '시계 해금 · 목표 11');
  assert.equal(stageIntroForStage(6).kicker, 'MISSION ON');
  assert.equal(stageIntroForStage(7).kicker, 'CAT CHANCE');
  assert.equal(stageIntroForStage(8).kicker, 'CHAIN FEVER');
  assert.match(stageIntroForStage(8).detail, /보너스|목표/);
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
