import {
  Device,
  Environment,
  Game,
  GoogleAdMob,
  Promotion,
  Share,
  getSchemeUri,
  getUserKeyForGame,
  loadFullScreenAd,
  showFullScreenAd,
} from '@apps-in-toss/web-framework';

// Browser bundle source for js/vendor/toss-game-center-v1.js. Rebuild with:
// pnpm dlx esbuild@0.25.10 tools/toss-game-center-entry.mjs --bundle
//   --format=esm --platform=browser --target=es2020 --minify
//   --legal-comments=none --outfile=js/vendor/toss-game-center-v1.js

export function isLeaderboardSupported() {
  try {
    return Game.setLeaderboardScore.isSupported()
      && Game.openLeaderboard.isSupported();
  } catch {
    return false;
  }
}

export function submitLeaderboardScore(score) {
  return Game.setLeaderboardScore({ score });
}

export function openLeaderboard() {
  return Game.openLeaderboard();
}

// A custom OING account uses Toss' game-scoped hash as a provider identity.
// The raw hash is sent only to our server for mTLS verification and is never
// stored there; the server keeps an HMAC-derived identity key instead.
export async function getTossGameIdentity() {
  try {
    if (typeof getUserKeyForGame !== 'function') return null;
    const result = await getUserKeyForGame();
    if (!result || result === 'ERROR' || result === 'INVALID_CATEGORY') return null;
    return result.type === 'HASH' && result.hash
      ? { provider: 'toss', credential: result.hash }
      : null;
  } catch {
    return null;
  }
}

export async function getTossGameProfile() {
  try {
    if (typeof Game?.getUserProfile !== 'function' || !Game.getUserProfile.isSupported()) return null;
    return await Game.getUserProfile();
  } catch {
    return null;
  }
}

// 네이티브 햅틱. 아이폰은 웹 Vibration API를 지원하지 않아 토스 밖에서는
// 진동이 아예 없는데, 이 다리를 타면 iOS에서도 울린다. js/haptic.js가
// 이 두 함수가 없으면 조용히 navigator.vibrate로 떨어지므로, 번들을 다시
// 굽기 전에도 안전하다.
//
// 리더보드와 달리 triggerHaptic은 isSupported()를 달고 있지 않다. 버전을
// 타는 기능이 아니라서 토스 안이면 늘 쓸 수 있기 때문이다. 그래서 함수가
// 있는지만 본다. 앞으로 토스가 isSupported를 붙이면 그 말을 따른다.
export function isHapticSupported() {
  try {
    const trigger = Device?.triggerHaptic;
    if (typeof trigger !== 'function') return false;
    if (typeof trigger.isSupported === 'function') return trigger.isSupported();
    return true;
  } catch {
    return false;
  }
}

export function triggerHaptic(options) {
  return Device.triggerHaptic(options);
}

// 토스 안에서 공유할 때 실을 링크.
//
// 실기기 제보: 공유하기를 누르면 링크가 아예 안 뜬다. location.href가 앱인토스
// 내부 주소라 받는 사람이 열면 오류가 나므로, 지금까지는 토스 안에서 링크를
// 통째로 뺐기 때문이다. Share.createLink는 그 딥링크를 "토스 앱에서 열리는"
// 진짜 주소로 바꿔 준다.
//
// path는 intoss:// 로 시작해야 한다. 이 미니앱 자신의 주소는 getSchemeUri가
// 알려준다. 실패하면 빈 문자열을 돌려주고, 부르는 쪽은 예전처럼 글만 공유한다.
// 앱에 처음 들어올 때 쓴 스킴 주소. 도전장 점수가 여기에 실려 온다.
// Environment.initialURL이 정본이고, getSchemeUri는 같은 값을 주는 옛 이름이다
// (SDK가 deprecated로 표시했다). 둘 다 없으면 빈 문자열이고, 부르는 쪽은
// 도전장이 없는 것으로 보고 평소대로 돈다.
export function getInitialSchemeUrl() {
  try {
    const url = Environment?.initialURL;
    if (typeof url === 'string' && url) return url;
  } catch {
    // 아래 옛 이름으로.
  }
  try {
    const url = getSchemeUri?.();
    return typeof url === 'string' ? url : '';
  } catch {
    return '';
  }
}

export async function createTossShareLink(ogImageUrl = '', pathQuery = '') {
  if (typeof Share?.createLink !== 'function') return '';

  // createLink의 path는 intoss:// 딥링크여야 한다. 그런데 getSchemeUri가
  // 주는 값은 환경에 따라 다른 스킴(supertoss:// 등)이거나 referrer 같은
  // 질의를 달고 있다 - 처음 버전은 intoss://가 아니면 바로 포기해서
  // 실기기에서 링크가 아예 안 실렸다. 후보를 차례로 시도한다.
  const candidates = [];
  let raw = '';
  try { raw = String(getSchemeUri?.() || ''); } catch {}
  if (raw.startsWith('intoss://')) candidates.push(raw.split('?')[0]);
  try {
    const appName = globalThis.window?.__appsInTossConstants?.appName;
    if (typeof appName === 'string' && appName) candidates.push(`intoss://${appName}`);
  } catch {}
  if (raw && !raw.startsWith('intoss://')) candidates.push(raw.split('?')[0]);

  for (const base of candidates) {
    try {
      // pathQuery는 "vs=8235" 같은 도전장 질의. 받는 쪽은 이 주소로 앱을
      // 열게 되고, getInitialSchemeUrl이 그대로 돌려준다. 빈 값이면 예전과
      // 똑같은 주소가 나가므로 도전장을 못 실어도 공유는 그대로 된다.
      const path = pathQuery ? `${base}${base.includes('?') ? '&' : '?'}${pathQuery}` : base;
      // ogImageUrl은 링크 미리보기에 뜨는 그림. 공개 주소여야 하고
      // 구버전 토스는 무시한다 - 없으면 그림 없는 링크가 될 뿐이다.
      const params = ogImageUrl ? { path, ogImageUrl } : { path };
      const link = await Share.createLink(params);
      if (typeof link === 'string' && link) return link;
    } catch {
      // 다음 후보로.
    }
  }
  return '';
}

// 토스 웹뷰에는 navigator.share가 없다. 그래서 지금까지 공유 버튼이 조용히
// 클립보드에 글만 복사하고 끝났다("문자만 복사된다"는 제보). 이 함수는
// 네이티브 공유 시트를 열어 카톡·메시지 등으로 바로 보내게 한다.
export function isTossShareSupported() {
  return typeof Share?.sendMessage === 'function';
}

export async function sendTossShareMessage(message) {
  try {
    if (typeof Share?.sendMessage !== 'function') return false;
    await Share.sendMessage({ message });
    return true;
  } catch {
    return false;
  }
}

// 보상형 광고. 토스가 광고를 대신 틀어 주고, 유저가 끝까지 보면
// userEarnedReward 이벤트가 온다. 지급은 그 이벤트가 왔을 때만 한다 -
// dismissed(중간에 닫음)만으로 지급하면 정책 위반이다.

export function isRewardedAdSupported() {
  try {
    return GoogleAdMob.loadAppsInTossAdMob.isSupported()
      && GoogleAdMob.showAppsInTossAdMob.isSupported();
  } catch {
    return false;
  }
}

export function isInterstitialAdSupported() {
  try {
    return loadFullScreenAd.isSupported() && showFullScreenAd.isSupported();
  } catch {
    return false;
  }
}

// 광고 다리에는 반드시 시간 제한이 있어야 한다.
//
// 이 약속들은 이벤트가 와야만 끝난다. 그런데 토스 공식 문서에도 예외가
// 적혀 있다 - 안드로이드 특정 버전에서 dismissed가 아예 오지 않은 사례가
// 있었고, 로드는 네트워크에 따라 1분 가까이 걸릴 수 있다. 아무 이벤트도
// 안 오면 이 약속은 영원히 안 끝나고, 그 위에서 기다리던 게임은
// 이어하기라면 finishing 상태로, 도움팩이라면 paused 상태로 굳는다.
// 화면상 아무 표시도 없이 그냥 안 눌리는 판이 되는 것이다.
//
// 그래서 어떤 경우에도 시간이 지나면 스스로 끝낸다. 늦게 오는 보상을
// 놓치지 않도록 show 쪽은 넉넉히 잡는다 - 광고 자체가 30초 안팎이고
// 사람이 보상 화면에서 머무는 시간까지 감안한 값이다.
let LOAD_TIMEOUT_MS = 20000;
// 닫힘 뒤에 보상 이벤트가 늦게 오는 경우를 기다려 주는 시간.
// 실기기 제보(아이폰): "30초 광고를 다 봤는데 +30초가 안 붙고 바로 결과창."
// AdMob 이벤트 순서가 기기마다 같지 않다. 안드로이드는 보통 보상 -> 닫힘인데
// 아이폰에서 닫힘이 먼저 오면, 닫힘에서 곧장 결론을 내는 코드는 끝까지 본
// 사람을 빈손으로 돌려보낸다. 광고비는 이미 발생한 뒤라 제일 나쁜 결말이다.
//
// 1.5초에서 3초로 늘렸다. 다 본 사람을 빈손으로 보내지 않으려던 원래 걱정은
// 옳았는데, 그 걱정을 "15초 넘게 떠 있었으면 그냥 준다"로 풀었던 것이 틀렸다.
// 그 방식은 이벤트가 유실된 사람과 30초 광고를 15초에 닫은 사람을 구별하지
// 못한다.
//
// 이 유예는 다르다. 늘려도 없는 보상을 만들어내지 않는다 - userEarnedReward가
// 실제로 도착할 때까지 귀를 열어둘 뿐이다. 늘려서 생기는 비용은 "보상이 끝내
// 안 오는 판"에서 3초를 기다리는 것뿐이고, 보통 순서(보상 -> 닫힘)에서는 한
// 순간도 안 기다린다. 그러니 먹튀를 막고 싶으면 늘려야 할 것은 이 값이다.
let REWARD_GRACE_MS = 3000;
let SHOW_TIMEOUT_MS = 180000;

// 여기 예전에 "광고가 15초 넘게 떠 있었으면 보상 이벤트가 없어도 다 본
// 것으로 친다"는 마지막 그물이 있었다. 걷어냈다.
//
// 외부 검수에서 지적받았고 지적이 옳았다. 30초 광고를 15초에 닫아도 보상이
// 나갔다. privacy.html은 "광고가 끝까지 재생됐다는 신호만 받아 보상을
// 지급합니다"라고 적어 두었는데 코드가 그 약속을 어기고 있었고, 광고
// 제공사가 승인하지 않은 보상을 우리가 임의로 준 것이기도 하다.
//
// 원래 고치려던 문제(아이폰에서 닫힘이 보상보다 먼저 와서 보상을 잃는 것)는
// 위의 유예만으로 해결된다. 그건 순서 문제지 이벤트 유실이 아니다. 이벤트가
// 정말로 안 오면 우리는 그 사람이 다 봤는지 알 방법이 없고, 모르는 것을
// 안다고 치는 대신 조용히 실패로 두는 편이 맞다 - 부르는 쪽이 이미
// "광고를 못 불러왔다냥" 안내를 띄운다.

// 시험에서만 쓴다. 20초·180초를 실제로 기다릴 수는 없어서, 시간 제한이
// "정말로 약속을 끝내는지"를 짧은 값으로 확인한다. 게임 코드는 부르지 않는다.
export function __setAdDeadlinesForTest(loadMs, showMs, graceMs) {
  if (Number.isFinite(graceMs)) REWARD_GRACE_MS = graceMs;
  LOAD_TIMEOUT_MS = Number(loadMs) || LOAD_TIMEOUT_MS;
  SHOW_TIMEOUT_MS = Number(showMs) || SHOW_TIMEOUT_MS;
}

function withDeadline(ms, run) {
  return new Promise((resolve) => {
    let cleanup = null;
    let cleaned = false;
    let settled = false;
    let timer = null;

    // 정리는 많아야 한 번. 던져도 광고 흐름은 계속 간다.
    const runCleanup = () => {
      if (cleaned) return;
      const fn = cleanup;
      if (typeof fn !== 'function') return;
      cleaned = true;
      try { fn(); } catch {}
    };

    const settle = (value) => {
      if (settled) return;
      settled = true;
      if (timer !== null) { try { clearTimeout(timer); } catch {} }
      runCleanup();
      resolve(value);
    };

    timer = setTimeout(() => settle('timeout'), ms);
    try {
      cleanup = run(settle);
    } catch {
      settle('threw');
    }

    // SDK가 콜백을 동기로 부르면 위 settle이 cleanup을 대입하기 전에 돈다.
    // 그러면 SDK가 준 정리 함수가 영영 안 불려 리스너가 샌다 - 검수에서
    // "ok=true인데 cleanups=0"으로 재현된 그 자리다. run이 돌아온 뒤에
    // 이미 끝나 있었다면 여기서 한 번 치운다. runCleanup이 스스로 한 번만
    // 도는 것을 지키므로 비동기 경로와 겹쳐도 두 번 불리지 않는다.
    if (settled) runCleanup();
  });
}

// 광고는 미리 불러 둬야 누른 순간 바로 뜬다(공식 권장).
export function loadRewardedAd(adGroupId) {
  return withDeadline(LOAD_TIMEOUT_MS, (settle) => GoogleAdMob.loadAppsInTossAdMob({
    options: { adGroupId },
    onEvent: (event) => { if (event.type === 'loaded') settle(true); },
    onError: () => settle(false),
  })).then((value) => value === true);
}

// 전면형도 보상형과 같은 전체화면 슬롯을 쓰지만, 보상 이벤트는 기다리지
// 않는다. 결과 화면을 떠나는 순간에만 호출하고 dismissed/failedToShow 중
// 하나가 오면 게임 흐름을 즉시 돌려준다.
export function loadInterstitialAd(adGroupId) {
  return withDeadline(LOAD_TIMEOUT_MS, (settle) => loadFullScreenAd({
    options: { adGroupId },
    onEvent: (event) => { if (event.type === 'loaded') settle(true); },
    onError: () => settle(false),
  })).then((value) => value === true);
}

export function showInterstitialAd(adGroupId) {
  let shown = false;
  let failed = false;
  return withDeadline(SHOW_TIMEOUT_MS, (settle) => showFullScreenAd({
    options: { adGroupId },
    onEvent: (event) => {
      if (event.type === 'show' || event.type === 'impression') shown = true;
      else if (event.type === 'failedToShow') {
        failed = true;
        settle('failedToShow');
      } else if (event.type === 'dismissed') {
        shown = true;
        settle('dismissed');
      }
    },
    onError: () => { failed = true; settle('error'); },
  })).then((how) => {
    if (how === 'timeout' || how === 'threw') failed = true;
    return { shown: shown && !failed, failed };
  });
}

export function isPromotionRewardSupported() {
  try { return Promotion.grantReward.isSupported(); } catch { return false; }
}

export async function grantPromotionReward(promotionCode, amount) {
  try {
    const result = await Promotion.grantReward({
      promotionCode: String(promotionCode || ''),
      amount: Math.max(0, Math.round(Number(amount) || 0)),
    });
    return { ok: Boolean(result?.key), key: result?.key || '' };
  } catch (error) {
    return { ok: false, code: String(error?.code || 'UNKNOWN_ERROR') };
  }
}

export function isRewardedAdLoaded(adGroupId) {
  try {
    return GoogleAdMob.isAppsInTossAdMobLoaded({ adGroupId });
  } catch {
    return Promise.resolve(false);
  }
}

// 광고를 띄우고 결과를 기다린다. userEarnedReward를 봤으면 rewarded=true.
// 실제 지급은 광고 창이 닫힌(dismissed) 뒤에 하는 것이 안전하다 - 게임이
// 다시 화면에 있을 때 보상 연출이 보여야 하기 때문이다.
//
// failed는 "광고가 뜨지도 못했다"이다. 광고를 보다가 중간에 닫은 것
// (dismissed, 보상 없음)과 애초에 못 띄운 것(failedToShow, onError)은
// 사람에게 전혀 다른 일이다. 앞은 본인 선택이라 아무 말도 필요 없지만,
// 뒤는 우리 사정이므로 알려줘야 한다 - 조용히 넘어가면 "버튼이 먹통"으로
// 읽힌다(실기기 제보: "+30초를 눌렀는데 그냥 결과창으로 간다").
export function showRewardedAd(adGroupId) {
  let rewarded = false;
  let amount = 0;
  let failed = false;
  let graceTimer = null;
  const clearGrace = () => {
    if (graceTimer === null) return;
    try { clearTimeout(graceTimer); } catch {}
    graceTimer = null;
  };
  return withDeadline(SHOW_TIMEOUT_MS, (settle) => {
    const stop = GoogleAdMob.showAppsInTossAdMob({
      options: { adGroupId },
      onEvent: (event) => {
        if (event.type === 'userEarnedReward') {
          rewarded = true;
          amount = Number(event.data?.unitAmount) || 0;
          // 닫힘을 기다리던 중에 보상이 왔다면 더 기다릴 이유가 없다.
          if (graceTimer !== null) { clearGrace(); settle('dismissed'); }
        } else if (event.type === 'failedToShow') {
          failed = true;
          settle('failedToShow');
        } else if (event.type === 'dismissed') {
          // 여기서 곧장 결론을 내지 않는다. 아이폰에서 닫힘이 보상보다
          // 먼저 오는 경우가 있어서, 그러면 다 본 사람이 빈손이 된다.
          if (rewarded) settle('dismissed');
          else if (graceTimer === null) {
            graceTimer = setTimeout(() => { graceTimer = null; settle('dismissed'); }, REWARD_GRACE_MS);
          }
        }
      },
      onError: () => { failed = true; settle('error'); },
    });
    // withDeadline이 정리할 때 늦은-보상 타이머도 같이 끈다.
    return () => { clearGrace(); try { stop?.(); } catch {} };
  }).then((how) => {
    // 시간 제한에 걸렸는데 보상 이벤트는 이미 왔다면, 그건 유저가 끝까지
    // 본 것이고 닫힘 이벤트만 유실된 경우다. 그때는 지급하는 것이 맞다.
    if (how === 'timeout' && !rewarded) failed = true;
    if (how === 'threw') failed = true;
    // 보상은 userEarnedReward를 실제로 받았을 때만 준다. 오래 떠 있었다는
    // 것만으로는 다 봤다고 칠 수 없다(위 상수 자리의 주석 참고).
    return { rewarded, amount, failed };
  });
}

// 친구 초대 리워드(콘솔 '공유 리워드'). 친구 목록·발송은 전부 토스 화면이
// 처리하고, 우리는 "몇 명에게 보냈다"는 sendViral 이벤트만 받아 힌트를
// 지급한다. 연락처 권한이 필요 없다.
export function isContactsInviteSupported() {
  try {
    return Promotion.openContactsInvite.isSupported();
  } catch {
    return false;
  }
}

export function openContactsInvite(moduleId, { onReward } = {}) {
  return new Promise((resolve) => {
    let cleanup = null;
    let settled = false;
    let earned = 0;
    const settle = () => {
      if (settled) return;
      settled = true;
      try { cleanup?.(); } catch {}
      resolve({ earned });
    };
    try {
      cleanup = Promotion.openContactsInvite({
        options: { moduleId },
        onEvent: (event) => {
          if (event.type === 'sendViral') {
            earned += Number(event.data?.rewardAmount) || 0;
            onReward?.(event.data);
          } else if (event.type === 'close') {
            settle();
          }
        },
        onError: () => settle(),
      });
    } catch {
      settle();
    }
  });
}
