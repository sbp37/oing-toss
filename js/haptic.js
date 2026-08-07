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

export function bombHaptic() {
  vibrate([18, 22, 28]);
}

export function megaBombHaptic() {
  vibrate([24, 18, 34, 22, 20]);
}

export function clockHaptic() {
  vibrate([8, 24, 12]);
}

export function freezeHaptic() {
  vibrate([5, 18, 5, 18, 10]);
}

export function cloverHaptic() {
  vibrate([7, 16, 7, 16, 14]);
}

export function roundHaptic() {
  vibrate([10, 20, 14, 20, 22]);
}

export function countdownHaptic(seconds) {
  if (Number(seconds) <= 3) vibrate(Number(seconds) === 1 ? [7, 18, 11] : 6);
}

export function readyCountHaptic(step) {
  if (step === 'GO!') vibrate([8, 16, 13]);
  else vibrate(Number(step) === 1 ? 8 : 5);
}
