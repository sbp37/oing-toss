import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  INTERSTITIAL_RUN_INTERVAL,
  interstitialDecision,
} from '../js/ad-pacing.js';
import { AD_CONTINUE_HINTS } from '../js/data.js';

function fakeTossScope() {
  const scope = globalThis;
  const hadWindow = 'window' in scope;
  const previousWindow = scope.window;
  const previousBridge = scope.ReactNativeWebView;
  const previousConstants = scope.__appsInTossConstants;
  if (!hadWindow) scope.window = scope;
  scope.ReactNativeWebView = { postMessage() {} };
  scope.__appsInTossConstants = { tossAppVersion: '5.999.0', platformOS: 'android' };
  return () => {
    if (previousBridge === undefined) delete scope.ReactNativeWebView;
    else scope.ReactNativeWebView = previousBridge;
    if (previousConstants === undefined) delete scope.__appsInTossConstants;
    else scope.__appsInTossConstants = previousConstants;
    if (!hadWindow) delete scope.window;
    else scope.window = previousWindow;
  };
}

function fakeStorage() {
  const scope = globalThis;
  const had = 'localStorage' in scope;
  const previous = scope.localStorage;
  const values = new Map();
  scope.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  return () => {
    if (had) scope.localStorage = previous;
    else delete scope.localStorage;
  };
}

test('the first two completed runs are ad-free and the third is due', () => {
  assert.equal(INTERSTITIAL_RUN_INTERVAL, 3);
  assert.deepEqual(interstitialDecision({ completedRuns: 1 }), { due: false, reset: false });
  assert.deepEqual(interstitialDecision({ completedRuns: 2 }), { due: false, reset: false });
  assert.deepEqual(interstitialDecision({ completedRuns: 3 }), { due: true, reset: false });
});

test('a rewarded ad on the third run replaces the interstitial opportunity', () => {
  assert.deepEqual(
    interstitialDecision({ completedRuns: 3, rewardedShown: true }),
    { due: false, reset: true },
  );
});

test('the continue reward promises and grants one hint', async () => {
  assert.equal(AD_CONTINUE_HINTS, 1);
  const [game, ui, html] = await Promise.all([
    readFile(new URL('../js/game.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/ui.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
  ]);
  assert.match(game, /grantItems\(\{ hint: AD_CONTINUE_HINTS \}, \{ source: 'ad-continue' \}\)/);
  assert.match(ui, /\+\$\{Math\.round\(seconds\)\}초 · 힌트/);
  assert.match(html, /\+30초 · 힌트 1/);
});

test('the third result schedules an automatic interstitial after showing the score', async () => {
  const game = await readFile(new URL('../js/game.js', import.meta.url), 'utf8');
  const showAt = game.indexOf('this.ui.showResult(this.lastResultSummary);');
  const adAt = game.indexOf('void this.showInterstitialAfterResult();', showAt);
  assert.ok(showAt >= 0 && adAt > showAt, '결과보다 광고 예약이 먼저면 안 된다');
  assert.match(game, /await delay\(1200\);/);
  assert.match(game, /if \(!document\.querySelector\('#result-screen'\)\?\.classList\.contains\('is-active'\)\) return false;/);
});

test('promotion grants are attempted only once even when the response fails', async () => {
  const restoreToss = fakeTossScope();
  const restoreStorage = fakeStorage();
  try {
    const module = await import(`../js/promotions.js?test=${Math.random()}`);
    const rewards = [{ key: 'firstRun', runs: 1, amount: 1, promotionCode: 'TEST_FIRST' }];
    let calls = 0;
    const loadBridge = async () => ({
      isPromotionRewardSupported: () => true,
      grantPromotionReward: async () => {
        calls += 1;
        return { ok: false, code: 'UNKNOWN' };
      },
    });
    await module.grantRunPromotions(1, { rewards, loadBridge });
    await module.grantRunPromotions(1, { rewards, loadBridge });
    assert.equal(calls, 1, '실패 응답을 자동 재시도하면 중복 지급 위험이 있다');
  } finally {
    restoreStorage();
    restoreToss();
  }
});

test('promotion run progress starts with this campaign build and survives reloads', async () => {
  const restoreStorage = fakeStorage();
  try {
    const module = await import(`../js/promotions.js?runs=${Math.random()}`);
    assert.equal(module.incrementPromotionRuns(), 1);
    assert.equal(module.incrementPromotionRuns(), 2);
    const reopened = await import(`../js/promotions.js?reopened=${Math.random()}`);
    assert.equal(reopened.incrementPromotionRuns(), 3);
  } finally {
    restoreStorage();
  }
});

test('successful promotion grants keep the returned transaction key', async () => {
  const restoreToss = fakeTossScope();
  const restoreStorage = fakeStorage();
  try {
    const module = await import(`../js/promotions.js?success=${Math.random()}`);
    const rewards = [{ key: 'threeRuns', runs: 3, amount: 3, promotionCode: 'TEST_THREE' }];
    const granted = await module.grantRunPromotions(3, {
      rewards,
      loadBridge: async () => ({
        isPromotionRewardSupported: () => true,
        grantPromotionReward: async () => ({ ok: true, key: 'reward-key' }),
      }),
    });
    assert.equal(granted.length, 1);
    const claims = JSON.parse(globalThis.localStorage.getItem('oing_toss_v3_promotion_claims'));
    assert.equal(claims.threeRuns.status, 'granted');
    assert.equal(claims.threeRuns.key, 'reward-key');
  } finally {
    restoreStorage();
    restoreToss();
  }
});
