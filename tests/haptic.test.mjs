import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const BUNDLE = new URL('../js/vendor/toss-game-center-v1.js', import.meta.url);
const ENTRY = new URL('../tools/toss-game-center-entry.mjs', import.meta.url);

// 아이폰은 웹 Vibration API가 없어서, 토스의 네이티브 햅틱이 유일한 진동
// 통로다. 그 다리가 조용히 끊겨도 게임은 멀쩡히 돌아가기 때문에 사람이
// 알아채기 어렵다. 그래서 여기서 지킨다.

test('the shipped bundle carries the haptic bridge, not just the leaderboard', async () => {
  const bundle = await import(BUNDLE.href);
  assert.equal(typeof bundle.triggerHaptic, 'function');
  assert.equal(typeof bundle.isHapticSupported, 'function');
});

test('haptic support does not depend on an isSupported() the SDK never defines', async () => {
  const bundle = await import(BUNDLE.href);

  // 토스 SDK의 Device.triggerHaptic은 getAlbumItems 같은 기능과 달리
  // isSupported()를 달고 있지 않다. 그걸 그냥 부르면 TypeError가 나고,
  // 지원 확인이 영원히 false가 되어 아이폰 진동이 통째로 죽는다.
  const sdk = await import('@apps-in-toss/web-framework');
  assert.equal(typeof sdk.Device.triggerHaptic, 'function');
  assert.equal(typeof sdk.Device.triggerHaptic.isSupported, 'undefined');

  assert.equal(bundle.isHapticSupported(), true);
});

test('inside Toss the game takes the native route instead of web vibration', async () => {
  const scope = globalThis;
  const hadWindow = 'window' in scope;
  // SDK는 window.__appsInTossConstants를 직접 읽는다.
  if (!hadWindow) scope.window = scope;
  scope.ReactNativeWebView = { postMessage() {} };
  scope.__appsInTossConstants = { tossAppVersion: '5.999.0', platformOS: 'ios' };

  // 아이폰에는 이게 아예 없지만, 안드로이드에서 두 번 떨리는 걸 막으려면
  // 네이티브가 잡혔을 때 웹 진동이 조용해야 한다. 이 값이 늘어나면
  // 네이티브 경로가 끊겨 웹으로 몰래 떨어졌다는 뜻이다.
  const vibrated = [];
  const hadNavigator = 'navigator' in scope;
  if (!hadNavigator) scope.navigator = {};
  const previousVibrate = scope.navigator.vibrate;
  scope.navigator.vibrate = (pattern) => { vibrated.push(pattern); return true; };

  try {
    // 질의 문자열로 모듈을 새로 불러 다른 시험의 다리 상태와 섞이지 않게 한다.
    const { successHaptic, isHapticSupported } = await import('../js/haptic.js?scope=native');
    assert.equal(isHapticSupported(), true, '토스 안에서는 아이폰도 지원으로 친다');

    successHaptic(8);
    // 다리는 동적 import라 한 번 쉬어야 잡힌다.
    await new Promise((resolve) => setTimeout(resolve, 50));
    successHaptic(8);
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.deepEqual(vibrated, [], '네이티브가 있으면 웹 진동은 울리지 않아야 한다');
  } finally {
    if (previousVibrate === undefined) delete scope.navigator.vibrate;
    else scope.navigator.vibrate = previousVibrate;
    if (!hadNavigator) delete scope.navigator;
    delete scope.ReactNativeWebView;
    delete scope.__appsInTossConstants;
    if (!hadWindow) delete scope.window;
  }
});

test('outside Toss the game still vibrates through the web API', async () => {
  const scope = globalThis;
  const vibrated = [];
  const hadNavigator = 'navigator' in scope;
  if (!hadNavigator) scope.navigator = {};
  const previousVibrate = scope.navigator.vibrate;
  scope.navigator.vibrate = (pattern) => { vibrated.push(pattern); return true; };

  try {
    const { successHaptic } = await import('../js/haptic.js?scope=web');
    successHaptic(1);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.ok(vibrated.length > 0, '토스 밖 안드로이드는 웹 진동으로 울려야 한다');
  } finally {
    if (previousVibrate === undefined) delete scope.navigator.vibrate;
    else scope.navigator.vibrate = previousVibrate;
    if (!hadNavigator) delete scope.navigator;
  }
});

test('the bundle is rebuilt whenever the bridge source changes', async () => {
  const [entry, bundle] = await Promise.all([
    readFile(ENTRY, 'utf8'),
    readFile(BUNDLE, 'utf8'),
  ]);

  // 번들은 손으로 고치지 않고 entry에서 굽는다. entry가 내보내는 이름이
  // 번들에 없으면 굽는 걸 잊은 것이다 - 그 사고가 아이폰 진동을 죽였었다.
  const exported = [...entry.matchAll(/^export function (\w+)/gm)].map((m) => m[1]);
  assert.ok(exported.length >= 4, 'entry가 다리 함수들을 내보내야 한다');
  for (const name of exported) {
    assert.match(bundle, new RegExp(`\\bas ${name}\\b|\\b${name} as\\b|\\b${name}\\b`), `번들에 ${name}이 없다`);
  }
});
