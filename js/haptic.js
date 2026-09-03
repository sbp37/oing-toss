import { isAppsInTossWebView } from './leaderboard.js';

let enabled = true;
let lastSelectionTick = 0;
let lastImpactAt = 0;

// 진동은 기기마다 다른 길로 간다.
// - 안드로이드: navigator.vibrate. 동기 호출이라 즉시 울리고, 박자와 길이를
//   우리가 짠 대로 실을 수 있다. 토스 안에서도 이 길을 쓴다.
// - 아이폰: 웹 Vibration API가 아예 없다. 토스의 Device.triggerHaptic이
//   유일한 길이고, 토스 밖에서는 진동이 없다.
//
// 번들(js/vendor/toss-game-center-v1.js)에 haptic 내보내기가 없으면 조용히
// 넘어간다. 다시 굽는 명령은 tools/toss-game-center-entry.mjs 주석에 있다.
const loadTossBridge = () => import('./vendor/toss-game-center-v1.js');
let tossHapticPromise = null;
// 다리를 한 번 열어보고 나면 결과를 여기 남긴다. 'pending'인 동안만
// 네이티브를 믿고 기다리고, null로 판명되면 그때부터 웹 진동으로 돌아간다.
// 이게 없으면 다리가 끊겼을 때 안드로이드까지 진동이 통째로 죽는다.
let tossHapticTrigger = 'pending';

function tossHaptic() {
  if (!isAppsInTossWebView()) return null;
  tossHapticPromise ||= loadTossBridge()
    .then((module) => (typeof module.triggerHaptic === 'function' && module.isHapticSupported?.()
      ? module.triggerHaptic
      : null))
    .catch(() => null)
    .then((trigger) => {
      tossHapticTrigger = trigger;
      return trigger;
    });
  return tossHapticPromise;
}

// 네이티브 햅틱은 "얼마나 오래"가 아니라 "어떤 느낌"으로 부른다. 웹 패턴과
// 일대일로 맞출 수 없으므로, 각 순간이 무엇인지로 골라 짝지어 둔다.
function native(type) {
  if (tossHapticTrigger === null) return false;
  const pending = tossHaptic();
  if (!pending) return false;
  pending.then((trigger) => trigger?.({ type })).catch(() => {});
  return true;
}

// 웹 진동을 쓸 수 있는지. 안드로이드는 있고 아이폰(사파리/WKWebView)은 없다.
// 이 한 줄이 두 기기의 갈림길이다 - 아래 feel/impact 주석 참고.
function canVibrate() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

function vibrate(pattern) {
  if (!enabled) return;
  try { navigator.vibrate?.(pattern); } catch {}
}

// 어느 길로 울릴지 고르는 곳.
//
// 2026-08 실기기 제보(토스 안드로이드): "웹앱 때보다 약하고, 답 맞췄을 때
// 진동이 살짝 늦다." 원인은 이 함수가 토스 안에서 무조건 네이티브를 고른
// 것이었다. 네이티브 다리는 비동기 왕복이라 한 박자 늦고, 세기도 토스가
// 정한 고정 타입이라 우리가 짠 패턴보다 밋밋하다.
//
// 그래서 웹 진동이 있으면 그쪽을 먼저 쓴다. navigator.vibrate는 동기 호출이라
// 즉시 울리고, 박자와 길이를 우리가 정한 그대로 실을 수 있다.
// 네이티브는 웹 진동이 없는 기기(아이폰)에서만 쓴다 - 거기서는 그것이
// 유일한 길이고, 없으면 진동이 아예 0이다.
function feel(type, pattern) {
  if (!enabled) return;
  if (canVibrate()) { vibrate(pattern); return; }
  native(type);
}

function impact(type, pattern) {
  lastImpactAt = performance.now();
  if (!enabled) return;
  if (canVibrate()) {
    vibrate(0);
    vibrate(pattern);
    return;
  }
  native(type);
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

// 2026-08 실기기 제보: "답 맞췄을 때 쾌감이 적다." 기본 성공이 22ms 단발이라
// 얇았다. 한 번 툭 치고 곧바로 여운을 남기는 두 박으로 바꾼다 - 길게 늘리면
// 웅웅거려 싸구려로 느껴지므로, 총 길이가 아니라 박의 개수로 두께를 만든다.
export function successHaptic(combo = 1) {
  if (combo >= 8) impact('success', [26, 20, 32, 20, 44]);
  else if (combo >= 5) impact('basicMedium', [22, 18, 34]);
  else if (combo >= 3) impact('tickMedium', [20, 16, 28]);
  else impact('tap', [16, 14, 26]);
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

// 마지막 5초의 심장박동. 초가 줄수록 두 박 사이가 좁아져 몸이 먼저
// 카운트다운을 느낀다. 소리(10초 경고음)와 겹치지 않는 촉각 전용 층이다.
export function finalRushHaptic(second = 5) {
  const gap = 40 + Math.max(0, Math.round(second)) * 14;
  feel('tickMedium', [18, gap, 26]);
}

export function gameOverHaptic(newRecord = false) {
  if (newRecord) impact('confetti', [16, 18, 20, 18, 32]);
  else impact('basicMedium', [18, 30, 26]);
}
