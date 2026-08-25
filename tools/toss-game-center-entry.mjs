import { Device, Game } from '@apps-in-toss/web-framework';

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
