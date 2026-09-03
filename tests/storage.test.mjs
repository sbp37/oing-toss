import assert from 'node:assert/strict';
import test from 'node:test';
import { storageAdapter } from '../js/adapters.js';
import { GARDEN_MILESTONES, gardenProgress } from '../js/data.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test('stage and combo progression only move forward while legacy score keys stay compatible', () => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = new MemoryStorage();
  try {
    assert.equal(storageAdapter.getHighestStage(), 1);
    assert.equal(storageAdapter.saveHighestStage(4), 4);
    assert.equal(storageAdapter.saveHighestStage(2), 4);
    assert.equal(storageAdapter.getHighestStage(), 4);
    assert.equal(storageAdapter.saveBestCombo(7), 7);
    assert.equal(storageAdapter.saveBestCombo(3), 7);
    storageAdapter.saveBestScore(12580);
    assert.equal(storageAdapter.getBestScore(), 12580);
    assert.equal(storageAdapter.hasSeenDragTutorial(), false);
    storageAdapter.markDragTutorialSeen();
    assert.equal(storageAdapter.hasSeenDragTutorial(), true);
    assert.equal(storageAdapter.getRareShowcaseCount(), 0);
    assert.equal(storageAdapter.markRareShowcaseSeen(), 1);
    assert.equal(storageAdapter.markRareShowcaseSeen(), 2);
    assert.equal(storageAdapter.markRareShowcaseSeen(), 3);
    assert.equal(storageAdapter.markRareShowcaseSeen(), 3);
    assert.equal(storageAdapter.getRareShowcaseCount(), 3);
  } finally {
    globalThis.localStorage = previous;
  }
});

test('rescued cats accumulate across runs and never go backwards', () => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = new MemoryStorage();
  try {
    assert.equal(storageAdapter.getCatsRescued(), 0);
    assert.equal(storageAdapter.addCatsRescued(7), 7);
    assert.equal(storageAdapter.addCatsRescued(0), 7, 'a catless run keeps the total');
    assert.equal(storageAdapter.addCatsRescued(-3), 7, 'negative counts must not shrink the collection');
    assert.equal(storageAdapter.addCatsRescued(12), 19);
    assert.equal(storageAdapter.getCatsRescued(), 19);
  } finally {
    globalThis.localStorage = previous;
  }
});

test('clean clears accumulate as the garden record now that every stage fully reveals', () => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = new MemoryStorage();
  try {
    assert.equal(storageAdapter.getCleanClears(), 0);
    assert.equal(storageAdapter.addCleanClears(2), 2);
    assert.equal(storageAdapter.addCleanClears(0), 2, 'a run with no clean clears changes nothing');
    assert.equal(storageAdapter.addCleanClears(3), 5);
    assert.equal(storageAdapter.addCleanClears(-4), 5, 'negative input never shrinks the total');
    assert.equal(storageAdapter.getCleanClears(), 5);
  } finally {
    globalThis.localStorage = previous;
  }
});

test('the garden ladder unlocks in order and measures progress within the current step', () => {
  const empty = gardenProgress(0);
  assert.deepEqual(empty.unlocked, []);
  assert.equal(empty.latest, null);
  assert.equal(empty.next.id, 'sprout');
  assert.equal(empty.remaining, 3);
  assert.equal(empty.progress, 0);
  assert.equal(empty.complete, false);

  const first = gardenProgress(3);
  assert.deepEqual(first.unlocked, ['sprout']);
  assert.equal(first.latest.id, 'sprout');
  assert.equal(first.next.id, 'flowers');
  assert.equal(first.remaining, 7);
  assert.equal(first.progress, 0, 'the bar restarts at each unlock instead of counting from zero');

  const midStep = gardenProgress(6);
  assert.ok(midStep.progress > 0.42 && midStep.progress < 0.44, `expected ~3/7, got ${midStep.progress}`);

  const finished = gardenProgress(GARDEN_MILESTONES.at(-1).cats);
  assert.equal(finished.unlocked.length, GARDEN_MILESTONES.length);
  assert.equal(finished.next, null);
  assert.equal(finished.remaining, 0);
  assert.equal(finished.progress, 1);
  assert.equal(finished.complete, true);

  assert.equal(gardenProgress(-5).cats, 0, 'a negative total cannot unlock anything');
  assert.deepEqual(gardenProgress(99999).unlocked.length, GARDEN_MILESTONES.length);
  const requirements = GARDEN_MILESTONES.map((milestone) => milestone.cats);
  assert.deepEqual(requirements, [...requirements].sort((a, b) => a - b), 'tiers must stay in ascending order');
});

test('new players start with music on while an explicit saved preference remains compatible', () => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = new MemoryStorage();
  try {
    assert.deepEqual(storageAdapter.getSettings(), {
      sound: true,
      haptic: true,
      music: true,
      musicVolume: 0.4,
    });
    storageAdapter.saveSettings({ sound: true, haptic: true, music: false, musicVolume: 0.25 });
    assert.equal(storageAdapter.getSettings().music, false);
    assert.equal(storageAdapter.getSettings().musicVolume, 0.25);
  } finally {
    globalThis.localStorage = previous;
  }
});

test('result copy remembers eight distinct recent lines without changing legacy score history', () => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = new MemoryStorage();
  try {
    for (let index = 0; index < 10; index += 1) storageAdapter.rememberResultMessage(`결과 ${index}`);
    assert.deepEqual(storageAdapter.getRecentResultMessages(), [
      '결과 2', '결과 3', '결과 4', '결과 5', '결과 6', '결과 7', '결과 8', '결과 9',
    ]);
    storageAdapter.rememberResultMessage('결과 7');
    assert.equal(storageAdapter.getRecentResultMessages().at(-1), '결과 7');
    assert.deepEqual(storageAdapter.getRecentScores(), []);
  } finally {
    globalThis.localStorage = previous;
  }
});
