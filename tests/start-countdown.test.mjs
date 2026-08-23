import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the dark countdown is primed before mobile audio unlock can delay it', async () => {
  const game = await readFile(new URL('../js/game.js', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../js/ui.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../css/play-layout-v1.css', import.meta.url), 'utf8');
  const start = game.slice(game.indexOf('async start('), game.indexOf('async runStartCountdown('));
  const primeAt = start.indexOf('this.ui.primeStartCountdown(');
  const audioWaitAt = start.indexOf('await Promise.all([audioReady, musicReady])');

  assert.ok(primeAt >= 0 && audioWaitAt >= 0 && primeAt < audioWaitAt);
  assert.match(ui, /primeStartCountdown[\s\S]*?classList\.add\('is-visible', 'is-primed'\)/);
  assert.match(css, /\.start-countdown\.is-visible\.is-primed:not\(\.is-leaving\)[\s\S]*?animation:\s*none;[\s\S]*?opacity:\s*1;/);
});
