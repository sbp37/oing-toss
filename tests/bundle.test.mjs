import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

// 꾸러미 다이어트의 안전장치.
//
// 공유 미리보기 그림(assets/share)은 .ait에서만 빠진다. 그 전제는 하나뿐이다 -
// 앱은 그 파일들을 절대 로컬 경로로 부르지 않고, 언제나 공개 웹 주소로만
// 넘긴다는 것. 나중에 누가 <img src="assets/share/...">를 하나 쓰면 웹에서는
// 멀쩡히 보이고 토스 안에서만 그림이 깨진다 - 개발 중에는 절대 안 보이는
// 종류의 고장이라 여기서 막는다.

const url = (p) => new URL('../' + p, import.meta.url);

test('공유 그림을 로컬 경로로 부르는 곳이 없다', async () => {
  const html = await readFile(url('index.html'), 'utf8');
  assert.ok(!html.includes('assets/share'), 'index.html이 공유 그림을 직접 부른다');

  for (const name of await readdir(url('css'))) {
    if (!name.endsWith('.css')) continue;
    const css = await readFile(url('css/' + name), 'utf8');
    assert.ok(!css.includes('assets/share'), `${name}이 공유 그림을 직접 부른다`);
  }

  // js에서는 data.js의 상수 두 줄만 허용한다.
  for (const name of await readdir(url('js'))) {
    if (!name.endsWith('.js')) continue;
    const js = await readFile(url('js/' + name), 'utf8');
    if (!js.includes('assets/share')) continue;
    assert.equal(name, 'data.js', `${name}에 공유 그림 경로가 새로 생겼다`);
  }
});

test('공유 그림 경로는 언제나 공개 주소로 바뀐 뒤에 쓰인다', async () => {
  const adapters = await readFile(url('js/adapters.js'), 'utf8');
  const calls = [...adapters.matchAll(/shareOgImageFor\s*\(/g)];
  assert.ok(calls.length > 0, '공유 그림을 고르는 자리가 사라졌다');
  for (const m of calls) {
    const before = adapters.slice(Math.max(0, m.index - 20), m.index);
    assert.match(before, /publicImageUrl\($/, '공유 그림이 공개 주소로 안 바뀌고 쓰인다');
  }
});

test('.ait 빌드만 공유 그림을 걷어낸다', async () => {
  const build = await readFile(url('hosting/build-static.mjs'), 'utf8');
  assert.match(build, /--ait/, '.ait 갈래가 없다');
  assert.match(build, /if \(forAit\)[\s\S]{0,200}assets\/share/, '.ait에서 공유 그림을 안 걷어낸다');

  const pkg = JSON.parse(await readFile(url('package.json'), 'utf8'));
  assert.equal(pkg.scripts['build:ait'], 'node hosting/build-static.mjs --ait');
  // 되돌리기는 반드시 finally에 있어야 한다. `&&`로 이으면 가운데 단계가
  // 실패했을 때 되돌리기가 아예 안 돌고, dist/client가 공유 그림이 빠진 채로
  // 남는다. 그걸 웹에 올리면 미리보기가 조용히 빈칸이 된다.
  assert.equal(pkg.scripts.ait, 'node tools/build-ait.mjs');
  const runner = await readFile(url('tools/build-ait.mjs'), 'utf8');
  assert.match(runner, /finally\s*\{[\s\S]*build-static\.mjs/, '복구가 finally 안에 없다');
  // 웹/안드로이드는 완전본을 써야 한다.
  assert.equal(pkg.scripts.build, 'node hosting/build-static.mjs');
  assert.match(pkg.scripts['android:sync'], /^npm run build /);
});
