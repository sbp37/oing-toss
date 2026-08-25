import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('home teaches the rectangle rule once, as the large display headline', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../css/styles.css', import.meta.url), 'utf8');
  const home = html.slice(html.indexOf('id="home-screen"'), html.indexOf('id="play-screen"'));
  const finalHomeRules = css.slice(css.lastIndexOf('Home rule headline'));

  assert.doesNotMatch(home, /class="home-tagline"/);
  // 홈 화면만 게임 이름을 따라 '오잉!'을 쓴다. 게임 안 연출은 뿅을 유지한다.
assert.match(home, /<em>사각형<\/em>으로 묶어서 합이 <em>10<\/em>이면, 오잉!/);
  assert.match(finalHomeRules, /\.home-instruction[\s\S]*?font-family:\s*var\(--font-display\)/);
  assert.match(finalHomeRules, /font-size:\s*clamp\(14px,\s*4vw,\s*16px\)/);
  assert.match(finalHomeRules, /white-space:\s*nowrap/);
  assert.match(finalHomeRules, /\.home-instruction em[\s\S]*?color:\s*var\(--coral-deep\)/);
});
