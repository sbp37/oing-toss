import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const BUNDLE = new URL('../js/vendor/toss-game-center-v1.js', import.meta.url);
// 번들은 SDK를 통째로 안에 넣어 굽는다. 그래서 node_modules 쪽 SDK를 바꿔도
// 번들 안의 사본에는 닿지 않는다 - 번들을 상대로 시험하면 통과해도 그건
// 우리가 세운 가짜가 아니라 진짜 SDK가 실패한 결과다(실제로 한 번 그렇게
// 헛통과했다). 동작은 원본을 상대로 재고, 번들에는 "다시 구웠는가"만 묻는다.
const ENTRY = new URL('../tools/toss-game-center-entry.mjs', import.meta.url);

// 광고 다리의 약속이 끝나지 않으면 게임이 통째로 굳는다. 이어하기는
// finishing 상태로, 도움팩은 paused 상태로 - 화면에는 아무 표시도 없이
// 그냥 안 눌리는 판이 된다. 토스 공식 문서에도 안드로이드 특정 버전에서
// dismissed가 오지 않은 사례가 적혀 있어서, 가정이 아니라 실제 위험이다.

function fakeTossScope() {
  const scope = globalThis;
  const hadWindow = 'window' in scope;
  if (!hadWindow) scope.window = scope;
  scope.ReactNativeWebView = { postMessage() {} };
  scope.__appsInTossConstants = { tossAppVersion: '5.999.0', platformOS: 'android' };
  return () => {
    delete scope.ReactNativeWebView;
    delete scope.__appsInTossConstants;
    if (!hadWindow) delete scope.window;
  };
}

test('a show that never reports back still ends, and reports failure', async () => {
  const restore = fakeTossScope();
  try {
    const bundle = await import(`${ENTRY.href}?deadline=show`);
    const sdk = await import('@apps-in-toss/web-framework');
    const original = sdk.GoogleAdMob.showAppsInTossAdMob;
    // 아무 이벤트도 보내지 않는 SDK. 예전 구현이라면 여기서 영원히 멈춘다.
    sdk.GoogleAdMob.showAppsInTossAdMob = () => () => {};
    bundle.__setAdDeadlinesForTest(60, 60);
    try {
      const started = Date.now();
      const result = await bundle.showRewardedAd('ait.test.group');
      assert.ok(Date.now() - started < 3000, '시간 제한 안에 끝나야 한다');
      assert.equal(result.rewarded, false);
      assert.equal(result.failed, true, '못 띄운 것으로 보고해야 안내가 나간다');
    } finally {
      sdk.GoogleAdMob.showAppsInTossAdMob = original;
    }
  } finally {
    restore();
  }
});

test('a load that never reports back resolves false instead of hanging', async () => {
  const restore = fakeTossScope();
  try {
    const bundle = await import(`${ENTRY.href}?deadline=load`);
    const sdk = await import('@apps-in-toss/web-framework');
    const original = sdk.GoogleAdMob.loadAppsInTossAdMob;
    sdk.GoogleAdMob.loadAppsInTossAdMob = () => () => {};
    bundle.__setAdDeadlinesForTest(60, 60);
    try {
      const started = Date.now();
      const ok = await bundle.loadRewardedAd('ait.test.group');
      assert.ok(Date.now() - started < 3000);
      assert.equal(ok, false);
    } finally {
      sdk.GoogleAdMob.loadAppsInTossAdMob = original;
    }
  } finally {
    restore();
  }
});

test('a reward that arrives without a close event is still paid', async () => {
  const restore = fakeTossScope();
  try {
    const bundle = await import(`${ENTRY.href}?deadline=reward`);
    const sdk = await import('@apps-in-toss/web-framework');
    const original = sdk.GoogleAdMob.showAppsInTossAdMob;
    // 보상은 왔는데 dismissed가 유실된 경우. 끝까지 본 사람이므로 지급이 맞다.
    sdk.GoogleAdMob.showAppsInTossAdMob = ({ onEvent }) => {
      setTimeout(() => onEvent({ type: 'userEarnedReward', data: { unitAmount: 30 } }), 10);
      return () => {};
    };
    bundle.__setAdDeadlinesForTest(60, 120);
    try {
      const result = await bundle.showRewardedAd('ait.test.group');
      assert.equal(result.rewarded, true);
      assert.equal(result.amount, 30);
      assert.equal(result.failed, false, '지급됐으면 실패로 알리지 않는다');
    } finally {
      sdk.GoogleAdMob.showAppsInTossAdMob = original;
    }
  } finally {
    restore();
  }
});

test('the shipped bundle carries the deadline, not just the source', async () => {
  const [bundle, entry] = await Promise.all([readFile(BUNDLE, 'utf8'), readFile(ENTRY, 'utf8')]);
  assert.match(entry, /setTimeout\(\(\) => settle\('timeout'\), ms\)/);
  // 원본에 있는데 번들에 없으면 굽는 걸 잊은 것이다 - 실기기에 나가는 것은
  // 번들 쪽이라, 이 사고가 예전에 아이폰 진동을 통째로 죽였었다.
  assert.ok(bundle.includes('setTimeout'), '번들을 다시 굽지 않았다');
  assert.ok(bundle.includes('__setAdDeadlinesForTest') || bundle.includes('timeout'),
    '시간 제한이 번들에 안 들어갔다');
});

test('an invite reward survives the app being closed before the next run', async () => {
  const [adapters, game] = await Promise.all([
    readFile(new URL('../js/adapters.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/game.js', import.meta.url), 'utf8'),
  ]);

  // 이 보상은 결과 화면에서 받고 다음 판 시작에 지급된다. 그 사이에만
  // 존재하는 메모리 변수에 두면, 앱을 닫은 사람은 친구에게 초대장까지
  // 보내고도 아무것도 못 받는다. 토스가 sendViral을 보낸 시점에 이미
  // 지급이 확정된 것이므로 그 순간 기기에 적어야 한다.
  assert.match(adapters, /PENDING_SHARE_HINTS_KEY = 'oing_toss_v3_pending_share_hints'/);
  assert.match(adapters, /addPendingShareHints\(amount\)/);
  assert.match(adapters, /takePendingShareHints\(\)/);
  assert.match(game, /storageAdapter\.addPendingShareHints\(earned\)/);
  assert.match(game, /storageAdapter\.takePendingShareHints\(\)/);

  // 지급과 비우기가 한 호출이어야 두 번 받는 일이 없다.
  const take = adapters.slice(adapters.indexOf('takePendingShareHints() {'), adapters.indexOf('getFedCount() {'));
  assert.match(take, /setItem\(PENDING_SHARE_HINTS_KEY, '0'\)/);
});

test('music comes back after a help-pack ad', async () => {
  const game = await readFile(new URL('../js/game.js', import.meta.url), 'utf8');

  // runRewardedAd의 finally는 restoreAfterAdPause보다 먼저 도는데, 그때는
  // 아직 paused가 true라 음악 복원을 건너뛴다. 그래서 도움팩 광고를 한 번
  // 보면 그 판 내내 배경음악이 꺼져 있었다.
  const restore = game.slice(game.indexOf('restoreAfterAdPause() {'), game.indexOf('restoreAfterAdPause() {') + 1200);
  const resumeAt = restore.indexOf('this.state.paused = false');
  const musicAt = restore.indexOf('playMusic()');
  assert.ok(musicAt > 0, '광고 뒤 음악을 되살리지 않는다');
  assert.ok(musicAt > resumeAt, 'paused를 푼 뒤에 불러야 조건을 통과한다');
});

test('the AD badge only promises an ad that is actually loaded', async () => {
  const game = await readFile(new URL('../js/game.js', import.meta.url), 'utf8');

  // adsAvailable은 환경과 ID만 본다. 그것으로 배지를 띄우면, 로드가 실패한
  // 상황에서도 "광고로 채울 수 있음"처럼 보이고 누르면 아무 일도 안 난다 -
  // watchItemRefillAd가 adReady에서 조용히 되돌아가기 때문이다.
  assert.match(game, /adRefill: \{ pack: adReady\('helpPack'\) && !this\.adHelpPackUsed \}/);
  // 배경에서 로드가 끝나면 배지를 다시 그린다.
  assert.match(game, /onAdReadyChange\(\(\) => \{[\s\S]{0,80}updateHUD\(\)/);
});

test('the two ad slots load one after the other, not at once', async () => {
  const game = await readFile(new URL('../js/game.js', import.meta.url), 'utf8');

  // 공식 문서가 한 번에 하나씩 load -> show -> 다음 load를 권하고, 여러
  // 그룹을 연달아 부르면 이벤트가 누락되던 사례가 안드로이드 특정 버전에
  // 기록돼 있다. 병렬로 얻을 것도 없다 - 이어하기는 판 끝, 도움팩은
  // 아이템이 떨어진 뒤라 둘 다 급하지 않다.
  assert.doesNotMatch(game, /\['continue', 'helpPack'\]\.forEach\(\(kind\) => preloadAd/);
  assert.match(game, /for \(const kind of \['continue', 'helpPack'\]\) \{[\s\S]{0,60}await preloadAd\(kind\)/);
});

test('the share link preview uses a real OG image, not a tall card', async () => {
  const [data, adapters] = await Promise.all([
    readFile(new URL('../js/data.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/adapters.js', import.meta.url), 'utf8'),
  ]);

  // 토스 권장 규격은 1200x600 가로형이다. 카드 원본(1086x1448 webp)은
  // 비율도 형식도 어긋나서 미리보기가 제대로 안 그려질 수 있다.
  assert.match(data, /SHARE_OG_IMAGE = 'assets\/share\/og-oing-1200x600\.png'/);
  assert.match(adapters, /publicImageUrl\(SHARE_OG_IMAGE\)/);
});
