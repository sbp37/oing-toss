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

test('출석 일수는 판을 더 한다고 가까워지지 않으므로 예외를 안 받는다', () => {
  // "다음 카드까지 6일"은 지금 한 판 더 할 이유가 못 된다. 같은 상황에서
  // 판 수 목표가 대신 나와야 한다.
  const goal = nextGoalLine({
    totals: { runs: 1, cats: 6, bigClears: 11, cellsCleared: 154, playDays: 1, bestScore: 900 },
    score: 900,
    previousBest: 0,
  });
  assert.ok(!goal.text.includes('일!'), `날짜 목표가 첫 판 직후에 나온다: ${goal.text}`);

  // 비율이 충분히 줄면 그때는 들어온다.
  const near = nextGoalLine({
    totals: { runs: 40, cats: 99999, bigClears: 9999, cellsCleared: 99999, playDays: 6, bestScore: 20000 },
    score: 100,
    previousBest: 0,
  });
  assert.equal(near.text, '다음 카드까지 1일!');
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
