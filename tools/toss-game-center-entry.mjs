import { Device, Game, GoogleAdMob, Promotion, Share, getSchemeUri } from '@apps-in-toss/web-framework';

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
export async function createTossShareLink(ogImageUrl = '') {
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

  for (const path of candidates) {
    try {
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

// 광고는 미리 불러 둬야 누른 순간 바로 뜬다(공식 권장). 로드 완료/실패를
// Promise로 돌려주고, 반환된 cleanup은 결과가 나온 뒤 스스로 정리한다.
export function loadRewardedAd(adGroupId) {
  return new Promise((resolve) => {
    let cleanup = null;
    let settled = false;
    const settle = (ok) => {
      if (settled) return;
      settled = true;
      try { cleanup?.(); } catch {}
      resolve(ok);
    };
    try {
      cleanup = GoogleAdMob.loadAppsInTossAdMob({
        options: { adGroupId },
        onEvent: (event) => { if (event.type === 'loaded') settle(true); },
        onError: () => settle(false),
      });
    } catch {
      settle(false);
    }
  });
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
  return new Promise((resolve) => {
    let cleanup = null;
    let settled = false;
    let rewarded = false;
    let amount = 0;
    let failed = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      try { cleanup?.(); } catch {}
      resolve({ rewarded, amount, failed });
    };
    try {
      cleanup = GoogleAdMob.showAppsInTossAdMob({
        options: { adGroupId },
        onEvent: (event) => {
          if (event.type === 'userEarnedReward') {
            rewarded = true;
            amount = Number(event.data?.unitAmount) || 0;
          } else if (event.type === 'dismissed') {
            settle();
          } else if (event.type === 'failedToShow') {
            failed = true;
            settle();
          }
        },
        onError: () => { failed = true; settle(); },
      });
    } catch {
      failed = true;
      settle();
    }
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
