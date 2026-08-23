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

test('cleared cells drop selection state synchronously, including bomb spill', () => {
  const classes = new Map();
  const tileFor = (r, c, item = '') => {
    const key = `${r}:${c}`;
    const names = new Set(['is-selected', 'is-hint-area']);
    classes.set(key, names);
    return { dataset: { item }, classList: classListFor(names) };
  };
  const tiles = new Map([
    ['0:0', tileFor(0, 0)],
    ['0:1', tileFor(0, 1)],
    ['1:0', tileFor(1, 0)],
    ['1:1', tileFor(1, 1, 'bomb')],
  ]);
  let selectionClears = 0;
  GameUI.prototype.revealClearedCells.call({
    clearSelection() { selectionClears += 1; },
    tileAt: (r, c) => tiles.get(`${r}:${c}`),
  }, { r1: 0, c1: 0, r2: 0, c2: 1 }, [{ r: 1, c: 0 }, { r: 1, c: 1 }]);

  assert.equal(selectionClears, 1);
  for (const key of ['0:0', '0:1', '1:0']) {
    assert.equal(classes.get(key).has('is-selected'), false, `${key} kept a selected face`);
    assert.equal(classes.get(key).has('is-cleared-reveal'), true, `${key} did not reveal immediately`);
  }
  assert.equal(classes.get('1:1').has('is-cleared-reveal'), false, 'an unconsumed board item must keep its face');
});

test('the game reveals removed cells before starting delayed celebration', async () => {
  const source = await readFile(new URL('../js/game.js', import.meta.url), 'utf8');
  const success = source.slice(source.indexOf('const caughtItems = this.boardItemsInRect(rect);'), source.indexOf('const remainingAnswer = this.model.findAnswer();'));
  assert.ok(success.indexOf('this.model.remove(rect)') < success.indexOf('this.ui.revealClearedCells(rect, blastCells)'));
  assert.ok(success.indexOf('this.ui.revealClearedCells(rect, blastCells)') < success.indexOf('this.ui.animateSuccess(rect'));
});

test('the final hint frame is a thin mint guide', async () => {
  const css = await readFile(new URL('../css/play-layout-v1.css', import.meta.url), 'utf8');
  const finalHintRules = css.slice(css.lastIndexOf('Readable hint, lighter frame'));
  assert.match(finalHintRules, /\.hint-region\s*\{[\s\S]*?border-width:\s*2\.5px;/);
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
