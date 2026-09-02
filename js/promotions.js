import { PROMOTION_RUN_REWARDS } from './data.js';
import { isAppsInTossWebView } from './leaderboard.js';

const CLAIMS_KEY = 'oing_toss_v3_promotion_claims';
const RUNS_KEY = 'oing_toss_v3_promotion_runs';

function readClaims() {
  try {
    const value = JSON.parse(localStorage.getItem(CLAIMS_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function writeClaims(value) {
  try { localStorage.setItem(CLAIMS_KEY, JSON.stringify(value)); } catch {}
}

export function incrementPromotionRuns() {
  let previous = 0;
  try { previous = Math.max(0, Math.floor(Number(localStorage.getItem(RUNS_KEY)) || 0)); } catch {}
  const next = previous + 1;
  try { localStorage.setItem(RUNS_KEY, String(next)); } catch {}
  return next;
}

export function dueRunPromotions(runs, rewards = PROMOTION_RUN_REWARDS, claims = readClaims()) {
  const count = Math.max(0, Math.floor(Number(runs) || 0));
  return rewards.filter((reward) => (
    reward?.promotionCode
      && count >= reward.runs
      && !claims[reward.key]
  ));
}

// 토스는 같은 코드를 중복 호출하면 같은 사용자에게 포인트를 다시 줄 수 있다.
// 그래서 네이티브 호출 전에 attempted를 먼저 남긴다. 응답을 잃은 애매한
// 실패에서 자동 재시도해 이중 지급하는 것보다, 작은 보상을 한 번 실패시키는
// 편이 운영 예산과 심사 기준에 안전하다.
export async function grantRunPromotions(runs, {
  onGranted,
  loadBridge = () => import('./vendor/toss-game-center-v1.js'),
  rewards = PROMOTION_RUN_REWARDS,
} = {}) {
  if (!isAppsInTossWebView()) return [];
  const due = dueRunPromotions(runs, rewards);
  if (!due.length) return [];

  let bridge;
  try { bridge = await loadBridge(); } catch { return []; }
  if (!bridge?.isPromotionRewardSupported?.()) return [];

  const granted = [];
  for (const reward of due) {
    const claims = readClaims();
    if (claims[reward.key]) continue;
    claims[reward.key] = { status: 'attempted', at: Date.now() };
    writeClaims(claims);
    try {
      const result = await bridge.grantPromotionReward(reward.promotionCode, reward.amount);
      if (!result?.ok) continue;
      const latest = readClaims();
      latest[reward.key] = { status: 'granted', key: result.key || '', at: Date.now() };
      writeClaims(latest);
      granted.push(reward);
      try { onGranted?.(reward); } catch {}
    } catch {
      // attempted 상태를 유지해 자동 중복 호출을 막는다.
    }
  }
  return granted;
}

export function recordPromotionRunAndGrant(options) {
  return grantRunPromotions(incrementPromotionRuns(), options);
}

export function __resetPromotionClaimsForTest() {
  try { localStorage.removeItem(CLAIMS_KEY); } catch {}
  try { localStorage.removeItem(RUNS_KEY); } catch {}
}
