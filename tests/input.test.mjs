import assert from 'node:assert/strict';
import test from 'node:test';
import { attachStickyRectangleInput, cellFromPoint } from '../js/input.js';

globalThis.requestAnimationFrame = (callback) => {
  callback();
  return 1;
};
globalThis.cancelAnimationFrame = () => {};

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
}

class FakeBoard extends EventTarget {
  constructor() {
    super();
    this.dataset = { size: '4', cols: '4', rows: '6' };
    this.classList = new FakeClassList();
    this.captured = new Set();
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, right: 400, bottom: 600, width: 400, height: 600 };
  }

  setPointerCapture(id) { this.captured.add(id); }
  releasePointerCapture(id) { this.captured.delete(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
}

function pointerEvent(type, { x, y, id = 1, isPrimary = true } = {}) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, {
    clientX: { value: x },
    clientY: { value: y },
    pointerId: { value: id },
    isPrimary: { value: isPrimary },
    button: { value: 0 },
  });
  return event;
}

test('rectangular hit testing keeps seven columns and independent row height', () => {
  const board = new FakeBoard();
  assert.deepEqual(cellFromPoint(board, 350, 550), { r: 5, c: 3 });
  assert.deepEqual(cellFromPoint(board, 150, 250), { r: 2, c: 1 });
});

test('two endpoint taps commit the same rectangle as a drag', () => {
  const board = new FakeBoard();
  const commits = [];
  const anchors = [];
  let cancels = 0;
  const input = attachStickyRectangleInput({
    boardEl: board,
    isEnabled: () => true,
    onPreview: () => {},
    onCommit: (rect) => commits.push(rect),
    onCancel: () => { cancels += 1; },
    onTapAnchor: (cell) => anchors.push(cell),
  });

  board.dispatchEvent(pointerEvent('pointerdown', { x: 50, y: 50 }));
  board.dispatchEvent(pointerEvent('pointerup', { x: 50, y: 50 }));
  assert.deepEqual(anchors, [{ r: 0, c: 0 }]);
  assert.equal(commits.length, 0);
  assert.equal(cancels, 0);

  board.dispatchEvent(pointerEvent('pointerdown', { x: 250, y: 350 }));
  board.dispatchEvent(pointerEvent('pointerup', { x: 250, y: 350 }));
  assert.deepEqual(commits, [{ r1: 0, r2: 3, c1: 0, c2: 2 }]);
  assert.equal(cancels, 0);
  input.destroy();
});

test('tapping the same anchored cell again cancels without committing', () => {
  const board = new FakeBoard();
  const commits = [];
  let cancels = 0;
  const input = attachStickyRectangleInput({
    boardEl: board,
    isEnabled: () => true,
    onPreview: () => {},
    onCommit: (rect) => commits.push(rect),
    onCancel: () => { cancels += 1; },
  });
  for (let index = 0; index < 2; index += 1) {
    board.dispatchEvent(pointerEvent('pointerdown', { x: 50, y: 50 }));
    board.dispatchEvent(pointerEvent('pointerup', { x: 50, y: 50 }));
  }
  assert.equal(commits.length, 0);
  assert.equal(cancels, 1);
  input.destroy();
});

test('tap anchor exposes a clearable visual state callback', () => {
  const board = new FakeBoard();
  const anchors = [];
  const input = attachStickyRectangleInput({
    boardEl: board,
    isEnabled: () => true,
    onPreview: () => {},
    onCommit: () => {},
    onTapAnchor: (cell) => anchors.push(cell),
  });
  board.dispatchEvent(pointerEvent('pointerdown', { x: 150, y: 150 }));
  board.dispatchEvent(pointerEvent('pointerup', { x: 150, y: 150 }));
  assert.deepEqual(anchors, [{ r: 1, c: 1 }]);
  input.cancel();
  input.destroy();
});

test('pointercancel releases the gesture without committing', () => {
  const board = new FakeBoard();
  const commits = [];
  let cancels = 0;
  const input = attachStickyRectangleInput({
    boardEl: board,
    isEnabled: () => true,
    onPreview: () => {},
    onCommit: (rect) => commits.push(rect),
    onCancel: () => { cancels += 1; },
  });
  board.dispatchEvent(pointerEvent('pointerdown', { x: 50, y: 50, id: 4 }));
  board.dispatchEvent(pointerEvent('pointermove', { x: 250, y: 350, id: 4 }));
  board.dispatchEvent(pointerEvent('pointercancel', { x: 250, y: 350, id: 4 }));
  assert.equal(commits.length, 0);
  assert.equal(cancels, 1);
  assert.equal(board.captured.size, 0);
  input.destroy();
});

test('non-primary touch is ignored and an outside pointer can return before commit', () => {
  const board = new FakeBoard();
  const commits = [];
  const input = attachStickyRectangleInput({
    boardEl: board,
    isEnabled: () => true,
    onPreview: () => {},
    onCommit: (rect) => commits.push(rect),
  });
  board.dispatchEvent(pointerEvent('pointerdown', { x: 50, y: 50, id: 8, isPrimary: false }));
  board.dispatchEvent(pointerEvent('pointerup', { x: 250, y: 350, id: 8, isPrimary: false }));
  assert.equal(commits.length, 0);
  board.dispatchEvent(pointerEvent('pointerdown', { x: 50, y: 50, id: 9 }));
  board.dispatchEvent(pointerEvent('pointermove', { x: 460, y: 680, id: 9 }));
  board.dispatchEvent(pointerEvent('pointerup', { x: 250, y: 350, id: 9 }));
  assert.deepEqual(commits, [{ r1: 0, r2: 3, c1: 0, c2: 2 }]);
  input.destroy();
});
