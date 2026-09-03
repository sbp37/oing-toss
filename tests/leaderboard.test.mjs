import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  createGameLeaderboardAdapter,
  isAppsInTossWebView,
  isGooglePlayGamesWebView,
} from '../js/leaderboard.js';

const tossScope = () => ({
  ReactNativeWebView: { postMessage() {} },
  __appsInTossConstants: { tossAppVersion: '5.999.0' },
});

const googleScope = (plugin) => ({
  Capacitor: {
    getPlatform: () => 'android',
    Plugins: { GooglePlayLeaderboard: plugin },
  },
});

test('Apps in Toss detection requires the native bridge and injected constants', () => {
  assert.equal(isAppsInTossWebView({}), false);
  assert.equal(isAppsInTossWebView({ ReactNativeWebView: {} }), false);
  assert.equal(isAppsInTossWebView(tossScope()), true);
});

test('Google Play detection requires Android and the complete native plugin', () => {
  const complete = {
    isAvailable: async () => ({ available: true }),
    submitScore: async () => ({ ok: true }),
    open: async () => ({ ok: true }),
  };
  assert.equal(isGooglePlayGamesWebView({}), false);
  assert.equal(isGooglePlayGamesWebView(googleScope({ isAvailable() {} })), false);
  assert.equal(isGooglePlayGamesWebView({
    Capacitor: { getPlatform: () => 'web', Plugins: { GooglePlayLeaderboard: complete } },
  }), false);
  assert.equal(isGooglePlayGamesWebView(googleScope(complete)), true);
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

test('Outside Toss and Google Play never loads or calls either provider', async () => {
  let loads = 0;
  const adapter = createGameLeaderboardAdapter({
    scope: {},
    loadProvider: async () => {
      loads += 1;
      throw new Error('must not load');
    },
    loadGoogleProvider: async () => {
      loads += 1;
      throw new Error('must not load');
    },
  });

  assert.equal(await adapter.isAvailable(), false);
  assert.deepEqual(await adapter.submitClassicScoreOnce({ runId: 1, score: 10 }), { ok: false, reason: 'outside-supported-platform' });
  assert.deepEqual(await adapter.open(), { ok: false, reason: 'outside-supported-platform' });
  assert.equal(loads, 0);
});

test('Google Play submits a rounded Classic score once and opens the native leaderboard', async () => {
  const submitted = [];
  let opens = 0;
  const plugin = {
    isAvailable: async () => ({ available: true, authenticated: true }),
    submitScore: async ({ score }) => {
      submitted.push(score);
      return { ok: true };
    },
    open: async () => {
      opens += 1;
      return { ok: true };
    },
  };
  const adapter = createGameLeaderboardAdapter({ scope: googleScope(plugin) });

  assert.equal(adapter.isGooglePlayEnvironment(), true);
  assert.equal(adapter.isTossEnvironment(), false);
  assert.equal(await adapter.isAvailable(), true);
  assert.deepEqual(await adapter.submitClassicScoreOnce({ runId: 'android-1', score: 4567.8 }), { ok: true });
  assert.deepEqual(await adapter.submitClassicScoreOnce({ runId: 'android-1', score: 9999 }), { ok: false, reason: 'duplicate' });
  assert.deepEqual(await adapter.open(), { ok: true });
  assert.deepEqual(submitted, [4568]);
  assert.equal(opens, 1);
});

test('Apps in Toss remains the preferred provider inside an Android host', async () => {
  let tossSubmits = 0;
  let googleSubmits = 0;
  const scope = {
    ...tossScope(),
    ...googleScope({
      isAvailable: async () => ({ available: true }),
      submitScore: async () => { googleSubmits += 1; return { ok: true }; },
      open: async () => ({ ok: true }),
    }),
  };
  const adapter = createGameLeaderboardAdapter({
    scope,
    loadProvider: async () => ({
      isLeaderboardSupported: () => true,
      submitLeaderboardScore: async () => {
        tossSubmits += 1;
        return { statusCode: 'SUCCESS' };
      },
      openLeaderboard: async () => {},
    }),
  });

  assert.deepEqual(await adapter.submitClassicScoreOnce({ runId: 'toss-android', score: 77 }), { ok: true });
  assert.equal(tossSubmits, 1);
  assert.equal(googleSubmits, 0);
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
  const [game, home, providerSource, androidPlugin, manifest, strings, gradle] = await Promise.all([
    readFile(new URL('../js/game.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../tools/toss-game-center-entry.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../android/app/src/main/java/com/oinggame/app/GooglePlayLeaderboardPlugin.java', import.meta.url), 'utf8'),
    readFile(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8'),
    readFile(new URL('../android/app/src/main/res/values/strings.xml', import.meta.url), 'utf8'),
    readFile(new URL('../android/app/build.gradle', import.meta.url), 'utf8'),
  ]);

  const classicFinish = game.slice(game.indexOf('async finishClassic()'));
  assert.equal((classicFinish.match(/submitClassicScoreOnce/g) || []).length, 1);
  assert.match(classicFinish, /runId:\s*this\.activeRunId/);
  assert.match(home, /id="home-leaderboard-button"/);
  assert.match(home, /id="home-ranking-button"/);
  assert.match(providerSource, /Game\.setLeaderboardScore/);
  assert.match(providerSource, /Game\.openLeaderboard/);
  assert.match(androidPlugin, /submitScore\(/);
  assert.match(androidPlugin, /getLeaderboardIntent\(/);
  assert.match(manifest, /com\.google\.android\.gms\.games\.APP_ID/);
  assert.match(strings, /974542803508/);
  assert.match(strings, /CgkItKScuq4cEAIQAA/);
  assert.match(gradle, /play-services-games-v2:22\.0\.0/);
});
