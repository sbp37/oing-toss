import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  NICKNAME_CHANGE_MS,
  automaticNickname,
  isLegacyAutomaticNickname,
  nicknameClaimKey,
  nicknameChangeAvailableAtMs,
  nicknameReason,
} from '../firebase/functions/lib/nickname.js';
import { compareRankRows, decorateRankChanges, lifetimeLeaderboard } from '../firebase/functions/lib/ranking.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Firebase ranking keeps Firestore private and exposes one HTTPS gateway', async () => {
  const [rules, source] = await Promise.all([
    read('firebase/firestore.rules'),
    read('firebase/functions/index.js'),
  ]);
  assert.match(rules, /allow read, write: if false/);
  assert.match(source, /export const oingApi = onRequest/);
  assert.match(source, /verifyTossIdentity/);
  assert.match(source, /classifyRun/);
});

test('Firebase ranking caches top lists and expires run audit data', async () => {
  const source = await read('firebase/functions/index.js');
  assert.match(source, /collectionName\('ranking_cache', realm\)/);
  assert.match(source, /TOP_LIMIT = 100/);
  assert.match(source, /expiresAt: Timestamp\.fromMillis/);
  assert.match(source, /output = \{ \.\.\.run\.result, duplicate: true \}/);
  assert.match(source, /const ranking = accepted \?/);
  assert.match(source, /beatenNickname/);
  assert.match(source, /rankDelta: ranking\.weekly\.rankDelta/);
  assert.match(source, /decorateRankChanges\(rows, sorted\)/);
  assert.match(source, /rankDelta: Number\.isFinite\(Number\(row\.rankDelta\)\)/);
});

test('friend ranking reads each saved friend instead of dropping friends outside global top 100', async () => {
  const source = await read('firebase/functions/index.js');
  assert.match(source, /mode === 'all' \|\| mode === 'friends'/);
  assert.match(source, /lifetimeLeaderboard/);
  assert.match(source, /await db\.getAll\(\.\.\.refs\)/);
});

const rankingStore = (players, cachedRows = []) => ({
  cachedRows,
  loadPlayers: async (ids) => players.filter((player) => ids.includes(player.playerId)),
  countHigher: async (score) => players.filter((player) => player.bestScore > score).length,
  loadTies: async (score) => players.filter((player) => player.bestScore === score),
  loadNextHigher: async (score) => {
    const next = players.filter((player) => player.bestScore > score).sort((a, b) => a.bestScore - b.bestScore)[0];
    return next ? { score: next.bestScore } : null;
  },
});

test('friends retain lifetime scores even when nobody played this week', async () => {
  const players = [
    { playerId: 'me', nickname: '블루', bestScore: 1200 },
    { playerId: 'friend', nickname: '모카', bestScore: 6000 },
    { playerId: 'stranger', nickname: '쿠키', bestScore: 10000 },
  ];
  const result = await lifetimeLeaderboard({ mode: 'friends', playerId: 'me', friendIds: new Set(['friend']), ...rankingStore(players) });
  assert.deepEqual(result.rows.map((row) => row.score), [6000, 1200]);
  assert.equal(result.me.rank, 2);
  assert.equal(result.me.scoreToNext, 4801);
  assert.equal(result.rows[0].isFriend, true);
});

test('a player beyond top 100 still gets an exact rank and next-rank gap', async () => {
  const players = Array.from({ length: 152 }, (_, index) => ({ playerId: `p${index}`, nickname: '고양이', bestScore: 10000 - index * 10 }));
  const cache = players.slice(0, 100).map((player) => ({ ...player, score: player.bestScore }));
  const result = await lifetimeLeaderboard({ mode: 'all', playerId: 'p151', ...rankingStore(players, cache) });
  assert.equal(result.rows.length, 100);
  assert.equal(result.me.rank, 152);
  assert.equal(result.me.score, 8490);
  assert.equal(result.me.scoreToNext, 11);
  assert.equal(result.me.isMe, true);
});

test('out-of-cache equal scores use the same achievement-time ordering', async () => {
  const players = [
    { playerId: 'old', bestScore: 1000, bestAchievedAt: '2026-09-01' },
    { playerId: 'me', bestScore: 1000, bestAchievedAt: '2026-09-02' },
    { playerId: 'later', bestScore: 1000, bestAchievedAt: '2026-09-03' },
  ];
  const result = await lifetimeLeaderboard({ mode: 'all', playerId: 'me', ...rankingStore(players) });
  assert.equal(result.me.rank, 2);
  assert.equal(result.me.scoreToNext, 1);
  assert.ok(compareRankRows({ playerId: 'a', score: 1000, achievedAt: '' }, { playerId: 'b', score: 1000, achievedAt: '' }) < 0);
});

test('a player with no submitted score has no fabricated rank', async () => {
  const result = await lifetimeLeaderboard({ mode: 'all', playerId: 'me', ...rankingStore([{ playerId: 'me', bestScore: 0 }]) });
  assert.equal(result.me, null);
});

test('rank movement is recalculated for both climbers and displaced players', () => {
  const previous = [
    { playerId: 'a', score: 1000 },
    { playerId: 'b', score: 900 },
    { playerId: 'c', score: 800 },
  ];
  const withNewLeader = decorateRankChanges(previous, [
    { playerId: 'new', score: 1200 },
    ...previous,
  ]);
  assert.deepEqual(withNewLeader.map(({ playerId, rankDelta, isNew }) => ({ playerId, rankDelta, isNew })), [
    { playerId: 'new', rankDelta: 0, isNew: true },
    { playerId: 'a', rankDelta: -1, isNew: false },
    { playerId: 'b', rankDelta: -1, isNew: false },
    { playerId: 'c', rankDelta: -1, isNew: false },
  ]);

  const swapped = decorateRankChanges(previous, [previous[0], previous[2], previous[1]]);
  assert.equal(swapped[1].rankDelta, 1);
  assert.equal(swapped[2].rankDelta, -1);
});

test('ranking responses derive activity fire from the latest play timestamp', async () => {
  const source = await read('firebase/functions/index.js');
  assert.match(source, /lastPlayedAt: finishedAt/);
  assert.match(source, /activeAt: finishedAt/);
  assert.match(source, /row\.activeAt \|\| row\.achievedAt/);
  assert.match(source, /decorateRankChanges\(rows, sorted\)/);
});

test('private Toss AIT testing is isolated from verified live rankings', async () => {
  const [source, bridge] = await Promise.all([
    read('firebase/functions/index.js'),
    read('tools/toss-game-center-entry.mjs'),
  ]);
  assert.match(source, /host\.endsWith\('\.private-apps\.tossmini\.com'\)/);
  assert.match(source, /realm === 'sandbox' \? `sandbox_\$\{name\}` : name/);
  assert.match(source, /automaticNickname/);
  assert.match(source, /verifyPlayerToken\(value\.slice\(7\), env\('OING_RUN_TICKET_SECRET'\)\)/);
  assert.match(source, /verifyRunTicket\(body\.ticket, env\('OING_RUN_TICKET_SECRET'\)\)/);
  assert.match(bridge, /environment: getOperationalEnvironment/);
});

test('ranking nicknames allow friendly names but reject contact details and impersonation', () => {
  assert.equal(nicknameReason('블루냥7'), '');
  assert.equal(nicknameReason('블루고양이77'), 'nickname-length');
  assert.equal(nicknameReason('한'), 'nickname-length');
  assert.equal(nicknameReason('블루 냥'), 'nickname-characters');
  assert.equal(nicknameReason('www123'), 'nickname-contact');
  assert.equal(nicknameReason('오잉운영자'), 'nickname-blocked');
  assert.equal(NICKNAME_CHANGE_MS, 7 * 24 * 60 * 60 * 1000);
  assert.equal(nicknameClaimKey(' BlueCat '), 'bluecat');
  assert.equal(nicknameClaimKey('푸른냥'), '푸른냥');
  const changedAt = Date.parse('2026-09-01T00:00:00.000Z');
  assert.equal(nicknameChangeAvailableAtMs({
    nicknameChangedAt: new Date(changedAt),
    nicknameChangeAvailableAt: new Date(changedAt + 30 * 24 * 60 * 60 * 1000),
  }), changedAt + NICKNAME_CHANGE_MS);
});

test('custom ranking nicknames are atomically unique and report a useful conflict', async () => {
  const source = await read('firebase/functions/index.js');
  assert.match(source, /collectionName\('nickname_claims', realm\)/);
  assert.match(source, /claimedByAnother \|\| usedByAnother/);
  assert.match(source, /reason: 'nickname-taken'/);
  assert.match(source, /transaction\.set\(claimRef/);
});

test('automatic ranking names are varied Korean combinations without serial numbers', () => {
  const first = automaticNickname('0123456789abcdef0123456789abcdef');
  const second = automaticNickname('fedcba9876543210fedcba9876543210');
  assert.notEqual(first, second);
  assert.doesNotMatch(first, /\d/);
  assert.doesNotMatch(second, /\d/);
  assert.equal(nicknameReason(first), '');
  assert.equal(nicknameReason(second), '');
  assert.equal(isLegacyAutomaticNickname('오잉냥570'), true);
  assert.equal(isLegacyAutomaticNickname('오잉이'), false);
  assert.equal(isLegacyAutomaticNickname('블루냥'), false);
});

test('every build defaults to the deployed Firebase function and still allows an override', async () => {
  const [html, build, example] = await Promise.all([
    read('index.html'),
    read('hosting/build-static.mjs'),
    read('.firebaserc.example'),
  ]);
  assert.match(html, /meta name="oing-online-api-url" content="__OING_ONLINE_API_URL__"/);
  assert.match(build, /process\.env\.OING_ONLINE_API_URL/);
  assert.match(build, /https:\/\/asia-northeast3-new-oing-toss\.cloudfunctions\.net\/oingApi/);
  assert.match(example, /YOUR_NEW_OING_FIREBASE_PROJECT_ID/);
});
