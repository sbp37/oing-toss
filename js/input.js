import { normalizeRect, rectKey } from './board.js';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// cachedRect가 오면 그것을 쓴다. 판의 위치와 크기는 한 번의 드래그 동안
// 바뀌지 않는데, 손가락이 움직일 때마다 getBoundingClientRect를 부르면
// 브라우저가 그 자리에서 판 전체의 배치를 다시 계산한다. 칸이 54개인 판에서는
// 이 읽기 한 번이 한 칸 이동 비용의 대부분을 차지했다.
export function cellFromPoint(boardEl, clientX, clientY, stickyCell = null, cachedRect = null) {
  const rect = cachedRect || boardEl.getBoundingClientRect();
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
    const hysteresis = clamp(Math.min(cellWidth, cellHeight) * 0.085, 4, 8);
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
  onTapAnchorExpired,
  onPointerStart,
}) {
  let pointerId = null;
  let boardRect = null;
  let startCell = null;
  let lastCell = null;
  let tapAnchor = null;
  let usingTapAnchor = false;
  let lastKey = '';
  let committed = false;
  let queuedEvent = null;
  let previewFrame = 0;
  let tapAnchorTimer = 0;
  // Whether this gesture ever left the cell it started on. A drag that comes
  // back to its origin is someone changing their mind, so it cancels; only a
  // gesture that never moved is a tap, and only a tap arms the anchor.
  let leftOrigin = false;

  const clearTapTimer = () => {
    if (tapAnchorTimer) clearTimeout(tapAnchorTimer);
    tapAnchorTimer = 0;
  };

  const previewAt = (event) => {
    const cell = cellFromPoint(boardEl, event.clientX, event.clientY, lastCell, boardRect);
    if (!cell || !startCell) return;
    lastCell = cell;
    if (cell.r !== startCell.r || cell.c !== startCell.c) leftOrigin = true;
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
    leftOrigin = false;
    if (clearTapAnchor) {
      tapAnchor = null;
      clearTapTimer();
    }
    if (previewFrame) cancelAnimationFrame(previewFrame);
    previewFrame = 0;
    boardRect = null;
    boardEl.classList.remove('is-dragging');
    if (cancelled) onCancel?.();
    if (oldPointerId !== null && boardEl.hasPointerCapture?.(oldPointerId)) {
      try { boardEl.releasePointerCapture(oldPointerId); } catch {}
    }
  };

  const onPointerDown = (event) => {
    if (!isEnabled() || pointerId !== null || event.isPrimary === false || event.button !== 0) return;
    // 이 제스처가 끝날 때까지 쓸 판의 좌표. 손가락을 누른 순간 한 번만 읽는다.
    boardRect = boardEl.getBoundingClientRect();
    const cell = cellFromPoint(boardEl, event.clientX, event.clientY, null, boardRect);
    if (!cell) return;
    event.preventDefault();
    onPointerStart?.();
    pointerId = event.pointerId;
    usingTapAnchor = Boolean(tapAnchor);
    startCell = tapAnchor || cell;
    lastCell = cell;
    committed = false;
    leftOrigin = false;
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
      if (usingTapAnchor || leftOrigin) {
        reset(true);
      } else {
        tapAnchor = { ...startCell };
        const anchor = { ...tapAnchor };
        reset(false, false);
        onTapAnchor?.(anchor);
        clearTapTimer();
        tapAnchorTimer = setTimeout(() => {
          if (!tapAnchor) return;
          tapAnchor = null;
          tapAnchorTimer = 0;
          onTapAnchorExpired?.();
        }, 2800);
      }
      return;
    }
    committed = true;
    const rect = normalizeRect(startCell, lastCell || startCell);
    tapAnchor = null;
    clearTapTimer();
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
      clearTapTimer();
      boardEl.removeEventListener('pointerdown', onPointerDown);
      boardEl.removeEventListener('pointermove', onPointerMove);
      boardEl.removeEventListener('pointerup', onPointerUp);
      boardEl.removeEventListener('pointercancel', onPointerCancel);
      boardEl.removeEventListener('lostpointercapture', onLostPointerCapture);
    },
  };
}
