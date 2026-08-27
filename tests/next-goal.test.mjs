import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { NEXT_GOAL_MAX_RUNS, nextGoalLine } from '../js/data.js';

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

test('한 판 더로는 못 닿는 누적 목표를 내밀지 않는다', () => {
  // 외부 검수 지적. "남은 비율"만 보던 시절에는 이런 줄이 나갔다.
  //   고양이 120/300 -> "고양이 180마리만 더"  (초보 기준 약 27판)
  //   지운 칸 8,000/20,000 -> "12,000칸만 더"  (초보 기준 약 78판)
  // 비율은 목표의 크기를 못 봐서 이걸 못 거른다. 이제는 그 사람 자신의
  // 판당 평균으로 몇 판이 남았는지 재고, NEXT_GOAL_MAX_RUNS를 넘으면 뺀다.
  const cats = nextGoalLine({
    totals: { runs: 18, cats: 120, bigClears: 120, cellsCleared: 2800, playDays: 4, bestScore: 2000 },
    score: 1500,
    previousBest: 2000,
  });
  assert.ok(!cats.text.includes('고양이'), `27판짜리 목표가 나온다: ${cats.text}`);

  const cells = nextGoalLine({
    totals: { runs: 50, cats: 900, bigClears: 400, cellsCleared: 8000, playDays: 9, bestScore: 5000 },
    score: 4500,
    previousBest: 5000,
  });
  assert.ok(!cells.text.includes('칸'), `78판짜리 목표가 나온다: ${cells.text}`);

  // 진짜로 한두 판 안에 닿으면 나와야 한다 - 판당 633칸이면 1,000칸은 1.6판.
  const near = nextGoalLine({
    totals: { runs: 30, cats: 90000, bigClears: 9000, cellsCleared: 19000, playDays: 9, bestScore: 20000 },
    score: 100,
    previousBest: 20000,
  });
  assert.equal(near.text, '다음 카드까지 1,000칸!');
  assert.ok(near.runs <= NEXT_GOAL_MAX_RUNS);
});

test('도전장은 거리와 무관하게 언제나 가장 먼저다', () => {
  // 외부 검수 지적. 기록이 없는 사람에게는 친구 점수까지의 거리가 사실상
  // 무한대라 어떤 문턱에도 걸렸다. 그런데 그 사람은 바로 그 점수를 넘으러
  // 링크를 타고 온 사람이고, 홈 배너에는 이미 도전장이 떠 있다. 한 화면에서
  // 보이고 다른 화면에서 사라지면 앞뒤가 안 맞는다.
  const fresh = { runs: 0, cats: 0, bigClears: 0, cellsCleared: 0, playDays: 0, bestScore: 0 };
  const start = nextGoalLine({ totals: fresh, previousBest: 0, challengeTarget: 8235, phase: 'start' });
  assert.equal(start.kind, 'challenge');
  assert.equal(start.startText, '이번 판 8,235점 넘기면 친구 이기기!');

  const result = nextGoalLine({
    totals: { ...fresh, runs: 1, cats: 6, bigClears: 11, cellsCleared: 154, bestScore: 900 },
    score: 900,
    previousBest: 0,
    challengeTarget: 8235,
  });
  assert.equal(result.kind, 'challenge');
  assert.equal(result.text, '친구 기록까지 7,335점!');

  // 다른 목표가 아무리 가까워도 도전장이 앞선다.
  const crowded = nextGoalLine({
    totals: { runs: 20, cats: 900, bigClears: 200, cellsCleared: 8000, playDays: 6, bestScore: 3630 },
    score: 3630,
    previousBest: 3600,
    challengeTarget: 9000,
  });
  assert.equal(crowded.kind, 'challenge');
});

test('한참 모자란 판에서 최고기록을 들이밀지 않는다', () => {
  // 200점 내고 "최고기록까지 19,800점"은 목표가 아니라 면박이다.
  const far = nextGoalLine({
    totals: { runs: 300, cats: 90000, bigClears: 9000, cellsCleared: 90000, playDays: 40, bestScore: 20000 },
    score: 200,
    previousBest: 20000,
  });
  assert.equal(far, null);

  // 가까우면 나온다 - 판정은 결과창 헤드라인과 같은 isRecordInReach가 한다.
  const close = nextGoalLine({
    totals: { runs: 300, cats: 90000, bigClears: 9000, cellsCleared: 90000, playDays: 40, bestScore: 20000 },
    score: 19000,
    previousBest: 20000,
  });
  assert.equal(close.text, '최고기록까지 1,000점!');
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

test('벽 같은 목표는 다른 게 남아 있어도 안 고른다', () => {
  // 이 사람의 누적은 전부 바닥이라 카드 목표는 전부 수십 판짜리 벽이다.
  // 그래도 500점은 이미 내본 점수라, 도달 가능한 최고기록이 대신 나와야 한다.
  const goal = nextGoalLine({
    totals: { runs: 11, cats: 20, bigClears: 5, cellsCleared: 200, playDays: 1, bestScore: 500 },
    score: 20,
    previousBest: 500,
  });
  assert.equal(goal.kind, 'best', `벽이 다음 목표로 나온다: ${goal?.text}`);
  assert.ok(!goal.text.includes('칸'), '20,000칸 같은 벽이 나온다');
});

test('억지 목표를 만드느니 아무것도 안 띄운다', () => {
  // 설계 문서가 이 판단을 이 기능에서 제일 중요하다고 못박았다. 첫 판을
  // 막 끝낸 사람은 누적이 전부 바닥이라 닿는 목표가 없을 수 있고, 그때는
  // 침묵이 맞다.
  const goal = nextGoalLine({
    totals: { runs: 1, cats: 6, bigClears: 11, cellsCleared: 154, playDays: 1, bestScore: 900 },
    score: 900,
    previousBest: 0,
  });
  assert.equal(goal, null);
});

test('단위마다 말이 달라진다', () => {
  // 판 수를 30으로 잡아 판당 평균이 실제 봇 측정값에 가깝게 나오도록 한다
  // (판당 고양이 20 / 5칸묶기 8 / 지운 칸 630 근방).
  const of = (totals, extra = {}) => nextGoalLine({ totals, score: 0, previousBest: 0, ...extra })?.text;
  const base = { runs: 30, cats: 99999, bigClears: 99999, cellsCleared: 99999, playDays: 40, bestScore: 20000 };
  assert.equal(of({ ...base, cellsCleared: 19000 }), '다음 카드까지 1,000칸!');
  assert.equal(of({ ...base, cats: 280 }), '다음 카드까지 고양이 20마리!');
  assert.equal(of({ ...base, bigClears: 280 }), '다음 카드까지 20번!');
  assert.equal(
    of(base, { score: 9000, previousBest: 0, challengeTarget: 9500 }),
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
