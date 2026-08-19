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

test('classic tiers match the reference players we calibrate against', async () => {
  const { classicResultTierFor, CLASSIC_RESULT_TIERS } = await import('../js/data.js');
  // 실측 기준점: 원조에서 3~4천이 기본인 플레이어와 15,000점 플레이어.
  assert.equal(classicResultTierFor(3500).min, 3200);
  assert.equal(classicResultTierFor(15000).min, 15000);
  // 첫 세션 봇(1,117)과 실기기 첫날(2,130)은 서로 다른 구간을 받는다.
  assert.equal(classicResultTierFor(1117).min, 500);
  assert.equal(classicResultTierFor(2130).min, 1500);
  // 경계값이 구간 정의와 일치하고 내림차순으로 정렬돼 있다.
  assert.deepEqual(CLASSIC_RESULT_TIERS.map((t) => t.min), [30000, 15000, 6000, 3200, 1500, 500, 0]);
  // 모든 구간에 대사와 목표가 실제로 들어 있다.
  for (const tier of CLASSIC_RESULT_TIERS) {
    assert.ok(tier.lines.length >= 8, `tier ${tier.min} lines`);
    assert.ok(tier.goals.length >= 5, `tier ${tier.min} goals`);
  }
});

test('classic reaction follows the original judgement rules', async () => {
  const { buildClassicResultReaction, CLASSIC_SMART_REACT } = await import('../js/data.js');
  const build = (input, random = () => 0.99) => buildClassicResultReaction(input, { random });

  // 신기록은 기존 최고가 500점 이상일 때만 record로 말한다.
  assert.equal(build({ score: 900, newRecord: true, previousBest: 600 }).type, 'record');
  assert.notEqual(build({ score: 400, newRecord: true, previousBest: 100 }).type, 'record');

  // 개인화는 과거 3판부터. 2판이면 티어 멘트로 떨어진다.
  const twoRuns = build({ score: 3500, previousBest: 4000, recentScores: [3000, 3400] });
  assert.ok(['tier', 'tierGoal', 'nearGoal'].includes(twoRuns.type));

  // near: 최고 1000 이상이고 90% 이상 도달했을 때, {diff}가 실제 숫자로 치환된다.
  const near = build({ score: 1900, previousBest: 2000, recentScores: [1000, 1100, 1200] });
  assert.equal(near.type, 'near');
  assert.match(near.message, /100/);
  assert.doesNotMatch(near.message, /\{diff\}/);

  // rising: 직전 두 판보다 계단식 상승.
  assert.equal(build({ score: 1500, previousBest: 9000, recentScores: [900, 1000, 1200] }).type, 'rising');

  // above / below: 평균 대비 배율 판정.
  assert.equal(build({ score: 2000, previousBest: 9000, recentScores: [1100, 1000, 900] }).type, 'above');
  assert.equal(build({ score: 500, previousBest: 9000, recentScores: [1100, 1000, 900] }).type, 'below');

  // drill은 아쉬운 판(below)에서는 어떤 난수로도 절대 나오지 않는다.
  for (const roll of [0, 0.05, 0.14, 0.19, 0.5]) {
    const down = build({ score: 500, previousBest: 9000, recentScores: [1100, 1000, 900] }, () => roll);
    assert.notEqual(down.type, 'drill');
  }
  // above 판에서는 낮은 확률로 drill이 나온다.
  const drilled = build({ score: 2000, previousBest: 9000, recentScores: [1100, 1000, 900] }, () => 0.1);
  assert.equal(drilled.type, 'drill');
  assert.ok(CLASSIC_SMART_REACT.drill.includes(drilled.message));

  // plateau: 4판이 평균의 15% 안에 모이면 절반 확률로 정체 멘트.
  let calls = 0;
  const plateauRandom = () => { calls += 1; return calls <= 1 ? 0.1 : 0.9; };
  const flat = build({ score: 1000, previousBest: 9000, recentScores: [980, 1010, 1000] }, plateauRandom);
  assert.equal(flat.type, 'plateau');
});

test('classic pools never mention features the game does not have yet', async () => {
  const { CLASSIC_RESULT_TIERS, CLASSIC_SMART_REACT, CLASSIC_NEAR_GOAL_TEMPLATES } = await import('../js/data.js');
  const all = [
    ...CLASSIC_RESULT_TIERS.flatMap((t) => [...t.lines, ...t.goals]),
    ...Object.values(CLASSIC_SMART_REACT).flat(),
    ...CLASSIC_NEAR_GOAL_TEMPLATES,
  ];
  for (const line of all) {
    // 랭킹·순위·TOP10은 아직 없는 기능이라 등장하면 거짓말이 된다.
    assert.doesNotMatch(line, /랭킹|순위|TOP ?10|1위/, line);
  }
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

test('classic share copy uses board count instead of stage language', () => {
  const text = buildShareText({ score: 12580, maxCombo: 7, round: 3, classic: { boards: 3 } });
  assert.match(text, /3판 진행/);
  assert.doesNotMatch(text, /STAGE|스테이지/);
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
