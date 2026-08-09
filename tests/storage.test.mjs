import assert from 'node:assert/strict';
import test from 'node:test';
import { storageAdapter } from '../js/adapters.js';

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
  } finally {
    globalThis.localStorage = previous;
  }
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
