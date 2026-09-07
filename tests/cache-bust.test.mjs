import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('mutable app files carry a generated build revision', async () => {
  const index = await read('index.html');
  assert.match(index, /css\/styles\.css\?v=__OING_BUILD_ID__/);
  assert.match(index, /js\/game\.js\?v=__OING_BUILD_ID__/);
  assert.match(index, /sw\.js\?v=__OING_BUILD_ID__/);
  assert.match(index, /updateViaCache:\s*'none'/);
});

test('the worker and static build replace persistent AIT cache keys', async () => {
  const worker = await read('sw.js');
  const build = await read('hosting/build-static.mjs');
  assert.match(worker, /const BUILD_ID = '__OING_BUILD_ID__'/);
  assert.match(worker, /versioned\('css\/styles\.css'\)/);
  assert.match(worker, /versioned\('js\/game\.js'\)/);
  assert.match(worker, /skipWaiting\(\)/);
  assert.match(build, /createHash\("sha256"\)/);
  assert.match(build, /replaceAll\(BUILD_TOKEN, buildId\)/);
  assert.match(build, /stampJavaScriptImports/);
  assert.match(build, /hosting\/build-static\.mjs/);
});
