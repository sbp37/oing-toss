import { Device, Game, Share, getSchemeUri } from '@apps-in-toss/web-framework';

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
export async function createTossShareLink() {
  try {
    if (typeof Share?.createLink !== 'function') return '';
    const path = getSchemeUri?.();
    if (typeof path !== 'string' || !path.startsWith('intoss://')) return '';
    const link = await Share.createLink({ path });
    return typeof link === 'string' ? link : '';
  } catch {
    return '';
  }
}
