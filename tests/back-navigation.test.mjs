import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

// 안드로이드에서 뒤로가기의 첫 뜻은 언제나 "지금 덮여 있는 것을 걷어라"다.
// 그 뜻을 받아줄 곳이 없는 오버레이는 조용히 앱 종료로 흘러간다.

test('every overlay that can cover the screen answers the back gesture', async () => {
  const [nav, html] = await Promise.all([read('js/navigation.js'), read('index.html')]);

  // 화면을 덮을 수 있는 오버레이를 전부 세고, 그 중 뒤로가기가 다루지 않는
  // 것이 없는지 본다. 새 오버레이를 추가하면 여기서 걸린다.
  // class="overlay-close"인 닫기 버튼까지 걸리지 않게, 첫 낱말이 정확히
  // overlay인 것만 센다.
  const overlays = [...html.matchAll(/class="overlay(?: [^"]*)?" id="([a-z-]+)"/g)].map((m) => m[1]);
  assert.ok(overlays.length >= 6, `오버레이를 못 찾았다: ${overlays}`);

  const handled = new Set([
    // 일시정지 계열은 따로 다룬다 - 닫는 것이 아니라 판을 재개해야 한다.
    ...[...nav.matchAll(/PAUSE_FAMILY = \[([^\]]+)\]/g)]
      .flatMap((m) => [...m[1].matchAll(/'#([a-z-]+)'/g)].map((x) => x[1])),
    ...[...nav.matchAll(/\{ overlay: '#([a-z-]+)'/g)].map((m) => m[1]),
  ]);

  const missing = overlays.filter((id) => !handled.has(id));
  assert.deepEqual(missing, [], `뒤로가기가 못 닫는 오버레이: ${missing.join(', ')}`);
});

test('back closes an overlay by pressing its own close button', async () => {
  const nav = await read('js/navigation.js');

  // DOM만 감추면 안 되는 이유가 둘 있다. 결과 화면에서 연 기록 시트는 닫을
  // 때 결과 시트를 다시 세워야 하고, 도움팩 제안은 기다리고 있는 약속을
  // '거절'로 매듭지어야 한다 - 시간 제한이 없는 창이라 감추기만 하면
  // 그 판이 영영 끝나지 않는다.
  assert.match(nav, /const button = document\.querySelector\(dismissible\.button\);/);
  assert.match(nav, /if \(button\) button\.click\(\);/);
  assert.match(nav, /\{ overlay: '#help-pack-overlay', button: '#help-pack-decline-button' \}/);
  assert.match(nav, /\{ overlay: '#continue-overlay', button: '#continue-decline-button' \}/);
});

test('back checks covering overlays before the pause family', async () => {
  const nav = await read('js/navigation.js');
  const handler = nav.slice(nav.indexOf("addEventListener('popstate'"));
  const dismissAt = handler.indexOf('topDismissible()');
  const pauseAt = handler.indexOf('pauseFamilyOpen()');
  assert.ok(dismissAt > 0 && pauseAt > 0);
  // 일시정지에서 연 '방법'처럼 덮는 창이 늘 더 위에 있다.
  assert.ok(dismissAt < pauseAt, '일시정지를 먼저 보면 위에 덮인 창을 못 걷는다');
});

test('the exit warning stays, but only on the home screen', async () => {
  const nav = await read('js/navigation.js');
  assert.match(nav, /한 번 더 누르면 나가요/);
  const handler = nav.slice(nav.indexOf("addEventListener('popstate'"));
  // 종료 경고는 모든 분기가 return으로 빠져나간 뒤에만 닿아야 한다.
  assert.ok(handler.indexOf('exitArmedAt = Date.now()') > handler.indexOf('pauseFamilyOpen()'));
  assert.ok(handler.indexOf('exitArmedAt = Date.now()') > handler.indexOf("screen === 'result'"));
});
