const MIN_VALUE = 1;
const MAX_VALUE = 9;

const randomValue = () => Math.floor(Math.random() * MAX_VALUE) + MIN_VALUE;

export function normalizeRect(a, b) {
  return {
    r1: Math.min(a.r, b.r),
    r2: Math.max(a.r, b.r),
    c1: Math.min(a.c, b.c),
    c2: Math.max(a.c, b.c),
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
    this.grid = Array.from({ length: size }, () => Array.from({ length: size }, randomValue));
    if (!this.findAnswer()) {
      const row = Math.floor(Math.random() * size);
      const col = Math.floor(Math.random() * Math.max(1, size - 1));
      const first = 2 + Math.floor(Math.random() * 7);
      this.grid[row][col] = first;
      this.grid[row][col + 1] = 10 - first;
    }
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

