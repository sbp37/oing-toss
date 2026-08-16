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


const ORIGINAL_PAIR_WEIGHTS = Object.freeze([
  Object.freeze([8, 8, 13, 15, 11]),
  Object.freeze([9, 9, 13, 14, 10]),
  Object.freeze([10, 10, 13, 13, 9]),
  Object.freeze([11, 11, 13, 12, 8]),
  Object.freeze([12, 11, 13, 12, 7]),
]);
const COMPLEMENT_PAIRS = Object.freeze([[1, 9], [2, 8], [3, 7], [4, 6], [5, 5]]);
const TEN_TRIPLES = Object.freeze([[2, 3, 5], [1, 4, 5], [1, 3, 6], [2, 2, 6]]);
const TEN_QUADS = Object.freeze([[1, 2, 3, 4], [1, 1, 3, 5], [2, 2, 2, 4], [1, 2, 2, 5], [1, 1, 2, 6], [2, 2, 3, 3], [1, 1, 4, 4], [1, 3, 3, 3]]);
const TEN_QUINTS = Object.freeze([[1, 1, 2, 2, 4], [2, 2, 2, 2, 2], [1, 2, 2, 2, 3], [1, 1, 1, 3, 4], [1, 1, 2, 3, 3]]);
const TEN_SEXTS = Object.freeze([[1, 1, 1, 2, 2, 3], [1, 1, 2, 2, 2, 2], [1, 1, 1, 1, 2, 4], [1, 1, 1, 1, 3, 3]]);

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

// True when every line (all rows, or all columns) splits into consecutive
// runs of numbers that each sum to exactly ten. Such a board always drains
// to empty: each run is a one-line rectangle containing only its own
// numbers, so it is selectable at any moment, in any order. This is the
// invariant the backbone generator establishes and the tests verify.
export function gridDrainsByLines(grid) {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  const drains = (lines) => lines.every((line) => {
    let acc = 0;
    for (const value of line) {
      if (!(value > 0)) continue;
      acc += value;
      if (acc === 10) acc = 0;
      else if (acc > 10) return false;
    }
    return acc === 0;
  });
  if (drains(grid)) return true;
  const columns = Array.from({ length: cols }, (_, c) => Array.from({ length: rows }, (_, r) => grid[r]?.[c] ?? 0));
  return drains(columns);
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
  return ORIGINAL_PAIR_WEIGHTS[4];
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
  for (let unit = 0; unit < tripleUnits; unit += 1) {
    bag.push(...TEN_TRIPLES[(Math.max(0, round - 1) + unit) % TEN_TRIPLES.length]);
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
  const base = stage === 1
    ? { targetAnswers: 6, maximumAnswers: 8, minimumAnswers: 4, maximumSimpleAnswers: 6, minimumAdjacentPairs: 3, maximumAdjacentPairs: 5, minimumRichAnswers: 1, minimumShapePatterns: 3, minimumValuePatterns: 4, minimumOrientations: 2 }
    : stage === 2
      ? { targetAnswers: 8, maximumAnswers: 11, minimumAnswers: 6, maximumSimpleAnswers: 6, minimumAdjacentPairs: 3, maximumAdjacentPairs: 4, minimumRichAnswers: 2, minimumShapePatterns: 4, minimumValuePatterns: 5, minimumOrientations: 2 }
      : stage === 3
        ? { targetAnswers: 10, maximumAnswers: 13, minimumAnswers: 7, maximumSimpleAnswers: 5, minimumAdjacentPairs: 2, maximumAdjacentPairs: 3, minimumRichAnswers: 3, minimumShapePatterns: 5, minimumValuePatterns: 5, minimumOrientations: 2 }
        : stage === 4
          ? { targetAnswers: 11, maximumAnswers: 14, minimumAnswers: 8, maximumSimpleAnswers: 5, minimumAdjacentPairs: 1, maximumAdjacentPairs: 2, minimumRichAnswers: 4, minimumShapePatterns: 5, minimumValuePatterns: 5, minimumOrientations: 2 }
          : stage === 5
            ? { targetAnswers: 12, maximumAnswers: 15, minimumAnswers: 9, maximumSimpleAnswers: 4, minimumAdjacentPairs: 0, maximumAdjacentPairs: 2, minimumRichAnswers: 5, minimumShapePatterns: 5, minimumValuePatterns: 6, minimumOrientations: 2 }
            : stage <= 7
              ? { targetAnswers: 12, maximumAnswers: 15, minimumAnswers: 9, maximumSimpleAnswers: 3, minimumAdjacentPairs: 0, maximumAdjacentPairs: 1, minimumRichAnswers: 7, minimumShapePatterns: 7, minimumValuePatterns: 6, minimumOrientations: 2 }
              : stage <= 9
                ? { targetAnswers: 13, maximumAnswers: 16, minimumAnswers: 9, maximumSimpleAnswers: 3, minimumAdjacentPairs: 0, maximumAdjacentPairs: 1, minimumRichAnswers: 8, minimumShapePatterns: 8, minimumValuePatterns: 8, minimumOrientations: 3 }
                : { targetAnswers: 14, maximumAnswers: 17, minimumAnswers: 10, maximumSimpleAnswers: 3, minimumAdjacentPairs: 0, maximumAdjacentPairs: 1, minimumRichAnswers: 9, minimumShapePatterns: 8, minimumValuePatterns: 8, minimumOrientations: 3 };
  const assistAdjacentBonus = assist === 'starter' ? 1 : 0;
  return Object.freeze({
    ...base,
    minimumAdjacentPairs: base.minimumAdjacentPairs + assistAdjacentBonus,
    minimumAnswerZones: stage <= 2 ? 3 : 4,
    maximumDominantCellShare: stage <= 2 ? 0.52 : stage <= 4 ? 0.46 : stage <= 7 ? 0.38 : 0.32,
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
  return {
    total: answers.length,
    simple: answers.filter((answer) => answer.count === 2).length,
    adjacent: answers.filter(isAdjacentPair).length,
    rich: answers.filter((answer) => answer.count >= 3).length,
    ...diversity,
    ...spread,
  };
}

function pacingPenalty(mix, pacing) {
  const below = (value, minimum) => Math.max(0, minimum - value);
  const above = (value, maximum) => Math.max(0, value - maximum);
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
    + above(mix.dominantCellShare, pacing.maximumDominantCellShare) * 80;
}

// Full-clear backbone: every board is built as a tiling of one-line
// segments that each sum to exactly ten. A segment's numbers sit in a
// single row (or column), so its bounding rectangle contains no foreign
// number and is selectable at any moment — the board always has a
// complete clear path by construction. Difficulty still comes from the
// value mix: later stages use longer, harder-to-spot segments.
function backboneSizeMix(round) {
  const stage = difficultyPhaseForStage(round);
  if (stage <= 1) return [[2, 8], [3, 2]];
  if (stage === 2) return [[2, 7], [3, 3]];
  if (stage === 3) return [[2, 11], [3, 7], [4, 2]];
  if (stage === 4) return [[2, 9], [3, 8], [4, 3]];
  if (stage === 5) return [[2, 8], [3, 8], [4, 4]];
  if (stage <= 7) return [[2, 6], [3, 9], [4, 5]];
  if (stage <= 9) return [[2, 5], [3, 9], [4, 6]];
  return [[2, 4], [3, 9], [4, 7]];
}

function sampleBackboneSize(mix) {
  const total = mix.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [size, weight] of mix) {
    roll -= weight;
    if (roll <= 0) return size;
  }
  return mix.at(-1)[0];
}

// A sum-ten multiset of the given size. Pairs keep the original stage
// weighting; sizes past the pattern tables (only reachable through cat
// gluing) fall back to ones plus a closer.
function tenGroupValues(count, round) {
  if (count === 2) {
    const weights = pairWeightsForRound(round);
    const total = weights.reduce((sum, value) => sum + value, 0);
    let roll = Math.random() * total;
    for (let index = 0; index < COMPLEMENT_PAIRS.length; index += 1) {
      roll -= weights[index];
      if (roll <= 0) return COMPLEMENT_PAIRS[index].slice();
    }
    return COMPLEMENT_PAIRS.at(-1).slice();
  }
  const pool = count === 3 ? TEN_TRIPLES : count === 4 ? TEN_QUADS : count === 5 ? TEN_QUINTS : count === 6 ? TEN_SEXTS : null;
  if (pool) return pool[Math.floor(Math.random() * pool.length)].slice();
  return [...new Array(count - 1).fill(1), 11 - count];
}

// Partitions one line's number cells into consecutive segments of 2..9
// numbers. Cats glue their neighbours together (a split across a cat would
// leave that cat outside every segment rectangle, stranding it), and a cat
// past the line's first or last number can never be covered — the caller
// re-rolls cat placement in that case.
function lineRangePlan(width, catCols, round) {
  const positions = [];
  for (let col = 0; col < width; col += 1) {
    if (!catCols.has(col)) positions.push(col);
  }
  if (positions.length < 2) return null;
  for (const col of catCols) {
    if (col < positions[0] || col > positions.at(-1)) return null;
  }
  const blocks = [[positions[0]]];
  for (let index = 1; index < positions.length; index += 1) {
    let glued = false;
    for (let col = positions[index - 1] + 1; col < positions[index]; col += 1) {
      if (catCols.has(col)) glued = true;
    }
    if (glued) blocks.at(-1).push(positions[index]);
    else blocks.push([positions[index]]);
  }
  const mix = backboneSizeMix(round);
  const ranges = [];
  let index = 0;
  while (index < blocks.length) {
    const range = [];
    const targetSize = sampleBackboneSize(mix);
    while (index < blocks.length) {
      range.push(...blocks[index]);
      index += 1;
      const rest = blocks.slice(index).reduce((sum, block) => sum + block.length, 0);
      if (rest === 0) break;
      if (range.length >= Math.max(2, targetSize) && rest !== 1) break;
      if (range.length > 9) return null;
    }
    if (range.length < 2 || range.length > 9) return null;
    ranges.push(range);
  }
  return ranges;
}

function makeBackboneGrid(rows, cols, round, catTarget) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const alongRows = attempt % 2 === 0;
    const lineCount = alongRows ? rows : cols;
    const lineWidth = alongRows ? cols : rows;
    const cats = new Set();
    if (attempt < 40) {
      while (cats.size < catTarget) {
        cats.add(cellKey(Math.floor(Math.random() * rows), Math.floor(Math.random() * cols)));
      }
    } else {
      // Safety net: one interior cat per distinct line always segments.
      for (let index = 0; index < catTarget; index += 1) {
        const line = index % lineCount;
        const offset = 1 + Math.floor(Math.random() * (lineWidth - 2));
        cats.add(alongRows ? cellKey(line, offset) : cellKey(offset, line));
      }
      if (cats.size < catTarget) continue;
    }
    const plans = [];
    let feasible = true;
    for (let line = 0; line < lineCount && feasible; line += 1) {
      const catCols = new Set();
      cats.forEach((key) => {
        const [r, c] = key.split(':').map(Number);
        if ((alongRows ? r : c) === line) catCols.add(alongRows ? c : r);
      });
      const plan = lineRangePlan(lineWidth, catCols, round);
      if (!plan) feasible = false;
      else plans.push(plan);
    }
    if (!feasible) continue;
    const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
    plans.forEach((ranges, line) => {
      ranges.forEach((range) => {
        const values = shuffleArray(tenGroupValues(range.length, round));
        range.forEach((offset, position) => {
          const r = alongRows ? line : offset;
          const c = alongRows ? offset : line;
          grid[r][c] = values[position];
        });
      });
    });
    return { grid, cats };
  }
  return null;
}

function isAdjacentPair(answer) {
  return answer.count === 2 && (answer.r2 - answer.r1 + 1) * (answer.c2 - answer.c1 + 1) === 2;
}

const cellKey = (row, col) => `${row}:${col}`;

export function bonusCatTargetForSize(size) {
  return Math.max(1, Math.round(size * size * BONUS_CAT_RATIO));
}

export function bonusCatTargetForDimensions(rows, cols = rows) {
  return Math.max(1, Math.round(rows * cols * BONUS_CAT_RATIO));
}

function rectContainsCell(rect, row, col) {
  return row >= rect.r1 && row <= rect.r2 && col >= rect.c1 && col <= rect.c2;
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
    let bestCandidate = null;
    let bestPenalty = Number.POSITIVE_INFINITY;
    for (let attempt = 0; attempt < GENERATION_ATTEMPTS * 2; attempt += 1) {
      const candidate = makeBackboneGrid(this.rows, this.cols, round, catTarget);
      if (!candidate) continue;
      const answers = findAllSumTenRects(candidate.grid);
      if (!answers.length) continue;
      const cats = candidate.cats;
      const everyCatCollectable = [...cats].every((key) => {
        const [row, col] = key.split(':').map(Number);
        return answers.some((answer) => rectContainsCell(answer, row, col));
      });
      if (!everyCatCollectable) continue;
      const mix = answerMix(candidate.grid, answers);
      const penalty = pacingPenalty(mix, pacing);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestCandidate = { grid: candidate.grid, cats };
      }
      const ideal = mix.total >= pacing.minimumAnswers
        && mix.total <= pacing.maximumAnswers
        && mix.simple <= pacing.maximumSimpleAnswers
        && mix.adjacent >= pacing.minimumAdjacentPairs
        && mix.adjacent <= pacing.maximumAdjacentPairs
        && mix.rich >= pacing.minimumRichAnswers
        && mix.shapePatterns >= pacing.minimumShapePatterns
        && mix.valuePatterns >= pacing.minimumValuePatterns
        && mix.orientations >= pacing.minimumOrientations
        && mix.answerZones >= pacing.minimumAnswerZones
        && mix.dominantCellShare <= pacing.maximumDominantCellShare;
      if (ideal) {
        this.grid = candidate.grid;
        this.bonusCats = cats;
        return this.grid;
      }
    }

    if (bestCandidate) {
      this.grid = bestCandidate.grid;
      this.bonusCats = bestCandidate.cats;
      return this.grid;
    }

    // Safety fallback: even without a pacing-approved candidate the board
    // must keep the full-clear guarantee, so it stays a backbone build.
    while (true) {
      const candidate = makeBackboneGrid(this.rows, this.cols, round, catTarget);
      if (!candidate || candidate.cats.size !== catTarget) continue;
      this.grid = candidate.grid;
      this.bonusCats = candidate.cats;
      return this.grid;
    }
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

    // The strong path: plan the tail as geometry-safe groups (row runs plus
    // an endgame for single-cell rows), deal sum-ten value sets into them,
    // and verify by simulation that clearing the groups in order drains the
    // board completely. One rescue then guarantees the whole tail can be
    // finished without another rescue — laying values out in row-major
    // order used to promise nothing about the rectangles being selectable.
    const values = numbered.map(({ r, c }) => this.grid[r][c]);
    const plan = planRescueLayout(numbered, values);
    if (plan && this.applyRescuePlan(plan)) {
      return { repaired: plan.changed > 0, plan: plan.slots.map((slot) => slotRect(slot)) };
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

  // Writes a rescue plan's values into the grid, then proves the promise on
  // a copy: each group's rectangle must hold exactly its own numbers summing
  // to ten at its turn, and the final copy must be empty. Any miss restores
  // the previous values and reports failure so the degraded path can run.
  applyRescuePlan(plan) {
    const backup = this.grid.map((row) => row.slice());
    plan.slots.forEach((slot) => slot.cells.forEach(({ r, c }, index) => {
      this.grid[r][c] = slot.values[index];
    }));
    const clone = this.grid.map((row) => row.slice());
    for (const slot of plan.slots) {
      const rect = slotRect(slot);
      const stats = rectStats(clone, rect);
      if (stats.sum !== 10 || stats.count !== slot.cells.length) {
        this.grid = backup;
        return false;
      }
      cellsInRect(rect).forEach(({ r, c }) => {
        if (clone[r][c] > 0) clone[r][c] = null;
      });
    }
    if (clone.flat().some((value) => value > 0)) {
      this.grid = backup;
      return false;
    }
    this.assignSpecialTiles([...this.specialTiles.values()]);
    return Boolean(this.findAnswer());
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
