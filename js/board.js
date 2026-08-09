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

const qualityTarget = (size, assist = 'standard') => {
  const base = BOARD_DIFFICULTY[size] || BOARD_DIFFICULTY[9];
  const bonus = BOARD_ASSIST_PROFILES[assist] || BOARD_ASSIST_PROFILES.standard;
  return {
    ...base,
    minimumAnswers: base.minimumAnswers + bonus.minimumAnswers,
    minimumSimpleAnswers: base.minimumSimpleAnswers + bonus.minimumSimpleAnswers,
    minimumAdjacentPairs: base.minimumAdjacentPairs + bonus.minimumAdjacentPairs,
  };
};

const randomValue = () => Math.floor(Math.random() * MAX_VALUE) + MIN_VALUE;

function shuffled(values) {
  return shuffleArray(values.slice());
}

function makeRandomGrid(rows, cols = rows) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, randomValue));
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

function pairWeightsForRound(round = 1) {
  const stage = Math.max(1, Math.round(Number(round) || 1));
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
  const stage = Math.max(1, Math.round(Number(round) || 1));
  const ratio = stage <= 2
    ? 0
    : stage === 3
      ? 0.08
      : stage === 4
        ? 0.12
        : stage === 5
          ? 0.16
          : stage <= 7
            ? 0.2
            : stage <= 9
              ? 0.24
              : 0.28;
  let units = Math.min(Math.floor(count / 3), Math.round((count * ratio) / 3));
  if (units % 2 !== count % 2) units += units * 3 + 3 <= count ? 1 : -1;
  return Math.max(0, units);
}

export function adjacentSeedCountForRound(round = 1) {
  const stage = Math.max(1, Math.round(Number(round) || 1));
  if (stage <= 2) return 3;
  if (stage <= 4) return 2;
  if (stage <= 7) return 1;
  return 0;
}

export function boardPacingForRound(round = 1, assist = 'standard') {
  const stage = Math.max(1, Math.round(Number(round) || 1));
  const base = stage === 1
    ? { targetAnswers: 6, maximumAnswers: 8, minimumAnswers: 4, minimumAdjacentPairs: 3, maximumAdjacentPairs: 5, minimumRichAnswers: 1 }
    : stage === 2
      ? { targetAnswers: 8, maximumAnswers: 11, minimumAnswers: 6, minimumAdjacentPairs: 3, maximumAdjacentPairs: 5, minimumRichAnswers: 2 }
      : stage === 3
        ? { targetAnswers: 10, maximumAnswers: 13, minimumAnswers: 7, minimumAdjacentPairs: 2, maximumAdjacentPairs: 4, minimumRichAnswers: 3 }
        : stage === 4
          ? { targetAnswers: 11, maximumAnswers: 14, minimumAnswers: 8, minimumAdjacentPairs: 2, maximumAdjacentPairs: 3, minimumRichAnswers: 4 }
          : stage === 5
            ? { targetAnswers: 12, maximumAnswers: 15, minimumAnswers: 9, minimumAdjacentPairs: 1, maximumAdjacentPairs: 3, minimumRichAnswers: 5 }
            : stage <= 7
              ? { targetAnswers: 13, maximumAnswers: 17, minimumAnswers: 10, minimumAdjacentPairs: 1, maximumAdjacentPairs: 2, minimumRichAnswers: 6 }
              : stage <= 9
                ? { targetAnswers: 14, maximumAnswers: 18, minimumAnswers: 10, minimumAdjacentPairs: 0, maximumAdjacentPairs: 2, minimumRichAnswers: 7 }
                : { targetAnswers: 15, maximumAnswers: 19, minimumAnswers: 11, minimumAdjacentPairs: 0, maximumAdjacentPairs: 1, minimumRichAnswers: 8 };
  const assistAdjacentBonus = assist === 'starter' ? 1 : 0;
  return Object.freeze({
    ...base,
    minimumAdjacentPairs: base.minimumAdjacentPairs + assistAdjacentBonus,
  });
}

function answerMix(answers) {
  return {
    total: answers.length,
    adjacent: answers.filter(isAdjacentPair).length,
    rich: answers.filter((answer) => answer.count >= 3).length,
  };
}

function pacingPenalty(mix, pacing) {
  const below = (value, minimum) => Math.max(0, minimum - value);
  const above = (value, maximum) => Math.max(0, value - maximum);
  return Math.abs(mix.total - pacing.targetAnswers)
    + below(mix.total, pacing.minimumAnswers) * 18
    + above(mix.total, pacing.maximumAnswers) * 5
    + below(mix.adjacent, pacing.minimumAdjacentPairs) * 14
    + above(mix.adjacent, pacing.maximumAdjacentPairs) * 3
    + below(mix.rich, pacing.minimumRichAnswers) * 14;
}

function seedAdjacentPairsInGrid(grid, requested) {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  let seeded = 0;
  for (let guard = 0; seeded < requested && guard < 500; guard += 1) {
    const row = Math.floor(Math.random() * rows);
    const col = Math.floor(Math.random() * cols);
    if (!(grid[row]?.[col] > 0)) continue;
    const neighbors = shuffleArray([[0, 1], [1, 0], [0, -1], [-1, 0]]);
    const neighbor = neighbors
      .map(([dr, dc]) => ({ row: row + dr, col: col + dc }))
      .find(({ row: nextRow, col: nextCol }) => grid[nextRow]?.[nextCol] > 0);
    if (!neighbor) continue;
    const needed = 10 - grid[row][col];
    if (grid[neighbor.row][neighbor.col] === needed) {
      seeded += 1;
      continue;
    }
    const candidates = [];
    for (let sourceRow = 0; sourceRow < rows; sourceRow += 1) {
      for (let sourceCol = 0; sourceCol < cols; sourceCol += 1) {
        if (sourceRow === row && sourceCol === col) continue;
        if (sourceRow === neighbor.row && sourceCol === neighbor.col) continue;
        if (grid[sourceRow][sourceCol] === needed) candidates.push({ row: sourceRow, col: sourceCol });
      }
    }
    if (!candidates.length) continue;
    const source = candidates[Math.floor(Math.random() * candidates.length)];
    [grid[neighbor.row][neighbor.col], grid[source.row][source.col]] = [
      grid[source.row][source.col],
      grid[neighbor.row][neighbor.col],
    ];
    seeded += 1;
  }
}

function makeBalancedGrid(rows, cols, round, catTarget) {
  const total = rows * cols;
  const catIndexes = new Set();
  while (catIndexes.size < catTarget) catIndexes.add(Math.floor(Math.random() * total));
  const bag = numberBagForRound(total - catTarget, round);
  let bagIndex = 0;
  const grid = Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) => (
    catIndexes.has(row * cols + col) ? null : bag[bagIndex++]
  )));
  seedAdjacentPairsInGrid(grid, adjacentSeedCountForRound(round));
  return { grid, catIndexes };
}

function isAdjacentPair(answer) {
  return answer.count === 2 && (answer.r2 - answer.r1 + 1) * (answer.c2 - answer.c1 + 1) === 2;
}

function answersMeetQuality(answers, size, assist = 'standard') {
  const {
    minimumAnswers,
    minimumSimpleAnswers,
    minimumAdjacentPairs,
    minimumRichAnswers,
  } = qualityTarget(size, assist);
  return answers.length >= minimumAnswers
    && answers.filter((answer) => answer.count === 2).length >= minimumSimpleAnswers
    && answers.filter(isAdjacentPair).length >= minimumAdjacentPairs
    && answers.filter((answer) => answer.count >= 3).length >= minimumRichAnswers;
}

function hasGoodAnswerMix(grid, assist = 'standard') {
  const difficultySize = Math.max(grid.length, grid[0]?.length || 0);
  return answersMeetQuality(findAllSumTenRects(grid), difficultySize, assist);
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

function placeBonusCats(grid, assist = 'standard') {
  const cats = new Set();
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  const target = bonusCatTargetForDimensions(rows, cols);
  const difficultySize = Math.max(rows, cols);

  for (let index = 0; index < target; index += 1) {
    const candidates = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if ((grid[row]?.[col] ?? 0) <= 0 || cats.has(cellKey(row, col))) continue;
        const previous = grid[row][col];
        grid[row][col] = null;
        const answers = findAllSumTenRects(grid);
        const catAnswers = answers.filter((answer) => rectContainsCell(answer, row, col));
        const everyCatStillCollectable = [...cats, cellKey(row, col)].every((key) => {
          const [catRow, catCol] = key.split(':').map(Number);
          return answers.some((answer) => rectContainsCell(answer, catRow, catCol));
        });
        if (answersMeetQuality(answers, difficultySize, assist) && catAnswers.length && everyCatStillCollectable) {
          candidates.push({ row, col, coverage: catAnswers.length });
        }
        grid[row][col] = previous;
      }
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => b.coverage - a.coverage);
    const bestCoverage = candidates[0].coverage;
    const best = shuffled(candidates.filter((candidate) => candidate.coverage === bestCoverage))[0];
    grid[best.row][best.col] = null;
    cats.add(cellKey(best.row, best.col));
  }

  return cats;
}

function seedProfileAnswers(grid, assist = 'standard') {
  const rowCount = grid.length;
  const colCount = grid[0]?.length || 0;
  const { minimumAdjacentPairs, minimumRichAnswers } = qualityTarget(Math.max(rowCount, colCount), assist);
  const pairPatterns = [[1, 9], [2, 8], [3, 7], [4, 6]];
  const richPatterns = [[2, 3, 5], [1, 4, 5], [1, 3, 6], [2, 2, 6]];
  const rows = shuffled(Array.from({ length: rowCount }, (_, index) => index));

  for (let index = 0; index < minimumRichAnswers; index += 1) {
    const row = rows[(minimumAdjacentPairs + index) % rows.length];
    const start = Math.min(colCount - 3, index % Math.max(1, colCount - 2));
    shuffled(richPatterns[index % richPatterns.length]).forEach((value, offset) => {
      grid[row][start + offset] = value;
    });
  }

  const starts = colCount >= 6 ? [0, 2, colCount - 2] : [0, colCount - 2];
  const pairSlots = shuffled(rows.flatMap((row) => starts.map((start) => ({ row, start }))));
  for (let index = 0; index < minimumAdjacentPairs; index += 1) {
    const { row, start } = pairSlots[index % pairSlots.length];
    shuffled(pairPatterns[index % pairPatterns.length]).forEach((value, offset) => {
      grid[row][start + offset] = value;
    });
  }
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

export function findBestBombTarget(grid) {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  let best = null;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const rect = bombRect({ rows, cols }, row, col);
      const stats = rectStats(grid, rect);
      if (stats.count === 0) continue;
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

export class BoardModel {
  constructor(size = 4) {
    this.size = size;
    this.cols = size;
    this.rows = size;
    this.grid = [];
    this.bonusCats = new Set();
    this.specialTiles = new Map();
    this.generate(size);
  }

  generate(size = this.size, options = {}) {
    this.size = size;
    this.cols = Math.max(1, Math.round(options.cols || size));
    this.rows = Math.max(1, Math.round(options.rows || this.cols));
    this.size = this.cols;
    this.specialTiles.clear();
    const round = Math.max(1, Math.round(Number(options.round) || 1));
    const assist = options.assist || (options.easy ? 'guided' : 'standard');
    const catTarget = bonusCatTargetForDimensions(this.rows, this.cols);
    const pacing = boardPacingForRound(round, assist);
    let bestCandidate = null;
    let bestPenalty = Number.POSITIVE_INFINITY;
    for (let attempt = 0; attempt < GENERATION_ATTEMPTS * 2; attempt += 1) {
      const candidate = makeBalancedGrid(this.rows, this.cols, round, catTarget);
      const answers = findAllSumTenRects(candidate.grid);
      if (!answers.length) continue;
      const cats = new Set([...candidate.catIndexes].map((index) => `${Math.floor(index / this.cols)}:${index % this.cols}`));
      const everyCatCollectable = [...cats].every((key) => {
        const [row, col] = key.split(':').map(Number);
        return answers.some((answer) => rectContainsCell(answer, row, col));
      });
      if (!everyCatCollectable) continue;
      const mix = answerMix(answers);
      const penalty = pacingPenalty(mix, pacing);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestCandidate = { grid: candidate.grid, cats };
      }
      const ideal = mix.total >= pacing.minimumAnswers
        && mix.total <= pacing.maximumAnswers
        && mix.adjacent >= pacing.minimumAdjacentPairs
        && mix.adjacent <= pacing.maximumAdjacentPairs
        && mix.rich >= pacing.minimumRichAnswers;
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

    // Safety fallback: preserve the prior generator's answer/cat guarantees if
    // an unusually constrained board cannot place every bonus cat from the bag.
    while (true) {
      this.grid = makeRandomGrid(this.rows, this.cols);
      seedProfileAnswers(this.grid, assist);
      if (!hasGoodAnswerMix(this.grid, assist)) continue;
      const bonusCats = placeBonusCats(this.grid, assist);
      if (bonusCats?.size !== catTarget) continue;
      this.bonusCats = bonusCats;
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
    const requested = Array.isArray(types) ? types.filter((type) => ['clock', 'bomb'].includes(type)) : [];
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

    const minimumChoices = spots.length >= 6 ? 3 : 1;
    let bestCandidate = original.slice();
    let bestAnswerCount = this.findAnswers().length;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const candidate = shuffleArray(original.slice());
      spots.forEach(({ r, c }, index) => { this.grid[r][c] = candidate[index]; });
      const answerCount = this.findAnswers().length;
      if (answerCount > bestAnswerCount) {
        bestAnswerCount = answerCount;
        bestCandidate = candidate.slice();
      }
      if (answerCount >= minimumChoices) {
        this.assignSpecialTiles(specialTypes);
        return true;
      }
    }

    spots.forEach(({ r, c }, index) => { this.grid[r][c] = bestCandidate[index]; });
    this.assignSpecialTiles(specialTypes);
    return bestAnswerCount > 0;
  }
}
