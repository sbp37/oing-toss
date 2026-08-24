import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createGameLeaderboardAdapter, isAppsInTossWebView } from '../js/leaderboard.js';

const tossScope = () => ({
  ReactNativeWebView: { postMessage() {} },
  __appsInTossConstants: { tossAppVersion: '5.999.0' },
});

test('Apps in Toss detection requires the native bridge and injected constants', () => {
  assert.equal(isAppsInTossWebView({}), false);
  assert.equal(isAppsInTossWebView({ ReactNativeWebView: {} }), false);
  assert.equal(isAppsInTossWebView(tossScope()), true);
});

test('Classic score is submitted at most once for each run id', async () => {
  const submitted = [];
  const adapter = createGameLeaderboardAdapter({
    scope: tossScope(),
    loadProvider: async () => ({
      isLeaderboardSupported: () => true,
      submitLeaderboardScore: async (score) => {
        submitted.push(score);
        return { statusCode: 'SUCCESS' };
      },
      openLeaderboard: async () => {},
    }),
  });

  assert.deepEqual(await adapter.submitClassicScoreOnce({ runId: 1, score: 1234.4 }), { ok: true });
  assert.deepEqual(await adapter.submitClassicScoreOnce({ runId: 1, score: 9999 }), { ok: false, reason: 'duplicate' });
  assert.deepEqual(await adapter.submitClassicScoreOnce({ runId: 2, score: 42 }), { ok: true });
  assert.deepEqual(submitted, ['1234', '42']);
});

test('Bridge failures stay contained and do not retry the finished run', async () => {
  let calls = 0;
  const adapter = createGameLeaderboardAdapter({
    scope: tossScope(),
    loadProvider: async () => ({
      isLeaderboardSupported: () => true,
      submitLeaderboardScore: async () => {
        calls += 1;
        throw new Error('native bridge unavailable');
      },
      openLeaderboard: async () => {},
    }),
  });

  assert.deepEqual(await adapter.submitClassicScoreOnce({ runId: 'run-a', score: 10 }), { ok: false, reason: 'bridge-error' });
  assert.deepEqual(await adapter.submitClassicScoreOnce({ runId: 'run-a', score: 10 }), { ok: false, reason: 'duplicate' });
  assert.equal(calls, 1);
});

test('Outside Toss never loads or calls the official provider', async () => {
  let loads = 0;
  const adapter = createGameLeaderboardAdapter({
    scope: {},
    loadProvider: async () => {
      loads += 1;
      throw new Error('must not load');
    },
  });

  assert.equal(await adapter.isAvailable(), false);
  assert.deepEqual(await adapter.submitClassicScoreOnce({ runId: 1, score: 10 }), { ok: false, reason: 'outside-toss' });
  assert.deepEqual(await adapter.open(), { ok: false, reason: 'outside-toss' });
  assert.equal(loads, 0);
});

test('Leaderboard entry delegates to the official provider once', async () => {
  let opens = 0;
  const adapter = createGameLeaderboardAdapter({
    scope: tossScope(),
    loadProvider: async () => ({
      isLeaderboardSupported: () => true,
      submitLeaderboardScore: async () => ({ statusCode: 'SUCCESS' }),
      openLeaderboard: async () => { opens += 1; },
    }),
  });

  assert.deepEqual(await adapter.open(), { ok: true });
  assert.equal(opens, 1);
});

test('Classic finish and the separate home entry stay wired to Game Center', async () => {
  const [game, home, providerSource] = await Promise.all([
    readFile(new URL('../js/game.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../tools/toss-game-center-entry.mjs', import.meta.url), 'utf8'),
  ]);

  const classicFinish = game.slice(game.indexOf('async finishClassic()'));
  assert.equal((classicFinish.match(/submitClassicScoreOnce/g) || []).length, 1);
  assert.match(classicFinish, /runId:\s*this\.activeRunId/);
  assert.match(home, /id="home-leaderboard-button"/);
  assert.match(home, /id="home-ranking-button"/);
  assert.match(providerSource, /Game\.setLeaderboardScore/);
  assert.match(providerSource, /Game\.openLeaderboard/);
});
