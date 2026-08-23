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

test('opening help pauses play and closing it resumes the same run', () => {
  assert.match(game, /#play-help-button'\)\.addEventListener\('click', \(\) => this\.openHelp\(\)\)/);
  assert.match(game, /openHelp\(\)\s*\{\s*this\.pause\('help', 'help-overlay'\);\s*\}/);
  assert.match(game, /this\.ui\.setOverlay\(this\.activePauseOverlay, false\);/);
});
