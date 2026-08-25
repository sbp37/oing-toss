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
  loadingKinds.add(kind);
  try {
    const module = await bridge();
    if (!module?.isRewardedAdSupported?.()) return false;
    const ok = await module.loadRewardedAd(adGroupId);
    if (ok) loadedKinds.add(kind);
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

// 광고를 띄우고 { rewarded, amount }를 돌려준다. 어떤 실패든 rewarded=false로
// 조용히 끝난다 - 호출자는 실패를 따로 다룰 필요가 없고, 지급만 안 하면 된다.
// 한 번 쓴 로드는 소모되므로 다음을 위해 다시 불러 둔다.
export async function showAd(kind) {
  const adGroupId = adGroupIdFor(kind);
  if (!adGroupId || !isAppsInTossWebView()) return { rewarded: false, amount: 0 };
  try {
    const module = await bridge();
    if (!module?.showRewardedAd) return { rewarded: false, amount: 0 };
    const result = await module.showRewardedAd(adGroupId);
    return { rewarded: Boolean(result?.rewarded), amount: Number(result?.amount) || 0 };
  } catch {
    return { rewarded: false, amount: 0 };
  } finally {
    loadedKinds.delete(kind);
    preloadAd(kind);
  }
}
