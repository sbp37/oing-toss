import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseRunGoal, runGoalText, runGrowthText } from '../js/run-goal.js';
import { classicBoardShouldTurn, isEasyAnswer } from '../js/data.js';
import { findAllSumTenRects } from '../js/board.js';
import { GameUI } from '../js/ui.js';

test('run goal uses a close fresh rival, excludes self and beats ties by one', () => {
  const goal = chooseRunGoal({ best: 1000, now: 10000, fetchedAt: 9000, rows: [
    { nickname: '나', score: 1000, isMe: true }, { nickname: '멀다', score: 9000 },
    { nickname: '친구', score: 1000 }, { nickname: '다음', score: 1100 },
  ] });
  assert.equal(goal.target, 1001);
  assert.equal(goal.name, '친구');
  assert.match(runGoalText(goal, 1000), /1점/);
  assert.match(runGoalText(goal, 1001), /기록 돌파/);
  assert.ok(Object.isFrozen(goal));
});

test('offline, stale or distant rivals fall back without inventing an opponent', () => {
  assert.equal(chooseRunGoal().target, 1000);
  assert.equal(chooseRunGoal({ best: 2000, now: 400000, fetchedAt: 1, rows: [{ nickname: '친구', score: 2100 }] }).kind, 'best');
  assert.equal(chooseRunGoal({ best: 2000, now: 10000, fetchedAt: 9000, rows: [{ nickname: '친구', score: 9000 }] }).target, 2001);
  assert.equal(chooseRunGoal({ best: 2000, challenge: 2500 }).target, 2500);
});

test('growth reports only a real previous-record improvement', () => {
  assert.equal(runGrowthText({ maxCombo: 9, previousCombo: 10 }), '');
  assert.equal(runGrowthText({ maxCombo: 9, previousCombo: 0 }), '');
  assert.match(runGrowthText({ maxCombo: 12, previousCombo: 10 }), /\+2/);
});

test('last adjacent 1,1,8 stays playable for a perfect clear in either orientation', () => {
  for (const vertical of [false, true]) {
    const grid = Array.from({ length: 5 }, () => Array(6).fill(0));
    [1, 1, 8].forEach((n, i) => { grid[vertical ? i : 0][vertical ? 0 : i] = n; });
    const answers = findAllSumTenRects(grid);
    assert.equal(classicBoardShouldTurn({ hasAnswer: true, hasEasyAnswer: answers.some(isEasyAnswer), remaining: 3, initialPlayable: 30 }), false);
  }
  assert.equal(isEasyAnswer({ count: 3, r1: 0, r2: 2, c1: 0, c2: 2 }), false);
  assert.equal(isEasyAnswer({}), false);
});

test('score animations retarget, snap on reset and stop at screen transitions', () => {
  const before = { window: globalThis.window, raf: globalThis.requestAnimationFrame, cancel: globalThis.cancelAnimationFrame };
  const pending = new Map(); let id = 0;
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  globalThis.requestAnimationFrame = (cb) => { pending.set(++id, cb); return id; };
  globalThis.cancelAnimationFrame = (key) => pending.delete(key);
  try {
    const ui = Object.create(GameUI.prototype);
    ui.elements = { score: { textContent: '', dataset: {}, classList: { remove() {}, add() {} }, offsetWidth: 20 } };
    ui.renderScore(0); ui.renderScore(2);
    assert.equal(pending.size, 0);
    assert.equal(ui.elements.score.textContent, '2');
    ui.renderScore(100); ui.renderScore(150);
    assert.equal(pending.size, 1);
    ui.renderScore(50); // target decreased even while shown is still 2
    assert.equal(pending.size, 0);
    assert.equal(ui.scoreShown, 50);
    ui.renderScore(100); ui.settleScore();
    assert.equal(pending.size, 0);
    assert.equal(ui.scoreShown, 100);
    ui.renderScore(0);
    assert.equal(ui.scoreShown, 0);
    globalThis.window.matchMedia = () => ({ matches: true });
    ui.renderScore(200);
    assert.equal(pending.size, 0);
  } finally {
    globalThis.window = before.window;
    globalThis.requestAnimationFrame = before.raf;
    globalThis.cancelAnimationFrame = before.cancel;
  }
});
