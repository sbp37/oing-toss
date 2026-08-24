import { isAppsInTossWebView } from './leaderboard.js';

let enabled = true;
let lastSelectionTick = 0;
let lastImpactAt = 0;

// 토스 안에서는 네이티브 햅틱을 쓴다. 두 가지가 한 번에 해결된다:
// - 아이폰: 웹 Vibration API를 지원하지 않아 지금까지 진동이 전혀 없었다.
//   토스의 Device.triggerHaptic은 iOS에서도 동작한다.
// - 안드로이드: navigator.vibrate의 짧은 패턴은 기기에 따라 거의 안 느껴진다.
//   네이티브 햅틱은 기기가 정한 세기로 또렷하게 울린다.
//
// 번들(js/vendor/toss-game-center-v1.js)에 haptic 내보내기가 아직 없으면
// 조용히 navigator.vibrate로 떨어진다 - 번들을 다시 굽기 전에도 안전하다.
// 다시 굽는 명령은 tools/toss-game-center-entry.mjs 주석에 있다.
const loadTossBridge = () => import('./vendor/toss-game-center-v1.js');
let tossHapticPromise = null;

function tossHaptic() {
  if (!isAppsInTossWebView()) return null;
  tossHapticPromise ||= loadTossBridge()
    .then((module) => (typeof module.triggerHaptic === 'function' && module.isHapticSupported?.()
      ? module.triggerHaptic
      : null))
    .catch(() => null);
  return tossHapticPromise;
}

// 네이티브 햅틱은 "얼마나 오래"가 아니라 "어떤 느낌"으로 부른다. 웹 패턴과
// 일대일로 맞출 수 없으므로, 각 순간이 무엇인지로 골라 짝지어 둔다.
function native(type) {
  const pending = tossHaptic();
  if (!pending) return false;
  pending.then((trigger) => trigger?.({ type })).catch(() => {});
  return true;
}

function vibrate(pattern) {
  if (!enabled) return;
  try { navigator.vibrate?.(pattern); } catch {}
}

// 네이티브가 잡히면 그쪽만 울린다. 둘 다 울리면 토스 안드로이드에서 두 번
// 떨리는 것처럼 느껴진다.
function feel(type, pattern) {
  if (!enabled) return;
  if (native(type)) return;
  vibrate(pattern);
}

function impact(type, pattern) {
  lastImpactAt = performance.now();
  if (!enabled) return;
  if (native(type)) return;
  vibrate(0);
  vibrate(pattern);
}

export function setHapticEnabled(value) {
  enabled = Boolean(value);
}

export function isHapticEnabled() {
  return enabled;
}

// iOS 사파리는 Vibration API 자체를 지원하지 않는다. 지원 여부를 모른 채
// 설정에 진동 토글만 켜두면, 아이폰 유저는 켜도 아무 일이 없어 고장으로 느낀다.
// 설정 화면에서 이 값으로 토글을 비활성화하고 안내를 띄운다.
// 토스 안에서는 네이티브 햅틱이 있으므로 아이폰에서도 지원으로 친다.
export function isHapticSupported() {
  if (isAppsInTossWebView()) return true;
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

// 웹 패턴의 길이를 전반적으로 올렸다. 실기기 제보로 "안드로이드가 좀 약하다"는
// 말이 나왔는데, 3~15ms대는 요즘 기기의 진동 모터가 제대로 실어주지 못하는
// 구간이다. 리듬(몇 번, 어떤 간격)은 그대로 두고 각 박의 길이만 키웠다.
export function selectionTick(isPerfect = false) {
  const now = performance.now();
  if (now - lastImpactAt < 48) return;
  if (now - lastSelectionTick < 24) return;
  lastSelectionTick = now;
  feel('tickWeak', isPerfect ? [9, 8, 12] : 8);
}

export function successHaptic(combo = 1) {
  if (combo >= 8) impact('success', [20, 22, 26, 22, 36]);
  else if (combo >= 5) impact('basicMedium', [18, 20, 28]);
  else if (combo >= 3) impact('tickMedium', [16, 18, 22]);
  else impact('tap', 22);
}

export function failHaptic() {
  impact('error', [14, 45, 14]);
}

export function itemHaptic() {
  feel('tap', [12, 20, 18]);
}

export function bombHaptic() {
  impact('basicMedium', [24, 22, 38]);
}

export function megaBombHaptic() {
  impact('confetti', [32, 18, 44, 22, 30]);
}

export function clockHaptic() {
  feel('softMedium', [14, 24, 20]);
}

export function freezeHaptic() {
  feel('wiggle', [10, 18, 10, 18, 16]);
}

export function cloverHaptic() {
  feel('success', [12, 16, 12, 16, 20]);
}

export function roundHaptic() {
  impact('success', [16, 20, 20, 20, 30]);
}

export function countdownHaptic(seconds) {
  if (Number(seconds) <= 3) {
    if (Number(seconds) === 1) feel('tickMedium', [12, 18, 18]);
    else feel('basicWeak', 12);
  }
}

export function readyCountHaptic(step) {
  if (step === 'GO!') feel('success', [14, 16, 22]);
  else if (Number(step) === 1) feel('tickMedium', 14);
  else feel('basicWeak', 10);
}

export function gameOverHaptic(newRecord = false) {
  if (newRecord) impact('confetti', [16, 18, 20, 18, 32]);
  else impact('basicMedium', [18, 30, 26]);
}
