import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { storageAdapter } from '../js/adapters.js';
import { nicknameRegistrationCopy } from '../js/oing-online.js';

test('new score rules start fresh while legacy records and collection progress remain intact', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map([
    ['oing_toss_v3_classic_best_score', '20000'],
    ['oing_toss_v3_classic_recent_scores', '[19000,20000]'],
    ['oing_toss_v3_classic_best_combo', '120'],
    ['oing_toss_v3_candy', '17'],
    ['oing_toss_v3_classic_chapters_seen', '["garden","forest"]'],
  ]);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
  } });
  try {
    assert.equal(storageAdapter.getClassicBestScore(), 0);
    assert.equal(storageAdapter.getClassicBestCombo(), 0);
    assert.deepEqual(storageAdapter.getClassicRecentScores(), []);
    assert.equal(storageAdapter.getLegacyClassicBestScore(), 20000);
    assert.equal(storageAdapter.getCollectionBestScore(), 20000);
    storageAdapter.saveClassicBestScore(1400);
    storageAdapter.saveClassicRunScore(1400);
    storageAdapter.saveClassicBestCombo(22);
    assert.equal(storageAdapter.getClassicBestScore(), 1400);
    assert.deepEqual(storageAdapter.getClassicRecentScores(), [1400]);
    assert.equal(storageAdapter.getClassicBestCombo(), 22);
    assert.equal(storageAdapter.getLegacyClassicBestScore(), 20000);
    assert.equal(data.get('oing_toss_v3_classic_recent_scores'), '[19000,20000]');
    assert.equal(storageAdapter.getCandy(), 17);
    assert.deepEqual(storageAdapter.getSeenChapters(), ['garden', 'forest']);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});

test('nickname guidance only confirms a record when it has actually been accepted', () => {
  assert.match(nicknameRegistrationCopy({}), /게임을 마치면/);
  assert.doesNotMatch(nicknameRegistrationCopy({}), /저장됐/);
  assert.match(nicknameRegistrationCopy({ status: 'saving' }), /등록 중/);
  assert.match(nicknameRegistrationCopy({ status: 'failed', bestScore: 5000 }), /완료하지 못했/);
  assert.match(nicknameRegistrationCopy({ status: 'pending' }), /확인 중/);
  assert.match(nicknameRegistrationCopy({ status: 'accepted' }), /저장됐/);
  assert.match(nicknameRegistrationCopy({ bestScore: 1000 }), /저장됐/);
});

test('only a genuinely new player gets the small-board tutorial once', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
  } });
  try {
    assert.equal(storageAdapter.hasCompletedClassicIntro(), false);
    storageAdapter.markClassicIntroCompleted();
    assert.equal(storageAdapter.hasCompletedClassicIntro(), true);

    data.clear();
    data.set('oing_toss_v3_classic_best_score', '20000');
    assert.equal(storageAdapter.hasCompletedClassicIntro(), true);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});

test('the update NEW badge is remembered per release version', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
  } });
  try {
    assert.equal(storageAdapter.hasSeenUpdateNotice('2026.09.07'), false);
    storageAdapter.markUpdateNoticeSeen('2026.09.07');
    assert.equal(storageAdapter.hasSeenUpdateNotice('2026.09.07'), true);
    assert.equal(storageAdapter.hasSeenUpdateNotice('2026.09.08'), false);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});

test('the current update notice and ranking victory copy ship in the game', async () => {
  const [index, game] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../js/game.js', import.meta.url), 'utf8'),
  ]);
  assert.match(index, /폭탄 효과/);
  assert.match(index, /쉬운 답을 모두 찾으면/);
  assert.match(index, /내 기록과 가까운 목표/);
  assert.match(index, /나만의 랭킹 별명/);
  assert.match(game, /UPDATE_NOTICE_VERSION = '2026\.09\.08'/);
  assert.match(game, /\$\{all\.beatenNickname\}님을 이겼다냥!/);
});
