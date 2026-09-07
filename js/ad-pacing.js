// 전면광고는 판 도중이 아니라 결과 화면을 떠나는 순간에만 보여준다.
// 첫 두 판은 광고 없이 익히고, 세 번째 완료 뒤부터 한 번의 전면 수익화
// 기회를 만든다. 같은 판에서 보상형 광고가 이미 떴다면 전면은 skip한다.

export const INTERSTITIAL_RUN_INTERVAL = 3;

export function interstitialDecision({ completedRuns = 0, rewardedShown = false } = {}) {
  const due = Math.max(0, Math.floor(Number(completedRuns) || 0)) >= INTERSTITIAL_RUN_INTERVAL;
  if (!due) return Object.freeze({ due: false, reset: false });
  if (rewardedShown) return Object.freeze({ due: false, reset: true });
  return Object.freeze({ due: true, reset: false });
}
