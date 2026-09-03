import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_VERSION = 1;
const DEFAULT_TTL_SECONDS = 30 * 60;

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decode(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function signatureFor(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeSignatureMatch(actual, expected) {
  const left = Buffer.from(String(actual));
  const right = Buffer.from(String(expected));
  return left.length === right.length && timingSafeEqual(left, right);
}

export function providerIdentityKey(provider, providerUserId, secret) {
  if (!secret) throw new Error('OING_IDENTITY_SECRET is required');
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  const normalizedUserId = String(providerUserId || '').trim();
  if (!normalizedProvider || !normalizedUserId) throw new Error('invalid provider identity');
  return createHmac('sha256', secret)
    .update(`${normalizedProvider}\0${normalizedUserId}`)
    .digest('hex');
}

export function createRunTicket(claims, secret) {
  if (!secret) throw new Error('OING_RUN_TICKET_SECRET is required');
  const now = Math.floor(Date.now() / 1000);
  const payload = encode({
    v: TOKEN_VERSION,
    iat: now,
    exp: now + DEFAULT_TTL_SECONDS,
    ...claims,
  });
  return `${payload}.${signatureFor(payload, secret)}`;
}

export function createPlayerToken({ playerId }, secret) {
  if (!secret) throw new Error('OING_RUN_TICKET_SECRET is required');
  const now = Math.floor(Date.now() / 1000);
  const payload = encode({
    v: TOKEN_VERSION,
    kind: 'player',
    iat: now,
    exp: now + 24 * 60 * 60,
    playerId,
  });
  return `${payload}.${signatureFor(payload, secret)}`;
}

export function verifyPlayerToken(token, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!secret || typeof token !== 'string') return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;
  if (!safeSignatureMatch(signature, signatureFor(payload, secret))) return null;
  try {
    const claims = decode(payload);
    if (claims.v !== TOKEN_VERSION || claims.kind !== 'player') return null;
    if (claims.exp < nowSeconds || claims.iat > nowSeconds + 30 || !claims.playerId) return null;
    return claims;
  } catch {
    return null;
  }
}

export function verifyRunTicket(ticket, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!secret || typeof ticket !== 'string') return null;
  const [payload, signature, extra] = ticket.split('.');
  if (!payload || !signature || extra) return null;
  if (!safeSignatureMatch(signature, signatureFor(payload, secret))) return null;
  try {
    const claims = decode(payload);
    if (claims.v !== TOKEN_VERSION || claims.exp < nowSeconds || claims.iat > nowSeconds + 30) return null;
    if (!claims.runId || !claims.playerId || !claims.clientRunId) return null;
    return claims;
  } catch {
    return null;
  }
}

export function countBurstWindows(successTimesMs, windowMs = 3000, threshold = 12) {
  const times = Array.isArray(successTimesMs)
    ? successTimesMs.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
    : [];
  let left = 0;
  let maxCount = 0;
  for (let right = 0; right < times.length; right += 1) {
    while (times[right] - times[left] > windowMs) left += 1;
    maxCount = Math.max(maxCount, right - left + 1);
  }
  return { maxCount, suspicious: maxCount > threshold };
}

export function classifyRun({ score, durationMs, successTimesMs, successCount }) {
  const numericScore = Math.max(0, Math.round(Number(score) || 0));
  const numericDuration = Math.max(0, Math.round(Number(durationMs) || 0));
  const burst = countBurstWindows(successTimesMs);
  const timeline = Array.isArray(successTimesMs)
    ? successTimesMs.map(Number).filter(Number.isFinite)
    : [];
  const numericSuccessCount = Math.max(0, Math.round(Number(successCount) || 0));
  const reasons = [];
  if (numericScore > 150000) reasons.push('score-over-review-threshold');
  if (numericDuration < 15000 || numericDuration > 15 * 60 * 1000) reasons.push('duration-out-of-range');
  if (timeline.length !== numericSuccessCount || timeline.some((time) => time < 0 || time > numericDuration)) {
    reasons.push('success-ledger-mismatch');
  }
  if (burst.suspicious) reasons.push('success-burst');
  return {
    status: reasons.length ? 'pending' : 'accepted',
    reasons,
    score: numericScore,
    durationMs: numericDuration,
    maxBurstCount: burst.maxCount,
  };
}
