import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { NEXT_GOAL_MAX_RATIO, nextGoalLine } from '../js/data.js';

// 결과 화면의 '다음 목표' 한 줄. 고르는 규칙이 전부라서, 여기가 틀리면
// 화면에는 멀쩡한 문장이 뜬 채로 엉뚱한 목표를 가리킨다 - 눈으로는 절대
// 못 잡는 종류의 오류다.

const RICH = {
  runs: 400, cats: 99999, bigClears: 9999, cellsCleared: 99999, playDays: 40, bestScore: 20000,
};

test('가장 가까운 목표 하나만 나온다', () => {
  // 최고기록까지 620점(0.17)보다 4,000점 카드까지 380점(0.095)이 가깝다.
  const goal = nextGoalLine({
    totals: { ...RICH, bestScore: 3620, cellsCleared: 3000 },
    score: 3000,
    previousBest: 3620,
  });
  assert.equal(goal.kind, 'card');
  assert.equal(goal.text, '4,000점 카드까지 380점!');
});

test('이미 넘어선 목표는 후보가 아니다', () => {
  // 신기록을 낸 판에서 "최고기록까지"가 뜨면 방금 한 일을 부정하는 말이 된다.
  const goal = nextGoalLine({ totals: RICH, score: 20000, previousBest: 15000 });
  assert.equal(goal, null);
  // 도전장을 넘긴 판도 같다 - 부르는 쪽이 target 0으로 넘긴다.
  const won = nextGoalLine({ totals: RICH, score: 20000, previousBest: 15000, challengeTarget: 0 });
  assert.equal(won, null);
});

test('첫 판을 끝낸 사람도 이유를 하나 받는다', () => {
  // 누적이 전부 0에 가까워 비율로는 전부 잘리는 자리다. 정작 이 한 줄이
  // 가장 필요한 사람이라, 여기서 null이 나오면 기능의 목적이 사라진다.
  const goal = nextGoalLine({
    totals: { runs: 1, cats: 6, bigClears: 11, cellsCleared: 154, playDays: 1, bestScore: 900 },
    score: 900,
    previousBest: 0,
  });
  assert.equal(goal.text, '다음 카드까지 9판!');
  assert.ok(goal.ratio > NEXT_GOAL_MAX_RATIO, '비율 예외를 타지 않고 통과했다');
});

test('출석 일수는 아무리 가까워도 후보가 아니다', () => {
  // 날짜는 판을 더 한다고 오지 않는다. "다음 카드까지 1일"은 지금 한 판 더
  // 할 이유가 못 되므로, 남은 하루짜리가 되어도 헤드라인에 안 올린다.
  // (갤러리에는 그대로 남는다 - 여기서 거르는 건 이 한 줄뿐이다.)
  const goal = nextGoalLine({
    totals: { runs: 400, cats: 99999, bigClears: 9999, cellsCleared: 99999, playDays: 6, bestScore: 20000 },
    score: 100,
    previousBest: 0,
  });
  assert.equal(goal, null, `날짜 목표가 헤드라인에 올라온다: ${goal?.text}`);

  // 첫 판 직후에도 마찬가지 - 판 수 목표가 대신 나와야 한다.
  const first = nextGoalLine({
    totals: { runs: 1, cats: 6, bigClears: 11, cellsCleared: 154, playDays: 1, bestScore: 900 },
    score: 900,
    previousBest: 0,
  });
  assert.equal(first.text, '다음 카드까지 9판!');
});

test('시작할 때는 넘어야 할 수를 말한다', () => {
  // 아직 0점이라 이번 판 점수로는 아무것도 못 잰다. 그 사람이 이미 낼 수 있는
  // 점수에서 재고, 문장도 "남은 몫"이 아니라 "넘어야 할 수"여야 한다 -
  // 시작할 때의 목표는 이 판을 어떻게 칠지의 기준이기 때문이다.
  const near = nextGoalLine({
    totals: { ...RICH, bestScore: 3620 },
    previousBest: 3620,
    phase: 'start',
  });
  assert.equal(near.startText, '이번 판 4,000점이면 새 카드!');

  // 카드가 멀면 신기록이 그 자리를 맡는다. 최고기록은 언제나 바로 위에 있어서
  // 시작 화면에서는 후보가 없어지는 일이 사실상 없다.
  const record = nextGoalLine({
    totals: { ...RICH, bestScore: 2000 },
    previousBest: 2000,
    phase: 'start',
  });
  assert.equal(record.kind, 'best');
  assert.equal(record.startText, '이번 판 2,000점 넘기면 신기록!');

  // 도전장이 있으면 그 수를 넘는 것이 이번 판의 기준이다.
  const rival = nextGoalLine({
    totals: { ...RICH, bestScore: 8000 },
    previousBest: 8000,
    challengeTarget: 8235,
    phase: 'start',
  });
  assert.equal(rival.startText, '이번 판 8,235점 넘기면 친구 이기기!');
});

test('맨 처음 판은 이 판 자체가 목표다', () => {
  // 최고기록도 누적도 0이라 넘어야 할 수가 없다. 남은 것은 "첫 판 끝내기"
  // 카드 하나인데, 그 한 판이 바로 지금 시작하는 판이다. "1판만 더"라고
  // 하면 이 판을 안 세는 말이 되어 거짓말이 된다.
  const goal = nextGoalLine({
    totals: { runs: 0, cats: 0, bigClears: 0, cellsCleared: 0, playDays: 0, bestScore: 0 },
    previousBest: 0,
    phase: 'start',
  });
  assert.equal(goal.startText, '이 판을 끝내면 새 카드!');
});

test('내밀 것이 없으면 아무것도 안 띄운다', () => {
  // 억지 목표는 없느니만 못하다. 다 모았고 신기록도 방금 냈으면 침묵이 맞다.
  const goal = nextGoalLine({ totals: RICH, score: 20000, previousBest: 15000 });
  assert.equal(goal, null);
});

test('두 자리가 같은 목표를 서로 다른 말로 가리킨다', async () => {
  // 하나의 고르기가 두 화면을 먹인다. 말투만 갈라진다.
  const totals = { ...RICH, bestScore: 3620 };
  const ending = nextGoalLine({ totals, score: 3000, previousBest: 3620 });
  const opening = nextGoalLine({ totals, previousBest: 3620, phase: 'start' });
  assert.equal(ending.cardKey, opening.cardKey, '같은 목표를 가리켜야 한다');
  assert.equal(ending.text, '4,000점 카드까지 380점!');
  assert.equal(opening.startText, '이번 판 4,000점이면 새 카드!');

  // 시작 카운트다운에 줄이 실제로 붙어 있는지. 다리가 끊기면 화면에는 아무
  // 일도 안 일어나고, 그건 눈으로 찾기 전에는 알 수가 없다.
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="start-countdown-goal"/);
  const ui = await readFile(new URL('../js/ui.js', import.meta.url), 'utf8');
  assert.match(ui, /setStartCountdownGoal/);
  const game = await readFile(new URL('../js/game.js', import.meta.url), 'utf8');
  assert.match(game, /setStartCountdownGoal\(nextGoalLine\(/, '시작 카운트다운이 목표를 안 받는다');
  assert.match(game, /phase: 'start'/);
});

test('너무 먼 목표는 벽이라 아무것도 안 내보낸다', () => {
  const goal = nextGoalLine({
    totals: { runs: 11, cats: 20, bigClears: 5, cellsCleared: 200, playDays: 1, bestScore: 500 },
    score: 20,
    previousBest: 500,
  });
  assert.equal(goal, null, '20,000칸 같은 벽이 다음 목표로 나온다');
});

test('단위마다 말이 달라진다', () => {
  const of = (totals, extra = {}) => nextGoalLine({ totals, score: 0, previousBest: 0, ...extra }).text;
  assert.equal(of({ ...RICH, cellsCleared: 19000 }), '다음 카드까지 1,000칸!');
  assert.equal(of({ ...RICH, cats: 280 }), '다음 카드까지 고양이 20마리!');
  assert.equal(of({ ...RICH, bigClears: 250 }), '다음 카드까지 50번!');
  assert.equal(
    of(RICH, { score: 9000, previousBest: 0, challengeTarget: 9500 }),
    '친구 기록까지 500점!',
  );
});

test('결과 화면에서 줄이 버튼 바로 위에 있다', async () => {
  // 이 한 줄의 값어치는 자리에서 나온다. 읽은 눈이 그대로 '한 판 더!'로
  // 떨어져야 하므로, 사이에 다른 것이 끼면 장치가 아니라 정보가 된다.
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const line = html.indexOf('id="result-next-goal"');
  const actions = html.indexOf('<div class="result-actions">');
  const retry = html.indexOf('id="retry-button"');
  assert.ok(line > 0, '다음 목표 줄이 마크업에 없다');
  assert.ok(line < actions && actions < retry, '다음 목표 줄이 한 판 더! 버튼 위에 없다');
  const between = html.slice(html.indexOf('</p>', line) + 4, actions);
  assert.equal(between.trim(), '', `줄과 버튼 사이에 다른 것이 끼어 있다: ${between.trim()}`);
});
