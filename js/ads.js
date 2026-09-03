// 보상형 광고 관리.
//
// 광고그룹 ID는 토스 콘솔에서 만든 값이다(그룹 하나 = 보상 하나). 비어 있으면
// 그 광고 자리는 게임에서 아예 보이지 않는다 - ID 없이 출시돼도 게임은
// 광고 없던 때와 똑같이 돈다. 웹·원스토어처럼 토스 밖인 환경도 마찬가지다.
//
// 정책 요약(공식 문서):
// - 광고는 미리 불러 둔다.
// - 지급은 userEarnedReward 이벤트가 왔을 때만. 중간에 닫으면(dismissed만)
//   지급하지 않는다.
// - 보상 내용은 광고 전에 보여준다(버튼 문구가 그 역할을 한다).
import { isAppsInTossWebView } from './leaderboard.js';
import { AD_GROUP_IDS } from './data.js';

const loadBridge = () => import('./vendor/toss-game-center-v1.js');

let bridgePromise = null;
const loadedKinds = new Set();
const loadingKinds = new Set();

// 준비 상태가 바뀌면 알린다. 버튼의 광고 배지가 "실제로 불러왔는가"를
// 보고 뜨기 때문에, 배경에서 로드가 끝나는 순간 화면을 다시 그려야 한다.
// 이게 없으면 광고를 한 번 쓴 뒤 다시 불러와도 배지가 안 돌아온다.
const readyListeners = new Set();

// 광고가 화면에 떠 있는 동안에는 새 광고를 불러오지 않는다.
//
// 검수 지적: 기존 GoogleAdMob API는 하나를 불러 두고 다른 것을 또 부르면
// 이벤트가 섞일 수 있다. 판 시작의 연달아 부르기는 이미 순차로 바꿨는데,
// 남아 있던 구멍이 showAd의 finally다 - 광고를 쓴 자리에서 곧바로 같은
// 자리를 다시 불러오므로, 그 순간 다른 종류가 이미 로드돼 있으면 두 개가
// 겹친다. 그리고 그 재로드는 광고 창이 아직 떠 있는 동안 시작될 수도 있다.
//
// 그래서 "지금 광고가 떠 있는가"를 한 곳에서 들고, 떠 있는 동안의 로드
// 요청은 미뤘다가 끝난 뒤에 한 번만 처리한다. 두 광고를 미리 들고 있는
// 구조 자체는 유지한다 - 이어하기는 판 끝, 도움팩은 아이템이 떨어진
// 순간이라 둘 다 "필요할 때 준비돼 있는 것"이 이 기능의 값이기 때문이다.
let showingKind = null;
const deferredLoads = new Set();

export function isAdShowing() {
  return showingKind !== null;
}

export function onAdReadyChange(listener) {
  if (typeof listener !== 'function') return () => {};
  readyListeners.add(listener);
  return () => readyListeners.delete(listener);
}

function announceReadyChange() {
  for (const listener of readyListeners) {
    try { listener(); } catch {}
  }
}

function bridge() {
  bridgePromise ||= loadBridge().catch(() => null);
  return bridgePromise;
}

export function adGroupIdFor(kind) {
  const id = AD_GROUP_IDS[kind];
  return typeof id === 'string' && id.length > 0 ? id : '';
}

// 이 환경에서 이 광고 자리를 보여줄 수 있는가. 동기 판단이 필요해서(버튼
// 표시 여부) 토스 웹뷰 여부와 ID 유무만 본다. SDK 지원 여부는 실제로
// 불러올 때 확인되고, 안 되면 로드가 실패해 버튼이 조용히 사라진다.
export function adsAvailable(kind) {
  return Boolean(adGroupIdFor(kind)) && isAppsInTossWebView();
}

// 미리 불러 두기. 여러 번 불러도 로드 중이거나 이미 로드됐으면 조용히 넘어간다.
export async function preloadAd(kind) {
  const adGroupId = adGroupIdFor(kind);
  if (!adGroupId || !isAppsInTossWebView()) return false;
  if (loadedKinds.has(kind) || loadingKinds.has(kind)) return loadedKinds.has(kind);
  // 광고가 떠 있는 동안의 요청은 접어 뒀다가 끝난 뒤에 한 번만 처리한다.
  if (showingKind !== null) {
    deferredLoads.add(kind);
    return false;
  }
  loadingKinds.add(kind);
  try {
    const module = await bridge();
    if (!module?.isRewardedAdSupported?.()) return false;
    const ok = await module.loadRewardedAd(adGroupId);
    if (ok) {
      loadedKinds.add(kind);
      announceReadyChange();
    }
    return Boolean(ok);
  } catch {
    return false;
  } finally {
    loadingKinds.delete(kind);
  }
}

// 로드까지 끝나 지금 바로 띄울 수 있는가.
export function adReady(kind) {
  return adsAvailable(kind) && loadedKinds.has(kind);
}

// 광고를 띄우고 { rewarded, amount, shown }를 돌려준다. 어떤 실패든
// rewarded=false로 조용히 끝난다 - 호출자는 지급만 안 하면 된다. shown은
// "광고가 실제로 떴는가"로, 안 떴으면 부르는 쪽이 사람에게 알려줄 수 있다.
// 한 번 쓴 로드는 소모되므로 다음을 위해 다시 불러 둔다.
//
// 실기기 제보: 이어하기는 "광고 보고 +30초"를 눌러도 그냥 결과창으로 갔다.
// 힌트(도움팩)는 멀쩡했다. 차이는 기다린 시간이다. 도움팩은 판 도중에 바로
// 쓰지만, 이어하기 광고는 판 시작에 불러 두고 2분 넘게 묵혀 뒀다가 쓴다.
// 그런데 loadedKinds는 우리 쪽 기억일 뿐이라, 그 사이 광고가 만료되거나
// 무효가 돼도 계속 "준비됨"이라고 답한다. 그 상태로 show를 부르면 SDK가
// failedToShow로 끝내고, 우리는 보상 없이 결과로 갔다.
//
// 그래서 띄우기 직전에 SDK에게 직접 물어보고, 아니라면 그 자리에서 한 번
// 다시 불러온다. 몇 초 늦어질 수는 있어도 "눌렀는데 아무 일도 안 일어남"
// 보다는 낫다.
export async function showAd(kind) {
  const adGroupId = adGroupIdFor(kind);
  if (!adGroupId || !isAppsInTossWebView()) return { rewarded: false, amount: 0, shown: false };
  try {
    const module = await bridge();
    if (!module?.showRewardedAd) return { rewarded: false, amount: 0, shown: false };

    let live = true;
    try {
      if (typeof module.isRewardedAdLoaded === 'function') {
        live = Boolean(await module.isRewardedAdLoaded(adGroupId));
      }
    } catch {
      // 물어볼 수 없으면 우리 기억을 믿고 그냥 진행한다.
      live = true;
    }
    if (!live) {
      loadedKinds.delete(kind);
      loadingKinds.delete(kind);
      // 다시 못 불러와도 그냥 띄워는 본다. isRewardedAdLoaded가 기기나
      // 버전에 따라 실제와 다르게 false를 줄 수 있는데, 여기서 포기하면
      // 예전 같으면 떴을 광고까지 안 뜨게 만든다. 띄워보는 데 드는 값은
      // 없고, 실패해도 아래 failed로 똑같이 걸린다.
      const reloaded = await module.loadRewardedAd(adGroupId).catch(() => false);
      if (reloaded) loadedKinds.add(kind);
    }

    showingKind = kind;
    const result = await module.showRewardedAd(adGroupId);
    return {
      rewarded: Boolean(result?.rewarded),
      amount: Number(result?.amount) || 0,
      // 중간에 닫은 것(dismissed)은 본인 선택이라 조용히 넘어가고,
      // 아예 못 띄운 것(failedToShow)만 부르는 쪽에 알린다.
      shown: !result?.failed,
    };
  } catch {
    return { rewarded: false, amount: 0, shown: false };
  } finally {
    showingKind = null;
    loadedKinds.delete(kind);
    announceReadyChange();
    // 방금 쓴 자리를 다시 채우고, 광고가 떠 있는 동안 미뤄 둔 요청도 같이
    // 처리한다. preloadAd 자체가 순차로 돌므로 여기서도 하나씩 간다.
    const pending = [kind, ...deferredLoads];
    deferredLoads.clear();
    void (async () => {
      for (const next of pending) {
        await preloadAd(next);
      }
    })();
  }
}
