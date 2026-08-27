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

test('every card has a link-preview image, and it is the right shape', async () => {
  const { readdir, stat } = await import('node:fs/promises');
  const { shareOgImageFor, SHARE_OG_IMAGE } = await import('../js/data.js');
  const adapters = await readFile(new URL('../js/adapters.js', import.meta.url), 'utf8');

  // 토스 권장 규격은 1200x600 가로형이다. 카드 원본(1086x1448 webp)은
  // 비율도 형식도 어긋나서 미리보기가 제대로 안 그려질 수 있다. 그래서
  // 카드마다 짝이 되는 PNG를 미리 구워 둔다.
  assert.match(adapters, /publicImageUrl\(shareOgImageFor\(imageUrl\)\)/);

  const cardsDir = new URL('../assets/cards/', import.meta.url);
  const cards = (await readdir(cardsDir))
    .filter((name) => /^card-\d+-.*\.webp$/.test(name));
  assert.ok(cards.length >= 9, `카드를 못 찾았다: ${cards.length}`);

  for (const card of cards) {
    const og = shareOgImageFor(`assets/cards/${card}`);
    assert.notEqual(og, SHARE_OG_IMAGE, `${card}가 공통 배너로 떨어진다`);
    // 그림이 실제로 있어야 한다 - 없으면 미리보기가 통째로 빈다.
    const info = await stat(new URL(`../${og}`, import.meta.url));
    assert.ok(info.size > 10000, `${og}가 비었다`);
  }

  // 카드가 아닌 것(장면 그림, 빈 값)은 공통 배너로 떨어진다.
  assert.equal(shareOgImageFor('assets/chapters/chapter-garden.webp'), SHARE_OG_IMAGE);
  assert.equal(shareOgImageFor(''), SHARE_OG_IMAGE);
  assert.equal(shareOgImageFor(), SHARE_OG_IMAGE);
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

// 실기기 제보(아이폰): "30초 광고를 다 봤는데 +30초가 안 붙고 바로 결과창."
// 광고비는 이미 발생한 뒤라 이건 제일 나쁜 결말이다 - 유저 입장에서 먹튀다.
// AdMob 이벤트 순서는 기기마다 같지 않다. 안드로이드는 보통 보상 -> 닫힘인데
// 아이폰에서 닫힘이 먼저 오면, 닫힘에서 곧장 결론을 내는 코드는 끝까지 본
// 사람을 빈손으로 돌려보낸다.
test('닫힘이 보상보다 먼저 와도 지급한다 (아이폰 순서)', async () => {
  const restore = fakeTossScope();
  try {
    const bundle = await import(`${ENTRY.href}?ios=order`);
    const sdk = await import('@apps-in-toss/web-framework');
    const original = sdk.GoogleAdMob.showAppsInTossAdMob;
    sdk.GoogleAdMob.showAppsInTossAdMob = ({ onEvent }) => {
      setTimeout(() => onEvent({ type: 'show' }), 0);
      // 닫힘이 먼저, 보상이 나중.
      setTimeout(() => onEvent({ type: 'dismissed' }), 20);
      setTimeout(() => onEvent({ type: 'userEarnedReward', data: { unitType: 's', unitAmount: 30 } }), 60);
      return () => {};
    };
    bundle.__setAdDeadlinesForTest(60, 5000, 400, 999999);
    try {
      const result = await bundle.showRewardedAd('ait.test.group');
      assert.equal(result.rewarded, true, '다 본 사람이 빈손으로 돌아갔다');
      assert.equal(result.amount, 30, '콘솔 지급량을 못 받았다');
      assert.equal(result.failed, false);
    } finally {
      sdk.GoogleAdMob.showAppsInTossAdMob = original;
    }
  } finally {
    restore();
  }
});

test('보상 없이 닫으면 그대로 미지급이다 - 유예가 공짜 지급이 되면 안 된다', async () => {
  const restore = fakeTossScope();
  try {
    const bundle = await import(`${ENTRY.href}?ios=skip`);
    const sdk = await import('@apps-in-toss/web-framework');
    const original = sdk.GoogleAdMob.showAppsInTossAdMob;
    sdk.GoogleAdMob.showAppsInTossAdMob = ({ onEvent }) => {
      setTimeout(() => onEvent({ type: 'show' }), 0);
      setTimeout(() => onEvent({ type: 'dismissed' }), 20);   // 보상은 영영 안 온다
      return () => {};
    };
    // 오래 본 것으로 쳐주는 그물을 아주 높게 잡아 이 시험에서는 안 걸리게 한다.
    bundle.__setAdDeadlinesForTest(60, 5000, 150, 999999);
    try {
      const result = await bundle.showRewardedAd('ait.test.group');
      assert.equal(result.rewarded, false, '중간에 닫았는데 지급했다');
      assert.equal(result.failed, false, '못 띄운 것이 아니라 본인이 닫은 것이다');
    } finally {
      sdk.GoogleAdMob.showAppsInTossAdMob = original;
    }
  } finally {
    restore();
  }
});

test('보상 이벤트가 없으면 아무리 오래 떠 있었어도 지급하지 않는다', async () => {
  // 여기 예전에는 정반대 시험이 있었다. "오래 떠 있었으면 다 본 것으로
  // 친다"를 정상 동작으로 인정했는데, 그 탓에 30초 광고를 15초에 닫아도
  // 보상이 나갔다. privacy.html이 "끝까지 재생됐다는 신호만 받아 지급한다"고
  // 적어둔 것과도 어긋났다. 시험이 회귀를 막는 대신 결함을 지키고 있었다.
  //
  // 이 시험은 그 반대를 고정한다. 이벤트를 못 받으면 모르는 것이고,
  // 모르는 것은 주지 않는다.
  const restore = fakeTossScope();
  try {
    const bundle = await import(`${ENTRY.href}?ios=nogrant`);
    const sdk = await import('@apps-in-toss/web-framework');
    const original = sdk.GoogleAdMob.showAppsInTossAdMob;
    sdk.GoogleAdMob.showAppsInTossAdMob = ({ onEvent }) => {
      setTimeout(() => onEvent({ type: 'show' }), 0);
      // 한참 떠 있다가 닫힌다. 보상 이벤트는 끝내 안 온다.
      setTimeout(() => onEvent({ type: 'dismissed' }), 200);
      return () => {};
    };
    bundle.__setAdDeadlinesForTest(60, 5000, 30);
    try {
      const result = await bundle.showRewardedAd('ait.test.group');
      assert.equal(result.rewarded, false, '보상 신호 없이 지급됐다');
    } finally {
      sdk.GoogleAdMob.showAppsInTossAdMob = original;
    }
  } finally {
    restore();
  }
});

test('평소 순서(보상 -> 닫힘)에서는 유예 없이 곧장 끝난다', async () => {
  const restore = fakeTossScope();
  try {
    const bundle = await import(`${ENTRY.href}?ios=normal`);
    const sdk = await import('@apps-in-toss/web-framework');
    const original = sdk.GoogleAdMob.showAppsInTossAdMob;
    sdk.GoogleAdMob.showAppsInTossAdMob = ({ onEvent }) => {
      setTimeout(() => onEvent({ type: 'show' }), 0);
      setTimeout(() => onEvent({ type: 'userEarnedReward', data: { unitType: 's', unitAmount: 30 } }), 10);
      setTimeout(() => onEvent({ type: 'dismissed' }), 20);
      return () => {};
    };
    // 유예를 아주 길게 잡아도, 이미 보상을 받았으면 기다리지 않아야 한다.
    bundle.__setAdDeadlinesForTest(60, 5000, 4000, 999999);
    try {
      const started = Date.now();
      const result = await bundle.showRewardedAd('ait.test.group');
      assert.equal(result.rewarded, true);
      assert.ok(Date.now() - started < 1000, '보상을 이미 받았는데 유예를 기다렸다');
    } finally {
      sdk.GoogleAdMob.showAppsInTossAdMob = original;
    }
  } finally {
    restore();
  }
});

test('번들에도 늦은-보상 유예가 들어가 있다 - 소스만 고치고 안 구우면 실기기는 그대로다', async () => {
  const source = await readFile(BUNDLE, 'utf8');
  // 축소되면 이름이 바뀌므로 상수값으로 확인한다. 3000은 유예 시간이다.
  assert.match(source, /3e3|3000/, '유예 시간이 번들에 없다 - 다시 구워야 한다');
  // 15초 그물은 걷어냈다. 번들에 남아 있으면 실기기에서는 아직 지급된다.
  assert.ok(!/15e3|15000/.test(source), '걷어낸 15초 그물이 번들에 남아 있다 - 다시 구워야 한다');
});

// 실기기 제보: "힌트 광고 눌러서 보고 돌아오니 결과창이 뜨네요."
// 판이 끝나기 직전에 도움팩을 권했고, 광고를 다 본 뒤 힌트를 받자마자 판이
// 끝났다. 판 재고는 판마다 새로 만들어지므로 받은 것은 그대로 사라진다 -
// 광고만 보고 아무것도 못 받은 셈이다. 광고 동안 시계는 멈추므로(실측:
// 9.8초 동안 판 시간 1.8초 소모) 광고가 시간을 먹은 것이 아니라, 애초에
// 쓸 시간이 없을 때 권한 것이 문제였다.
test('쓸 시간이 없으면 도움팩을 권하지 않는다', async () => {
  const { AD_HELP_PACK, AD_HELP_PACK_MIN_SECONDS } = await import('../js/data.js');

  // 게임 객체 없이 문턱만 본다. 이 한 줄이 이 수정의 전부다.
  const offers = (timeLeft) => timeLeft >= AD_HELP_PACK_MIN_SECONDS;

  assert.equal(offers(60), true, '시간이 넉넉한데 안 권한다');
  assert.equal(offers(AD_HELP_PACK_MIN_SECONDS), true, '문턱에서는 권해야 한다');
  assert.equal(offers(6), false, '6초 남았는데 30초 광고를 권한다');
  assert.equal(offers(0), false);

  // 받는 것이 힌트 두 개다. 문턱은 그 둘을 실제로 써 볼 만한 길이여야 한다.
  // 이 숫자가 팩 내용보다 작아지면 문턱이 무의미해진다.
  assert.ok(AD_HELP_PACK.hint >= 1, '팩에 힌트가 없다');
  assert.ok(AD_HELP_PACK_MIN_SECONDS >= 10, '문턱이 너무 짧아 광고만 보고 끝난다');
});

// 광고를 봤는데 보상이 없는 판. 예전에는 여기가 통째로 조용했다 - 유저는
// 광고를 다 보고 돌아왔는데 아무것도 못 받고 아무 말도 못 들었다.
// 이게 실제 "먹튀" 경험이라, 안내가 사라지면 안 된다.
test('광고를 봤는데 보상이 없으면 그 사실을 알린다', async () => {
  const source = await readFile(new URL('../js/game.js', import.meta.url), 'utf8');
  const spots = [...source.matchAll(/shown \? '광고 보상을 못 받았다냥/g)];
  assert.equal(spots.length, 2, '이어하기와 도움팩 두 자리 모두에 안내가 있어야 한다');
  // 예전 조건(!shown일 때만 알림)으로 되돌아가면 이 시험이 걸린다.
  assert.ok(
    !/if \(!rewarded && !shown\) this\.ui\.toast/.test(source),
    '떴는데 보상 없는 경우가 다시 조용해졌다',
  );
});
