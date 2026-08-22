const MIN_VALUE = 1;
const MAX_VALUE = 9;
const GENERATION_ATTEMPTS = 72;
export const BONUS_CAT_RATIO = 0.07;
export const EASY_BOARD_BONUS = Object.freeze({ minimumAnswers: 1, minimumSimpleAnswers: 2, minimumAdjacentPairs: 2 });
export const BOARD_ASSIST_PROFILES = Object.freeze({
  starter: Object.freeze({ minimumAnswers: 3, minimumSimpleAnswers: 3, minimumAdjacentPairs: 3 }),
  guided: EASY_BOARD_BONUS,
  standard: Object.freeze({ minimumAnswers: 0, minimumSimpleAnswers: 0, minimumAdjacentPairs: 0 }),
});

// The board gets denser every round, but the kind of answer changes too:
// Early rounds teach with obvious pairs; later, denser boards increasingly
// reward wider 3+ tile rectangles. Every profile still guarantees choices.
export const BOARD_DIFFICULTY = Object.freeze({
  4: Object.freeze({ minimumAnswers: 5, minimumSimpleAnswers: 3, minimumAdjacentPairs: 3, minimumRichAnswers: 1 }),
  5: Object.freeze({ minimumAnswers: 7, minimumSimpleAnswers: 2, minimumAdjacentPairs: 2, minimumRichAnswers: 2 }),
  6: Object.freeze({ minimumAnswers: 9, minimumSimpleAnswers: 1, minimumAdjacentPairs: 1, minimumRichAnswers: 4 }),
  7: Object.freeze({ minimumAnswers: 12, minimumSimpleAnswers: 1, minimumAdjacentPairs: 1, minimumRichAnswers: 6 }),
  8: Object.freeze({ minimumAnswers: 15, minimumSimpleAnswers: 1, minimumAdjacentPairs: 1, minimumRichAnswers: 8 }),
  9: Object.freeze({ minimumAnswers: 18, minimumSimpleAnswers: 1, minimumAdjacentPairs: 1, minimumRichAnswers: 10 }),
});

export function boardAssistForSuccessCount(successCount) {
  const count = Math.max(0, Math.floor(Number(successCount) || 0));
  // A real board often has more clears than its displayed minimum target.
  // These thresholds follow measured clears, keeping rounds 1-2 in starter,
  // rounds 3-5 guided, and switching to standard around round 6.
  if (count < 15) return 'starter';
  if (count < 55) return 'guided';
  return 'standard';
}

export function boardAssistForPerformance({
  stage = 1,
  successCount = 0,
  failureCount = 0,
  maxCombo = 0,
} = {}) {
  const level = Math.max(1, Math.round(Number(stage) || 1));
  const successes = Math.max(0, Math.round(Number(successCount) || 0));
  const failures = Math.max(0, Math.round(Number(failureCount) || 0));
  const streak = Math.max(0, Math.round(Number(maxCombo) || 0));
  const attempts = successes + failures;
  const accuracy = attempts ? successes / attempts : 1;

  if (level === 1) return 'starter';
  if (level === 2) return streak >= 5 && accuracy >= 0.75 ? 'guided' : 'starter';
  if (level <= 4) {
    if (attempts >= 8 && accuracy < 0.65) return 'starter';
    if (streak >= 10 && accuracy >= 0.85) return 'standard';
    return 'guided';
  }
  // Skilled runs stop receiving hidden easy pairs once the full board is
  // learned. A struggling run still gets one softer profile without changing
  // the visible stage rules or stored progression.
  if (attempts >= 10 && accuracy < 0.6) return 'guided';
  return 'standard';
}


// Pair weights per difficulty phase, in COMPLEMENT_PAIRS order. Late stages
// lean on 1+9 and 2+8 for a measured reason: nine cannot appear in any
// sum-ten triple (9+1 leaves nothing for a third cell), so as the triple
// share climbs, pairs are the only place the big, instantly readable
// numbers can live. Left alone, stage 10 fell to 2.6% nines and 2.6%
// eights and the board turned into small-number addition.
const ORIGINAL_PAIR_WEIGHTS = Object.freeze([
  Object.freeze([8, 8, 13, 15, 11]),
  Object.freeze([10, 10, 13, 13, 9]),
  Object.freeze([12, 12, 13, 11, 7]),
  Object.freeze([13, 12, 13, 11, 6]),
  Object.freeze([15, 14, 12, 9, 5]),
  Object.freeze([16, 15, 12, 8, 4]),
]);
const COMPLEMENT_PAIRS = Object.freeze([[1, 9], [2, 8], [3, 7], [4, 6], [5, 5]]);

// Sum-ten triples. The early pool is the original four; once the triple
// share starts to dominate, the pool swaps in 1+2+7. What matters for feel
// is whether a triple has a big anchor: spotting a 7 and hunting its 1+2 is
// recognition, while 3+3+4 is pure addition. Anchored sets keep the late
// board readable without making it easier — difficulty still rides on shape
// and density, not on how much mental arithmetic each answer costs.
const TEN_TRIPLES_EARLY = Object.freeze([[2, 3, 5], [1, 4, 5], [1, 3, 6], [2, 2, 6]]);
const TEN_TRIPLES_LATE = Object.freeze([
  [1, 2, 7], [1, 3, 6], [2, 2, 6], [1, 4, 5], [2, 3, 5], [3, 3, 4],
]);

function tripleGroupsForRound(round = 1) {
  return difficultyPhaseForStage(round) <= 4 ? TEN_TRIPLES_EARLY : TEN_TRIPLES_LATE;
}

// Splits a value list into groups that each sum to exactly ten, or returns
// null when no such partition exists. Backtracking over descending values
// with a node budget — rescue tails are small, and a budget miss just falls
// back to the single-answer repair path.
export function partitionIntoTens(values) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total === 0) return [];
  if (total % 10 !== 0) return null;
  const sorted = values.slice().sort((a, b) => b - a);
  const used = new Array(sorted.length).fill(false);
  const groups = [];
  let budget = 40000;

  const fill = (need, startIndex, group) => {
    if (budget <= 0) return false;
    budget -= 1;
    if (need === 0) {
      groups.push(group.slice());
      const nextIndex = used.findIndex((flag) => !flag);
      if (nextIndex === -1) return true;
      used[nextIndex] = true;
      group.length = 0;
      group.push(sorted[nextIndex]);
      if (fill(10 - sorted[nextIndex], nextIndex + 1, group)) return true;
      used[nextIndex] = false;
      groups.pop();
      return false;
    }
    for (let index = startIndex; index < sorted.length; index += 1) {
      if (used[index] || sorted[index] > need) continue;
      if (index > startIndex && sorted[index] === sorted[index - 1] && !used[index - 1]) continue;
      used[index] = true;
      group.push(sorted[index]);
      if (fill(need - sorted[index], index + 1, group)) return true;
      group.pop();
      used[index] = false;
    }
    return false;
  };

  used[0] = true;
  const seed = [sorted[0]];
  if (fill(10 - sorted[0], 1, seed)) return groups.concat(groups.length && groups.at(-1) === seed ? [] : []);
  return null;
}

// Makes a value list partitionable into tens with as few changes as
// possible: zero when it already is, otherwise one value rewritten (two in
// pathological cases). Returns { values, changed } or null.
export function repairValuesForPartition(input) {
  if (partitionIntoTens(input)) return { values: input.slice(), changed: 0 };
  for (let index = 0; index < input.length; index += 1) {
    for (let value = 1; value <= 9; value += 1) {
      if (value === input[index]) continue;
      const candidate = input.slice();
      candidate[index] = value;
      if (partitionIntoTens(candidate)) return { values: candidate, changed: 1 };
    }
  }
  if (input.length <= 6) {
    for (let a = 0; a < input.length; a += 1) {
      for (let b = a + 1; b < input.length; b += 1) {
        for (let va = 1; va <= 9; va += 1) {
          for (let vb = 1; vb <= 9; vb += 1) {
            const candidate = input.slice();
            candidate[a] = va;
            candidate[b] = vb;
            if (partitionIntoTens(candidate)) return { values: candidate, changed: 2 };
          }
        }
      }
    }
  }
  return null;
}

// Splits a value list into groups of the exact given sizes, each summing to
// ten. The rescue planner decides the geometry first (which cells form which
// selectable rectangle) and this solver then deals the values into it.
export function partitionIntoSizedTens(values, sizes) {
  const count = values.length;
  if (!sizes.length || sizes.reduce((sum, size) => sum + size, 0) !== count) return null;
  if (values.reduce((sum, value) => sum + value, 0) !== sizes.length * 10) return null;
  const sorted = values.slice().sort((a, b) => b - a);
  const groups = sizes.map((size) => ({ left: size, need: 10, values: [] }));
  let budget = 60000;

  const place = (index) => {
    if (budget <= 0) return false;
    budget -= 1;
    if (index === count) return groups.every((group) => group.left === 0);
    const value = sorted[index];
    const tried = new Set();
    for (const group of groups) {
      if (group.left <= 0 || group.need < value) continue;
      const remaining = group.left - 1;
      const rest = group.need - value;
      if (rest < remaining || rest > remaining * 9) continue;
      const signature = `${group.left}:${group.need}`;
      if (tried.has(signature)) continue;
      tried.add(signature);
      group.left = remaining;
      group.need = rest;
      group.values.push(value);
      if (place(index + 1)) return true;
      group.left = remaining + 1;
      group.need = rest + value;
      group.values.pop();
    }
    return false;
  };

  if (!place(0)) return null;
  return groups.map((group) => group.values.slice());
}

// Counts lines (rows and columns) that split entirely into two or more
// consecutive sum-ten runs — the "train" pattern a player clears by
// sweeping along one line without ever scanning the rest of the board.
// The generator penalizes boards that show these.
export function countTrainLines(grid) {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  const isTrain = (line) => {
    let acc = 0;
    let runs = 0;
    for (const value of line) {
      if (!(value > 0)) continue;
      acc += value;
      if (acc === 10) {
        acc = 0;
        runs += 1;
      } else if (acc > 10) return false;
    }
    return acc === 0 && runs >= 2;
  };
  let trains = 0;
  for (const row of grid) trains += isTrain(row) ? 1 : 0;
  for (let c = 0; c < cols; c += 1) {
    trains += isTrain(Array.from({ length: rows }, (_, r) => grid[r]?.[c] ?? 0)) ? 1 : 0;
  }
  return trains;
}

// The ladder holds each size for two stages (4x4 / 5x5 / 5x5 / 6x6 / 6x6 /
// 6x7), and a repeated size is exactly where the value mix must climb one
// step — that is the whole point of holding the size. The stage number
// itself is therefore the difficulty phase again; the remapping that the
// one-axis ladder needed is retired with that ladder.
export function difficultyPhaseForStage(stage = 1) {
  return Math.max(1, Math.round(Number(stage) || 1));
}

function pairWeightsForRound(round = 1) {
  const stage = difficultyPhaseForStage(round);
  if (stage === 1) return ORIGINAL_PAIR_WEIGHTS[0];
  if (stage <= 3) return ORIGINAL_PAIR_WEIGHTS[1];
  if (stage === 4) return ORIGINAL_PAIR_WEIGHTS[2];
  if (stage === 5) return ORIGINAL_PAIR_WEIGHTS[3];
  if (stage <= 7) return ORIGINAL_PAIR_WEIGHTS[4];
  return ORIGINAL_PAIR_WEIGHTS[5];
}

function apportionedPairCounts(unitCount, weights) {
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const exact = weights.map((weight) => (unitCount * weight) / totalWeight);
  const counts = exact.map(Math.floor);
  let left = unitCount - counts.reduce((sum, value) => sum + value, 0);
  exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
    .forEach(({ index }) => {
      if (left <= 0) return;
      counts[index] += 1;
      left -= 1;
    });
  return counts;
}

// Scales the original 110-number bag to the V2 board dimensions while keeping
// complementary values paired and the total sum divisible by ten.
export function numberBagForRound(numberCount, round = 1) {
  const count = Math.max(2, Math.round(Number(numberCount) || 2));
  const tripleUnits = tripleUnitCountForRound(count, round);
  const pairUnits = Math.max(0, (count - tripleUnits * 3) / 2);
  const bag = [];
  apportionedPairCounts(pairUnits, pairWeightsForRound(round)).forEach((units, index) => {
    for (let unit = 0; unit < units; unit += 1) bag.push(...COMPLEMENT_PAIRS[index]);
  });
  // The walk starts at a random point rather than at the stage number: a
  // fixed start made a stage's composition depend on where its index landed
  // in the table, so single stages swung between big-number and all-small
  // boards for no design reason. Walking consecutively from a random start
  // keeps one board's triples spread across the pool while every stage
  // averages out to the pool's own mix.
  const triples = tripleGroupsForRound(round);
  const start = Math.floor(Math.random() * triples.length);
  for (let unit = 0; unit < tripleUnits; unit += 1) {
    bag.push(...triples[(start + unit) % triples.length]);
  }
  return shuffleArray(bag);
}

export function tripleUnitCountForRound(numberCount, round = 1) {
  const count = Math.max(2, Math.round(Number(numberCount) || 2));
  const stage = difficultyPhaseForStage(round);
  const ratio = stage <= 2
    ? 0
    : stage === 3
      ? 0.16
      : stage === 4
        ? 0.24
        : stage === 5
          ? 0.32
          : stage <= 7
            ? 0.42
            : stage <= 9
              ? 0.55
              : 0.65;
  let units = Math.min(Math.floor(count / 3), Math.round((count * ratio) / 3));
  if (units % 2 !== count % 2) units += units * 3 + 3 <= count ? 1 : -1;
  return Math.max(0, units);
}

export function adjacentSeedCountForRound(round = 1) {
  const stage = difficultyPhaseForStage(round);
  if (stage === 1) return 4;
  if (stage === 2) return 3;
  if (stage === 3) return 2;
  if (stage === 4) return 1;
  return 0;
}

export function boardPacingForRound(round = 1, assist = 'standard') {
  const stage = difficultyPhaseForStage(round);
  // Bands calibrated to natural bag placements: a random complement-rich
  // board simply shows 4-6 adjacent pairs and 5-7 two-cell answers at any
  // stage, so the caps reflect that reality instead of an authored
  // composition. Train lines stay hard-capped — line sweeping must never
  // come back — and late difficulty rides on the value mix (triples) and
  // density, not on starving obvious pairs below what randomness allows.
  const base = stage === 1
    ? { targetAnswers: 6, maximumAnswers: 9, minimumAnswers: 4, maximumSimpleAnswers: 7, minimumAdjacentPairs: 3, maximumAdjacentPairs: 6, minimumRichAnswers: 1, minimumShapePatterns: 3, minimumValuePatterns: 4, minimumOrientations: 2, maximumTrainLines: 2, minimumBoxAnswers: 0 }
    : stage === 2
      ? { targetAnswers: 8, maximumAnswers: 12, minimumAnswers: 6, maximumSimpleAnswers: 7, minimumAdjacentPairs: 2, maximumAdjacentPairs: 6, minimumRichAnswers: 2, minimumShapePatterns: 4, minimumValuePatterns: 5, minimumOrientations: 2, maximumTrainLines: 1, minimumBoxAnswers: 0 }
      : stage === 3
        ? { targetAnswers: 10, maximumAnswers: 14, minimumAnswers: 7, maximumSimpleAnswers: 9, minimumAdjacentPairs: 1, maximumAdjacentPairs: 5, minimumRichAnswers: 3, minimumShapePatterns: 5, minimumValuePatterns: 5, minimumOrientations: 2, maximumTrainLines: 1, minimumBoxAnswers: 1 }
        : stage === 4
          ? { targetAnswers: 11, maximumAnswers: 16, minimumAnswers: 8, maximumSimpleAnswers: 9, minimumAdjacentPairs: 1, maximumAdjacentPairs: 5, minimumRichAnswers: 4, minimumShapePatterns: 5, minimumValuePatterns: 5, minimumOrientations: 2, maximumTrainLines: 1, minimumBoxAnswers: 1 }
          : stage === 5
            ? { targetAnswers: 12, maximumAnswers: 17, minimumAnswers: 9, maximumSimpleAnswers: 9, minimumAdjacentPairs: 0, maximumAdjacentPairs: 5, minimumRichAnswers: 5, minimumShapePatterns: 6, minimumValuePatterns: 6, minimumOrientations: 2, maximumTrainLines: 1, minimumBoxAnswers: 1 }
            : stage <= 7
              ? { targetAnswers: 12, maximumAnswers: 18, minimumAnswers: 9, maximumSimpleAnswers: 9, minimumAdjacentPairs: 0, maximumAdjacentPairs: 5, minimumRichAnswers: 6, minimumShapePatterns: 7, minimumValuePatterns: 7, minimumOrientations: 2, maximumTrainLines: 1, minimumBoxAnswers: 1 }
              : stage <= 9
                ? { targetAnswers: 13, maximumAnswers: 19, minimumAnswers: 9, maximumSimpleAnswers: 9, minimumAdjacentPairs: 0, maximumAdjacentPairs: 5, minimumRichAnswers: 7, minimumShapePatterns: 8, minimumValuePatterns: 8, minimumOrientations: 2, maximumTrainLines: 1, minimumBoxAnswers: 1 }
                : { targetAnswers: 14, maximumAnswers: 20, minimumAnswers: 10, maximumSimpleAnswers: 9, minimumAdjacentPairs: 0, maximumAdjacentPairs: 5, minimumRichAnswers: 8, minimumShapePatterns: 8, minimumValuePatterns: 8, minimumOrientations: 2, maximumTrainLines: 1, minimumBoxAnswers: 1 };
  const assistAdjacentBonus = assist === 'starter' ? 1 : 0;
  return Object.freeze({
    ...base,
    minimumAdjacentPairs: base.minimumAdjacentPairs + assistAdjacentBonus,
    minimumAnswerZones: stage <= 3 ? 3 : 4,
    maximumDominantCellShare: stage <= 2 ? 0.52 : stage <= 4 ? 0.46 : 0.4,
  });
}

export function analyzeAnswerSpread(grid, answers = findAllSumTenRects(grid)) {
  if (!answers.length) return Object.freeze({ answerZones: 0, dominantCellShare: 1 });
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  const zones = new Set();
  const cellCoverage = new Map();
  answers.forEach((answer) => {
    const centerRow = (answer.r1 + answer.r2 + 1) / (2 * Math.max(1, rows));
    const centerCol = (answer.c1 + answer.c2 + 1) / (2 * Math.max(1, cols));
    zones.add(`${centerRow >= 0.5 ? 1 : 0}:${centerCol >= 0.5 ? 1 : 0}`);
    cellsInRect(answer).forEach(({ r, c }) => {
      const key = cellKey(r, c);
      cellCoverage.set(key, (cellCoverage.get(key) || 0) + 1);
    });
  });
  return Object.freeze({
    answerZones: zones.size,
    dominantCellShare: Math.max(...cellCoverage.values()) / answers.length,
  });
}

export function analyzeAnswerDiversity(grid, answers = findAllSumTenRects(grid)) {
  const shapePatterns = new Set();
  const valuePatterns = new Set();
  const orientations = new Set();
  answers.forEach((answer) => {
    const height = answer.r2 - answer.r1 + 1;
    const width = answer.c2 - answer.c1 + 1;
    shapePatterns.add(`${height}x${width}:${answer.count}`);
    orientations.add(height === 1 ? 'horizontal' : width === 1 ? 'vertical' : 'box');
    const values = cellsInRect(answer)
      .map(({ r, c }) => grid[r]?.[c] ?? 0)
      .filter((value) => value > 0)
      .sort((a, b) => a - b);
    valuePatterns.add(values.join('+'));
  });
  return Object.freeze({
    shapePatterns: shapePatterns.size,
    valuePatterns: valuePatterns.size,
    orientations: orientations.size,
  });
}

function answerMix(grid, answers) {
  const diversity = analyzeAnswerDiversity(grid, answers);
  const spread = analyzeAnswerSpread(grid, answers);
  let horizontal = 0;
  let vertical = 0;
  let box = 0;
  answers.forEach((answer) => {
    const height = answer.r2 - answer.r1 + 1;
    const width = answer.c2 - answer.c1 + 1;
    if (height >= 2 && width >= 2) box += 1;
    else if (height === 1) horizontal += 1;
    else vertical += 1;
  });
  return {
    total: answers.length,
    simple: answers.filter((answer) => answer.count === 2).length,
    adjacent: answers.filter(isAdjacentPair).length,
    rich: answers.filter((answer) => answer.count >= 3).length,
    horizontal,
    vertical,
    box,
    trainLines: countTrainLines(grid),
    ...diversity,
    ...spread,
  };
}

function pacingPenalty(mix, pacing) {
  const below = (value, minimum) => Math.max(0, minimum - value);
  const above = (value, maximum) => Math.max(0, value - maximum);
  // A board where one direction dominates the 1D answers reads as stripes;
  // the imbalance term pushes candidates toward a mixed reading direction.
  const oneD = mix.horizontal + mix.vertical;
  const imbalance = oneD ? Math.abs(mix.horizontal - mix.vertical) / oneD : 0;
  return Math.abs(mix.total - pacing.targetAnswers)
    + below(mix.total, pacing.minimumAnswers) * 18
    + above(mix.total, pacing.maximumAnswers) * 5
    + above(mix.simple, pacing.maximumSimpleAnswers) * 16
    + below(mix.adjacent, pacing.minimumAdjacentPairs) * 14
    + above(mix.adjacent, pacing.maximumAdjacentPairs) * 18
    + below(mix.rich, pacing.minimumRichAnswers) * 14
    + below(mix.shapePatterns, pacing.minimumShapePatterns) * 10
    + below(mix.valuePatterns, pacing.minimumValuePatterns) * 12
    + below(mix.orientations, pacing.minimumOrientations) * 34
    + below(mix.answerZones, pacing.minimumAnswerZones) * 22
    + above(mix.dominantCellShare, pacing.maximumDominantCellShare) * 80
    + above(mix.trainLines, pacing.maximumTrainLines) * 40
    + below(mix.box, pacing.minimumBoxAnswers) * 22
    + above(imbalance, 0.55) * 70;
}

// ── Natural generation ────────────────────────────────────────────────
// The board is a plain random placement of the original OING number bag —
// no planted sum-ten blocks, no tiling, no backbone. Full clearability is
// then earned, not designed in: a failure-guided local search permutes
// cell positions (never values, so the value histogram stays exactly the
// natural bag's) until plan-blind human-like play finishes the board most
// of the time. Acceptance is capped by adjacent-pair and train-line
// limits, so the search cannot quietly rebuild an authored-looking board.

function makeNaturalGrid(rows, cols, round, catTarget) {
  const cats = new Set();
  while (cats.size < catTarget) {
    cats.add(cellKey(Math.floor(Math.random() * rows), Math.floor(Math.random() * cols)));
  }
  const bag = numberBagForRound(rows * cols - catTarget, round);
  let index = 0;
  const grid = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => (
    cats.has(cellKey(r, c)) ? null : bag[index++]
  )));
  return { grid, cats };
}

function adjacentPairCount(grid) {
  let count = 0;
  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < (grid[row]?.length || 0); col += 1) {
      const value = grid[row][col];
      if (!(value > 0)) continue;
      if ((grid[row]?.[col + 1] ?? 0) > 0 && value + grid[row][col + 1] === 10) count += 1;
      if ((grid[row + 1]?.[col] ?? 0) > 0 && value + grid[row + 1][col] === 10) count += 1;
    }
  }
  return count;
}

// How a human eye ranks the visible answers: adjacent pairs jump out
// first, one-line runs next, 2D boxes last. Shared by the rollouts here
// and the human-like balance agent.
function pickAnswerLikeHuman(answers) {
  let total = 0;
  const weights = answers.map((answer) => {
    const height = answer.r2 - answer.r1 + 1;
    const width = answer.c2 - answer.c1 + 1;
    const weight = (answer.count === 2 && height * width === 2) ? 2.4
      : (height >= 2 && width >= 2) ? 0.9
        : answer.count === 2 ? 1.6 : 1.1;
    total += weight;
    return weight;
  });
  let roll = Math.random() * total;
  for (let index = 0; index < answers.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return answers[index];
  }
  return answers.at(-1);
}

// One no-lookahead rollout: keep committing legal answers a plan-blind
// player would pick until the board dries up. Records the sequence, so a
// successful rollout doubles as a constructive full-clear certificate.
export function rolloutClearOnce(sourceGrid, sourceCats = new Set(), picker = pickAnswerLikeHuman) {
  const grid = sourceGrid.map((row) => row.slice());
  const cats = new Set(sourceCats);
  const total = grid.flat().filter((value) => value > 0).length + cats.size;
  const sequence = [];
  const stranded = [];
  let removed = 0;
  while (true) {
    const answers = findAllSumTenRects(grid);
    if (!answers.length) break;
    const pick = picker(answers);
    sequence.push({ r1: pick.r1, c1: pick.c1, r2: pick.r2, c2: pick.c2 });
    for (let r = pick.r1; r <= pick.r2; r += 1) {
      for (let c = pick.c1; c <= pick.c2; c += 1) {
        if (grid[r][c] > 0) removed += 1;
        grid[r][c] = null;
        if (cats.delete(cellKey(r, c))) removed += 1;
      }
    }
  }
  grid.forEach((row, r) => row.forEach((value, c) => {
    if (value > 0) stranded.push({ r, c });
  }));
  const remaining = stranded.length + cats.size;
  return {
    fullClear: remaining === 0,
    remaining,
    stranded,
    sequence,
    clearedShare: total ? removed / total : 1,
  };
}

// Keep in sync with SOFT_CLEAR_MAX_TAIL in data.js: a dead end at or
// below this many remaining cells resolves as a soft sweep in the game,
// so a rollout landing there counts as a smooth finish, not a failure.
const SOFT_CLEAR_TAIL = 6;

function robustnessScore(grid, cats, tries = 6) {
  let fullClears = 0;
  let smoothFinishes = 0;
  let clearedShare = 0;
  let certificate = null;
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const result = rolloutClearOnce(grid, cats);
    if (result.fullClear && !certificate) certificate = result.sequence;
    fullClears += result.fullClear ? 1 : 0;
    smoothFinishes += (result.fullClear || result.remaining <= SOFT_CLEAR_TAIL) ? 1 : 0;
    clearedShare += result.clearedShare;
  }
  return {
    fullClearRate: fullClears / tries,
    smoothRate: smoothFinishes / tries,
    clearedShare: clearedShare / tries,
    certificate,
  };
}

// Bounded DFS full-clear solver over the real game rules (rectangle
// selection, sum ten, cats count zero but must be collected). Returns a
// clearing sequence or null within the node budget. Used as the backup
// certificate when no rollout happened to finish, and by tests.
export function solveFullClear(sourceGrid, sourceCats = new Set(), budget = 4000) {
  const grid = sourceGrid.map((row) => row.slice());
  const cats = new Set(sourceCats);
  const failed = new Set();
  const sequence = [];
  let nodes = budget;

  const stateKey = () => grid.flat().map((value) => (value > 0 ? value : 0)).join('') + '|' + [...cats].sort().join(',');
  const empty = () => grid.flat().every((value) => !(value > 0)) && cats.size === 0;

  const search = () => {
    if (empty()) return true;
    if (nodes <= 0) return false;
    nodes -= 1;
    const key = stateKey();
    if (failed.has(key)) return false;
    const answers = shuffleArray(findAllSumTenRects(grid));
    for (const answer of answers) {
      const removedCells = [];
      const removedCats = [];
      for (let r = answer.r1; r <= answer.r2; r += 1) {
        for (let c = answer.c1; c <= answer.c2; c += 1) {
          if (grid[r][c] > 0) {
            removedCells.push({ r, c, value: grid[r][c] });
            grid[r][c] = null;
          }
          const catKey = cellKey(r, c);
          if (cats.delete(catKey)) removedCats.push(catKey);
        }
      }
      sequence.push({ r1: answer.r1, c1: answer.c1, r2: answer.r2, c2: answer.c2 });
      if (search()) return true;
      sequence.pop();
      removedCells.forEach(({ r, c, value }) => { grid[r][c] = value; });
      removedCats.forEach((catKey) => cats.add(catKey));
    }
    failed.add(key);
    return false;
  };

  return search() ? sequence : null;
}

// Failure-guided local search: run a blind rollout, find where it
// strands, and nudge the arrangement — pull a complement next to a
// stranded cell, or swap the stranded cell somewhere else. Only positions
// ever move; the value multiset stays the natural bag. Moves that push
// the board over its adjacent-pair or train-line caps are rejected, so
// the search cannot converge back to an authored-looking layout.
function optimizeNaturalBoard(grid, cats, round, pacing, iterationBudget, targetRate) {
  const cells = [];
  grid.forEach((row, r) => row.forEach((value, c) => {
    if (value > 0) cells.push({ r, c });
  }));
  // The productive move is exactly "put a complement near a stranded
  // value", which raises obvious adjacency — the measured trade-off is
  // steep (uncapped search nearly triples adjacent pairs for +0.3 clear
  // rate). cap+2 is the compromise: some earned robustness, no domino
  // field.
  const withinCaps = () => adjacentPairCount(grid) <= pacing.maximumAdjacentPairs + 2
    && countTrainLines(grid) <= pacing.maximumTrainLines + 1;
  // A full clear scores 1 and a soft-clearable tail (the game sweeps it)
  // scores 0.65, so the search still prefers true clears — CLEAN CLEAR
  // must stay reachable — while a tiny leftover no longer reads as a
  // failed board.
  const rate = (tries) => {
    let score = 0;
    for (let attempt = 0; attempt < tries; attempt += 1) {
      const roll = rolloutClearOnce(grid, cats);
      score += roll.fullClear ? 1 : roll.remaining <= SOFT_CLEAR_TAIL ? 0.65 : 0;
    }
    return score / tries;
  };
  const swap = (a, b) => {
    const tmp = grid[a.r][a.c];
    grid[a.r][a.c] = grid[b.r][b.c];
    grid[b.r][b.c] = tmp;
  };

  // A fresh natural placement can start above the adjacent-pair cap, and
  // withinCaps would then freeze the search (every move rejected). Break
  // obvious pairs down to the cap first by pushing one member elsewhere.
  for (let attempt = 0; attempt < 60 && adjacentPairCount(grid) > pacing.maximumAdjacentPairs; attempt += 1) {
    const first = cells[Math.floor(Math.random() * cells.length)];
    const neighbours = cells.filter(({ r, c }) => Math.abs(r - first.r) + Math.abs(c - first.c) === 1
      && grid[first.r][first.c] + grid[r][c] === 10);
    if (!neighbours.length) continue;
    const second = cells[Math.floor(Math.random() * cells.length)];
    if (first.r === second.r && first.c === second.c) continue;
    const before = adjacentPairCount(grid);
    swap(first, second);
    if (adjacentPairCount(grid) >= before) swap(first, second);
  }

  // Iteration-bounded (not wall-clock) so a seeded Math.random reproduces
  // the exact same board — the balance simulator depends on that.
  let current = rate(3);
  for (let iteration = 0; iteration < iterationBudget && current < targetRate; iteration += 1) {
    const trace = rolloutClearOnce(grid, cats);
    if (trace.fullClear || !trace.stranded.length) {
      current = Math.min(1, current + 0.15);
      continue;
    }
    const strandedCell = trace.stranded[Math.floor(Math.random() * trace.stranded.length)];
    let first = null;
    let second = null;
    if (Math.random() < 0.65) {
      // Bring a complement of the stranded value into its neighbourhood.
      const want = 10 - grid[strandedCell.r][strandedCell.c];
      const donors = cells.filter(({ r, c }) => grid[r][c] === want
        && !(r === strandedCell.r && c === strandedCell.c)
        && !trace.stranded.some((cell) => cell.r === r && cell.c === c));
      const neighbours = cells.filter(({ r, c }) => Math.abs(r - strandedCell.r) + Math.abs(c - strandedCell.c) === 1);
      if (donors.length && neighbours.length) {
        first = donors[Math.floor(Math.random() * donors.length)];
        second = neighbours[Math.floor(Math.random() * neighbours.length)];
      }
    }
    if (!first) {
      first = strandedCell;
      second = cells[Math.floor(Math.random() * cells.length)];
    }
    if (first.r === second.r && first.c === second.c) continue;
    swap(first, second);
    if (!withinCaps()) {
      swap(first, second);
      continue;
    }
    const next = rate(3);
    if (next >= current) current = next;
    else swap(first, second);
    // Three samples quantize to thirds, so "one lucky clear" can fake a
    // met target — confirm before stopping, and keep climbing otherwise.
    if (current >= targetRate) {
      const confirmed = rate(5);
      if (confirmed < targetRate) current = Math.min(current, confirmed);
      else current = confirmed;
    }
  }
  return current;
}

function isAdjacentPair(answer) {
  return answer.count === 2 && (answer.r2 - answer.r1 + 1) * (answer.c2 - answer.c1 + 1) === 2;
}

const cellKey = (row, col) => `${row}:${col}`;

export function bonusCatTargetForSize(size) {
  return bonusCatTargetForDimensions(size, size);
}

// Late boards carry one cat more than the flat ratio used to give them:
// with only three on a 36-42 cell board they were background decoration,
// collected in passing. A fourth cat measurably turns cat-aware play into
// a rewarded strategy (chasing them raises the PERFECT rate instead of
// costing it), while five made stranding so common that PERFECT suffered
// — measured, not guessed. The learning sizes keep their light sprinkle.
export function bonusCatTargetForDimensions(rows, cols = rows) {
  const cells = Math.max(1, Math.round(rows)) * Math.max(1, Math.round(cols));
  if (cells <= 16) return 1;
  if (cells <= 25) return 2;
  if (cells <= 36) return 4;
  return 4;
}

export function normalizeRect(a, b) {
  return {
    r1: Math.min(a.r, b.r),
    r2: Math.max(a.r, b.r),
    c1: Math.min(a.c, b.c),
    c2: Math.max(a.c, b.c),
  };
}

function boardDimensions(sizeOrDimensions) {
  if (typeof sizeOrDimensions === 'number') {
    const size = Math.max(1, Math.round(sizeOrDimensions));
    return { rows: size, cols: size };
  }
  return {
    rows: Math.max(1, Math.round(sizeOrDimensions?.rows || 1)),
    cols: Math.max(1, Math.round(sizeOrDimensions?.cols || 1)),
  };
}

export function bombRect(sizeOrDimensions, row, col) {
  const { rows, cols } = boardDimensions(sizeOrDimensions);
  return {
    r1: Math.max(0, row - 1),
    r2: Math.min(rows - 1, row + 1),
    c1: Math.max(0, col - 1),
    c2: Math.min(cols - 1, col + 1),
  };
}

export function megaBombRect(sizeOrDimensions, row, col) {
  const { rows, cols } = boardDimensions(sizeOrDimensions);
  return {
    r1: Math.max(0, row - 2),
    r2: Math.min(rows - 1, row + 2),
    c1: Math.max(0, col - 2),
    c2: Math.min(cols - 1, col + 2),
  };
}

export function megaBombCells(grid, row, col, limit = 12) {
  const rect = megaBombRect({ rows: grid.length, cols: grid[0]?.length || 0 }, row, col);
  return cellsInRect(rect)
    .filter(({ r, c }) => (grid[r]?.[c] ?? 0) > 0)
    .sort((a, b) => {
      const distanceA = Math.abs(a.r - row) + Math.abs(a.c - col);
      const distanceB = Math.abs(b.r - row) + Math.abs(b.c - col);
      return distanceA - distanceB || a.r - b.r || a.c - b.c;
    })
    .slice(0, Math.max(0, limit));
}

export function cellListStats(grid, cells) {
  return cells.reduce((stats, { r, c }) => {
    const value = grid[r]?.[c] ?? 0;
    if (value > 0) {
      stats.sum += value;
      stats.count += 1;
    }
    return stats;
  }, { sum: 0, count: 0 });
}

export function findBestBombTarget(grid, maximumCells = 6) {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  const limit = Math.max(1, Math.round(Number(maximumCells) || 6));
  let best = null;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const rect = bombRect({ rows, cols }, row, col);
      const stats = rectStats(grid, rect);
      if (stats.count === 0 || stats.count > limit) continue;
      const value = stats.count * 100 + stats.sum;
      if (!best || value > best.value) best = { row, col, rect, stats, value };
    }
  }
  if (!best) return null;
  const { value: _value, ...target } = best;
  return target;
}

export function rectKey(rect) {
  return `${rect.r1}:${rect.c1}:${rect.r2}:${rect.c2}`;
}

export function cellsInRect(rect) {
  const cells = [];
  for (let r = rect.r1; r <= rect.r2; r += 1) {
    for (let c = rect.c1; c <= rect.c2; c += 1) cells.push({ r, c });
  }
  return cells;
}

export function rectStats(grid, rect) {
  let sum = 0;
  let count = 0;
  for (let r = rect.r1; r <= rect.r2; r += 1) {
    for (let c = rect.c1; c <= rect.c2; c += 1) {
      const value = grid[r]?.[c] ?? 0;
      sum += value;
      if (value > 0) count += 1;
    }
  }
  return { sum, count };
}

export function findAllSumTenRects(grid) {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  const answers = [];
  for (let r1 = 0; r1 < rows; r1 += 1) {
    for (let c1 = 0; c1 < cols; c1 += 1) {
      for (let r2 = r1; r2 < rows; r2 += 1) {
        for (let c2 = c1; c2 < cols; c2 += 1) {
          const rect = { r1, c1, r2, c2 };
          const stats = rectStats(grid, rect);
          if (stats.sum === 10 && stats.count >= 2) answers.push({ ...rect, count: stats.count });
        }
      }
    }
  }
  return answers;
}

function shuffleArray(values) {
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

function slotRect(slot) {
  return {
    r1: Math.min(...slot.cells.map(({ r }) => r)),
    r2: Math.max(...slot.cells.map(({ r }) => r)),
    c1: Math.min(...slot.cells.map(({ c }) => c)),
    c2: Math.max(...slot.cells.map(({ c }) => c)),
  };
}

// Splits `count` cells into exactly `runs` consecutive runs of 2..9 cells.
function runSizesFor(count, runs) {
  if (runs < 1 || count < runs * 2 || count > runs * 9) return null;
  const sizes = new Array(runs).fill(2);
  let left = count - runs * 2;
  for (let index = 0; index < runs && left > 0; index += 1) {
    const add = Math.min(7, left);
    sizes[index] += add;
    left -= add;
  }
  return shuffleArray(sizes);
}

// Plans a rescue layout over the remaining cells: which cells form which
// sum-ten group, such that clearing the groups in the returned order is
// always geometrically possible. Two group shapes are used, both provably
// clean at their turn:
//  - a run of consecutive occupied cells inside one row (its rectangle can
//    contain only holes and its own members, so it is selectable anytime);
//  - an endgame group of rows holding a single cell each, taken over
//    consecutive such rows and cleared after every row run (by then its
//    rectangle spans only its own members). A lone single instead borrows
//    partners from the nearest multi-cell row and clears last.
// Values are only rearranged when possible; when the totals cannot make
// groups of ten (bomb debris), the fewest possible values are rewritten.
// Returns { slots, changed } or null; cells never move, holes stay holes.
export function planRescueLayout(cells, values) {
  const count = cells.length;
  if (count < 2 || values.length !== count) return null;
  const byRow = new Map();
  cells.forEach((cell) => {
    if (!byRow.has(cell.r)) byRow.set(cell.r, []);
    byRow.get(cell.r).push({ r: cell.r, c: cell.c });
  });
  const rowNumbers = [...byRow.keys()].sort((a, b) => a - b);
  rowNumbers.forEach((row) => byRow.get(row).sort((a, b) => a.c - b.c));
  let singles = rowNumbers.filter((row) => byRow.get(row).length === 1).map((row) => byRow.get(row)[0]);

  // A lone single cannot make ten by itself and has no partner row of its
  // own kind, so it steals one or two partners from the nearest full row.
  let donorSlot = null;
  if (singles.length === 1) {
    const single = singles[0];
    const donorRow = rowNumbers
      .filter((row) => byRow.get(row).length >= 2)
      .sort((a, b) => Math.abs(a - single.r) - Math.abs(b - single.r) || a - b)[0];
    if (donorRow === undefined) return null;
    const donorCells = byRow.get(donorRow);
    if (donorCells.length === 2) {
      donorSlot = { cells: [single, ...donorCells] };
      byRow.set(donorRow, []);
    } else {
      const donor = donorCells.slice().sort((a, b) => Math.abs(a.c - single.c) - Math.abs(b.c - single.c) || a.c - b.c)[0];
      byRow.set(donorRow, donorCells.filter((cell) => cell !== donor));
      donorSlot = { cells: [single, donor] };
    }
    singles = [];
  }

  const endgame = [];
  if (singles.length >= 2) {
    const queue = singles.slice();
    if (queue.length % 2 === 1) endgame.push({ cells: queue.splice(0, 3) });
    while (queue.length) endgame.push({ cells: queue.splice(0, 2) });
  }
  if (donorSlot) endgame.push(donorSlot);

  const rowInfos = rowNumbers
    .map((row) => ({ cells: byRow.get(row) }))
    .filter((info) => info.cells.length >= 2);
  const minRuns = rowInfos.reduce((sum, info) => sum + Math.ceil(info.cells.length / 9), 0);
  const maxRuns = rowInfos.reduce((sum, info) => sum + Math.floor(info.cells.length / 2), 0);
  const fixed = endgame.length;
  if (fixed + maxRuns === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  const preferred = Math.min(fixed + maxRuns, Math.max(fixed + minRuns, Math.round(total / 10)));
  const targets = [...new Set([preferred, preferred - 1, preferred + 1, preferred - 2, preferred + 2])]
    .filter((target) => target >= fixed + minRuns && target <= fixed + maxRuns);

  // Distributes the row runs to reach the target group count, then deals
  // the values into the resulting sizes.
  const attemptDeal = (target, working, changed) => {
    for (let variant = 0; variant < 4; variant += 1) {
      let runsLeft = target - fixed;
      const slots = [];
      let feasible = true;
      for (let index = 0; index < rowInfos.length && feasible; index += 1) {
        const info = rowInfos[index];
        const rest = rowInfos.slice(index + 1);
        const restMin = rest.reduce((sum, other) => sum + Math.ceil(other.cells.length / 9), 0);
        const restMax = rest.reduce((sum, other) => sum + Math.floor(other.cells.length / 2), 0);
        const low = Math.max(Math.ceil(info.cells.length / 9), runsLeft - restMax);
        const high = Math.min(Math.floor(info.cells.length / 2), runsLeft - restMin);
        if (low > high) { feasible = false; break; }
        const bias = [2.5, 2, 3, 4][variant];
        const runs = Math.min(high, Math.max(low, Math.round(info.cells.length / bias)));
        const sizes = runSizesFor(info.cells.length, runs);
        if (!sizes) { feasible = false; break; }
        let cursor = 0;
        sizes.forEach((size) => {
          slots.push({ cells: info.cells.slice(cursor, cursor + size) });
          cursor += size;
        });
        runsLeft -= runs;
      }
      if (!feasible || runsLeft !== 0) continue;
      slots.push(...endgame.map((slot) => ({ cells: slot.cells })));
      const groups = partitionIntoSizedTens(working, slots.map((slot) => slot.cells.length));
      if (!groups) continue;
      groups.forEach((group, index) => { slots[index].values = shuffleArray(group.slice()); });
      return { slots, changed };
    }
    return null;
  };

  for (const target of targets) {
    // Steer the total to target*10 with the fewest value edits — none when
    // the values already fit. Editing the highest-capacity cells first
    // keeps the edit count minimal (each edit moves the total by up to
    // ±8); rotations then try other edit positions when the dealt values
    // refuse to split. Bomb debris of all-high values can genuinely
    // require rewriting most of a tiny tail (9+9+9 has no sum-ten split
    // under any layout), which still beats sweeping the cells away.
    const delta0 = target * 10 - total;
    const order = values.map((_, index) => index).sort((a, b) => (
      delta0 > 0 ? (values[a] - values[b]) : (values[b] - values[a])
    ));
    const rotations = delta0 === 0 ? 1 : Math.min(order.length, 6);
    // Full-width edits use the fewest cells but can flood the tail with
    // nines that no longer pair with anything; smaller caps spread the
    // same delta across more cells, producing friendlier multisets.
    const caps = delta0 === 0 ? [8] : [8, 5, 3];
    let steered = null;
    for (const cap of caps) {
      for (let rotation = 0; rotation < rotations; rotation += 1) {
        const working = values.slice();
        let delta = delta0;
        let changed = 0;
        for (let step = 0; delta !== 0 && step < order.length; step += 1) {
          const index = order[(step + rotation) % order.length];
          const value = working[index];
          const move = delta > 0
            ? Math.min(delta, cap, 9 - value)
            : Math.max(delta, -cap, 1 - value);
          if (move === 0) continue;
          working[index] = value + move;
          delta -= move;
          changed += 1;
        }
        if (delta !== 0) continue;
        if (!steered) steered = { working: working.slice(), changed };
        const dealt = attemptDeal(target, working, changed);
        if (dealt) return dealt;
      }
    }

    // Escalation: the total already fits but the multiset refuses these
    // group sizes — shift weight between two cells (total preserved) until
    // a split appears.
    if (steered) {
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const working = steered.working.slice();
        const from = Math.floor(Math.random() * count);
        const to = Math.floor(Math.random() * count);
        if (from === to) continue;
        const shift = 1 + Math.floor(Math.random() * 8);
        if (working[to] + shift > 9 || working[from] - shift < 1) continue;
        working[to] += shift;
        working[from] -= shift;
        const dealt = attemptDeal(target, working, steered.changed + 2);
        if (dealt) return dealt;
      }
    }
  }
  return null;
}

export class BoardModel {
  constructor(size = 4) {
    this.size = size;
    this.cols = size;
    this.rows = size;
    this.grid = [];
    this.bonusCats = new Set();
    this.specialTiles = new Map();
    this.round = 1;
    this.lastClearPlan = null;
    this.lastBlindClearRate = 0;
    this.generate(size);
  }

  generate(size = this.size, options = {}) {
    this.size = size;
    this.cols = Math.max(1, Math.round(options.cols || size));
    this.rows = Math.max(1, Math.round(options.rows || this.cols));
    this.size = this.cols;
    this.specialTiles.clear();
    const round = Math.max(1, Math.round(Number(options.round) || 1));
    this.round = round;
    const assist = options.assist || (options.easy ? 'guided' : 'standard');
    const catTarget = bonusCatTargetForDimensions(this.rows, this.cols);
    const pacing = boardPacingForRound(round, assist);
    // Natural board first, certification after: place the original number
    // bag at random, then let the failure-guided search raise the blind
    // full-clear rate to the stage's target within a hard time budget.
    // The board the player sees keeps the bag's value distribution and
    // stays inside the adjacent-pair/train caps — random to the eye,
    // mostly finishable underneath.
    const stage = difficultyPhaseForStage(round);
    // Targets follow the soft-clear game loop: a rollout that reaches a
    // sweepable tail counts 0.65 and a true full clear 1, so the search
    // chases boards where blind play ends smoothly and still prefers real
    // clears. Rescue is only the > tail case, which this directly minimizes.
    const targetRate = stage <= 1 ? 0.85 : stage <= 3 ? 0.75 : stage <= 5 ? 0.62 : 0.55;
    const cellCount = this.rows * this.cols;
    // Large boards pay 3-4x more per iteration (bigger rect enumeration),
    // so they get a smaller budget: the soft-clear loop tolerates a lower
    // smooth rate better than a 400ms stage transition.
    let budget = cellCount <= 16 ? 60 : cellCount <= 25 ? 80 : 70;
    const catsCollectable = (grid, cats) => {
      const answers = findAllSumTenRects(grid);
      return answers.length > 0 && [...cats].every((key) => {
        const [row, col] = key.split(':').map(Number);
        return answers.some((answer) => row >= answer.r1 && row <= answer.r2
          && col >= answer.c1 && col <= answer.c2);
      });
    };
    let best = null;
    for (let restart = 0; restart < 4 && budget >= 10; restart += 1) {
      const candidate = makeNaturalGrid(this.rows, this.cols, round, catTarget);
      if (!candidate || !findAllSumTenRects(candidate.grid).length) continue;
      const slice = Math.max(15, Math.ceil(budget * 0.55));
      optimizeNaturalBoard(candidate.grid, candidate.cats, round, pacing, slice, targetRate);
      budget -= slice;
      // The optimizer moves values around, so the cat check comes after.
      if (!catsCollectable(candidate.grid, candidate.cats)) continue;
      const confirmed = robustnessScore(candidate.grid, candidate.cats, 6);
      const answers = findAllSumTenRects(candidate.grid);
      const mix = answerMix(candidate.grid, answers);
      // A cat covered by only a few answers is a destination — the player
      // must find and choose that combo to collect it. A cat sitting under
      // six answers is collected by accident and directs nothing, so only
      // the focused kind scores.
      let focusedCats = 0;
      for (const key of candidate.cats) {
        const [row, col] = key.split(':').map(Number);
        const coverage = answers.filter((answer) => row >= answer.r1 && row <= answer.r2
          && col >= answer.c1 && col <= answer.c2).length;
        if (coverage >= 1 && coverage <= 3) focusedCats += 1;
      }
      const score = confirmed.fullClearRate * 60 + confirmed.smoothRate * 60
        + confirmed.clearedShare * 20 + focusedCats * 5
        - pacingPenalty(mix, pacing) * 0.3;
      if (!best || score > best.score) {
        best = { candidate, score, rate: confirmed.smoothRate, certificate: confirmed.certificate };
      }
      if (best.rate >= targetRate) break;
    }
    // A board no blind rollout ever finished must not ship if avoidable:
    // some natural multisets are genuinely near-unclearable, so keep
    // drawing fresh bags until one takes to optimization.
    for (let emergency = 0; emergency < 2 && (!best || best.rate === 0); emergency += 1) {
      const retry = makeNaturalGrid(this.rows, this.cols, round, catTarget);
      if (!retry || !findAllSumTenRects(retry.grid).length) continue;
      optimizeNaturalBoard(retry.grid, retry.cats, round, pacing, 20, targetRate);
      if (!catsCollectable(retry.grid, retry.cats)) continue;
      const confirmed = robustnessScore(retry.grid, retry.cats, 6);
      if (confirmed.smoothRate > 0) {
        best = { candidate: retry, rate: confirmed.smoothRate, certificate: confirmed.certificate };
      }
    }
    if (best) {
      this.grid = best.candidate.grid;
      this.bonusCats = best.candidate.cats;
      // A successful rollout is a constructive certificate; when none of
      // the confirm rollouts finished, the bounded solver looks for one.
      this.lastClearPlan = best.certificate
        || solveFullClear(this.grid, this.bonusCats, 2500);
      this.lastBlindClearRate = best.rate;
      return this.grid;
    }

    // Safety fallback: a plain natural board with collectable cats. The
    // rescue shuffle remains the runtime safety net for whatever play
    // does to it.
    while (true) {
      const candidate = makeNaturalGrid(this.rows, this.cols, round, catTarget);
      if (!candidate || candidate.cats.size !== catTarget) continue;
      if (!catsCollectable(candidate.grid, candidate.cats)) continue;
      this.grid = candidate.grid;
      this.bonusCats = candidate.cats;
      this.lastClearPlan = solveFullClear(this.grid, this.bonusCats, 900);
      this.lastBlindClearRate = 0;
      return this.grid;
    }
  }

  // Classic mode board: the natural number bag placed at random, nothing
  // engineered on top. 판갈이 is the loop's safety net, so there is no
  // clearability target to certify — the only gate is that the opening
  // board has enough to find — and the whole thing must return instantly,
  // because board changes happen while the timer keeps running.
  generateClassic(cols, rows = cols, round = 1, options = {}) {
    this.cols = Math.max(1, Math.round(cols));
    this.rows = Math.max(1, Math.round(rows));
    this.size = this.cols;
    this.specialTiles.clear();
    this.round = Math.max(1, Math.round(Number(round) || 1));
    const baseCatTarget = bonusCatTargetForDimensions(this.rows, this.cols);
    const catMultiplier = Math.max(1, Math.round(Number(options?.catMultiplier) || 1));
    const catTarget = Math.min(this.rows * this.cols - 4, baseCatTarget * catMultiplier);
    const isLearningBoard = this.cols === 6 && this.rows <= 6;
    const wanted = Math.max(
      4,
      Math.round((this.rows * this.cols) / 9),
      isLearningBoard ? 8 : 0,
    );
    const wantedMultiCell = isLearningBoard ? 3 : 0;
    const maxAttempts = isLearningBoard ? 96 : 24;
    let best = null;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const candidate = makeNaturalGrid(this.rows, this.cols, this.round, catTarget);
      const answerRects = findAllSumTenRects(candidate.grid);
      const answers = answerRects.length;
      const multiCell = answerRects.filter((answer) => answer.count >= 3).length;
      const targetCoverage = Math.min(answers, wanted)
        + Math.min(multiCell, wantedMultiCell) * wanted;
      if (!best
        || targetCoverage > best.targetCoverage
        || (targetCoverage === best.targetCoverage && answers > best.answers)) {
        best = { candidate, answers, multiCell, targetCoverage };
      }
      if (answers >= wanted && multiCell >= wantedMultiCell) break;
    }
    this.grid = best.candidate.grid;
    this.bonusCats = best.candidate.cats;
    this.lastClearPlan = null;
    this.lastBlindClearRate = 0;
    return this.grid;
  }

  valueAt(r, c) {
    return this.grid[r]?.[c] ?? 0;
  }

  hasBonusCat(r, c) {
    return (this.grid[r]?.[c] ?? null) === null && this.bonusCats.has(cellKey(r, c));
  }

  specialAt(r, c) {
    return this.specialTiles.get(cellKey(r, c)) || null;
  }

  assignSpecialTiles(types = [], random = Math.random) {
    // Bomb is the only special tile the board places; the clock tile was
    // retired along with its stage chance, badge and aria copy.
    const requested = Array.isArray(types) ? types.filter((type) => type === 'bomb') : [];
    this.specialTiles.clear();
    if (!requested.length) return [];
    const answers = this.findAnswers();
    const candidates = [];
    answers.forEach((answer) => {
      cellsInRect(answer).forEach(({ r, c }) => {
        if ((this.grid[r]?.[c] ?? 0) <= 0) return;
        const key = cellKey(r, c);
        if (!candidates.some((candidate) => candidate.key === key)) candidates.push({ r, c, key });
      });
    });
    const available = candidates.slice();
    const placed = [];
    requested.forEach((type) => {
      if (!available.length) return;
      const index = Math.min(available.length - 1, Math.floor(Math.max(0, random()) * available.length));
      const [cell] = available.splice(index, 1);
      this.specialTiles.set(cell.key, type);
      placed.push({ ...cell, type });
    });
    return placed;
  }

  stats(rect) {
    const stats = rectStats(this.grid, rect);
    const catCount = cellsInRect(rect).reduce(
      (count, { r, c }) => count + (this.hasBonusCat(r, c) ? 1 : 0),
      0,
    );
    const specials = cellsInRect(rect)
      .map(({ r, c }) => ({ r, c, type: this.specialAt(r, c) }))
      .filter(({ type }) => Boolean(type));
    return { ...stats, catCount, specials };
  }

  remove(rect) {
    let removed = 0;
    for (const { r, c } of cellsInRect(rect)) {
      const hadNumber = this.grid[r][c] > 0;
      const hadCat = this.bonusCats.delete(cellKey(r, c));
      this.specialTiles.delete(cellKey(r, c));
      if (hadNumber || hadCat) removed += 1;
      this.grid[r][c] = null;
    }
    return removed;
  }

  removeCells(cells) {
    let removed = 0;
    cells.forEach(({ r, c }) => {
      const hadNumber = (this.grid[r]?.[c] ?? 0) > 0;
      const hadCat = this.bonusCats.delete(cellKey(r, c));
      this.specialTiles.delete(cellKey(r, c));
      if (hadNumber || hadCat) removed += 1;
      if (this.grid[r]) this.grid[r][c] = null;
    });
    return removed;
  }

  megaBombTarget(row, col) {
    const cells = megaBombCells(this.grid, row, col);
    return {
      row,
      col,
      rect: megaBombRect({ rows: this.rows, cols: this.cols }, row, col),
      cells,
      stats: cellListStats(this.grid, cells),
    };
  }

  bombTarget(row, col) {
    const rect = bombRect({ rows: this.rows, cols: this.cols }, row, col);
    return { rect, stats: this.stats(rect) };
  }

  findAnswers() {
    return findAllSumTenRects(this.grid);
  }

  findAnswer() {
    const answers = this.findAnswers();
    if (!answers.length) return null;
    const richer = answers.filter((answer) => answer.count >= 3);
    const pool = richer.length ? richer : answers;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  findEasyAnswer() {
    const answers = this.findAnswers();
    if (!answers.length) return null;
    const simple = answers.filter((answer) => answer.count === 2);
    const pool = simple.length ? simple : answers;
    const centerRow = (this.rows - 1) / 2;
    const centerCol = (this.cols - 1) / 2;
    return pool.slice().sort((a, b) => {
      const areaA = (a.r2 - a.r1 + 1) * (a.c2 - a.c1 + 1);
      const areaB = (b.r2 - b.r1 + 1) * (b.c2 - b.c1 + 1);
      const centerA = Math.abs((a.r1 + a.r2) / 2 - centerRow) + Math.abs((a.c1 + a.c2) / 2 - centerCol);
      const centerB = Math.abs((b.r1 + b.r2) / 2 - centerRow) + Math.abs((b.c1 + b.c2) / 2 - centerCol);
      return areaA - areaB || centerA - centerB;
    })[0];
  }

  findHintAnswer() {
    const answers = this.findAnswers();
    if (!answers.length) return null;
    const richer = answers.filter((answer) => answer.count >= 3);
    const pool = richer.length ? richer : answers;
    const centerRow = (this.rows - 1) / 2;
    const centerCol = (this.cols - 1) / 2;
    return pool.slice().sort((a, b) => {
      const centerA = Math.abs((a.r1 + a.r2) / 2 - centerRow) + Math.abs((a.c1 + a.c2) / 2 - centerCol);
      const centerB = Math.abs((b.r1 + b.r2) / 2 - centerRow) + Math.abs((b.c1 + b.c2) / 2 - centerCol);
      return a.count - b.count || centerA - centerB;
    })[0];
  }

  remainingPlayableCells() {
    return this.grid.flat().filter((value) => value > 0).length + this.bonusCats.size;
  }

  specialBombCells(specials = [], selectedRect = null, limit = 4) {
    const selected = new Set(selectedRect ? cellsInRect(selectedRect).map(({ r, c }) => cellKey(r, c)) : []);
    const candidates = [];
    specials.filter(({ type }) => type === 'bomb').forEach(({ r: row, c: col }) => {
      cellsInRect(bombRect({ rows: this.rows, cols: this.cols }, row, col)).forEach(({ r, c }) => {
        const key = cellKey(r, c);
        if (selected.has(key) || (this.grid[r]?.[c] ?? 0) <= 0) return;
        if (!candidates.some((candidate) => candidate.key === key)) {
          candidates.push({ r, c, key, distance: Math.abs(r - row) + Math.abs(c - col) });
        }
      });
    });
    return candidates
      .sort((a, b) => a.distance - b.distance || a.r - b.r || a.c - b.c)
      .slice(0, Math.max(0, limit))
      .map(({ r, c }) => ({ r, c }));
  }

  bestBombTarget() {
    return findBestBombTarget(this.grid);
  }

  // The rescue shuffle behind the full-clear rule: when numbers remain but
  // no sum-ten answer does, the board must become playable again without
  // ever refilling a cleared cell. Rearrangement is tried first (the values
  // usually allow an answer, they are just badly placed); if the value set
  // itself cannot make ten — the common cause is a bomb blast removing an
  // arbitrary-sum region — the smallest possible repair is applied: two
  // occupied cells whose bounding rectangle holds no other number become a
  // complementary pair. Returns null when fewer than two numbers remain
  // (nothing can ever sum to ten again), otherwise { repaired }.
  rescueRemaining() {
    const numbered = [];
    for (let r = 0; r < this.rows; r += 1) {
      for (let c = 0; c < this.cols; c += 1) {
        if (this.grid[r][c] > 0) numbered.push({ r, c });
      }
    }
    if (numbered.length < 2) return null;

    const values = numbered.map(({ r, c }) => this.grid[r][c]);

    // First choice: keep the player's values untouched and only shuffle
    // their positions, accepting an arrangement once plan-blind rollouts
    // actually finish the tail (cats included — a full clear collects
    // them). Only when no arrangement of the existing values can work is
    // the minimal value repair tried, and only after that the geometric
    // planner — so a rescued board keeps looking like the same board,
    // not a freshly authored puzzle.
    const certifyArrangement = (candidateValues) => {
      let bestArrangement = null;
      for (let variant = 0; variant < 8; variant += 1) {
        const arrangement = shuffleArray(candidateValues.slice());
        const clone = this.grid.map((row) => row.slice());
        numbered.forEach(({ r, c }, index) => { clone[r][c] = arrangement[index]; });
        let clears = 0;
        let sequence = null;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const roll = rolloutClearOnce(clone, this.bonusCats);
          if (roll.fullClear) {
            clears += 1;
            if (!sequence) sequence = roll.sequence;
          }
        }
        if (clears && (!bestArrangement || clears > bestArrangement.clears)) {
          bestArrangement = { arrangement, sequence, clears };
        }
        if (bestArrangement && bestArrangement.clears >= 3) break;
      }
      return bestArrangement;
    };

    let valuesRepaired = false;
    let certified = certifyArrangement(values);
    if (!certified) {
      const repairedValues = repairValuesForPartition(values);
      if (repairedValues && repairedValues.changed > 0) {
        certified = certifyArrangement(repairedValues.values);
        if (certified) valuesRepaired = true;
      }
    }
    if (certified) {
      numbered.forEach(({ r, c }, index) => { this.grid[r][c] = certified.arrangement[index]; });
      this.assignSpecialTiles([...this.specialTiles.values()]);
      if (this.findAnswer()) return { repaired: valuesRepaired, plan: certified.sequence };
    }
    let best = null;
    for (let variant = 0; variant < 6; variant += 1) {
      const transposed = variant % 2 === 1;
      const cellsIn = transposed ? numbered.map(({ r, c }) => ({ r: c, c: r })) : numbered;
      const plan = planRescueLayout(cellsIn, values);
      if (!plan) continue;
      const slots = plan.slots.map((slot) => ({
        cells: transposed ? slot.cells.map(({ r, c }) => ({ r: c, c: r })) : slot.cells,
        values: slot.values,
      }));

      // Prove the scripted drain on a copy, tracking cats swept along.
      const laid = this.grid.map((row) => row.slice());
      slots.forEach((slot) => slot.cells.forEach(({ r, c }, index) => {
        laid[r][c] = slot.values[index];
      }));
      const work = laid.map((row) => row.slice());
      const catsLeft = new Set(this.bonusCats);
      let sound = true;
      for (const slot of slots) {
        const rect = slotRect(slot);
        const stats = rectStats(work, rect);
        if (stats.sum !== 10 || stats.count !== slot.cells.length) { sound = false; break; }
        cellsInRect(rect).forEach(({ r, c }) => {
          if (work[r][c] > 0) work[r][c] = null;
          catsLeft.delete(cellKey(r, c));
        });
      }
      if (!sound || work.flat().some((value) => value > 0)) continue;

      const robust = robustnessScore(laid, this.bonusCats, 4);
      const score = robust.fullClearRate * 100 + robust.clearedShare * 20
        - catsLeft.size * 60 - plan.changed * 2;
      if (!best || score > best.score) best = { slots, changed: plan.changed, score };
    }
    if (best) {
      best.slots.forEach((slot) => slot.cells.forEach(({ r, c }, index) => {
        this.grid[r][c] = slot.values[index];
      }));
      this.assignSpecialTiles([...this.specialTiles.values()]);
      if (this.findAnswer()) {
        return { repaired: best.changed > 0, plan: best.slots.map((slot) => slotRect(slot)) };
      }
    }

    // Degraded path: at least put one answer back on the board.
    if (this.shuffleRemaining() && this.findAnswer()) return { repaired: false };
    const pair = this.findCleanPair(numbered);
    if (!pair) return null;
    const [first, second] = pair;
    const keep = Math.min(9, Math.max(1, this.grid[first.r][first.c]));
    this.grid[second.r][second.c] = 10 - keep;
    return this.findAnswer() ? { repaired: true } : null;
  }

  // Blast debris: fewer than two numbers can never sum to ten again, so the
  // leftovers (an orphan number and any uncollected cats) are swept off the
  // board. Cleared cells stay cleared — this only ever removes.
  sweepRemaining() {
    const removed = [];
    for (let r = 0; r < this.rows; r += 1) {
      for (let c = 0; c < this.cols; c += 1) {
        if (this.grid[r][c] > 0) {
          removed.push({ r, c });
          this.grid[r][c] = null;
        }
      }
    }
    this.bonusCats.forEach((key) => {
      const [r, c] = key.split(':').map(Number);
      removed.push({ r, c });
    });
    this.bonusCats.clear();
    this.specialTiles.clear();
    return removed;
  }

  // Two occupied cells whose bounding rectangle contains no third number.
  // A same-row pair with only gaps between them is always clean; failing
  // that, consecutive cells in row-sorted order cannot enclose a third.
  findCleanPair(numbered) {
    const byRow = new Map();
    numbered.forEach((cell) => {
      if (!byRow.has(cell.r)) byRow.set(cell.r, []);
      byRow.get(cell.r).push(cell);
    });
    for (const cells of byRow.values()) {
      if (cells.length < 2) continue;
      const sorted = cells.slice().sort((a, b) => a.c - b.c);
      return [sorted[0], sorted[1]];
    }
    const sorted = numbered.slice().sort((a, b) => a.r - b.r || a.c - b.c);
    return sorted.length >= 2 ? [sorted[0], sorted[1]] : null;
  }

  shuffleRemaining() {
    const specialTypes = [...this.specialTiles.values()];
    const spots = [];
    const original = [];
    for (let r = 0; r < this.rows; r += 1) {
      for (let c = 0; c < this.cols; c += 1) {
        if (this.grid[r][c] > 0) {
          spots.push({ r, c });
          original.push(this.grid[r][c]);
        }
      }
    }
    if (spots.length < 2) return false;

    const stage = Math.max(1, this.round || 1);
    const minimumChoices = spots.length < 6 ? 1 : stage <= 2 ? 2 : stage <= 5 ? 3 : 4;
    const targetChoices = spots.length < 6 ? 1 : stage <= 2 ? 5 : stage <= 5 ? 6 : 7;
    let bestCandidate = original.slice();
    let bestAnswerCount = this.findAnswers().length;
    let bestDistance = Math.abs(bestAnswerCount - targetChoices);
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const candidate = shuffleArray(original.slice());
      spots.forEach(({ r, c }, index) => { this.grid[r][c] = candidate[index]; });
      const answerCount = this.findAnswers().length;
      const distance = Math.abs(answerCount - targetChoices);
      if (answerCount >= minimumChoices && (bestAnswerCount < minimumChoices || distance < bestDistance)) {
        bestAnswerCount = answerCount;
        bestDistance = distance;
        bestCandidate = candidate.slice();
      }
      if (answerCount >= minimumChoices && answerCount <= targetChoices + 1) {
        this.assignSpecialTiles(specialTypes);
        return true;
      }
    }

    spots.forEach(({ r, c }, index) => { this.grid[r][c] = bestCandidate[index]; });
    this.assignSpecialTiles(specialTypes);
    return bestAnswerCount > 0;
  }
}
