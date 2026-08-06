let enabled = true;
let lastSelectionTick = 0;

function vibrate(pattern) {
  if (!enabled) return;
  try { navigator.vibrate?.(pattern); } catch {}
}

export function setHapticEnabled(value) {
  enabled = Boolean(value);
}

export function isHapticEnabled() {
  return enabled;
}

export function selectionTick(isPerfect = false) {
  const now = performance.now();
  if (now - lastSelectionTick < 24) return;
  lastSelectionTick = now;
  vibrate(isPerfect ? [5, 8, 7] : 3);
}

export function successHaptic(combo = 1) {
  if (combo >= 8) vibrate([14, 22, 20, 22, 28]);
  else if (combo >= 5) vibrate([12, 20, 20]);
  else if (combo >= 3) vibrate([10, 18, 14]);
  else vibrate(15);
}

export function failHaptic() {
  vibrate([8, 45, 8]);
}

export function itemHaptic() {
  vibrate([7, 20, 11]);
}

export function roundHaptic() {
  vibrate([10, 20, 14, 20, 22]);
}
