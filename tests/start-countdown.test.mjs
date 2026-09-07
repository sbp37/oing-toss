import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the dark countdown is primed before mobile audio unlock can delay it', async () => {
  const game = await readFile(new URL('../js/game.js', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../js/ui.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../css/play-layout-v1.css', import.meta.url), 'utf8');
  const start = game.slice(game.indexOf('async start('), game.indexOf('async runStartCountdown('));
  const primeAt = start.indexOf('this.ui.primeStartCountdown(');
  const audioWaitAt = start.indexOf('Promise.all([audioReady, musicReady])');

  assert.ok(primeAt >= 0 && audioWaitAt >= 0 && primeAt < audioWaitAt);
  assert.match(ui, /primeStartCountdown[\s\S]*?classList\.add\('is-visible', 'is-primed'\)/);
  assert.match(css, /\.start-countdown\.is-visible\.is-primed:not\(\.is-leaving\)[\s\S]*?animation:\s*none;[\s\S]*?opacity:\s*1;/);
});

// 첫 접속에서 "3이 멈춰 있다가 3·2·1이 또 나온다"는 제보를 붙잡는 가드다.
// 원인은 둘이었다 - 오디오 대기에 상한이 없었고, 대기가 끝난 뒤 카운트다운이
// 미리 띄운 숫자부터 다시 돌았다. 둘 다 여기서 지킨다.
test('the primed digit is bounded and never counted twice', async () => {
  const game = await readFile(new URL('../js/game.js', import.meta.url), 'utf8');
  const start = game.slice(game.indexOf('async start('), game.indexOf('async runStartCountdown('));

  // 오디오 대기는 상한과 경주한다 - 언락이 느려도 커튼이 멎어 있지 않는다.
  assert.match(start, /Promise\.race\(\[[\s\S]*?Promise\.all\(\[audioReady, musicReady\]\)[\s\S]*?COUNTDOWN_AUDIO_WAIT_CAP_MS[\s\S]*?\]\)/);
  assert.match(game, /const COUNTDOWN_AUDIO_WAIT_CAP_MS = \d+/);

  // 미리 띄운 숫자가 제 박자를 채웠으면 그 다음 숫자부터 이어간다.
  assert.match(start, /skipPrimedStep/);
  const cap = Number(game.match(/const COUNTDOWN_AUDIO_WAIT_CAP_MS = (\d+)/)[1]);
  assert.ok(cap > 0 && cap <= 2000, `대기 상한이 현실적이어야 한다: ${cap}ms`);

  // runStartCountdown은 건너뛸 때 첫 단계만 덜어낸다.
  const run = game.slice(game.indexOf('async runStartCountdown('));
  assert.match(run, /skipPrimedStep && all\.length > 1 \? all\.slice\(1\) : all/);
});
