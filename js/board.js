const MIN_VALUE = 1;
const MAX_VALUE = 9;
const GENERATION_ATTEMPTS = 72;
export const BONUS_CAT_RATIO = 0.07;
export const EASY_BOARD_BONUS = Object.freeze({ minimumAnswers: 3, minimumSimpleAnswers: 2, minimumAdjacentPairs: 2 });
export const BOARD_ASSIST_PROFILES = Object.freeze({
  starter: Object.freeze({ minimumAnswers: 5, minimumSimpleAnswers: 3, minimumAdjacentPairs: 3 }),
  guided: EASY_BOARD_BONUS,
  standard: Object.freeze({ minimumAnswers: 0, minimumSimpleAnswers: 0, minimumAdjacentPairs: 0 }),
});

// The board gets denser every round, but the kind of answer changes too:
// round 1 teaches with obvious pairs, round 2 mixes shapes, and round 3
// rewards wider 3+ tile rectangles. Every profile still guarantees choices.
export const BOARD_DIFFICULTY = Object.freeze({
  4: Object.freeze({ minimumAnswers: 5, minimumSimpleAnswers: 3, minimumAdjacentPairs: 3, minimumRichAnswers: 1 }),
  5: Object.freeze({ minimumAnswers: 7, minimumSimpleAnswers: 2, minimumAdjacentPairs: 2, minimumRichAnswers: 2 }),
  6: Object.freeze({ minimumAnswers: 9, minimumSimpleAnswers: 1, minimumAdjacentPairs: 1, minimumRichAnswers: 4 }),
});

export function boardAssistForSuccessCount(successCount) {
  const count = Math.max(0, Math.floor(Number(successCount) || 0));
  if (count < 2) return 'starter';
  if (count < 5) return 'guided';
  return 'standard';
}

const qualityTarget = (size, assist = 'standard') => {
  const base = BOARD_DIFFICULTY[size] || BOARD_DIFFICULTY[6];
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

function makeRandomGrid(size) {
  return Array.from({ length: size }, () => Array.from({ length: size }, randomValue));
}

function isAdjacentPair(answer) {
  return answer.count === 2 && (answer.r2 - answer.r1 + 1) * (answer.c2 - answer.c1 + 1) === 2;
}

function hasGoodAnswerMix(grid, assist = 'standard') {
  const {
    minimumAnswers,
    minimumSimpleAnswers,
    minimumAdjacentPairs,
    minimumRichAnswers,
  } = qualityTarget(grid.length, assist);
  const answers = findAllSumTenRects(grid);
  return answers.length >= minimumAnswers
    && answers.filter((answer) => answer.count === 2).length >= minimumSimpleAnswers
    && answers.filter(isAdjacentPair).length >= minimumAdjacentPairs
    && answers.filter((answer) => answer.count >= 3).length >= minimumRichAnswers;
}

const cellKey = (row, col) => `${row}:${col}`;

export function bonusCatTargetForSize(size) {
  return Math.max(1, Math.round(size * size * BONUS_CAT_RATIO));
}

function rectContainsCell(rect, row, col) {
  return row >= rect.r1 && row <= rect.r2 && col >= rect.c1 && col <= rect.c2;
}

function placeBonusCats(grid, assist = 'standard') {
  const cats = new Set();
  const target = bonusCatTargetForSize(grid.length);

  for (let index = 0; index < target; index += 1) {
    const candidates = [];
    for (let row = 0; row < grid.length; row += 1) {
      for (let col = 0; col < grid.length; col += 1) {
        if ((grid[row]?.[col] ?? 0) <= 0 || cats.has(cellKey(row, col))) continue;
        const previous = grid[row][col];
        grid[row][col] = null;
        const answers = findAllSumTenRects(grid);
        const catAnswers = answers.filter((answer) => rectContainsCell(answer, row, col));
        const everyCatStillCollectable = [...cats, cellKey(row, col)].every((key) => {
          const [catRow, catCol] = key.split(':').map(Number);
          return answers.some((answer) => rectContainsCell(answer, catRow, catCol));
        });
        if (hasGoodAnswerMix(grid, assist) && catAnswers.length && everyCatStillCollectable) {
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
  const size = grid.length;
  const { minimumAdjacentPairs, minimumRichAnswers } = qualityTarget(size, assist);
  const pairPatterns = [[1, 9], [2, 8], [3, 7], [4, 6]];
  const richPatterns = [[2, 3, 5], [1, 4, 5], [1, 3, 6], [2, 2, 6]];
  const rows = shuffled(Array.from({ length: size }, (_, index) => index));

  for (let index = 0; index < minimumRichAnswers; index += 1) {
    const row = rows[(minimumAdjacentPairs + index) % rows.length];
    const start = Math.min(size - 3, index % Math.max(1, size - 2));
    shuffled(richPatterns[index % richPatterns.length]).forEach((value, offset) => {
      grid[row][start + offset] = value;
    });
  }

  const starts = size >= 6 ? [0, 2, size - 2] : [0, size - 2];
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

export function bombRect(size, row, col) {
  const last = Math.max(0, size - 1);
  return {
    r1: Math.max(0, row - 1),
    r2: Math.min(last, row + 1),
    c1: Math.max(0, col - 1),
    c2: Math.min(last, col + 1),
  };
}

export function megaBombRect(size, row, col) {
  const last = Math.max(0, size - 1);
  return {
    r1: Math.max(0, row - 2),
    r2: Math.min(last, row + 2),
    c1: Math.max(0, col - 2),
    c2: Math.min(last, col + 2),
  };
}

export function megaBombCells(grid, row, col, limit = 12) {
  const rect = megaBombRect(grid.length, row, col);
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
  const size = grid.length;
  let best = null;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const rect = bombRect(size, row, col);
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
  const size = grid.length;
  const answers = [];
  for (let r1 = 0; r1 < size; r1 += 1) {
    for (let c1 = 0; c1 < size; c1 += 1) {
      for (let r2 = r1; r2 < size; r2 += 1) {
        for (let c2 = c1; c2 < size; c2 += 1) {
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
    this.grid = [];
    this.bonusCats = new Set();
    this.generate(size);
  }

  generate(size = this.size, options = {}) {
    this.size = size;
    const assist = options.assist || (options.easy ? 'guided' : 'standard');
    const attempts = assist === 'starter'
      ? GENERATION_ATTEMPTS * 7
      : assist === 'guided' ? GENERATION_ATTEMPTS * 5 : GENERATION_ATTEMPTS * 3;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      this.grid = makeRandomGrid(size);
      if (assist !== 'standard') seedProfileAnswers(this.grid, assist);
      if (!hasGoodAnswerMix(this.grid, assist)) continue;
      const bonusCats = placeBonusCats(this.grid, assist);
      if (bonusCats?.size === bonusCatTargetForSize(size)) {
        this.bonusCats = bonusCats;
        return this.grid;
      }
    }

    // Extremely rare fallback: keep generating until the promised cat count and
    // answer profile both hold. This is intentionally deterministic in outcome,
    // not in layout, so a round never silently loses its bonus cats.
    while (true) {
      this.grid = makeRandomGrid(size);
      seedProfileAnswers(this.grid, assist);
      if (!hasGoodAnswerMix(this.grid, assist)) continue;
      const bonusCats = placeBonusCats(this.grid, assist);
      if (bonusCats?.size !== bonusCatTargetForSize(size)) continue;
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

  stats(rect) {
    const stats = rectStats(this.grid, rect);
    const catCount = cellsInRect(rect).reduce(
      (count, { r, c }) => count + (this.hasBonusCat(r, c) ? 1 : 0),
      0,
    );
    return { ...stats, catCount };
  }

  remove(rect) {
    let removed = 0;
    for (const { r, c } of cellsInRect(rect)) {
      const hadNumber = this.grid[r][c] > 0;
      const hadCat = this.bonusCats.delete(cellKey(r, c));
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
      rect: megaBombRect(this.size, row, col),
      cells,
      stats: cellListStats(this.grid, cells),
    };
  }

  bombTarget(row, col) {
    const rect = bombRect(this.size, row, col);
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
    const center = (this.size - 1) / 2;
    return pool.slice().sort((a, b) => {
      const areaA = (a.r2 - a.r1 + 1) * (a.c2 - a.c1 + 1);
      const areaB = (b.r2 - b.r1 + 1) * (b.c2 - b.c1 + 1);
      const centerA = Math.abs((a.r1 + a.r2) / 2 - center) + Math.abs((a.c1 + a.c2) / 2 - center);
      const centerB = Math.abs((b.r1 + b.r2) / 2 - center) + Math.abs((b.c1 + b.c2) / 2 - center);
      return areaA - areaB || centerA - centerB;
    })[0];
  }

  bestBombTarget() {
    return findBestBombTarget(this.grid);
  }

  shuffleRemaining() {
    const spots = [];
    const original = [];
    for (let r = 0; r < this.size; r += 1) {
      for (let c = 0; c < this.size; c += 1) {
        if (this.grid[r][c] > 0) {
          spots.push({ r, c });
          original.push(this.grid[r][c]);
        }
      }
    }
    if (spots.length < 2) return false;

    for (let attempt = 0; attempt < 80; attempt += 1) {
      const candidate = shuffleArray(original.slice());
      spots.forEach(({ r, c }, index) => { this.grid[r][c] = candidate[index]; });
      if (this.findAnswer()) return true;
    }

    spots.forEach(({ r, c }, index) => { this.grid[r][c] = original[index]; });
    return Boolean(this.findAnswer());
  }
}
