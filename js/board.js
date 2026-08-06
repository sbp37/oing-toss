const MIN_VALUE = 1;
const MAX_VALUE = 9;
const GENERATION_ATTEMPTS = 72;

// The board gets denser every round, but the kind of answer changes too:
// round 1 teaches with obvious pairs, round 2 mixes shapes, and round 3
// rewards wider 3+ tile rectangles. Every profile still guarantees choices.
export const BOARD_DIFFICULTY = Object.freeze({
  4: Object.freeze({ minimumAnswers: 5, minimumSimpleAnswers: 3, minimumRichAnswers: 1 }),
  5: Object.freeze({ minimumAnswers: 7, minimumSimpleAnswers: 2, minimumRichAnswers: 2 }),
  6: Object.freeze({ minimumAnswers: 9, minimumSimpleAnswers: 1, minimumRichAnswers: 4 }),
});

const qualityTarget = (size) => BOARD_DIFFICULTY[size] || BOARD_DIFFICULTY[6];

const randomValue = () => Math.floor(Math.random() * MAX_VALUE) + MIN_VALUE;

function shuffled(values) {
  return shuffleArray(values.slice());
}

function makeRandomGrid(size) {
  return Array.from({ length: size }, () => Array.from({ length: size }, randomValue));
}

function hasGoodAnswerMix(grid) {
  const { minimumAnswers, minimumSimpleAnswers, minimumRichAnswers } = qualityTarget(grid.length);
  const answers = findAllSumTenRects(grid);
  return answers.length >= minimumAnswers
    && answers.filter((answer) => answer.count === 2).length >= minimumSimpleAnswers
    && answers.filter((answer) => answer.count >= 3).length >= minimumRichAnswers;
}

function seedProfileAnswers(grid) {
  const size = grid.length;
  const { minimumSimpleAnswers, minimumRichAnswers } = qualityTarget(size);
  const pairPatterns = [[1, 9], [2, 8], [3, 7], [4, 6]];
  const richPatterns = [[2, 3, 5], [1, 4, 5], [1, 3, 6], [2, 2, 6]];
  const rows = shuffled(Array.from({ length: size }, (_, index) => index));

  for (let index = 0; index < minimumSimpleAnswers; index += 1) {
    const row = rows[index % rows.length];
    const start = index % 2 === 0 ? 0 : size - 2;
    shuffled(pairPatterns[index % pairPatterns.length]).forEach((value, offset) => {
      grid[row][start + offset] = value;
    });
  }

  for (let index = 0; index < minimumRichAnswers; index += 1) {
    const row = rows[(minimumSimpleAnswers + index) % rows.length];
    const start = Math.min(size - 3, index % Math.max(1, size - 2));
    shuffled(richPatterns[index % richPatterns.length]).forEach((value, offset) => {
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
    this.generate(size);
  }

  generate(size = this.size) {
    this.size = size;
    for (let attempt = 0; attempt < GENERATION_ATTEMPTS; attempt += 1) {
      this.grid = makeRandomGrid(size);
      if (hasGoodAnswerMix(this.grid)) return this.grid;
    }

    this.grid = makeRandomGrid(size);
    seedProfileAnswers(this.grid);
    return this.grid;
  }

  valueAt(r, c) {
    return this.grid[r]?.[c] ?? 0;
  }

  stats(rect) {
    return rectStats(this.grid, rect);
  }

  remove(rect) {
    let removed = 0;
    for (const { r, c } of cellsInRect(rect)) {
      if (this.grid[r][c] > 0) removed += 1;
      this.grid[r][c] = null;
    }
    return removed;
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
