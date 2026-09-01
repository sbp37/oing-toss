import {
  createPlayerToken,
  createRunTicket,
  classifyRun,
  providerIdentityKey,
  verifyPlayerToken,
  verifyRunTicket,
} from '../../server/oing/security.js';
import { verifyTossIdentity } from '../../server/oing/toss-identity.js';
import {
  bootstrapPlayer,
  equipCosmetic,
  finishRun,
  getCatalog,
  getProfile,
  leaderboard,
  purchaseCosmetic,
  setFriend,
  startRun,
} from '../../server/oing/repository.js';

function json(response, status, payload) {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.end(JSON.stringify(payload));
}

function authorize(request) {
  const value = String(request.headers.authorization || '');
  const token = value.startsWith('Bearer ') ? value.slice(7) : '';
  return verifyPlayerToken(token, process.env.OING_RUN_TICKET_SECRET);
}

async function readBody(request) {
  if (request.body && typeof request.body === 'object') return request.body;
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 128000) throw new Error('request too large');
  }
  return raw ? JSON.parse(raw) : {};
}

async function identityIsValid(provider, credential) {
  if (process.env.OING_ALLOW_TEST_IDENTITY === 'true' && String(credential).startsWith('test_')) return true;
  if (provider === 'toss') return verifyTossIdentity(credential);
  return false;
}

function publicRankRow(row, playerId) {
  return {
    playerId: row.player_id,
    rank: Number(row.rank),
    nickname: row.nickname,
    score: Number(row.score),
    achievedAt: row.achieved_at,
    isMe: Boolean(playerId && row.player_id === playerId),
    isFriend: Boolean(row.is_friend),
    level: Number(row.level) || 1,
    hot: Boolean(row.hot),
    rankDelta: row.rank_delta === null || row.rank_delta === undefined ? null : Number(row.rank_delta),
    isNew: Boolean(row.is_new),
    previousRank: row.previous_rank === null || row.previous_rank === undefined ? null : Number(row.previous_rank),
    scoreToNext: row.score_to_next === null || row.score_to_next === undefined ? null : Number(row.score_to_next),
  };
}

async function handleBootstrap(body, response) {
  const provider = String(body.provider || '').trim();
  const credential = String(body.credential || '').trim();
  if (!['toss'].includes(provider) || !credential || credential.length > 512) {
    return json(response, 400, { ok: false, reason: 'invalid-identity' });
  }
  if (!await identityIsValid(provider, credential)) {
    return json(response, 401, { ok: false, reason: 'identity-not-verified' });
  }
  const providerUserKey = providerIdentityKey(provider, credential, process.env.OING_IDENTITY_SECRET);
  const fallbackNickname = `OING${providerUserKey.slice(0, 10).toUpperCase()}`;
  const player = await bootstrapPlayer({ provider, providerUserKey, fallbackNickname });
  if (!player) return json(response, 503, { ok: false, reason: 'player-unavailable' });
  const token = createPlayerToken(
    { playerId: player.player_id },
    process.env.OING_RUN_TICKET_SECRET,
  );
  return json(response, 200, {
    ok: true,
    token,
    player: {
      nickname: player.nickname,
      jelly: Number(player.jelly_balance),
    },
  });
}

async function handleStartRun(request, body, response) {
  const player = authorize(request);
  const clientRunId = String(body.clientRunId || '').trim();
  if (!player || !clientRunId || clientRunId.length > 80) {
    return json(response, 401, { ok: false, reason: 'invalid-session' });
  }
  const run = await startRun({ playerId: player.playerId, clientRunId });
  const ticket = createRunTicket({
    runId: run.id,
    playerId: run.player_id,
    clientRunId: run.client_run_id,
  }, process.env.OING_RUN_TICKET_SECRET);
  return json(response, 200, { ok: true, ticket, startedAt: run.started_at });
}

async function handleFinishRun(body, response) {
  const claims = verifyRunTicket(body.ticket, process.env.OING_RUN_TICKET_SECRET);
  if (!claims) return json(response, 401, { ok: false, reason: 'invalid-run-ticket' });
  const successTimesMs = Array.isArray(body.successTimesMs) ? body.successTimesMs.slice(0, 1000) : [];
  const requestedSuccessCount = Number(body.successCount);
  const successCount = Number.isFinite(requestedSuccessCount)
    ? Math.max(0, Math.round(requestedSuccessCount))
    : successTimesMs.length;
  const classification = classifyRun({
    score: body.score,
    durationMs: body.durationMs,
    successTimesMs,
    successCount,
  });
  const result = await finishRun({
    runId: claims.runId,
    playerId: claims.playerId,
    score: classification.score,
    durationMs: classification.durationMs,
    successCount,
    status: classification.status,
    reasons: classification.reasons,
    stats: {
      boards: Math.max(0, Math.round(Number(body.boards) || 0)),
      maxCombo: Math.max(0, Math.round(Number(body.maxCombo) || 0)),
      maxBurstCount: classification.maxBurstCount,
    },
  });
  return json(response, 200, {
    ok: true,
    status: result.run_status,
    bestScore: Number(result.best_score),
    jelly: Number(result.jelly_balance),
    jellyEarned: Number(result.jelly_earned),
    duplicate: Boolean(result.duplicate),
  });
}

async function handleLeaderboard(request, response) {
  const player = authorize(request);
  const url = new URL(request.url, 'https://oing.invalid');
  const requestedMode = url.searchParams.get('mode');
  const mode = requestedMode === 'all' || requestedMode === 'friends' ? requestedMode : 'weekly';
  const result = await leaderboard({ mode, limit: 100, playerId: player?.playerId || null });
  return json(response, 200, {
    ok: true,
    mode,
    rows: result.rows.map((row) => publicRankRow(row, player?.playerId)),
    me: result.me ? publicRankRow(result.me, player?.playerId) : null,
  });
}

async function handlePrivateAction(request, action, body, response) {
  const player = authorize(request);
  if (!player) return json(response, 401, { ok: false, reason: 'invalid-session' });
  if (action === 'profile') {
    const profile = await getProfile(player.playerId);
    return json(response, 200, { ok: true, profile });
  }
  if (action === 'catalog') {
    const items = await getCatalog(player.playerId);
    return json(response, 200, { ok: true, items });
  }
  if (action === 'purchase') {
    const itemKey = String(body.itemKey || '').trim();
    if (!itemKey) return json(response, 400, { ok: false, reason: 'invalid-purchase' });
    const purchase = await purchaseCosmetic({ playerId: player.playerId, itemKey });
    return json(response, 200, { ok: true, purchase });
  }
  if (action === 'equip') {
    const equipped = await equipCosmetic({ playerId: player.playerId, itemKey: String(body.itemKey || '') });
    return equipped
      ? json(response, 200, { ok: true, equipped })
      : json(response, 400, { ok: false, reason: 'item-not-owned' });
  }
  if (action === 'friend') {
    const friendPlayerId = String(body.playerId || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(friendPlayerId)) {
      return json(response, 400, { ok: false, reason: 'invalid-friend' });
    }
    const friendship = await setFriend({
      playerId: player.playerId,
      friendPlayerId,
      saved: body.saved !== false,
    });
    return friendship
      ? json(response, 200, { ok: true, friendship })
      : json(response, 404, { ok: false, reason: 'player-not-found' });
  }
  return json(response, 404, { ok: false, reason: 'unknown-action' });
}

export default async function handler(request, response) {
  response.setHeader('access-control-allow-origin', '*');
  response.setHeader('access-control-allow-headers', 'authorization, content-type');
  response.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  if (request.method === 'OPTIONS') return json(response, 200, { ok: true });

  try {
    const url = new URL(request.url, 'https://oing.invalid');
    const body = request.method === 'POST' ? await readBody(request) : {};
    const action = String(body.action || url.searchParams.get('action') || 'leaderboard');
    if (request.method === 'GET' && action === 'leaderboard') return handleLeaderboard(request, response);
    if (request.method !== 'POST' && !['profile', 'catalog'].includes(action)) {
      return json(response, 405, { ok: false, reason: 'method-not-allowed' });
    }
    if (action === 'bootstrap') return handleBootstrap(body, response);
    if (action === 'start-run') return handleStartRun(request, body, response);
    if (action === 'finish-run') return handleFinishRun(body, response);
    return handlePrivateAction(request, action, body, response);
  } catch (error) {
    console.error('[oing-api]', error);
    return json(response, 503, { ok: false, reason: 'service-unavailable' });
  }
}
