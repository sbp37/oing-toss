// 오잉 카드의 해금 판정.
//
// 카드가 잘못 열리면 수집의 의미가 사라지고, 잘못 잠기면 아무리 해도 안 열려
// 그만두게 된다. 어느 쪽도 화면만 봐서는 늦게 발견된다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { OING_CARDS, oingCardRows } from '../js/data.js';

const 아무것도안함 = { runs: 0, cats: 0, bigClears: 0, cellsCleared: 0, playDays: 0, bestScore: 0 };

test('처음 켠 사람에게는 한 장도 열려 있지 않다', () => {
  const rows = oingCardRows(아무것도안함);
  assert.equal(rows.length, 9);
  assert.equal(rows.filter((card) => card.unlocked).length, 0);
});

test('조건을 정확히 채우면 열리고, 하나 모자라면 잠겨 있다', () => {
  for (const card of OING_CARDS) {
    const 딱맞게 = { ...아무것도안함, [card.metric]: card.goal };
    const 하나모자라게 = { ...아무것도안함, [card.metric]: card.goal - 1 };
    const 열린것 = oingCardRows(딱맞게).find((row) => row.key === card.key);
    const 잠긴것 = oingCardRows(하나모자라게).find((row) => row.key === card.key);
    assert.equal(열린것.unlocked, true, `${card.label}: 조건을 채웠는데 잠겨 있다`);
    assert.equal(잠긴것.unlocked, false, `${card.label}: 하나 모자란데 열려 있다`);
  }
});

test('점수로 잠기는 카드는 두 장뿐이다', () => {
  // 점수는 실력 천장이라, 여기에 많이 묶으면 오래 해도 못 얻는 카드가 늘어난다.
  const 점수카드 = OING_CARDS.filter((card) => card.metric === 'bestScore');
  assert.equal(점수카드.length, 2);
});

test('뒤로 갈수록 어려워진다 - 같은 기준끼리는 목표가 커져야 한다', () => {
  const 기준별 = new Map();
  OING_CARDS.forEach((card, index) => {
    const 이전 = 기준별.get(card.metric);
    if (이전) {
      assert.ok(card.goal > 이전.goal,
        `${card.label}이 앞선 ${이전.label}보다 쉽거나 같다 (${card.goal} vs ${이전.goal})`);
      assert.ok(index > 이전.index, `${card.label}이 더 어려운데 앞에 있다`);
    }
    기준별.set(card.metric, { goal: card.goal, label: card.label, index });
  });
});

test('진행도는 0과 1 사이에 머문다', () => {
  const 넘치게 = { runs: 9999, cats: 9999, bigClears: 9999, cellsCleared: 999999, playDays: 999, bestScore: 999999 };
  for (const row of oingCardRows(넘치게)) {
    assert.equal(row.progress, 1);
    assert.equal(row.current, row.goal, '넘긴 값이 목표보다 크게 표시되면 안 된다');
  }
  for (const row of oingCardRows({ ...아무것도안함, cats: -50 })) {
    assert.ok(row.progress >= 0);
  }
});

test('그림이 아직 없어도 카드 정의는 온전하다', () => {
  for (const card of OING_CARDS) {
    assert.ok(card.key && card.label && card.requirement, `${card.key}: 빠진 항목이 있다`);
    assert.ok(card.goal > 0);
  }
  const keys = OING_CARDS.map((card) => card.key);
  assert.equal(new Set(keys).size, keys.length, '카드 key가 겹친다');
});
