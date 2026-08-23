import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GameUI } from '../js/ui.js';

function classListFor(classes) {
  return {
    add: (...names) => names.forEach((name) => classes.add(name)),
    remove: (...names) => names.forEach((name) => classes.delete(name)),
  };
}

test('a successful clear reveals the chapter before celebration delays', async () => {
  const tileClasses = new Set();
  const frameClasses = new Set();
  const tile = {
    dataset: {},
    style: { setProperty() {} },
    classList: classListFor(tileClasses),
  };
  const context = {
    tileAt: () => tile,
    elements: { marquee: { classList: classListFor(new Set()) } },
    boardFrame: {
      classList: classListFor(frameClasses),
      dataset: {},
    },
    spawnParticles() {},
    showScoreFlight() {},
  };

  const animation = GameUI.prototype.animateSuccess.call(
    context,
    { r1: 0, c1: 0, r2: 0, c2: 1 },
    1,
  );

  assert.equal(tileClasses.has('is-success'), true);
  assert.equal(tileClasses.has('is-cleared-reveal'), true);
  await animation;
});

test('live selection clears an idle hint before drawing its own sum', async () => {
  const source = await readFile(new URL('../js/game.js', import.meta.url), 'utf8');
  const pointerStart = source.slice(source.indexOf('onPointerStart:'), source.indexOf('onTapAnchor:'));
  assert.match(pointerStart, /this\.ui\.clearHint\(\)/);
  assert.ok(pointerStart.indexOf('clearHint()') < pointerStart.indexOf('clearSelection()'));
});

test('bomb impact does not render a second bomb image', async () => {
  const source = await readFile(new URL('../js/ui.js', import.meta.url), 'utf8');
  const impact = source.slice(source.indexOf('async animateBomb('), source.indexOf('async animateMegaBomb('));
  assert.doesNotMatch(impact, /createElement\(['"]img['"]\)/);
  assert.doesNotMatch(impact, /assets\/icons\/items\/bomb/);
});
