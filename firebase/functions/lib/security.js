import { createHmac, timingSafeEqual } from 'node:crypto';

const VERSION = 1;

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signatureFor(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function verifySigned(value, secret) {
  if (!secret || typeof value !== 'string') return null;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra) return null;
  const expected = signatureFor(payload, secret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return null; }
}

export function providerIdentityKey(provider, providerUserId, secret) {
  if (!secret) throw new Error('OING_IDENTITY_SECRET is required');
  return createHmac('sha256', secret)
    .update(`${String(provider).trim().toLowerCase()}\0${String(providerUserId).trim()}`)
    .digest('hex');
}

function createTicket(claims, secret, ttlSeconds) {
  if (!secret) throw new Error('OING_RUN_TICKET_SECRET is required');
  const now = Math.floor(Date.now() / 1000);
  const payload = encode({ v: VERSION, iat: now, exp: now + ttlSeconds, ...claims });
  return `${payload}.${signatureFor(payload, secret)}`;
}

export function createPlayerToken({ playerId, realm = 'live' }, secret) {
  return createTicket({ kind: 'player', playerId, realm }, secret, 24 * 60 * 60);
}

export function createRunTicket(claims, secret) {
  return createTicket(claims, secret, 30 * 60);
}

export function verifyPlayerToken(token, secret, now = Math.floor(Date.now() / 1000)) {
  const value = verifySigned(token, secret);
  return value?.v === VERSION && value.kind === 'player' && value.playerId
    && value.iat <= now + 30 && value.exp >= now ? value : null;
}

export function verifyRunTicket(ticket, secret, now = Math.floor(Date.now() / 1000)) {
  const value = verifySigned(ticket, secret);
  return value?.v === VERSION && value.runId && value.playerId && value.clientRunId
    && value.iat <= now + 30 && value.exp >= now ? value : null;
}

export function classifyRun({ score, durationMs, successTimesMs, successCount }) {
  const numericScore = Math.max(0, Math.round(Number(score) || 0));
  const numericDuration = Math.max(0, Math.round(Number(durationMs) || 0));
  const timeline = Array.isArray(successTimesMs)
    ? successTimesMs.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
    : [];
  let left = 0;
  let maxBurstCount = 0;
  for (let right = 0; right < timeline.length; right += 1) {
    while (timeline[right] - timeline[left] > 3000) left += 1;
    maxBurstCount = Math.max(maxBurstCount, right - left + 1);
  }
  const reasons = [];
  if (numericScore > 150000) reasons.push('score-over-review-threshold');
  if (numericDuration < 15000 || numericDuration > 15 * 60 * 1000) reasons.push('duration-out-of-range');
  if (timeline.length !== successCount || timeline.some((time) => time < 0 || time > numericDuration)) {
    reasons.push('success-ledger-mismatch');
  }
  if (maxBurstCount > 12) reasons.push('success-burst');
  return { status: reasons.length ? 'pending' : 'accepted', reasons, score: numericScore, durationMs: numericDuration };
}
