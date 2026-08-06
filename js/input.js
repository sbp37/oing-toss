import { normalizeRect, rectKey } from './board.js';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function cellFromPoint(boardEl, clientX, clientY) {
  const direct = document.elementFromPoint(clientX, clientY)?.closest('.tile');
  if (direct && boardEl.contains(direct)) {
    return { r: Number(direct.dataset.row), c: Number(direct.dataset.col) };
  }

  const rect = boardEl.getBoundingClientRect();
  const size = Number(boardEl.dataset.size) || 4;
  if (!rect.width || !rect.height) return null;
  const x = clamp(clientX, rect.left + 1, rect.right - 1);
  const y = clamp(clientY, rect.top + 1, rect.bottom - 1);
  return {
    r: clamp(Math.floor(((y - rect.top) / rect.height) * size), 0, size - 1),
    c: clamp(Math.floor(((x - rect.left) / rect.width) * size), 0, size - 1),
  };
}

export function attachStickyRectangleInput({
  boardEl,
  isEnabled,
  onPreview,
  onCommit,
  onCancel,
  onSelectionStep,
}) {
  let pointerId = null;
  let startCell = null;
  let lastCell = null;
  let lastKey = '';
  let committed = false;

  const previewAt = (event) => {
    const cell = cellFromPoint(boardEl, event.clientX, event.clientY);
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

  const reset = (cancelled = false) => {
    const oldPointerId = pointerId;
    pointerId = null;
    startCell = null;
    lastCell = null;
    lastKey = '';
    committed = false;
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
    startCell = cell;
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
    previewAt(event);
  };

  const onPointerUp = (event) => {
    if (event.pointerId !== pointerId || !startCell || committed) return;
    event.preventDefault();
    previewAt(event);
    const returnedToOrigin = lastCell
      && lastCell.r === startCell.r
      && lastCell.c === startCell.c;
    if (returnedToOrigin) {
      reset(true);
      return;
    }
    committed = true;
    const rect = normalizeRect(startCell, lastCell || startCell);
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
