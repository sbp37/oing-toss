const TELEMETRY_KEY = 'oing_toss_v2_local_telemetry_v1';
const MAX_STORED_RUNS = 50;

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const whole = (value, fallback = 0) => Math.max(0, Math.round(finite(value, fallback)));
const mean = (values) => values.length ? values.reduce((sum, value) => sum + finite(value), 0) / values.length : 0;

function safeStorage(storage) {
  if (storage) return storage;
  try { return globalThis.localStorage; } catch { return null; }
}

export function readTelemetryRuns(storage) {
  try {
    const parsed = JSON.parse(safeStorage(storage)?.getItem(TELEMETRY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(-MAX_STORED_RUNS) : [];
  } catch { return []; }
}

export function saveTelemetryRun(run, storage) {
  const target = safeStorage(storage);
  if (!target || !run) return false;
  try {
    target.setItem(TELEMETRY_KEY, JSON.stringify([...readTelemetryRuns(target), run].slice(-MAX_STORED_RUNS)));
    return true;
  } catch { return false; }
}

export function clearTelemetryRuns(storage) {
  try { safeStorage(storage)?.removeItem(TELEMETRY_KEY); return true; } catch { return false; }
}

export function summarizeTelemetryRuns(runs = []) {
  const valid = (Array.isArray(runs) ? runs : []).filter((run) => run && typeof run === 'object');
  const completed = valid.filter((run) => run.outcome === 'completed');
  const selections = valid.reduce((sum, run) => sum + whole(run.selections), 0);
  const successes = valid.reduce((sum, run) => sum + whole(run.successes), 0);
  const itemTypes = ['hint', 'shuffle', 'bomb', 'clock', 'megabomb', 'freeze', 'clover'];
  const itemsUsed = Object.fromEntries(itemTypes.map((type) => [type, valid.reduce((sum, run) => sum + whole(run.itemsUsed?.[type]), 0)]));
  return Object.freeze({
    runs: valid.length,
    completedRuns: completed.length,
    completionRate: valid.length ? Math.round((completed.length / valid.length) * 1000) / 10 : 0,
    averageScore: Math.round(mean(completed.map((run) => run.score))),
    averageDurationSeconds: Math.round(mean(completed.map((run) => run.durationSeconds)) * 10) / 10,
    averageRound: Math.round(mean(completed.map((run) => run.round)) * 10) / 10,
    averageMaxCombo: Math.round(mean(completed.map((run) => run.maxCombo)) * 10) / 10,
    accuracy: selections ? Math.round((successes / selections) * 1000) / 10 : 0,
    nearMissRate: selections ? Math.round(valid.reduce((sum, run) => sum + whole(run.nearMisses), 0) / selections * 1000) / 10 : 0,
    richClearRatio: successes ? Math.round(valid.reduce((sum, run) => sum + whole(run.richClears), 0) / successes * 1000) / 10 : 0,
    averageFirstInputMs: Math.round(mean(valid.map((run) => run.firstInputMs).filter(Number.isFinite))),
    itemsUsed: Object.freeze(itemsUsed),
    assistHints: valid.reduce((sum, run) => sum + whole(run.assistHints), 0),
    itemClearedCells: valid.reduce((sum, run) => sum + whole(run.itemClearedCells), 0),
    itemCatsCollected: valid.reduce((sum, run) => sum + whole(run.itemCatsCollected), 0),
    exits: Object.freeze(valid.reduce((result, run) => {
      const reason = run.endReason || 'unknown';
      result[reason] = (result[reason] || 0) + 1;
      return result;
    }, {})),
  });
}

export class RunTelemetry {
  constructor({ storage, now = () => Date.now(), monotonicNow = () => globalThis.performance?.now?.() ?? Date.now(), viewport = {} } = {}) {
    this.storage = safeStorage(storage);
    this.now = now;
    this.monotonicNow = monotonicNow;
    this.startedMonotonic = monotonicNow();
    this.activeMonotonic = null;
    this.closed = false;
    this.pauseStartedAt = null;
    this.run = {
      schema: 1, startedAt: now(), viewportWidth: whole(viewport.width), viewportHeight: whole(viewport.height), firstInputMs: null,
      selections: 0, successes: 0, failures: 0, simpleClears: 0, richClears: 0, clearedCells: 0, catsCollected: 0,
      boardsGenerated: 0, roundsCleared: 0, perfectClears: 0, manualHints: 0, autoHints: 0, assistHints: 0, nearMisses: 0,
      itemClearedCells: 0, itemCatsCollected: 0, pauses: 0, pausedMs: 0,
      itemsEarned: {}, itemsUsed: {},
    };
  }

  firstInput() {
    if (!this.closed && this.run.firstInputMs === null) this.run.firstInputMs = whole(this.monotonicNow() - (this.activeMonotonic ?? this.startedMonotonic));
  }

  playReady() { if (!this.closed && this.activeMonotonic === null) this.activeMonotonic = this.monotonicNow(); }

  boardGenerated(answerCount = 0) {
    if (this.closed) return;
    this.run.boardsGenerated += 1;
    this.run.initialAnswersTotal = whole(this.run.initialAnswersTotal) + whole(answerCount);
  }

  selection({ correct = false, cellCount = 0, catCount = 0, sum = 0 } = {}) {
    if (this.closed) return;
    this.firstInput();
    this.run.selections += 1;
    if (!correct) {
      this.run.failures += 1;
      if (Math.abs(finite(sum) - 10) === 1) this.run.nearMisses += 1;
      return;
    }
    this.run.successes += 1;
    const cells = whole(cellCount);
    this.run.clearedCells += cells;
    this.run.catsCollected += whole(catCount);
    if (cells >= 3) this.run.richClears += 1;
    else this.run.simpleClears += 1;
  }

  itemEarned(type) { if (!this.closed && type) this.run.itemsEarned[type] = whole(this.run.itemsEarned[type]) + 1; }
  itemUsed(type) { if (!this.closed && type) { this.firstInput(); this.run.itemsUsed[type] = whole(this.run.itemsUsed[type]) + 1; } }
  itemBlast({ cellCount = 0, catCount = 0 } = {}) {
    if (this.closed) return;
    this.run.itemClearedCells += whole(cellCount);
    this.run.itemCatsCollected += whole(catCount);
  }
  hint(kind = 'manual') {
    if (this.closed) return;
    if (kind === 'auto') this.run.autoHints += 1;
    else if (kind === 'assist') this.run.assistHints += 1;
    else this.run.manualHints += 1;
  }
  roundCleared({ perfect = false } = {}) { if (!this.closed) { this.run.roundsCleared += 1; if (perfect) this.run.perfectClears += 1; } }
  pause() { if (!this.closed && this.pauseStartedAt === null) { this.run.pauses += 1; this.pauseStartedAt = this.monotonicNow(); } }
  resume() { if (!this.closed && this.pauseStartedAt !== null) { this.run.pausedMs += whole(this.monotonicNow() - this.pauseStartedAt); this.pauseStartedAt = null; } }

  finish(finalState = {}, endReason = 'timer') {
    if (this.closed) return null;
    this.resume();
    this.closed = true;
    const durationMs = Math.max(0, this.monotonicNow() - (this.activeMonotonic ?? this.startedMonotonic) - this.run.pausedMs);
    const result = Object.freeze({
      ...this.run, endedAt: this.now(), durationSeconds: Math.round(durationMs / 100) / 10,
      outcome: endReason === 'timer' ? 'completed' : 'abandoned', endReason,
      score: whole(finalState.score), round: Math.max(1, whole(finalState.round, 1)),
      startStage: Math.max(1, whole(finalState.startStage, 1)), recordEligible: finalState.recordEligible !== false,
      maxCombo: whole(finalState.maxCombo), successCount: whole(finalState.successCount),
    });
    saveTelemetryRun(result, this.storage);
    return result;
  }
}

export function getLocalTelemetrySummary(storage) { return summarizeTelemetryRuns(readTelemetryRuns(storage)); }
