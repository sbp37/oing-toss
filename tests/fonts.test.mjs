// The shipped fonts are subsets built from the Korean actually used by the
// game, and the @font-face rules pin an explicit unicode-range. A character
// outside that range does not fall back gracefully — it renders in whatever
// the device happens to have, or as tofu. That failure is invisible in code
// review and in every automated check that does not look at pixels, so this
// test is the guard: any Korean added to the UI must already be in both
// subsets, or the subsets must be rebuilt (tools/build-*-subset.py).
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function sourceFiles() {
  const files = [join(ROOT, 'index.html')];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(css|js)$/.test(entry)) files.push(path);
    }
  };
  walk(join(ROOT, 'css'));
  walk(join(ROOT, 'js'));
  return files;
}

// Minimal WOFF2-aware cmap reader would pull in a font library; the generated
// CSS already states the shipped range, and it is what the browser enforces.
function shippedRange(cssPath) {
  const css = readFileSync(cssPath, 'utf8');
  const match = css.match(/unicode-range:\s*([^;]+);/);
  assert.ok(match, `${cssPath} must declare a unicode-range`);
  const codes = new Set();
  for (const part of match[1].split(',')) {
    const token = part.trim();
    const range = token.match(/^U\+([0-9A-Fa-f]+)-([0-9A-Fa-f]+)$/);
    if (range) {
      for (let code = parseInt(range[1], 16); code <= parseInt(range[2], 16); code += 1) codes.add(code);
      continue;
    }
    const single = token.match(/^U\+([0-9A-Fa-f]+)$/);
    if (single) codes.add(parseInt(single[1], 16));
  }
  return codes;
}

test('every Korean character in the UI is covered by the shipped font subset', () => {
  const covered = shippedRange(join(ROOT, 'assets/fonts/Jua-Korean.css'));
  assert.ok(covered.size > 100, 'the shipped range should list the real subset');

  const missing = new Map();
  for (const file of sourceFiles()) {
    const text = readFileSync(file, 'utf8');
    for (const character of text) {
      const code = character.codePointAt(0);
      if (code < 0xac00 || code > 0xd7a3) continue;
      if (covered.has(code)) continue;
      if (!missing.has(character)) missing.set(character, file.slice(ROOT.length));
    }
  }

  assert.deepEqual(
    [...missing.keys()],
    [],
    `Korean characters used in the UI but absent from the font subset: ${
      [...missing.entries()].map(([character, file]) => `${character} (${file})`).join(', ')
    }. Rebuild with tools/build-jua-subset.py and tools/build-pretendard-subset.py.`,
  );
});
