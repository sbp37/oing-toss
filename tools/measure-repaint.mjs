// 화면 상태별로 "프레임마다 다시 그리는 일"이 얼마나 일어나는지 잰다.
//
// 왜 있는가. 발열 제보를 받고 무한 CSS 애니메이션 다섯 개를 고쳤는데, 그때
// 근거로 든 수치를 저장소에 안 남겨서 외부 검수가 독립 재현을 못 했다.
// 주장만 남고 확인할 방법이 없는 수치는 근거가 아니다.
//
// 재는 것: Chromium 트레이싱에서 Paint / RasterTask 이벤트를 직접 센다.
// 프레임마다 다시 칠하는 연출이 있으면 5초에 수백 번씩 잡히고, 합성기만
// 쓰는 연출(transform / opacity / brightness·saturate 필터)이면 0이 나온다.
//
// 한계 (반드시 같이 읽을 것):
// - 메인 스레드만 본다. TaskDuration은 GPU 프로세스의 래스터·합성을 안 센다.
//   실기기 발열의 상당 부분은 GPU 쪽이라, 여기서 0이 나왔다고 폰이 시원해진다는
//   증명은 아니다. "연속 repaint 원인이 없다"까지만 말할 수 있다.
// - 데스크톱 Chromium이다. CPU 스로틀은 흉내일 뿐이고, 토스 안의 iOS WebKit이나
//   안드로이드 WebView는 합성 판단이 다를 수 있다.
// - 프레임 수를 세겠다고 requestAnimationFrame 루프를 넣으면 안 된다. 그 루프가
//   모든 CSS 애니메이션을 메인 스레드로 끌어내려서 결과를 통째로 오염시킨다
//   (같은 상태를 11.2%와 1.6%로 다르게 재는 일이 실제로 있었다).
//
// 쓰는 법:
//   npx serve -s . -l 8801        (다른 창에서)
//   node tools/measure-repaint.mjs
//   node tools/measure-repaint.mjs --url http://127.0.0.1:8801/ --width 390 --seconds 5
//
// Playwright가 필요하다. 이 저장소는 의존성으로 안 들고 있으므로(런타임에
// 안 쓰는 것을 설치 목록에 올리지 않는다), 없으면 아래 안내가 나온다.
// 전역에 깔려 있으면 --playwright로 경로를 넘겨도 된다.

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

async function loadChromium(hint) {
  const tried = [];
  const candidates = [
    hint,
    'playwright',
    ...(process.env.NODE_PATH || '').split(/[:;]/).filter(Boolean).map((dir) => `${dir}/playwright/index.js`),
    '/opt/node22/lib/node_modules/playwright/index.js',
  ].filter(Boolean);
  for (const candidate of candidates) {
    tried.push(candidate);
    try {
      const specifier = candidate.startsWith('.') || candidate.startsWith('/')
        ? pathToFileURL(createRequire(import.meta.url).resolve(candidate, { paths: [process.cwd()] })).href
        : candidate;
      const mod = await import(specifier);
      const chromium = mod.chromium || mod.default?.chromium;
      if (chromium) return chromium;
    } catch { /* 다음 후보 */ }
  }
  throw new Error(
    'Playwright를 못 찾았다. 다음 중 하나로 해결할 것:\n'
    + '  npm i -D playwright\n'
    + '  node tools/measure-repaint.mjs --playwright /경로/playwright/index.js\n'
    + `  (찾아본 곳: ${tried.join(', ')})`,
  );
}

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const URL_ = arg('url', 'http://127.0.0.1:8801/?test=1');
const WIDTH = Number(arg('width', 390));
const HEIGHT = Number(arg('height', 780));
const SECONDS = Number(arg('seconds', 5));
const THROTTLE = Number(arg('throttle', 6));
const EXECUTABLE = arg('chromium', '/opt/pw-browsers/chromium');

// 플레이 화면에서 켜지는 상태들. 실제 클래스/속성 이름 그대로다.
const STATES = {
  '조용한 플레이': () => {},
  '콤보 60 티어': () => { document.querySelector('.board-frame').dataset.comboTier = '60'; },
  '피버': () => { document.querySelector('.board-frame').classList.add('is-fever'); },
  '피버 종료 직전': () => { document.querySelector('.board-frame').classList.add('is-fever', 'is-fever-expiring'); },
  '시간 정지': () => { document.querySelector('.screen-play').classList.add('is-time-frozen'); },
  '마지막 30초': () => {
    document.querySelector('.screen-play').classList.add('is-final-countdown', 'is-final-rush');
    document.querySelector('.time-readout')?.classList.add('is-warning');
  },
  '전부 겹침': () => {
    const f = document.querySelector('.board-frame');
    f.dataset.comboTier = '60';
    f.classList.add('is-fever');
    document.querySelector('.screen-play').classList.add('is-final-countdown', 'is-final-rush');
    document.querySelector('.time-readout')?.classList.add('is-warning');
  },
};

const CLEAR = () => {
  const f = document.querySelector('.board-frame');
  delete f.dataset.comboTier;
  f.classList.remove('is-fever', 'is-fever-expiring');
  document.querySelector('.screen-play').classList.remove('is-final-countdown', 'is-final-rush', 'is-time-frozen');
  document.querySelector('.time-readout')?.classList.remove('is-warning');
};

const chromium = await loadChromium(arg('playwright', ''));
const browser = await chromium.launch({ executablePath: EXECUTABLE });
const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, serviceWorkers: 'block' });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);

await page.goto(URL_, { waitUntil: 'networkidle' });
if (!(await page.evaluate(() => Boolean(window.__OING_TEST__)))) {
  throw new Error('테스트 훅이 없다. 주소에 ?test=1을 붙일 것.');
}
await page.evaluate(() => window.__OING_TEST__.startClassic());
await page.waitForTimeout(2500);
// 첫 판의 튜토리얼 연출은 이 측정의 대상이 아니다.
await page.evaluate(() => document.querySelectorAll('[class*="tutorial"]').forEach((e) => e.remove()));

await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
await cdp.send('Performance.enable');

async function measure(label) {
  const events = [];
  const onData = (e) => events.push(...e.value);
  cdp.on('Tracing.dataCollected', onData);
  await cdp.send('Tracing.start', {
    categories: 'disabled-by-default-devtools.timeline',
    transferMode: 'ReportEvents',
  });
  const before = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  await page.waitForTimeout(SECONDS * 1000);
  const after = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.end');
  await done;
  cdp.off('Tracing.dataCollected', onData);

  const paints = events.filter((e) => e.name === 'Paint' && e.ph === 'X');
  const rasters = events.filter((e) => (e.name === 'RasterTask' || e.name === 'Rasterize') && e.ph === 'X');
  const cpu = ((after.TaskDuration - before.TaskDuration) / SECONDS) * 100;
  const rasterMs = rasters.reduce((s, e) => s + (e.dur || 0), 0) / 1000;
  console.log(
    label.padEnd(16),
    `${cpu.toFixed(1)}%`.padStart(7),
    `${paints.length}회`.padStart(9),
    `${rasterMs.toFixed(0)}ms`.padStart(10),
  );
  return { label, cpu, paints: paints.length, rasterMs };
}

console.log(`\n${WIDTH}x${HEIGHT} · CPU ${THROTTLE}배 스로틀 · 상태당 ${SECONDS}초`);
console.log('rAF 루프 없음(측정 오염 방지). GPU는 안 잡힌다 - 파일 맨 위 한계 참고.\n');
console.log('상태'.padEnd(16), '메인CPU'.padStart(7), 'Paint'.padStart(9), 'Raster'.padStart(10));

const results = [];
for (const [label, apply] of Object.entries(STATES)) {
  await page.evaluate(CLEAR);
  await page.waitForTimeout(400);
  await page.evaluate(apply);
  await page.waitForTimeout(700);
  results.push(await measure(label));
}

const dirty = results.filter((r) => r.paints > 0);
console.log(
  dirty.length
    ? `\n프레임마다 다시 그리는 상태 ${dirty.length}개: ${dirty.map((r) => r.label).join(', ')}`
    : '\n모든 상태에서 Paint 0회 - 연속 repaint를 만드는 연출이 없다.',
);
await browser.close();
