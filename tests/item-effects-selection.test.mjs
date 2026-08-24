import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('freeze keeps its original sound while adding cracks and a central notice', async () => {
  const ui = await readFile(new URL('../js/ui.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../css/play-layout-v1.css', import.meta.url), 'utf8');
  const freeze = ui.slice(ui.indexOf('async animateFreeze('), ui.indexOf('setFreezeActive(', ui.indexOf('async animateFreeze(')));

  assert.match(freeze, /for \(let index = 0; index < 6; index \+= 1\) impact\.appendChild\(document\.createElement\('b'\)\)/);
  assert.match(freeze, /impactTitle\.className = 'freeze-impact-title'/);
  assert.match(freeze, /impactTitle\.textContent = '시간 정지!'/);
  assert.match(css, /\.item-impact-freeze b\s*\{/);
  assert.match(css, /\.freeze-impact-title\s*\{/);
});

test('selected item effect policy stays encoded in the final visual layer', async () => {
  const css = await readFile(new URL('../css/play-layout-v1.css', import.meta.url), 'utf8');
  const selection = css.slice(css.lastIndexOf('Item FX selection pass'));

  assert.match(selection, /shuffle-soft-syrup/);
  assert.match(selection, /bomb-soft-ring/);
  assert.match(selection, /clover-soft-focus/);
  assert.match(selection, /\.megabomb-fx::before,[\s\S]*?border-width:\s*7px/);
});
