import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  classifyRun,
  countBurstWindows,
  createPlayerToken,
  createRunTicket,
  providerIdentityKey,
  verifyPlayerToken,
  verifyRunTicket,
} from '../server/oing/security.js';
import { createOingOnlineAdapter } from '../js/oing-online.js';

const secret = 'test-secret-with-enough-entropy';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || '',
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test('provider identities are one-way server keys and never nickname keys', () => {
  const first = providerIdentityKey('toss', 'raw-user-hash', secret);
  const second = providerIdentityKey('toss', 'raw-user-hash', secret);
  assert.equal(first, second);
  assert.equal(first.length, 64);
  assert.doesNotMatch(first, /raw-user-hash/);
  assert.notEqual(first, providerIdentityKey('google-play', 'raw-user-hash', secret));
});

test('player and run tickets reject tampering and expiration', () => {
  const player = createPlayerToken({ playerId: 'player-1' }, secret);
  assert.equal(verifyPlayerToken(player, secret)?.playerId, 'player-1');
  assert.equal(verifyPlayerToken(`${player}x`, secret), null);

  const run = createRunTicket({ runId: 'run-1', playerId: 'player-1', clientRunId: 'client-1' }, secret);
  const claims = verifyRunTicket(run, secret);
  assert.equal(claims.runId, 'run-1');
  assert.equal(verifyRunTicket(run, secret, claims.exp + 1), null);
});

test('run review catches impossible score, duration, and success bursts without ranking them', () => {
  assert.deepEqual(countBurstWindows([0, 1000, 2000, 3001]), { maxCount: 3, suspicious: false });
  const fast = Array.from({ length: 13 }, (_, index) => index * 200);
  const result = classifyRun({ score: 150001, durationMs: 1000, successTimesMs: fast, successCount: 13 });
  assert.equal(result.status, 'pending');
  assert.deepEqual(result.reasons, [
    'score-over-review-threshold',
    'duration-out-of-range',
    'success-ledger-mismatch',
    'success-burst',
  ]);
});

test('run review rejects a final count that disagrees with its success timeline', () => {
  const result = classifyRun({
    score: 1000,
    durationMs: 120000,
    successTimesMs: [1000, 5000],
    successCount: 3,
  });
  assert.equal(result.status, 'pending');
  assert.deepEqual(result.reasons, ['success-ledger-mismatch']);
});

test('online adapter bootstraps Toss, records one run, and never blocks on a duplicate finish', async () => {
  const calls = [];
  const responses = {
    bootstrap: { ok: true, token: 'player-token', player: { nickname: 'OINGCAT', jelly: 11 } },
    'start-run': { ok: true, ticket: 'run-ticket' },
    'finish-run': { ok: true, status: 'accepted', jelly: 12, jellyEarned: 1 },
  };
  const adapter = createOingOnlineAdapter({
    scope: { window: { ReactNativeWebView: {}, __appsInTossConstants: {} } },
    storage: memoryStorage(),
    loadTossProvider: async () => ({
      getTossGameIdentity: async () => ({ provider: 'toss', credential: 'raw-hash' }),
    }),
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      calls.push(body);
      return { ok: true, json: async () => responses[body.action] };
    },
  });
  assert.deepEqual(await adapter.startRun('run-a'), { ok: true });
  adapter.recordSuccess();
  const result = await adapter.finishRun({
    clientRunId: 'run-a', score: 3210, successCount: 1, boards: 4, maxCombo: 8,
  });
  assert.equal(result.ok, true);
  assert.equal(adapter.getPlayer().jelly, 12);
  assert.equal(calls.filter((call) => call.action === 'finish-run').length, 1);
  assert.equal((await adapter.finishRun({ clientRunId: 'run-a' })).reason, 'run-not-started');
});

test('public web can read OING ranks without pretending to have a native identity', async () => {
  const adapter = createOingOnlineAdapter({
    scope: { location: { hostname: 'example.com', origin: 'https://example.com' } },
    storage: null,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ ok: true, rows: [{ rank: 1, nickname: 'CAT', score: 9000 }] }),
    }),
  });
  const result = await adapter.leaderboard('all');
  assert.equal(result.rows[0].score, 9000);
});

test('Vercel branch previews show labeled sample ranks when the backend is unavailable', async () => {
  const adapter = createOingOnlineAdapter({
    scope: {
      location: {
        hostname: 'oing-toss-git-preview-sbp37s-projects.vercel.app',
        origin: 'https://oing-toss-git-preview-sbp37s-projects.vercel.app',
      },
    },
    storage: null,
    fetchImpl: async () => ({
      ok: false,
      json: async () => ({ ok: false, reason: 'offline' }),
    }),
  });
  const weekly = await adapter.leaderboard('weekly');
  assert.equal(weekly.preview, true);
  assert.equal(weekly.rows.length, 30);
  assert.equal(weekly.me.rank, 22);
  const friends = await adapter.leaderboard('friends');
  assert.ok(friends.rows.length >= 4);
  assert.equal((await adapter.setFriend(weekly.rows[5].playerId, true)).ok, true);
  assert.equal((await adapter.leaderboard('friends')).rows.some((row) => row.playerId === weekly.rows[5].playerId), true);
});

test('the production Vercel host never substitutes sample rankings', async () => {
  const adapter = createOingOnlineAdapter({
    scope: {
      location: {
        hostname: 'oing-toss.vercel.app',
        origin: 'https://oing-toss.vercel.app',
        search: '?rankingDemo=1',
      },
    },
    storage: null,
    fetchImpl: async () => ({
      ok: false,
      json: async () => ({ ok: false, reason: 'offline' }),
    }),
  });
  const result = await adapter.leaderboard('weekly');
  assert.equal(result.ok, false);
  assert.equal(result.preview, undefined);
  assert.deepEqual(result.rows, []);
});

test('friend ranking and long-press save use the authenticated OING API', async () => {
  const calls = [];
  const adapter = createOingOnlineAdapter({
    scope: { window: { ReactNativeWebView: {}, __appsInTossConstants: {} } },
    storage: memoryStorage(),
    loadTossProvider: async () => ({
      getTossGameIdentity: async () => ({ provider: 'toss', credential: 'raw-hash' }),
    }),
    fetchImpl: async (url, options) => {
      if (!options.body) {
        calls.push({ url, method: 'GET' });
        return { ok: true, json: async () => ({ ok: true, rows: [] }) };
      }
      const body = JSON.parse(options.body);
      calls.push(body);
      if (body.action === 'bootstrap') {
        return { ok: true, json: async () => ({ ok: true, token: 'player-token', player: {} }) };
      }
      return { ok: true, json: async () => ({ ok: true, friendship: { saved: body.saved } }) };
    },
  });

  await adapter.leaderboard('friends');
  const saved = await adapter.setFriend('11111111-1111-4111-8111-111111111111', true);
  assert.equal(saved.friendship.saved, true);
  assert.match(calls.find((call) => call.method === 'GET').url, /mode=friends/);
  assert.deepEqual(calls.at(-1), {
    action: 'friend',
    playerId: '11111111-1111-4111-8111-111111111111',
    saved: true,
  });
});

test('opening moves are retained while the mobile identity and run ticket are loading', async () => {
  let releaseStart;
  const startResponse = new Promise((resolve) => { releaseStart = resolve; });
  let finishBody = null;
  const adapter = createOingOnlineAdapter({
    scope: { window: { ReactNativeWebView: {}, __appsInTossConstants: {} } },
    storage: memoryStorage(),
    loadTossProvider: async () => ({
      getTossGameIdentity: async () => ({ provider: 'toss', credential: 'raw-hash' }),
    }),
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      if (body.action === 'bootstrap') {
        return { ok: true, json: async () => ({ ok: true, token: 'player-token', player: {} }) };
      }
      if (body.action === 'start-run') {
        await startResponse;
        return { ok: true, json: async () => ({ ok: true, ticket: 'run-ticket' }) };
      }
      finishBody = body;
      return { ok: true, json: async () => ({ ok: true, jelly: 0 }) };
    },
  });

  const starting = adapter.startRun('slow-start');
  await Promise.resolve();
  adapter.recordSuccess();
  releaseStart();
  await starting;
  await adapter.finishRun({ clientRunId: 'slow-start', score: 10 });
  assert.equal(finishBody.successTimesMs.length, 1);
});

test('a lost finish response is retried from session storage without a second local grant', async () => {
  const storage = memoryStorage();
  let firstFinish = true;
  const makeAdapter = () => createOingOnlineAdapter({
    scope: { window: { ReactNativeWebView: {}, __appsInTossConstants: {} } },
    storage,
    loadTossProvider: async () => ({
      getTossGameIdentity: async () => ({ provider: 'toss', credential: 'raw-hash' }),
    }),
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      if (body.action === 'bootstrap') {
        return { ok: true, json: async () => ({ ok: true, token: 'player-token', player: { jelly: 0 } }) };
      }
      if (body.action === 'start-run') {
        return { ok: true, json: async () => ({ ok: true, ticket: 'run-ticket' }) };
      }
      if (firstFinish) {
        firstFinish = false;
        throw new Error('response lost');
      }
      return { ok: true, json: async () => ({ ok: true, duplicate: true, jelly: 1 }) };
    },
  });

  const first = makeAdapter();
  await first.startRun('retry-run');
  assert.equal((await first.finishRun({ clientRunId: 'retry-run', score: 10 })).ok, false);
  const second = makeAdapter();
  const restored = await second.bootstrap();
  assert.equal(restored.ok, true);
  assert.equal(second.getPlayer().jelly, 1);
});

test('database schema keeps identity, score, wallet, and immutable ledger separate', async () => {
  const schema = await readFile(new URL('../server/oing/schema.sql', import.meta.url), 'utf8');
  assert.match(schema, /PRIMARY KEY \(provider, provider_user_key\)/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS oing_jelly_wallet/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS oing_jelly_ledger/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS oing_friendships/);
  assert.match(schema, /PRIMARY KEY \(owner_player_id, friend_player_id\)/);
  assert.match(schema, /CHECK \(owner_player_id <> friend_player_id\)/);
  assert.match(schema, /UNIQUE \(player_id, idempotency_key\)/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION oing_purchase_cosmetic/);
  assert.match(schema, /pg_advisory_xact_lock\(hashtextextended\(p_player_id::text \|\| ':' \|\| p_item_key/);
  assert.match(schema, /'cosmetic:' \|\| p_item_key/);
  assert.doesNotMatch(schema, /rankings\s*\/\s*nickname/i);
});
