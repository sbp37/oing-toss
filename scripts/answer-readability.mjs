import {
  BoardModel,
  answerReadabilityClass,
  closestReadableAnswer,
  findAllSumTenRects,
} from '../js/board.js';
import { classicBoardForIndex, classicRoundForBoard } from '../js/data.js';

const requestedRuns = Number.parseInt(process.argv[2] || '40', 10);
const runsPerBoard = Number.isFinite(requestedRuns) && requestedRuns > 0 ? requestedRuns : 40;
const originalRandom = Math.random;
let randomState = 0x0a17cafe;

Math.random = () => {
  randomState += 0x6d2b79f5;
  let mixed = randomState;
  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
};

function bestShape(answers) {
  return answerReadabilityClass(closestReadableAnswer(answers));
}

function pickLikePlayer(answers) {
  const weighted = answers.map((answer) => {
    const shape = answerReadabilityClass(answer);
    const weight = shape === 'adjacent-pair' ? 5
      : shape === 'near-triple' ? 3
        : shape === 'small-2d' ? 2
          : shape === 'spaced-pair' ? 1.5
            : 1;
    return { answer, weight };
  });
  let roll = Math.random() * weighted.reduce((sum, entry) => sum + entry.weight, 0);
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.answer;
  }
  return weighted.at(-1).answer;
}

function blankMetrics() {
  return {
    boards: 0,
    initialAnswers: 0,
    initialTwoCell: 0,
    initialAdjacentPairs: 0,
    stateAnswers: 0,
    stateTwoCell: 0,
    tailBoards: 0,
    tailShape: {},
    dryTails: 0,
    fullClears: 0,
  };
}

function addShape(metrics, shape) {
  metrics.tailShape[shape] = (metrics.tailShape[shape] || 0) + 1;
}

const totals = blankMetrics();
const stages = [];
const model = new BoardModel(4);

for (let boardIndex = 0; boardIndex < 10; boardIndex += 1) {
  const metrics = blankMetrics();
  const config = classicBoardForIndex(boardIndex);
  const round = classicRoundForBoard(boardIndex);
  for (let run = 0; run < runsPerBoard; run += 1) {
    model.generateClassic(config.cols, config.rows, round);
    const initial = model.findAnswers();
    const initialPlayable = model.remainingPlayableCells();
    metrics.boards += 1;
    metrics.initialAnswers += initial.length;
    metrics.initialTwoCell += initial.filter((answer) => answer.count === 2).length;
    metrics.initialAdjacentPairs += initial.filter((answer) => answerReadabilityClass(answer) === 'adjacent-pair').length;
    let tailMeasured = false;
    while (model.remainingPlayableCells() > 0) {
      const answers = findAllSumTenRects(model.grid);
      metrics.stateAnswers += answers.length;
      metrics.stateTwoCell += answers.filter((answer) => answer.count === 2).length;
      const remainingShare = model.remainingPlayableCells() / Math.max(1, initialPlayable);
      if (!tailMeasured && remainingShare <= 0.4) {
        metrics.tailBoards += 1;
        addShape(metrics, bestShape(answers));
        tailMeasured = true;
      }
      if (!answers.length) {
        metrics.dryTails += 1;
        break;
      }
      model.remove(pickLikePlayer(answers));
    }
    if (model.remainingPlayableCells() === 0) metrics.fullClears += 1;
  }
  Object.keys(totals).forEach((key) => {
    if (key === 'tailShape') return;
    totals[key] += metrics[key];
  });
  Object.entries(metrics.tailShape).forEach(([shape, count]) => {
    totals.tailShape[shape] = (totals.tailShape[shape] || 0) + count;
  });
  stages.push({ board: boardIndex + 1, round, rows: config.rows, cols: config.cols, ...metrics });
}

function summarize(metrics) {
  return {
    boards: metrics.boards,
    adjacentPairsPerOpening: Number((metrics.initialAdjacentPairs / Math.max(1, metrics.boards)).toFixed(2)),
    openingTwoCellPercent: Number((metrics.initialTwoCell / Math.max(1, metrics.initialAnswers) * 100).toFixed(1)),
    playedTwoCellPercent: Number((metrics.stateTwoCell / Math.max(1, metrics.stateAnswers) * 100).toFixed(1)),
    tailShape: metrics.tailShape,
    dryTailPercent: Number((metrics.dryTails / Math.max(1, metrics.boards) * 100).toFixed(1)),
    fullClearPercent: Number((metrics.fullClears / Math.max(1, metrics.boards) * 100).toFixed(1)),
  };
}

console.log(JSON.stringify({
  runsPerBoard,
  total: summarize(totals),
  stages: stages.map((stage) => ({
    board: stage.board,
    round: stage.round,
    size: `${stage.cols}x${stage.rows}`,
    ...summarize(stage),
  })),
}, null, 2));

Math.random = originalRandom;
