import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { automaticNickname, isLegacyAutomaticNickname } from '../lib/nickname.js';

const PROJECT_ID = 'new-oing-toss';
const APPLY = process.argv.includes('--apply');
const require = createRequire(import.meta.url);
const firebaseAuth = require('../../../node_modules/firebase-tools/lib/auth.js');
const account = firebaseAuth.getGlobalDefaultAccount();

if (!account?.tokens?.refresh_token) {
  throw new Error('Firebase CLI login is required before running this migration.');
}

const token = await firebaseAuth.getAccessToken(account.tokens.refresh_token, [
  'email',
  'openid',
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/cloudplatformprojects.readonly',
  'https://www.googleapis.com/auth/firebase',
]);
const databaseRoot = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function request(path, options = {}) {
  const response = await fetch(`${databaseRoot}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token.access_token}`,
      'content-type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
  }
  return response.status === 204 ? null : response.json();
}

function decodeValue(value = {}) {
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
  return undefined;
}

function decodeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

function encodeValue(value) {
  if (value === null) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'object') return { mapValue: { fields: encodeFields(value) } };
  throw new Error(`Unsupported Firestore value: ${typeof value}`);
}

function encodeFields(value) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeValue(item)]));
}

async function listCollection(collectionId) {
  const documents = [];
  let pageToken = '';
  do {
    const query = new URLSearchParams({ pageSize: '300' });
    if (pageToken) query.set('pageToken', pageToken);
    const result = await request(`/${collectionId}?${query}`);
    documents.push(...(result.documents || []));
    pageToken = result.nextPageToken || '';
  } while (pageToken);
  return documents;
}

async function listAllPlayerDocuments() {
  const result = await request(':runQuery', {
    method: 'POST',
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'players', allDescendants: true }],
      },
    }),
  });
  return result.flatMap((entry) => entry.document ? [entry.document] : []);
}

async function patchField(documentName, fieldName, value) {
  const encodedName = documentName.split('/documents/')[1].split('/').map(encodeURIComponent).join('/');
  const query = new URLSearchParams({ 'updateMask.fieldPaths': fieldName });
  await request(`/${encodedName}?${query}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: { [fieldName]: encodeValue(value) } }),
  });
}

const rootPlayerDocs = await listCollection('players');
const targets = new Map();

for (const document of rootPlayerDocs) {
  const player = decodeFields(document.fields);
  const playerId = document.name.split('/').at(-1);
  if (player.nicknameCustomized === true || !isLegacyAutomaticNickname(player.nickname)) continue;
  targets.set(playerId, {
    playerId,
    before: player.nickname,
    after: automaticNickname(playerId),
    documentName: document.name,
  });
}

const allPlayerDocs = await listAllPlayerDocuments();
const weeklyTargets = allPlayerDocs.filter((document) => {
  if (!document.name.includes('/documents/weekly_scores/')) return false;
  return targets.has(document.name.split('/').at(-1));
});

const cacheDocs = await listCollection('ranking_cache');
const cacheTargets = [];
for (const document of cacheDocs) {
  const cache = decodeFields(document.fields);
  if (!Array.isArray(cache.rows)) continue;
  let changed = false;
  const rows = cache.rows.map((row) => {
    const target = targets.get(String(row.playerId || ''));
    if (!target || row.nickname === target.after) return row;
    changed = true;
    return { ...row, nickname: target.after };
  });
  if (changed) cacheTargets.push({ documentName: document.name, rows, before: cache.rows });
}

console.log(JSON.stringify({
  mode: APPLY ? 'apply' : 'dry-run',
  playersScanned: rootPlayerDocs.length,
  playerTargets: [...targets.values()].map(({ playerId, before, after }) => ({ playerId, before, after })),
  weeklyDocuments: weeklyTargets.length,
  rankingCaches: cacheTargets.length,
  preservedOingi: rootPlayerDocs.filter((document) => decodeFields(document.fields).nickname === '오잉이').length,
}, null, 2));

if (!APPLY || targets.size === 0) process.exit(0);

const backupPath = `/private/tmp/oing-legacy-nickname-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
await writeFile(backupPath, JSON.stringify({
  createdAt: new Date().toISOString(),
  players: [...targets.values()],
  weekly: weeklyTargets.map((document) => ({ name: document.name, fields: document.fields })),
  caches: cacheTargets.map(({ documentName, before }) => ({ documentName, rows: before })),
}, null, 2), { mode: 0o600 });

for (const target of targets.values()) {
  await patchField(target.documentName, 'nickname', target.after);
}
for (const document of weeklyTargets) {
  const playerId = document.name.split('/').at(-1);
  await patchField(document.name, 'nickname', targets.get(playerId).after);
}
for (const cache of cacheTargets) {
  await patchField(cache.documentName, 'rows', cache.rows);
}

const verifiedPlayers = await listCollection('players');
const remaining = verifiedPlayers
  .map((document) => decodeFields(document.fields))
  .filter((player) => player.nicknameCustomized !== true && isLegacyAutomaticNickname(player.nickname));

if (remaining.length > 0) {
  throw new Error(`Verification failed: ${remaining.length} legacy automatic nickname(s) remain.`);
}

console.log(JSON.stringify({
  applied: true,
  changedPlayers: targets.size,
  changedWeeklyDocuments: weeklyTargets.length,
  changedRankingCaches: cacheTargets.length,
  preservedOingi: verifiedPlayers.filter((document) => decodeFields(document.fields).nickname === '오잉이').length,
  remainingLegacyAutomaticNicknames: remaining.length,
  backupPath,
}, null, 2));
