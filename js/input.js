import { normalizeRect, rectKey } from './board.js';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function cellFromPoint(boardEl, clientX, clientY, stickyCell = null) {
  const rect = boardEl.getBoundingClientRect();
  const cols = Number(boardEl.dataset.cols || boardEl.dataset.size) || 4;
  const rows = Number(boardEl.dataset.rows || boardEl.dataset.size) || 4;
  if (!rect.width || !rect.height) return null;
  const x = clamp(clientX, rect.left + 1, rect.right - 1);
  const y = clamp(clientY, rect.top + 1, rect.bottom - 1);
  const cellWidth = rect.width / cols;
  const cellHeight = rect.height / rows;
  let row = clamp(Math.floor((y - rect.top) / cellHeight), 0, rows - 1);
  let col = clamp(Math.floor((x - rect.left) / cellWidth), 0, cols - 1);

  // Keep the previous cell for a few pixels around a grid seam. This absorbs
  // fingertip jitter without slowing intentional or fast diagonal movement.
  if (stickyCell) {
    const hysteresis = clamp(Math.min(cellWidth, cellHeight) * 0.075, 3, 6);
    if (Math.abs(col - stickyCell.c) === 1) {
      const boundary = rect.left + Math.max(col, stickyCell.c) * cellWidth;
      if (Math.abs(x - boundary) < hysteresis) col = stickyCell.c;
    }
    if (Math.abs(row - stickyCell.r) === 1) {
      const boundary = rect.top + Math.max(row, stickyCell.r) * cellHeight;
      if (Math.abs(y - boundary) < hysteresis) row = stickyCell.r;
    }
  }
  return {
    r: row,
    c: col,
  };
}

export function attachStickyRectangleInput({
  boardEl,
  isEnabled,
  onPreview,
  onCommit,
  onCancel,
  onSelectionStep,
  onTapAnchor,
}) {
  let pointerId = null;
  let startCell = null;
  let lastCell = null;
  let tapAnchor = null;
  let usingTapAnchor = false;
  let lastKey = '';
  let committed = false;
  let queuedEvent = null;
  let previewFrame = 0;

  const previewAt = (event) => {
    const cell = cellFromPoint(boardEl, event.clientX, event.clientY, lastCell);
    if (!cell || !startCell) return;
    lastCell = cell;
    const rect = normalizeRect(startCell, cell);
    const key = rectKey(rect);
    if (key !== lastKey) {
      lastKey = key;
      onSelectionStep?.(rect);
    }
    onPreview(rect, { x: event.clientX, y: event.clientY });
  };

  const flushPreview = () => {
    previewFrame = 0;
    if (!queuedEvent || !startCell) return;
    const event = queuedEvent;
    queuedEvent = null;
    previewAt(event);
  };

  const queuePreview = (event) => {
    queuedEvent = { clientX: event.clientX, clientY: event.clientY };
    if (!previewFrame) previewFrame = requestAnimationFrame(flushPreview);
  };

  const reset = (cancelled = false, clearTapAnchor = cancelled) => {
    const oldPointerId = pointerId;
    pointerId = null;
    startCell = null;
    lastCell = null;
    lastKey = '';
    committed = false;
    queuedEvent = null;
    usingTapAnchor = false;
    if (clearTapAnchor) tapAnchor = null;
    if (previewFrame) cancelAnimationFrame(previewFrame);
    previewFrame = 0;
    boardEl.classList.remove('is-dragging');
    if (cancelled) onCancel?.();
    if (oldPointerId !== null && boardEl.hasPointerCapture?.(oldPointerId)) {
      try { boardEl.releasePointerCapture(oldPointerId); } catch {}
    }
  };

  const onPointerDown = (event) => {
    if (!isEnabled() || pointerId !== null || event.isPrimary === false || event.button !== 0) return;
    const cell = cellFromPoint(boardEl, event.clientX, event.clientY);
    if (!cell) return;
    event.preventDefault();
    pointerId = event.pointerId;
    usingTapAnchor = Boolean(tapAnchor);
    startCell = tapAnchor || cell;
    lastCell = cell;
    committed = false;
    lastKey = '';
    boardEl.classList.add('is-dragging');
    try { boardEl.setPointerCapture(pointerId); } catch {}
    previewAt(event);
  };

  const onPointerMove = (event) => {
    if (event.pointerId !== pointerId || !startCell) return;
    event.preventDefault();
    queuePreview(event);
  };

  const onPointerUp = (event) => {
    if (event.pointerId !== pointerId || !startCell || committed) return;
    event.preventDefault();
    if (previewFrame) {
      cancelAnimationFrame(previewFrame);
      previewFrame = 0;
    }
    queuedEvent = null;
    previewAt(event);
    const returnedToOrigin = lastCell
      && lastCell.r === startCell.r
      && lastCell.c === startCell.c;
    if (returnedToOrigin) {
      if (usingTapAnchor) {
        reset(true);
      } else {
        tapAnchor = { ...startCell };
        const anchor = { ...tapAnchor };
        reset(false, false);
        onTapAnchor?.(anchor);
      }
      return;
    }
    committed = true;
    const rect = normalizeRect(startCell, lastCell || startCell);
    tapAnchor = null;
    onCommit(rect, { x: event.clientX, y: event.clientY });
    reset(false);
  };

  const onPointerCancel = (event) => {
    if (event.pointerId !== pointerId) return;
    event.preventDefault();
    reset(true);
  };

  const onLostPointerCapture = (event) => {
    if (event.pointerId === pointerId) reset(true);
  };

  boardEl.addEventListener('pointerdown', onPointerDown, { passive: false });
  boardEl.addEventListener('pointermove', onPointerMove, { passive: false });
  boardEl.addEventListener('pointerup', onPointerUp, { passive: false });
  boardEl.addEventListener('pointercancel', onPointerCancel, { passive: false });
  boardEl.addEventListener('lostpointercapture', onLostPointerCapture);
  boardEl.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    cancel: () => reset(true),
    destroy() {
      boardEl.removeEventListener('pointerdown', onPointerDown);
      boardEl.removeEventListener('pointermove', onPointerMove);
      boardEl.removeEventListener('pointerup', onPointerUp);
      boardEl.removeEventListener('pointercancel', onPointerCancel);
      boardEl.removeEventListener('lostpointercapture', onLostPointerCapture);
    },
  };
}
