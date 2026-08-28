export const GOOGLE_INTERSTITIAL_RUN_INTERVAL = 3;

export function shouldOfferGoogleInterstitial({ completedRuns = 0, rewardedShown = false } = {}) {
  const runs = Math.max(0, Math.floor(Number(completedRuns) || 0));
  return runs >= GOOGLE_INTERSTITIAL_RUN_INTERVAL && !rewardedShown;
}

