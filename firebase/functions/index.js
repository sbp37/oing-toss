import { randomUUID } from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import {
  createPlayerToken,
  createRunTicket,
  classifyRun,
  providerIdentityKey,
  verifyPlayerToken,
  verifyRunTicket,
} from './lib/security.js';
import { verifyTossIdentity } from './lib/toss-identity.js';
import { compareRankRows, decorateRankChanges, lifetimeLeaderboard } from './lib/ranking.js';
import {
  NICKNAME_CHANGE_MS,
  automaticNickname,
  isLegacyAutomaticNickname,
  nicknameClaimKey,
  nicknameChangeAvailableAtMs,
  nicknameReason,
} from './lib/nickname.js';

if (!getApps().length) initializeApp();
const db = getFirestore();
const REGION = 'asia-northeast3';
const TOP_LIMIT = 100;
const functionSecrets = [
  defineSecret('OING_IDENTITY_SECRET'),
  defineSecret('OING_RUN_TICKET_SECRET'),
  defineSecret('TOSS_MTLS_CERT_BASE64'),
  defineSecret('TOSS_MTLS_KEY_BASE64'),
];

function env(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function weekKey(now = new Date()) {
  const seoul = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = seoul.getUTCDay() || 7;
  seoul.setUTCDate(seoul.getUTCDate() - day + 1);
  return seoul.toISOString().slice(0, 10);
}

function json(response, status, payload) {
  response.status(status).set('cache-control', 'no-store').json(payload);
}

async function bodyOf(request) {
  if (request.body && typeof request.body === 'object') return request.body;
  return {};
}

function bearer(request) {
  const value = String(request.headers.authorization || '');
  return value.startsWith('Bearer ')
    ? verifyPlayerToken(value.slice(7), env('OING_RUN_TICKET_SECRET'))
    : null;
}

function realmOf(auth) {
  return auth?.realm === 'sandbox' ? 'sandbox' : 'live';
}

function collectionName(name, realm = 'live') {
  return realm === 'sandbox' ? `sandbox_${name}` : name;
}

function isPrivateTossSandbox(request, environment) {
  if (environment !== 'sandbox') return false;
  try {
    const host = new URL(String(request.headers.referer || '')).hostname;
    return host.endsWith('.private-apps.tossmini.com');
  } catch {
    return false;
  }
}

function publicRow(row, rank, playerId, friendIds = new Set()) {
  return {
    playerId: row.playerId,
    rank,
    nickname: row.nickname,
    score: Number(row.score || 0),
    achievedAt: row.achievedAt || null,
    isMe: row.playerId === playerId,
    isFriend: friendIds.has(row.playerId),
    hot: (row.activeAt || row.achievedAt)
      ? Date.now() - new Date(row.activeAt || row.achievedAt).getTime() < 86400000
      : false,
    rankDelta: Number.isFinite(Number(row.rankDelta)) ? Number(row.rankDelta) : null,
    isNew: row.isNew === true,
  };
}

function sortTop(rows) {
  return [...rows]
    .sort(compareRankRows)
    .slice(0, TOP_LIMIT);
}

function renameCachedRows(transaction, snapshot, ref, playerId, nickname) {
  const rows = Array.isArray(snapshot.data()?.rows) ? snapshot.data().rows : [];
  if (!rows.some((row) => row.playerId === playerId)) return;
  transaction.set(ref, {
    rows: rows.map((row) => row.playerId === playerId ? { ...row, nickname } : row),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

function refreshTopCache(transaction, snapshot, mode, key, candidate, realm = 'live') {
  const ref = db.doc(`${collectionName('ranking_cache', realm)}/${mode}-${key}`);
  const rows = Array.isArray(snapshot.data()?.rows) ? snapshot.data().rows : [];
  const previous = rows.find((row) => row.playerId === candidate.playerId);
  if (previous && Number(previous.score) >= Number(candidate.score)) {
    if (candidate.activeAt && candidate.activeAt !== previous.activeAt) {
      transaction.set(ref, {
        rows: rows.map((row) => row.playerId === candidate.playerId
          ? { ...row, activeAt: candidate.activeAt }
          : row),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    return;
  }
  const sorted = sortTop([...rows.filter((row) => row.playerId !== candidate.playerId), candidate]);
  const next = decorateRankChanges(rows, sorted);
  transaction.set(ref, { rows: next, updatedAt: FieldValue.serverTimestamp() });
}

function rankOutcome(snapshot, candidate, previousScore) {
  const rows = Array.isArray(snapshot.data()?.rows) ? snapshot.data().rows : [];
  const before = sortTop(rows);
  const rankBeforeIndex = before.findIndex((row) => row.playerId === candidate.playerId);
  const improved = Number(candidate.score) > Number(previousScore || 0);
  const after = improved
    ? sortTop([...before.filter((row) => row.playerId !== candidate.playerId), candidate])
    : before;
  const rankAfterIndex = after.findIndex((row) => row.playerId === candidate.playerId);
  const rankBefore = rankBeforeIndex >= 0 ? rankBeforeIndex + 1 : null;
  const rankAfter = rankAfterIndex >= 0 ? rankAfterIndex + 1 : null;
  const movedUp = Boolean(rankAfter && (!rankBefore || rankAfter < rankBefore));
  const displaced = movedUp ? before[rankAfter - 1] : null;
  return {
    rankBefore,
    rankAfter,
    rankDelta: rankBefore && rankAfter ? Math.max(0, rankBefore - rankAfter) : 0,
    isNew: !rankBefore && Boolean(rankAfter),
    beatenNickname: displaced && displaced.playerId !== candidate.playerId
      ? String(displaced.nickname || '') || null
      : null,
  };
}

async function bootstrap(request, response, body) {
  const provider = String(body.provider || '');
  const credential = String(body.credential || '');
  const environment = String(body.environment || 'toss');
  if (provider !== 'toss' || !credential || credential.length > 512) {
    return json(response, 400, { ok: false, reason: 'invalid-identity' });
  }
  const testIdentity = process.env.OING_ALLOW_TEST_IDENTITY === 'true' && credential.startsWith('test_');
  const sandboxIdentity = isPrivateTossSandbox(request, environment);
  if (!testIdentity && !sandboxIdentity && !await verifyTossIdentity(credential)) {
    return json(response, 401, { ok: false, reason: 'identity-not-verified' });
  }
  const realm = sandboxIdentity ? 'sandbox' : 'live';
  const providerKey = providerIdentityKey(`${provider}-${realm}`, credential, env('OING_IDENTITY_SECRET'));
  const playerId = providerKey.slice(0, 32);
  const ref = db.doc(`${collectionName('players', realm)}/${playerId}`);
  const snap = await ref.get();
  let player = snap.exists ? snap.data() : {
    playerId,
    nickname: automaticNickname(providerKey),
    jelly: 0,
    createdAt: FieldValue.serverTimestamp(),
  };
  if (!snap.exists) await ref.set(player);
  // Early ranking builds gave every untouched account an almost identical
  // 오잉이/오잉냥### label. Upgrade only server-generated names; a name the
  // player explicitly chose is never rewritten.
  if (snap.exists && player.nicknameCustomized !== true && isLegacyAutomaticNickname(player.nickname)) {
    const nickname = automaticNickname(providerKey);
    const weeklyKey = weekKey();
    const weeklyRef = db.doc(`${collectionName('weekly_scores', realm)}/${weeklyKey}/players/${playerId}`);
    const allCacheRef = db.doc(`${collectionName('ranking_cache', realm)}/all-all`);
    const weeklyCacheRef = db.doc(`${collectionName('ranking_cache', realm)}/weekly-${weeklyKey}`);
    await db.runTransaction(async (transaction) => {
      const [playerSnap, weeklySnap, allCacheSnap, weeklyCacheSnap] = await Promise.all([
        transaction.get(ref),
        transaction.get(weeklyRef),
        transaction.get(allCacheRef),
        transaction.get(weeklyCacheRef),
      ]);
      const current = playerSnap.data() || {};
      if (current.nicknameCustomized === true || !isLegacyAutomaticNickname(current.nickname)) return;
      transaction.set(ref, { nickname }, { merge: true });
      if (weeklySnap.exists) transaction.set(weeklyRef, { nickname }, { merge: true });
      renameCachedRows(transaction, allCacheSnap, allCacheRef, playerId, nickname);
      renameCachedRows(transaction, weeklyCacheSnap, weeklyCacheRef, playerId, nickname);
    });
    player = { ...player, nickname };
  }
  const token = createPlayerToken({ playerId, realm }, env('OING_RUN_TICKET_SECRET'));
  return json(response, 200, {
    ok: true,
    token,
    player: {
      nickname: player.nickname,
      bestScore: Number(player.bestScore || 0),
      nicknameCustomized: player.nicknameCustomized === true,
      nicknameChangeAvailableAt: nicknameChangeAvailableAtMs(player)
        ? new Date(nicknameChangeAvailableAtMs(player)).toISOString()
        : null,
      jelly: Number(player.jelly || 0),
    },
  });
}

async function startRun(request, response, body) {
  const player = bearer(request);
  const realm = realmOf(player);
  const clientRunId = String(body.clientRunId || '').trim();
  if (!player || !clientRunId || clientRunId.length > 80) {
    return json(response, 401, { ok: false, reason: 'invalid-session' });
  }
  const runId = randomUUID();
  const startedAt = Date.now();
  await db.doc(`${collectionName('runs', realm)}/${runId}`).set({
    runId, playerId: player.playerId, clientRunId, startedAt, status: 'started',
    expiresAt: Timestamp.fromMillis(startedAt + 8 * 7 * 24 * 60 * 60 * 1000),
  });
  const ticket = createRunTicket({ runId, playerId: player.playerId, clientRunId, realm }, env('OING_RUN_TICKET_SECRET'));
  return json(response, 200, { ok: true, ticket, startedAt });
}

async function finishRun(response, body) {
  const claims = verifyRunTicket(body.ticket, env('OING_RUN_TICKET_SECRET'));
  if (!claims) return json(response, 401, { ok: false, reason: 'invalid-run-ticket' });
  const realm = realmOf(claims);
  const successTimesMs = Array.isArray(body.successTimesMs) ? body.successTimesMs.slice(0, 1000) : [];
  const successCount = Math.max(0, Math.round(Number(body.successCount) || successTimesMs.length));
  const result = classifyRun({ score: body.score, durationMs: body.durationMs, successTimesMs, successCount });
  const runRef = db.doc(`${collectionName('runs', realm)}/${claims.runId}`);
  const playerRef = db.doc(`${collectionName('players', realm)}/${claims.playerId}`);
  let output;
  await db.runTransaction(async (transaction) => {
    const weeklyKey = weekKey();
    const weeklyRef = db.doc(`${collectionName('weekly_scores', realm)}/${weeklyKey}/players/${claims.playerId}`);
    const allCacheRef = db.doc(`${collectionName('ranking_cache', realm)}/all-all`);
    const weeklyCacheRef = db.doc(`${collectionName('ranking_cache', realm)}/weekly-${weeklyKey}`);
    const [runSnap, playerSnap, weeklySnap, allCacheSnap, weeklyCacheSnap] = await Promise.all([
      transaction.get(runRef),
      transaction.get(playerRef),
      transaction.get(weeklyRef),
      transaction.get(allCacheRef),
      transaction.get(weeklyCacheRef),
    ]);
    const run = runSnap.data();
    if (!run || run.playerId !== claims.playerId) throw new Error('invalid-run-ticket');
    if (run.status !== 'started') {
      output = { ...run.result, duplicate: true };
      return;
    }
    const player = playerSnap.data() || {};
    const accepted = result.status === 'accepted';
    const jellyEarned = accepted ? Math.min(10, Math.max(0, Math.floor(result.score / 2000))) : 0;
    const nextJelly = Number(player.jelly || 0) + jellyEarned;
    const finishedAt = new Date().toISOString();
    const priorAll = Number(player.bestScore || 0);
    const priorWeekly = Number(weeklySnap.data()?.score || 0);
    const bestScore = accepted ? Math.max(priorAll, result.score) : priorAll;
    const candidate = {
      playerId: claims.playerId,
      nickname: player.nickname,
      score: result.score,
      achievedAt: finishedAt,
      activeAt: finishedAt,
    };
    const ranking = accepted ? {
      weekly: rankOutcome(weeklyCacheSnap, candidate, priorWeekly),
      all: rankOutcome(allCacheSnap, candidate, priorAll),
    } : null;
    output = { status: result.status, bestScore, jelly: nextJelly, jellyEarned, nickname: player.nickname, ranking, duplicate: false };
    transaction.update(runRef, {
      status: result.status, score: result.score, durationMs: result.durationMs,
      scoreRulesVersion: body.scoreRulesVersion === 2 ? 2 : 1,
      successCount, reasons: result.reasons, finishedAt, result: output,
    });
    if (!accepted) return;
    transaction.set(playerRef, {
      bestScore, jelly: nextJelly, lastPlayedAt: finishedAt, updatedAt: FieldValue.serverTimestamp(),
      ...(result.score > priorAll ? {
        bestAchievedAt: finishedAt,
        bestScoreRulesVersion: body.scoreRulesVersion === 2 ? 2 : 1,
      } : {}),
    }, { merge: true });
    refreshTopCache(transaction, allCacheSnap, 'all', 'all', {
      ...candidate,
      score: bestScore,
      achievedAt: result.score > priorAll
        ? finishedAt
        : (player.bestAchievedAt || candidate.achievedAt),
    }, realm);
    if (result.score > priorWeekly) {
      const weeklyCandidate = {
        ...candidate,
        rankDelta: ranking.weekly.rankDelta,
        isNew: ranking.weekly.isNew,
      };
      transaction.set(weeklyRef, weeklyCandidate);
      refreshTopCache(transaction, weeklyCacheSnap, 'weekly', weeklyKey, weeklyCandidate, realm);
    }
  });
  if (!output) return json(response, 503, { ok: false, reason: 'service-unavailable' });
  return json(response, 200, { ok: true, ...output });
}

async function friendIdsFor(playerId, realm = 'live') {
  if (!playerId) return new Set();
  const snap = await db.collection(`${collectionName('players', realm)}/${playerId}/friends`).get();
  return new Set(snap.docs.map((doc) => doc.id));
}

async function leaderboard(request, response) {
  const player = bearer(request);
  const realm = realmOf(player);
  const mode = ['all', 'friends'].includes(String(request.query.mode)) ? String(request.query.mode) : 'weekly';
  const friends = await friendIdsFor(player?.playerId, realm);
  if (mode === 'all' || mode === 'friends') {
    const cache = await db.doc(`${collectionName('ranking_cache', realm)}/all-all`).get();
    const players = db.collection(collectionName('players', realm));
    const result = await lifetimeLeaderboard({
      mode, playerId: player?.playerId, friendIds: friends,
      cachedRows: cache.data()?.rows || [], limit: TOP_LIMIT,
      loadPlayers: async (ids) => {
        const loaded = [];
        for (let offset = 0; offset < ids.length; offset += 100) {
          const refs = ids.slice(offset, offset + 100).map((id) => players.doc(id));
          const snaps = await db.getAll(...refs);
          loaded.push(...snaps.filter((snap) => snap.exists).map((snap) => ({ ...snap.data(), playerId: snap.id })));
        }
        return loaded;
      },
      countHigher: async (score) => (await players.where('bestScore', '>', score).count().get()).data().count,
      loadTies: async (score) => (await players.where('bestScore', '==', score).get()).docs
        .map((snap) => ({ ...snap.data(), playerId: snap.id })),
      loadNextHigher: async (score) => {
        const snap = await players.where('bestScore', '>', score).orderBy('bestScore', 'asc').limit(1).get();
        return snap.empty ? null : { score: snap.docs[0].data().bestScore };
      },
    });
    result.rows = result.rows.map((row) => ({
      ...row,
      hot: (row.activeAt || row.achievedAt)
        ? Date.now() - new Date(row.activeAt || row.achievedAt).getTime() < 86400000
        : false,
    }));
    return json(response, 200, result);
  }
  let rows;
  {
    const cacheMode = mode === 'all' ? 'all-all' : `weekly-${weekKey()}`;
    const snap = await db.doc(`${collectionName('ranking_cache', realm)}/${cacheMode}`).get();
    rows = Array.isArray(snap.data()?.rows) ? snap.data().rows : [];
  }
  rows = sortTop(rows).map((row, index) => publicRow(row, index + 1, player?.playerId, friends));
  const me = rows.find((row) => row.isMe) || null;
  return json(response, 200, { ok: true, mode, rows, me });
}

async function setFriend(request, response, body) {
  const player = bearer(request);
  const realm = realmOf(player);
  const friendPlayerId = String(body.playerId || '').trim();
  if (!player || !/^[0-9a-f]{32}$/.test(friendPlayerId) || friendPlayerId === player.playerId) {
    return json(response, 400, { ok: false, reason: 'invalid-friend' });
  }
  const target = await db.doc(`${collectionName('players', realm)}/${friendPlayerId}`).get();
  if (!target.exists) return json(response, 404, { ok: false, reason: 'player-not-found' });
  const ref = db.doc(`${collectionName('players', realm)}/${player.playerId}/friends/${friendPlayerId}`);
  if (body.saved === false) await ref.delete();
  else await ref.set({ playerId: friendPlayerId, savedAt: FieldValue.serverTimestamp() });
  return json(response, 200, { ok: true, friendship: { friendPlayerId, saved: body.saved !== false } });
}

async function setNickname(request, response, body) {
  const auth = bearer(request);
  const realm = realmOf(auth);
  const nickname = String(body.nickname || '').trim();
  if (!auth) return json(response, 401, { ok: false, reason: 'invalid-session' });
  const invalid = nicknameReason(nickname);
  if (invalid) return json(response, 400, { ok: false, reason: invalid });
  const playerRef = db.doc(`${collectionName('players', realm)}/${auth.playerId}`);
  let output;
  await db.runTransaction(async (transaction) => {
    const weeklyKey = weekKey();
    const weeklyRef = db.doc(`${collectionName('weekly_scores', realm)}/${weeklyKey}/players/${auth.playerId}`);
    const allCacheRef = db.doc(`${collectionName('ranking_cache', realm)}/all-all`);
    const weeklyCacheRef = db.doc(`${collectionName('ranking_cache', realm)}/weekly-${weeklyKey}`);
    const [playerSnap, weeklySnap, allCacheSnap, weeklyCacheSnap] = await Promise.all([
      transaction.get(playerRef),
      transaction.get(weeklyRef),
      transaction.get(allCacheRef),
      transaction.get(weeklyCacheRef),
    ]);
    if (!playerSnap.exists) throw new Error('invalid-session');
    const player = playerSnap.data();
    const now = Date.now();
    const availableAt = nicknameChangeAvailableAtMs(player);
    const sameNickname = player.nickname === nickname && player.nicknameCustomized === true;
    if (!sameNickname && player.nicknameCustomized === true && Number.isFinite(availableAt) && availableAt > now) {
      output = { blocked: true, nicknameChangeAvailableAt: new Date(availableAt).toISOString() };
      return;
    }

    // A deterministic claim document makes simultaneous saves atomic. The
    // exact-name query also protects names created before this claim table was
    // introduced, so deploying the feature never opens a duplicate window for
    // existing players.
    const key = nicknameClaimKey(nickname);
    const oldKey = player.nicknameCustomized === true ? nicknameClaimKey(player.nickname) : '';
    const claims = db.collection(collectionName('nickname_claims', realm));
    const claimRef = claims.doc(encodeURIComponent(key));
    const oldClaimRef = oldKey && oldKey !== key ? claims.doc(encodeURIComponent(oldKey)) : null;
    const exactNicknameQuery = db.collection(collectionName('players', realm))
      .where('nickname', '==', nickname)
      .limit(2);
    const [claimSnap, oldClaimSnap, exactNicknameSnap] = await Promise.all([
      transaction.get(claimRef),
      oldClaimRef ? transaction.get(oldClaimRef) : Promise.resolve(null),
      transaction.get(exactNicknameQuery),
    ]);
    const claimedByAnother = claimSnap.exists && claimSnap.data()?.playerId !== auth.playerId;
    const usedByAnother = exactNicknameSnap.docs.some((snap) => snap.id !== auth.playerId);
    if (claimedByAnother || usedByAnother) {
      output = { taken: true };
      return;
    }

    if (sameNickname) {
      transaction.set(claimRef, {
        playerId: auth.playerId,
        nickname,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      output = {
        nickname,
        nicknameCustomized: true,
        nicknameChangeAvailableAt: availableAt ? new Date(availableAt).toISOString() : null,
      };
      return;
    }
    const nextChange = Timestamp.fromMillis(now + NICKNAME_CHANGE_MS);
    transaction.set(claimRef, {
      playerId: auth.playerId,
      nickname,
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (oldClaimRef && oldClaimSnap?.exists && oldClaimSnap.data()?.playerId === auth.playerId) {
      transaction.delete(oldClaimRef);
    }
    transaction.set(playerRef, {
      nickname,
      nicknameKey: key,
      nicknameCustomized: true,
      nicknameChangedAt: FieldValue.serverTimestamp(),
      nicknameChangeAvailableAt: nextChange,
    }, { merge: true });
    if (weeklySnap.exists) transaction.set(weeklyRef, { nickname }, { merge: true });
    renameCachedRows(transaction, allCacheSnap, allCacheRef, auth.playerId, nickname);
    renameCachedRows(transaction, weeklyCacheSnap, weeklyCacheRef, auth.playerId, nickname);
    output = {
      nickname,
      nicknameCustomized: true,
      nicknameChangeAvailableAt: nextChange.toDate().toISOString(),
    };
  });
  if (output?.blocked) return json(response, 429, { ok: false, reason: 'nickname-cooldown', ...output });
  if (output?.taken) return json(response, 409, { ok: false, reason: 'nickname-taken' });
  return json(response, 200, { ok: true, player: output });
}

export const oingApi = onRequest({
  region: REGION,
  cors: true,
  timeoutSeconds: 15,
  memory: '256MiB',
  minInstances: 0,
  secrets: functionSecrets,
}, async (request, response) => {
  try {
    const body = await bodyOf(request);
    const action = String(body.action || request.query.action || 'leaderboard');
    if (request.method === 'GET' && action === 'leaderboard') return leaderboard(request, response);
    if (request.method !== 'POST') return json(response, 405, { ok: false, reason: 'method-not-allowed' });
    if (action === 'bootstrap') return bootstrap(request, response, body);
    if (action === 'start-run') return startRun(request, response, body);
    if (action === 'finish-run') return finishRun(response, body);
    if (action === 'friend') return setFriend(request, response, body);
    if (action === 'nickname') return setNickname(request, response, body);
    return json(response, 404, { ok: false, reason: 'unknown-action' });
  } catch (error) {
    console.error('[oing-firebase-api]', error);
    const reason = error?.message === 'invalid-run-ticket' ? 'invalid-run-ticket' : 'service-unavailable';
    return json(response, reason === 'invalid-run-ticket' ? 401 : 503, { ok: false, reason });
  }
});
