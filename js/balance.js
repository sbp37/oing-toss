import {
  BoardModel,
  analyzeAnswerDiversity,
  boardAssistForPerformance,
  cellListStats,
  megaBombCells,
} from './board.js';
import {
  GAME_DURATION_SECONDS,
  TIME_FREEZE_SECONDS,
  TIME_ITEM_CAP_SCORE,
  availableItemTimeBonus,
  boardDropReward,
  cappedSessionTime,
  chooseBoardDrop,
  comboAfterIdle,
  comboAfterFailure,
  comboGainForClear,
  comboWindowMsForStage,
  getRoundConfig,
  nextBoardDropPity,
  roundTimeBonusSeconds,
  scoreForBomb,
  scoreForCatBonus,
  scoreForClear,
  scoreForClutch,
  scoreForCloverBonus,
  scoreForMegaBomb,
  scoreForWideClear,
  stageShowcaseBoardDrop,
} from './data.js';

export const PLAYER_PROFILES = Object.freeze({
  novice: Object.freeze({ id: 'novice', decisionSeconds: 4.15, errorRate: 0.15, itemUseRate: 0.62, richBias: 0.12 }),
  regular: Object.freeze({ id: 'regular', decisionSeconds: 2.65, errorRate: 0.07, itemUseRate: 0.82, richBias: 0.48 }),
  expert: Object.freeze({ id: 'expert', decisionSeconds: 1.5, errorRate: 0.02, itemUseRate: 0.94, richBias: 0.82 }),
});

export function createSeededRandom(seed = 1) {
  let value = (Math.round(Number(seed) || 1) >>> 0) || 1;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBetween(random, minimum, maximum) {
  return minimum + (maximum - minimum) * random();
}

function chooseAnswer(answers, profile, random, model = null) {
  const rich = answers.filter((answer) => answer.count >= 3);
  const simple = answers.filter((answer) => answer.count === 2);
  const useRich = rich.length && (!simple.length || random() < profile.richBias);
  let pool = useRich ? rich : (simple.length ? simple : answers);
  // One step of strand-avoidance, modelling what any human does by eye:
  // given a choice, don't take the clear that kills every remaining answer.
  // Sampled small so the sim stays honest about imperfect play — this is
  // "don't leave an orphan 7", not a solver.
  if (model && answers.length > 1) {
    const sample = pool.slice(0, 4);
    const keeps = sample.filter((answer) => {
      const removed = [];
      for (let r = answer.r1; r <= answer.r2; r += 1) {
        for (let c = answer.c1; c <= answer.c2; c += 1) {
          if (model.grid[r][c] > 0) { removed.push({ r, c, v: model.grid[r][c] }); model.grid[r][c] = null; }
        }
      }
      const alive = Boolean(model.findAnswer());
      removed.forEach(({ r, c, v }) => { model.grid[r][c] = v; });
      return alive;
    });
    if (keeps.length) pool = keeps;
  }
  if (profile.id === 'expert') {
    const maximum = Math.max(...pool.map((answer) => answer.count));
    const best = pool.filter((answer) => answer.count === maximum);
    return best[Math.floor(random() * best.length)];
  }
  return pool[Math.floor(random() * pool.length)];
}

function bestMegaBombTarget(model) {
  let best = null;
  for (let row = 0; row < model.rows; row += 1) {
    for (let col = 0; col < model.cols; col += 1) {
      const cells = megaBombCells(model.grid, row, col);
      const stats = cellListStats(model.grid, cells);
      const value = stats.count * 100 + stats.sum;
      if (stats.count && (!best || value > best.value)) best = { cells, stats, value };
    }
  }
  return best;
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function simulateRun({
  seed = 1,
  profile = 'regular',
  durationSeconds = GAME_DURATION_SECONDS,
  maximumElapsedSeconds = 300,
  showcaseEligible = false,
  showcaseIndex = 0,
} = {}) {
  const settings = typeof profile === 'string' ? PLAYER_PROFILES[profile] : profile;
  if (!settings) throw new Error(`Unknown player profile: ${profile}`);
  const random = createSeededRandom(seed);
  const originalRandom = Math.random;
  Math.random = random;
  try {
    const state = {
      profile: settings.id,
      seed,
      elapsedSeconds: 0,
      timeLeft: durationSeconds,
      score: 0,
      combo: 0,
      maxCombo: 0,
      round: 1,
      clears: 0,
      errors: 0,
      simpleClears: 0,
      richClears: 0,
      catBonuses: 0,
      boards: 0,
      perfectClears: 0,
      rescueShuffles: 0,
      boardsCleared: 0,
      cleanClears: 0,
      stageRescues: 0,
      timeUpRemainingCells: 0,
      roundTimeBonus: 0,
      itemTimeBonus: 0,
      cloverBonusScore: 0,
      clutchBonusScore: 0,
      itemClearedCells: 0,
      itemsEarned: {},
      itemsUsed: {},
      answerCounts: [],
      initialSimpleAnswerCounts: [],
      initialShapePatternCounts: [],
      initialValuePatternCounts: [],
      initialOrientationCounts: [],
      boardClearCounts: [],
      capped: false,
    };
    let model;
    let clearsOnBoard = 0;
    let previousDropType = null;
    let dropsEarned = 0;
    let cloverGiven = false;
    let stageShowcaseGiven = false;
    let dropPity = { megabomb: 0, clover: 0, freeze: 0 };
    let cloverBoost = false;
    let comboExpiresAtSeconds = 0;

    const refreshComboDeadline = () => {
      comboExpiresAtSeconds = state.combo > 0
        ? state.elapsedSeconds + comboWindowMsForStage(state.round) / 1000
        : 0;
    };

    const applyIdleComboDecay = () => {
      while (state.combo > 0
        && comboExpiresAtSeconds > 0
        && state.elapsedSeconds >= comboExpiresAtSeconds) {
        state.combo = comboAfterIdle(state.combo, state.round);
        comboExpiresAtSeconds = state.combo > 0
          ? comboExpiresAtSeconds + comboWindowMsForStage(state.round) / 1000
          : 0;
      }
    };

    const spendTime = (seconds) => {
      const amount = Math.max(0, seconds);
      state.elapsedSeconds += amount;
      state.timeLeft -= amount;
      applyIdleComboDecay();
    };
    const buildBoard = () => {
      const config = getRoundConfig(state.round);
      model = new BoardModel(config.cols);
      model.generate(config.cols, {
        cols: config.cols,
        rows: config.rows,
        round: state.round,
        assist: boardAssistForPerformance({
          stage: state.round,
          successCount: state.clears,
          failureCount: state.errors,
          maxCombo: state.maxCombo,
        }),
      });
      const answers = model.findAnswers();
      const diversity = analyzeAnswerDiversity(model.grid, answers);
      state.boards += 1;
      state.answerCounts.push(answers.length);
      state.initialSimpleAnswerCounts.push(answers.filter((answer) => answer.count === 2).length);
      state.initialShapePatternCounts.push(diversity.shapePatterns);
      state.initialValuePatternCounts.push(diversity.valuePatterns);
      state.initialOrientationCounts.push(diversity.orientations);
      clearsOnBoard = 0;
    };
    const closeBoard = () => {
      state.boardClearCounts.push(clearsOnBoard);
      if (model.remainingPlayableCells() === 0) state.perfectClears += 1;
    };
    const completeStage = () => {
      closeBoard();
      state.boardsCleared += 1;
      if (state.stageRescues === 0) state.cleanClears += 1;
      state.stageRescues = 0;
      const bonus = roundTimeBonusSeconds(state.round);
      state.roundTimeBonus += bonus;
      state.timeLeft = cappedSessionTime(state.timeLeft, bonus);
      state.round += 1;
      refreshComboDeadline();
      buildBoard();
      const showcaseDrop = showcaseEligible
        ? stageShowcaseBoardDrop(state.round, () => (Math.min(2, showcaseIndex) + 0.5) / 3, stageShowcaseGiven)
        : null;
      if (showcaseDrop) {
        stageShowcaseGiven = true;
        previousDropType = showcaseDrop.id;
        if (showcaseDrop.id === 'clover') cloverGiven = true;
        state.itemsEarned[showcaseDrop.id] = (state.itemsEarned[showcaseDrop.id] || 0) + 1;
        useDrop(showcaseDrop);
      }
    };
    const useDrop = (drop) => {
      if (!drop || random() > settings.itemUseRate) return;
      state.itemsUsed[drop.id] = (state.itemsUsed[drop.id] || 0) + 1;
      spendTime(randomBetween(random, 0.32, 0.58));
      if (drop.id === 'clock') {
        const requestedTime = availableItemTimeBonus(state.itemTimeBonus, 5);
        if (requestedTime <= 0) state.score += TIME_ITEM_CAP_SCORE;
        const previousTime = state.timeLeft;
        state.timeLeft = cappedSessionTime(state.timeLeft, requestedTime);
        state.itemTimeBonus += Math.min(requestedTime, Math.max(0, state.timeLeft - Math.max(0, previousTime)));
      } else if (drop.id === 'freeze') {
        const requestedTime = availableItemTimeBonus(state.itemTimeBonus, TIME_FREEZE_SECONDS);
        if (requestedTime <= 0) state.score += TIME_ITEM_CAP_SCORE;
        const previousTime = state.timeLeft;
        state.timeLeft = cappedSessionTime(state.timeLeft, requestedTime);
        state.itemTimeBonus += Math.min(requestedTime, Math.max(0, state.timeLeft - Math.max(0, previousTime)));
      } else if (drop.id === 'clover') {
        cloverBoost = true;
      } else if (drop.id === 'bomb') {
        const target = model.bestBombTarget();
        if (target) {
          state.score += scoreForBomb(target.stats.sum, target.stats.count);
          state.itemClearedCells += target.stats.count;
          model.remove(target.rect);
        }
      } else if (drop.id === 'megabomb') {
        const target = bestMegaBombTarget(model);
        if (target) {
          state.score += scoreForMegaBomb(target.stats.sum, target.stats.count);
          state.itemClearedCells += target.stats.count;
          model.removeCells(target.cells);
        }
      }
    };

    buildBoard();
    let actions = 0;
    while (state.timeLeft > 0 && state.elapsedSeconds < maximumElapsedSeconds && actions < 600) {
      actions += 1;
      const roundSlowdown = Math.min(0.55, Math.max(0, state.round - 1) * 0.055);
      const variation = randomBetween(random, 0.82, 1.2);
      const cloverFactor = cloverBoost ? 0.62 : 1;
      spendTime((settings.decisionSeconds + roundSlowdown) * variation * cloverFactor + 0.2);
      if (state.timeLeft <= 0) break;

      const answers = model.findAnswers();
      if (!answers.length) {
        if (model.remainingPlayableCells() === 0) {
          completeStage();
          continue;
        }
        // Rescue shuffle: rearrange (or minimally repair) the remaining
        // numbers; fewer than two numbers sweeps the debris and completes.
        state.rescueShuffles += 1;
        state.stageRescues += 1;
        spendTime(randomBetween(random, 0.7, 1.2));
        const outcome = model.rescueRemaining();
        if (!outcome) {
          model.sweepRemaining();
          completeStage();
        }
        continue;
      }
      if (random() < settings.errorRate) {
        state.errors += 1;
        state.combo = comboAfterFailure(state.combo);
        refreshComboDeadline();
        continue;
      }

      const answer = chooseAnswer(answers, settings, random, model);
      const stats = model.stats(answer);
      const clearedCells = stats.count + stats.catCount;
      const previousCombo = state.combo;
      state.combo += comboGainForClear(clearedCells);
      refreshComboDeadline();
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      const clearPoints = scoreForClear(clearedCells, state.combo);
      const widePoints = scoreForWideClear(clearedCells, state.combo);
      const catPoints = scoreForCatBonus(stats.catCount, state.combo);
      const cloverPoints = cloverBoost ? scoreForCloverBonus(clearPoints + widePoints + catPoints) : 0;
      const clutchPoints = scoreForClutch(state.timeLeft, state.combo);
      cloverBoost = false;
      state.cloverBonusScore += cloverPoints;
      state.clutchBonusScore += clutchPoints;
      state.score += clearPoints + widePoints + catPoints + cloverPoints + clutchPoints;
      state.clears += 1;
      clearsOnBoard += 1;
      state.catBonuses += stats.catCount;
      if (answer.count >= 3) state.richClears += 1;
      else state.simpleClears += 1;
      model.remove(answer);

      if (boardDropReward(previousCombo, state.combo)) {
        const drop = chooseBoardDrop(state.combo, random, {
          cloverGiven,
          pity: dropPity,
          previousType: previousDropType,
          rewardIndex: dropsEarned,
          stage: state.round,
          timeBonusCapped: availableItemTimeBonus(state.itemTimeBonus, 1) <= 0,
        });
        if (drop) {
          dropsEarned += 1;
          previousDropType = drop.id;
          dropPity = nextBoardDropPity(dropPity, drop.id, { stage: state.round, combo: state.combo });
          if (drop.id === 'clover') cloverGiven = true;
          state.itemsEarned[drop.id] = (state.itemsEarned[drop.id] || 0) + 1;
          useDrop(drop);
        }
      }
      // A stage ends only on a completely empty board; a dry board with
      // cells still on it takes a rescue shuffle on the next loop pass.
      if (model.remainingPlayableCells() === 0) completeStage();
    }
    state.timeUpRemainingCells = model.remainingPlayableCells();
    state.capped = state.elapsedSeconds >= maximumElapsedSeconds || actions >= 600;
    state.elapsedSeconds = Math.round(state.elapsedSeconds * 10) / 10;
    state.timeLeft = Math.max(0, Math.round(state.timeLeft * 10) / 10);
    return state;
  } finally {
    Math.random = originalRandom;
  }
}

export function summarizeRuns(runs) {
  const itemTypes = ['bomb', 'clock', 'megabomb', 'freeze', 'clover'];
  const sumItems = (field) => Object.fromEntries(itemTypes.map((type) => [
    type,
    runs.reduce((sum, run) => sum + (run[field][type] || 0), 0),
  ]));
  return {
    runs: runs.length,
    scoreMean: Math.round(mean(runs.map((run) => run.score))),
    scoreP10: Math.round(percentile(runs.map((run) => run.score), 0.1)),
    scoreP90: Math.round(percentile(runs.map((run) => run.score), 0.9)),
    elapsedMean: Math.round(mean(runs.map((run) => run.elapsedSeconds)) * 10) / 10,
    roundMean: Math.round(mean(runs.map((run) => run.round)) * 10) / 10,
    clearsMean: Math.round(mean(runs.map((run) => run.clears)) * 10) / 10,
    boardsClearedMean: Math.round(mean(runs.map((run) => run.boardsCleared)) * 10) / 10,
    rescueMean: Math.round(mean(runs.map((run) => run.rescueShuffles)) * 100) / 100,
    cleanClearRate: Math.round(mean(runs.map((run) => (run.boardsCleared ? run.cleanClears / run.boardsCleared : 0))) * 100) / 100,
    timeUpRemainingCellsMean: Math.round(mean(runs.map((run) => run.timeUpRemainingCells)) * 10) / 10,
    itemDropsMean: Math.round(mean(runs.map((run) => Object.values(run.itemsEarned).reduce((a, b) => a + b, 0))) * 100) / 100,
    maxComboMean: Math.round(mean(runs.map((run) => run.maxCombo)) * 10) / 10,
    errorsMean: Math.round(mean(runs.map((run) => run.errors)) * 10) / 10,
    initialAnswersMean: Math.round(mean(runs.flatMap((run) => run.answerCounts)) * 10) / 10,
    initialSimpleAnswersMean: Math.round(mean(runs.flatMap((run) => run.initialSimpleAnswerCounts)) * 10) / 10,
    initialShapePatternsMean: Math.round(mean(runs.flatMap((run) => run.initialShapePatternCounts)) * 10) / 10,
    initialValuePatternsMean: Math.round(mean(runs.flatMap((run) => run.initialValuePatternCounts)) * 10) / 10,
    initialOrientationsMean: Math.round(mean(runs.flatMap((run) => run.initialOrientationCounts)) * 10) / 10,
    clearsPerBoardMean: Math.round(mean(runs.flatMap((run) => run.boardClearCounts)) * 10) / 10,
    richClearRatio: Math.round(1000 * runs.reduce((sum, run) => sum + run.richClears, 0)
      / Math.max(1, runs.reduce((sum, run) => sum + run.clears, 0))) / 10,
    cloverBonusMean: Math.round(mean(runs.map((run) => run.cloverBonusScore))),
    clutchBonusMean: Math.round(mean(runs.map((run) => run.clutchBonusScore))),
    itemClearedCellsMean: Math.round(mean(runs.map((run) => run.itemClearedCells)) * 10) / 10,
    roundTimeBonusMean: Math.round(mean(runs.map((run) => run.roundTimeBonus)) * 10) / 10,
    itemTimeBonusMean: Math.round(mean(runs.map((run) => run.itemTimeBonus)) * 10) / 10,
    cappedRuns: runs.filter((run) => run.capped).length,
    itemsEarned: sumItems('itemsEarned'),
    itemsUsed: sumItems('itemsUsed'),
  };
}

export function simulateBalanceSuite({ runsPerProfile = 40, seed = 20260808 } = {}) {
  return Object.fromEntries(Object.keys(PLAYER_PROFILES).map((profile, profileIndex) => {
    const runs = Array.from({ length: runsPerProfile }, (_, index) => simulateRun({
      profile,
      seed: seed + profileIndex * 100000 + index,
      showcaseEligible: index < 3,
      showcaseIndex: index,
    }));
    return [profile, summarizeRuns(runs)];
  }));
}
