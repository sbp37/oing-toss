import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('freeze uses only a brief screen tint and sparkle layer', async () => {
  const ui = await readFile(new URL('../js/ui.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../css/play-layout-v1.css', import.meta.url), 'utf8');
  const freeze = ui.slice(ui.indexOf('async animateFreeze('), ui.indexOf('setFreezeActive(', ui.indexOf('async animateFreeze(')));

  assert.match(freeze, /for \(let index = 0; index < 7; index \+= 1\) impact\.appendChild\(document\.createElement\('i'\)\)/);
  assert.doesNotMatch(freeze, /document\.createElement\('b'\)/);
  assert.doesNotMatch(freeze, /freeze-impact-title/);
  assert.doesNotMatch(css, /\.item-impact-freeze b\s*\{/);
  assert.doesNotMatch(css, /\.freeze-impact-title\s*\{/);
});

test('selected item effect policy stays encoded in the final visual layer', async () => {
  const css = await readFile(new URL('../css/play-layout-v1.css', import.meta.url), 'utf8');
  const selection = css.slice(css.lastIndexOf('Item FX selection pass'));

  assert.match(selection, /shuffle-soft-syrup/);
  assert.match(selection, /clover-soft-focus/);
  assert.doesNotMatch(selection, /bomb-soft-ring/);
  assert.doesNotMatch(selection, /\.megabomb-fx::before,[\s\S]*?border-width:\s*7px/);
});
