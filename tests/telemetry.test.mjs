import assert from 'node:assert/strict';
import test from 'node:test';
import { RunTelemetry, clearTelemetryRuns, readTelemetryRuns, saveTelemetryRun, summarizeTelemetryRuns } from '../js/telemetry.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) };
}

test('local telemetry records gameplay quality without identity data', () => {
  const storage = memoryStorage();
  let clock = 1000;
  const telemetry = new RunTelemetry({ storage, now: () => 1700000000000 + clock, monotonicNow: () => clock, viewport: { width: 390, height: 844 } });
  telemetry.playReady();
  clock += 800;
  telemetry.firstInput(); telemetry.boardGenerated(7);
  telemetry.selection({ correct: true, cellCount: 2 }); telemetry.selection({ correct: true, cellCount: 4, catCount: 1 }); telemetry.selection({ correct: false, cellCount: 3, sum: 9 });
  telemetry.itemEarned('bomb'); telemetry.itemUsed('bomb'); telemetry.itemBlast({ cellCount: 8, catCount: 1 }); telemetry.hint('manual'); telemetry.roundCleared({ perfect: true }); telemetry.pause();
  clock += 5000; telemetry.resume(); clock += 19200;
  const result = telemetry.finish({ score: 4321, round: 3, startStage: 1, recordEligible: true, maxCombo: 8, successCount: 2 }, 'timer');
  assert.equal(result.durationSeconds, 20); assert.equal(result.firstInputMs, 800); assert.equal(result.selections, 3); assert.equal(result.successes, 2);
  assert.equal(result.failures, 1); assert.equal(result.richClears, 1); assert.equal(result.outcome, 'completed'); assert.equal(result.viewportWidth, 390);
  assert.equal(result.nearMisses, 1); assert.equal(result.assistHints, 0);
  assert.equal(result.itemClearedCells, 8); assert.equal(result.itemCatsCollected, 1);
  assert.equal(result.startStage, 1); assert.equal(result.recordEligible, true);
  assert.equal('userAgent' in result, false); assert.deepEqual(readTelemetryRuns(storage), [result]); assert.equal(telemetry.finish({}, 'timer'), null);
});

test('checkpoint retries are marked as record-ineligible in telemetry', () => {
  const storage = memoryStorage();
  const telemetry = new RunTelemetry({ storage, now: () => 1, monotonicNow: () => 1 });
  const result = telemetry.finish({ score: 99999, round: 8, startStage: 8, recordEligible: false }, 'timer');
  assert.equal(result.startStage, 8);
  assert.equal(result.recordEligible, false);
});

test('telemetry summary exposes balance metrics and caps storage at fifty runs', () => {
  const storage = memoryStorage();
  for (let index = 0; index < 55; index += 1) saveTelemetryRun({ outcome: index % 5 ? 'completed' : 'abandoned', endReason: index % 5 ? 'timer' : 'home', score: 1000 + index, durationSeconds: 120, round: 4, maxCombo: 7, selections: 10, successes: 8, richClears: 3, firstInputMs: 900, itemsUsed: { hint: 1 } }, storage);
  const runs = readTelemetryRuns(storage); const summary = summarizeTelemetryRuns(runs);
  assert.equal(runs.length, 50); assert.equal(summary.completionRate, 80); assert.equal(summary.accuracy, 80); assert.equal(summary.nearMissRate, 0); assert.equal(summary.richClearRatio, 37.5); assert.equal(summary.assistHints, 0); assert.equal(summary.itemClearedCells, 0); assert.equal(summary.itemCatsCollected, 0); assert.equal(summary.itemsUsed.hint, 50);
  assert.equal(clearTelemetryRuns(storage), true); assert.deepEqual(readTelemetryRuns(storage), []);
});
