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

// ── 친구 초대 보상: 진짜 저장소를 흉내내어 잰다 ─────────────────────────
//
// 이 보상은 결과 화면에서 받고 다음 판 시작에 지급된다. 그 사이에만
// 존재하는 메모리 변수에 두면, 앱을 닫은 사람은 초대장까지 보내고도
// 아무것도 못 받는다. 그리고 "읽으면서 곧바로 비우기"는 지급이 실패했을 때
// 보상을 조용히 없앤다 - 잃는 쪽이 두 번 받는 쪽보다 나쁘다.

function withFakeStorage(run) {
  const scope = globalThis;
  const had = 'localStorage' in scope;
  const previous = had ? scope.localStorage : undefined;
  const map = new Map();
  const store = {
    failWrites: false,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      if (store.failWrites) throw new Error('저장 실패');
      map.set(k, String(v));
    },
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
  scope.localStorage = store;
  return Promise.resolve()
    .then(() => run(store))
    .finally(() => {
      if (had) scope.localStorage = previous;
      else delete scope.localStorage;
    });
}

test('an invite reward survives the app being closed, and only clears once paid', async () => {
  await withFakeStorage(async (store) => {
    const { storageAdapter } = await import(`../js/adapters.js?invite=${Math.random()}`);

    // 초대 두 번 -> 수량이 쌓인다
    storageAdapter.addPendingShareHints(2);
    storageAdapter.addPendingShareHints(1);
    assert.equal(storageAdapter.getPendingShareHints(), 3, '여러 번 초대하면 누적된다');

    // 앱을 껐다 켠 상황: 저장소만 남고 메모리는 사라진다
    const reopened = await import(`../js/adapters.js?invite2=${Math.random()}`);
    assert.equal(reopened.storageAdapter.getPendingShareHints(), 3, '새로 켜도 살아 있다');

    // 지급이 실패한 판: 아직 비우지 않았으므로 그대로 남아야 한다
    assert.equal(reopened.storageAdapter.getPendingShareHints(), 3, '지급 전에는 남는다');

    // 지급 성공 -> 그만큼만 덜어낸다
    assert.equal(reopened.storageAdapter.consumePendingShareHints(3), 0);
    assert.equal(reopened.storageAdapter.getPendingShareHints(), 0, '지급 뒤에는 비어야 한다');

    // 한 번 더 지급을 시도해도 줄 것이 없다(중복 지급 없음)
    assert.equal(reopened.storageAdapter.getPendingShareHints(), 0);

    // 부분 지급도 남은 만큼 지킨다
    reopened.storageAdapter.addPendingShareHints(4);
    reopened.storageAdapter.consumePendingShareHints(1);
    assert.equal(reopened.storageAdapter.getPendingShareHints(), 3);

    // 저장이 막힌 기기(사파리 비공개 모드 등)에서도 던지지 않는다.
    // 이때 값이 남아 다음 판에 한 번 더 지급될 수는 있다 - 잃는 것보다 낫다.
    store.failWrites = true;
    assert.doesNotThrow(() => reopened.storageAdapter.consumePendingShareHints(3));
    store.failWrites = false;
  });
});

test('the game pays the invite reward before it clears it', async () => {
  const game = await readFile(new URL('../js/game.js', import.meta.url), 'utf8');
  const block = game.slice(game.indexOf('const pendingHints ='), game.indexOf('const pendingHints =') + 700);
  const grantAt = block.indexOf('grantItems({ hint: pendingHints }');
  const clearAt = block.indexOf('consumePendingShareHints');
  assert.ok(grantAt > 0 && clearAt > 0);
  assert.ok(grantAt < clearAt, '비우고 나서 지급하면 실패했을 때 보상이 사라진다');
  assert.ok(!block.includes('takePendingShareHints'), '읽으면서 비우는 옛 방식이 남아 있다');
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

// ── 광고 슬롯: 문법이 아니라 실제 호출 순서를 잰다 ──────────────────────
//
// 예전 시험은 소스에 for/await가 있는지만 봤다. 그건 판 시작의 연달아
// 부르기만 덮고, 정작 남아 있던 구멍(광고를 쓴 자리에서 곧바로 다시
// 불러오는 finally)은 통과시킨다. 가짜 SDK에 실제 상태를 물려 잰다.

// ads.js는 다리를 경로로 동적 import한다. 노드에서는 그 경로를 가로챌
// 수 없어서, 실제 호출 순서(광고가 떠 있는 동안 load가 안 불리는지)는
// 브라우저 쪽 하네스에서 잰다 - scratchpad/ad-slot.mjs가 route로 다리를
// 바꿔치기해 load/show 로그를 찍는다. 여기서는 그 보증을 떠받치는 구조가
// 코드에 살아 있는지만 지킨다.

test('ads.js exposes the guard the reload path needs', async () => {
  const ads = await readFile(new URL('../js/ads.js', import.meta.url), 'utf8');

  // 광고가 떠 있는 동안의 로드 요청은 접어 뒀다가 끝난 뒤에 한 번만 돈다.
  assert.match(ads, /let showingKind = null;/);
  assert.match(ads, /const deferredLoads = new Set\(\);/);
  assert.match(ads, /if \(showingKind !== null\) \{[\s\S]{0,120}deferredLoads\.add\(kind\);[\s\S]{0,40}return false;/);
  assert.match(ads, /showingKind = kind;[\s\S]{0,120}showRewardedAd\(adGroupId\)/);
  assert.match(ads, /showingKind = null;/);

  // 끝난 뒤에는 방금 쓴 자리와 미뤄 둔 것을 순차로 채운다.
  const fin = ads.slice(ads.indexOf('} finally {', ads.indexOf('export async function showAd')));
  assert.match(fin, /const pending = \[kind, \.\.\.deferredLoads\]/);
  assert.match(fin, /for \(const next of pending\) \{[\s\S]{0,60}await preloadAd\(next\)/);
});

test('the two ad slots are filled one after the other at run start', async () => {
  const game = await readFile(new URL('../js/game.js', import.meta.url), 'utf8');
  // 판 시작에서 두 광고를 동시에 부르지 않는다.
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

// ── 검수 2차: 동기 콜백에서도 정리는 정확히 한 번 ────────────────────────
//
// SDK가 run() 안에서 곧바로 콜백을 부르면, settle이 cleanup을 대입하기
// 전에 돈다. 그러면 SDK가 준 정리 함수가 영영 안 불려 리스너가 샌다.
// 검수에서 "ok=true인데 cleanups=0"으로 재현된 자리다.

async function countCleanups(patch, call) {
  const restore = fakeTossScope();
  const sdk = await import('@apps-in-toss/web-framework');
  const originals = {
    load: sdk.GoogleAdMob.loadAppsInTossAdMob,
    show: sdk.GoogleAdMob.showAppsInTossAdMob,
  };
  let cleanups = 0;
  const cleanup = () => { cleanups += 1; };
  patch(sdk, cleanup);
  try {
    const bundle = await import(`${ENTRY.href}?cleanup=${Math.random().toString(36).slice(2)}`);
    bundle.__setAdDeadlinesForTest(80, 80);
    const result = await call(bundle);
    return { cleanups, result };
  } finally {
    sdk.GoogleAdMob.loadAppsInTossAdMob = originals.load;
    sdk.GoogleAdMob.showAppsInTossAdMob = originals.show;
    restore();
  }
}

test('a synchronous loaded event still runs cleanup exactly once', async () => {
  const { cleanups, result } = await countCleanups(
    (sdk, cleanup) => {
      sdk.GoogleAdMob.loadAppsInTossAdMob = ({ onEvent }) => {
        onEvent({ type: 'loaded' });   // 동기 호출
        return cleanup;
      };
    },
    (bundle) => bundle.loadRewardedAd('ait.test'),
  );
  assert.equal(result, true);
  assert.equal(cleanups, 1, `동기 콜백에서 정리가 ${cleanups}회 불렸다`);
});

test('a synchronous onError still runs cleanup exactly once', async () => {
  const { cleanups, result } = await countCleanups(
    (sdk, cleanup) => {
      sdk.GoogleAdMob.loadAppsInTossAdMob = ({ onError }) => {
        onError(new Error('nope'));
        return cleanup;
      };
    },
    (bundle) => bundle.loadRewardedAd('ait.test'),
  );
  assert.equal(result, false);
  assert.equal(cleanups, 1);
});

test('a synchronous failedToShow still runs cleanup exactly once', async () => {
  const { cleanups, result } = await countCleanups(
    (sdk, cleanup) => {
      sdk.GoogleAdMob.showAppsInTossAdMob = ({ onEvent }) => {
        onEvent({ type: 'failedToShow' });
        return cleanup;
      };
    },
    (bundle) => bundle.showRewardedAd('ait.test'),
  );
  assert.equal(result.failed, true);
  assert.equal(result.rewarded, false);
  assert.equal(cleanups, 1);
});

test('a late event after the deadline changes neither the result nor the cleanup count', async () => {
  let fire = null;
  const { cleanups, result } = await countCleanups(
    (sdk, cleanup) => {
      sdk.GoogleAdMob.showAppsInTossAdMob = ({ onEvent }) => {
        fire = onEvent;                 // 아무것도 안 보내고 시간 제한을 넘긴다
        return cleanup;
      };
    },
    async (bundle) => {
      const promise = bundle.showRewardedAd('ait.test');
      const settled = await promise;    // timeout으로 끝난다
      // 끝난 뒤에 늦게 도착하는 이벤트
      fire?.({ type: 'userEarnedReward', data: { unitAmount: 999 } });
      fire?.({ type: 'dismissed' });
      await new Promise((r) => setTimeout(r, 40));
      return settled;
    },
  );
  assert.equal(result.rewarded, false, '이미 끝난 뒤의 보상은 반영하지 않는다');
  assert.equal(result.amount, 0);
  assert.equal(result.failed, true);
  assert.equal(cleanups, 1, `늦은 이벤트로 정리가 ${cleanups}회 불렸다`);
});

test('a cleanup that throws does not break the ad flow', async () => {
  const restore = fakeTossScope();
  const sdk = await import('@apps-in-toss/web-framework');
  const original = sdk.GoogleAdMob.loadAppsInTossAdMob;
  sdk.GoogleAdMob.loadAppsInTossAdMob = ({ onEvent }) => {
    onEvent({ type: 'loaded' });
    return () => { throw new Error('cleanup 실패'); };
  };
  try {
    const bundle = await import(`${ENTRY.href}?throwing=1`);
    bundle.__setAdDeadlinesForTest(80, 80);
    assert.equal(await bundle.loadRewardedAd('ait.test'), true);
  } finally {
    sdk.GoogleAdMob.loadAppsInTossAdMob = original;
    restore();
  }
});
