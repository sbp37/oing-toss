import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, css, game] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../css/play-layout-v1.css', import.meta.url), 'utf8'),
  readFile(new URL('../js/game.js', import.meta.url), 'utf8'),
]);

test('in-game help presents the rectangle rule with readable motion cues', () => {
  assert.match(html, /id="play-help-button"[^>]+aria-label="게임 방법 보기"/);
  assert.match(html, /id="help-overlay"[\s\S]*?id="help-title">10 만드는 법</);
  assert.match(html, /시작 칸에서 반대쪽 칸까지 드래그/);
  assert.match(html, /네모 안의 모든 숫자를 더해봐/);
  assert.match(html, /빈칸은 0/);
  assert.match(html, /고양이 칸도 0[\s\S]*?보너스 점수를 받아/);
  assert.match(css, /\.help-steps li[\s\S]*?font-size:\s*clamp\(15px,\s*4\.2vw,\s*17px\)/);
  assert.match(css, /@keyframes help-selection-demo/);
  assert.match(css, /@keyframes help-finger-demo/);
});

test('help lives inside pause, and opening it works from either state', () => {
  assert.match(game, /#play-help-button'\)\.addEventListener\('click', \(\) => this\.openHelp\(\)\)/);

  // 방법 버튼은 플레이 화면이 아니라 일시정지 도구 줄에 있다. 플레이 화면에
  // 두었을 때 일시정지 버튼 바로 위 같은 세로줄에 붙어 한 덩어리로 보인다는
  // 실기기 제보를 받았다.
  assert.match(html, /pause-quick-actions[\s\S]*?id="play-help-button"[\s\S]*?<\/div>/);
  assert.doesNotMatch(html, /play-help-button[^>]*class="play-help-button"/);

  // 이미 멈춘 상태에서는 pause()가 조기 반환하므로 오버레이만 갈아 끼워야
  // 한다. 이 분기가 없으면 방법 버튼이 아무 반응도 하지 않는다.
  assert.match(game, /if \(this\.state\.running && this\.state\.paused\) \{[\s\S]*?setOverlay\('help-overlay', true\);/);
  assert.match(game, /this\.pause\('help', 'help-overlay'\);/);
  assert.match(game, /this\.ui\.setOverlay\(this\.activePauseOverlay, false\);/);
});
