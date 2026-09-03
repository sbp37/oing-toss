// 스토어 등록용 스크린샷을 실제 게임에서 뽑는다.
//
// 원스토어 규격: 가로/세로 최대 1300px, 9:16 권장, JPG/PNG, 1MB 이하, 2~8장.
// 그래서 뷰포트를 412×732(=9:16)로 잡고 2배 배율로 찍은 뒤 732×1300으로
// 줄이고 JPEG로 저장한다.
//
// 실행:
//   npx serve -s . -l 8766 &
//   node tools/build-store-screenshots.mjs
//   python3 -c "..."  # 아래 안내대로 리사이즈 (store/README.md 참고)
//
// 기록 화면과 홈의 최고점수는 테스트 모드에서 저장되지 않으므로(게임이
// 테스트 실행으로 기록을 더럽히지 않도록 막아둔 것), 몇 판 해본 사람의
// 저장소를 그대로 심어서 찍는다.

import { chromium } from 'playwright';

const OUT = new URL('../store/screenshots/', import.meta.url).pathname;
const VW = 412, VH = 732;              // 9:16 (412/732 = .5628)
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
const shot = async (name) => { await p.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name); };

// A plausible played-in history: test mode never writes records, so seed the
// same keys a handful of finished runs would have left behind.
await ctx.addInitScript(() => {
  const seed = {
    oing_toss_v3_classic_best_score: '5240',
    oing_toss_v3_classic_recent_scores: '[1860,2940,2210,4120,3480,5240,4360]',
    oing_toss_v3_best_combo: '14',
    oing_toss_v3_classic_chapters_seen: '["garden","forest","stream","village"]',
    oing_toss_v3_drag_tutorial_done: '1',
  };
  for (const [k, v] of Object.entries(seed)) { try { localStorage.setItem(k, v); } catch {} }
});

await p.goto('http://localhost:8766/?test=1', { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);

// 1. home
await shot('01-home');

// 7. record overlay (from home, before any run)
await p.click('#home-ranking-button');
await p.waitForTimeout(1300);
await shot('07-record');
await p.click('#ranking-close');
await p.waitForTimeout(700);

// 2. mid-drag selection on a real answer
await p.evaluate(() => window.__OING_TEST__.startClassic());
await p.waitForTimeout(1600);
await p.evaluate(() => { window.__OING_TEST__.setScore(1240); window.__OING_TEST__.setCombo(4); });
const drag = await p.evaluate(() => {
  const a = window.__OING_TEST__.findAnswer();
  if (!a) return null;
  const q = (r, c) => document.querySelector(`.tile[data-row="${r}"][data-col="${c}"]`).getBoundingClientRect();
  const s = q(a.r1, a.c1), e = q(a.r2, a.c2);
  return { sx: s.x + s.width / 2, sy: s.y + s.height / 2, ex: e.x + e.width / 2, ey: e.y + e.height / 2 };
});
if (drag) {
  await p.mouse.move(drag.sx, drag.sy);
  await p.mouse.down();
  await p.mouse.move((drag.sx + drag.ex) / 2, (drag.sy + drag.ey) / 2, { steps: 6 });
  await p.mouse.move(drag.ex, drag.ey, { steps: 6 });
  await p.waitForTimeout(320);
  await shot('02-play');
  await p.mouse.up();
  await p.waitForTimeout(900);
}

// 3. WOW - a real five-plus-cell clear
const wow = await p.evaluate(async () => {
  const t = window.__OING_TEST__;
  for (let board = 1; board < 8; board += 1) {
    t.classicJumpBoard(board);
    await new Promise((r) => setTimeout(r, 260));
    const big = t.findAnswers().find((a) => (a.r2 - a.r1 + 1) * (a.c2 - a.c1 + 1) >= 5);
    if (big) { t.setCombo(6); t.commit(big); return (big.r2 - big.r1 + 1) * (big.c2 - big.c1 + 1); }
  }
  return null;
});
await p.waitForTimeout(240);
await shot('03-wow');
console.log('wow cells:', wow);
await p.waitForTimeout(1400);

// 4. hidden picture emerging on a deeper board
const cleared = await p.evaluate(async () => {
  const t = window.__OING_TEST__;
  t.classicJumpBoard(5);
  await new Promise((r) => setTimeout(r, 400));
  let n = 0;
  for (let i = 0; i < 9; i += 1) {
    const a = t.findAnswer();
    if (!a) break;
    t.commit(a);
    n += 1;
    await new Promise((r) => setTimeout(r, 210));
  }
  t.setScore(4820);
  t.setCombo(5);
  return n;
});
await p.waitForTimeout(1200);
await shot('04-picture');
console.log('cleared answers:', cleared);

// 5. bomb on the board
await p.evaluate(async () => {
  const t = window.__OING_TEST__;
  const grid = t.getBoard();
  outer: for (let r = 1; r < grid.length - 1; r += 1) {
    for (let c = 1; c < grid[r].length - 1; c += 1) {
      if (grid[r][c] != null) { t.forceBoardItem('bomb', r, c); break outer; }
    }
  }
  t.setTimeLeft(38);
});
await p.waitForTimeout(700);
await shot('05-item');

// 6. result sheet
await p.evaluate(() => window.__OING_TEST__.finish());
await p.waitForTimeout(3200);
await shot('06-result');

console.log('pageerrors:', errs.length ? errs : 'none');
await b.close();
