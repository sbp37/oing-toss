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
  boardDropReward,
  cappedSessionTime,
  chooseBoardDrop,
  comboAfterIdle,
  comboAfterFailure,
  comboGainForClear,
  comboWindowMsForStage,
  completesStageChallenge,
  getRoundConfig,
  roundTimeBonusSeconds,
  scoreForBomb,
  scoreForCatBonus,
  scoreForClear,
  scoreForClutch,
  scoreForCloverBonus,
  scoreForMegaBomb,
  scoreForWideClear,
  stageChallengeBonus,
  stageChallengeForStage,
  stageProgressGainForClear,
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

function chooseAnswer(answers, profile, random) {
  const rich = answers.filter((answer) => answer.count >= 3);
  const simple = answers.filter((answer) => answer.count === 2);
  const useRich = rich.length && (!simple.length || random() < profile.richBias);
  const pool = useRich ? rich : (simple.length ? simple : answers);
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
      progress: 0,
      clears: 0,
      errors: 0,
      simpleClears: 0,
      richClears: 0,
      catBonuses: 0,
      boards: 0,
      perfectClears: 0,
      roundTimeBonus: 0,
      itemTimeBonus: 0,
      stageChallengeComplete: false,
      stageChallengeStreak: 0,
      stageChallengeScore: 0,
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
    const replaceBoard = () => {
      closeBoard();
      buildBoard();
    };
    const completeStage = () => {
      closeBoard();
      const bonus = roundTimeBonusSeconds(state.round);
      state.roundTimeBonus += bonus;
      state.timeLeft = cappedSessionTime(state.timeLeft, bonus);
      state.round += 1;
      state.progress = 0;
      state.stageChallengeComplete = false;
      state.stageChallengeStreak = 0;
      refreshComboDeadline();
      buildBoard();
    };
    const useDrop = (drop) => {
      if (!drop || random() > settings.itemUseRate) return;
      state.itemsUsed[drop.id] = (state.itemsUsed[drop.id] || 0) + 1;
      spendTime(randomBetween(random, 0.32, 0.58));
      if (drop.id === 'clock') {
        const previousTime = state.timeLeft;
        state.timeLeft = cappedSessionTime(state.timeLeft, 5);
        state.itemTimeBonus += state.timeLeft - previousTime;
      } else if (drop.id === 'freeze') {
        const previousTime = state.timeLeft;
        state.timeLeft = cappedSessionTime(state.timeLeft, TIME_FREEZE_SECONDS);
        state.itemTimeBonus += state.timeLeft - previousTime;
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
        replaceBoard();
        continue;
      }
      if (random() < settings.errorRate) {
        state.errors += 1;
        state.combo = comboAfterFailure(state.combo);
        state.stageChallengeStreak = 0;
        refreshComboDeadline();
        continue;
      }

      const answer = chooseAnswer(answers, settings, random);
      const stats = model.stats(answer);
      const clearedCells = stats.count + stats.catCount;
      const previousCombo = state.combo;
      state.combo += comboGainForClear(clearedCells);
      refreshComboDeadline();
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      state.stageChallengeStreak += 1;
      const challenge = stageChallengeForStage(state.round);
      const challengeCompleted = !state.stageChallengeComplete && completesStageChallenge(challenge, {
        cellCount: clearedCells,
        catCount: stats.catCount,
        stageStreak: state.stageChallengeStreak,
      });
      const challengePoints = challengeCompleted ? stageChallengeBonus(state.round) : 0;
      if (challengeCompleted) {
        state.stageChallengeComplete = true;
        state.stageChallengeScore += challengePoints;
      }
      const clearPoints = scoreForClear(clearedCells, state.combo);
      const widePoints = scoreForWideClear(clearedCells, state.combo);
      const catPoints = scoreForCatBonus(stats.catCount, state.combo);
      const cloverPoints = cloverBoost ? scoreForCloverBonus(clearPoints + widePoints + catPoints) : 0;
      const clutchPoints = scoreForClutch(state.timeLeft, state.combo);
      cloverBoost = false;
      state.cloverBonusScore += cloverPoints;
      state.clutchBonusScore += clutchPoints;
      state.score += clearPoints + widePoints + catPoints + challengePoints + cloverPoints + clutchPoints;
      state.clears += 1;
      state.progress += stageProgressGainForClear(clearedCells);
      clearsOnBoard += 1;
      state.catBonuses += stats.catCount;
      if (answer.count >= 3) state.richClears += 1;
      else state.simpleClears += 1;
      model.remove(answer);

      if (boardDropReward(previousCombo, state.combo)) {
        const drop = chooseBoardDrop(state.combo, random, {
          cloverGiven,
          previousType: previousDropType,
          rewardIndex: dropsEarned,
          stage: state.round,
        });
        if (drop) {
          dropsEarned += 1;
          previousDropType = drop.id;
          if (drop.id === 'clover') cloverGiven = true;
          state.itemsEarned[drop.id] = (state.itemsEarned[drop.id] || 0) + 1;
          useDrop(drop);
        }
      }
      const config = getRoundConfig(state.round);
      if (state.progress >= config.target) completeStage();
      else if (!model.findAnswers().length) replaceBoard();
    }
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
    challengeBonusMean: Math.round(mean(runs.map((run) => run.stageChallengeScore))),
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
    }));
    return [profile, summarizeRuns(runs)];
  }));
}
