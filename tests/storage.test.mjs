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
