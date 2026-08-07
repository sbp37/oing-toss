const cellKey = (row, col) => `${row}:${col}`;

function adjacentNumberCount(grid, row, col) {
  return [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ].reduce((count, [nextRow, nextCol]) => (
    count + ((grid[nextRow]?.[nextCol] ?? 0) > 0 ? 1 : 0)
  ), 0);
}

export function rankBoardItemCells(grid, occupiedKeys = new Set()) {
  const centerRow = (grid.length - 1) / 2;
  const centerCol = ((grid[0]?.length || 1) - 1) / 2;
  const cells = [];
  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < (grid[row]?.length || 0); col += 1) {
      const key = cellKey(row, col);
      if ((grid[row]?.[col] ?? 0) > 0 || occupiedKeys.has(key)) continue;
      cells.push({
        row,
        col,
        adjacency: adjacentNumberCount(grid, row, col),
        centerDistance: Math.abs(row - centerRow) + Math.abs(col - centerCol),
      });
    }
  }
  return cells
    .sort((a, b) => b.adjacency - a.adjacency || a.centerDistance - b.centerDistance)
    .map(({ row, col }) => ({ row, col }));
}

export class BoardItemField {
  constructor() {
    this.items = new Map();
    this.pending = [];
    this.serial = 0;
  }

  reset() {
    this.items.clear();
    this.pending.length = 0;
    this.serial = 0;
  }

  queue(type, metadata = {}) {
    if (!type) return null;
    const entry = { type, ...metadata };
    this.pending.push(entry);
    return entry;
  }

  carry() {
    const carried = [...this.items.values()].map(({ type, earnedAtCombo }) => ({ type, earnedAtCombo }));
    this.items.clear();
    this.pending.push(...carried);
    return carried;
  }

  place(grid, reservedKeys = new Set()) {
    const placed = [];
    const occupiedKeys = new Set([...this.items.keys(), ...reservedKeys]);
    const openCells = rankBoardItemCells(grid, occupiedKeys);
    while (this.pending.length && openCells.length) {
      const item = this.pending.shift();
      const cell = openCells.shift();
      const entry = {
        id: `board-item-${++this.serial}`,
        ...item,
        ...cell,
      };
      this.items.set(cellKey(cell.row, cell.col), entry);
      placed.push(entry);
    }
    return placed;
  }

  get(key) {
    return this.items.get(key) || null;
  }

  delete(key) {
    return this.items.delete(key);
  }

  set(type, row, col, metadata = {}) {
    const entry = {
      id: `board-item-${++this.serial}`,
      type,
      row,
      col,
      ...metadata,
    };
    this.items.set(cellKey(row, col), entry);
    return entry;
  }

  snapshot() {
    return {
      visible: [...this.items.values()].map((item) => ({ ...item })),
      pending: this.pending.map((item) => ({ ...item })),
    };
  }
}
