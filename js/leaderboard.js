const defaultProviderLoader = () => import('./vendor/toss-game-center-v1.js');

function webViewScope(scope) {
  return scope?.window || scope;
}

export function isAppsInTossWebView(scope = globalThis) {
  const target = webViewScope(scope);
  return Boolean(
    target?.ReactNativeWebView
    && target?.__appsInTossConstants,
  );
}

export function createGameLeaderboardAdapter({
  scope = globalThis,
  loadProvider = defaultProviderLoader,
} = {}) {
  const submittedRunIds = new Set();
  let providerPromise = null;

  const provider = () => {
    providerPromise ||= Promise.resolve().then(loadProvider);
    return providerPromise;
  };

  const supportedProvider = async () => {
    if (!isAppsInTossWebView(scope)) return null;
    try {
      const candidate = await provider();
      return candidate.isLeaderboardSupported() ? candidate : null;
    } catch {
      return null;
    }
  };

  return Object.freeze({
    isTossEnvironment: () => isAppsInTossWebView(scope),

    async isAvailable() {
      return Boolean(await supportedProvider());
    },

    async submitClassicScoreOnce({ runId, score }) {
      const runKey = String(runId ?? '');
      const numericScore = Number(score);
      if (!runKey || !Number.isFinite(numericScore) || numericScore < 0) {
        return { ok: false, reason: 'invalid-score' };
      }
      if (submittedRunIds.has(runKey)) return { ok: false, reason: 'duplicate' };

      const candidate = await supportedProvider();
      if (!candidate) {
        return {
          ok: false,
          reason: isAppsInTossWebView(scope) ? 'unsupported' : 'outside-toss',
        };
      }

      // Mark before awaiting the native bridge. A slow or rejected bridge call
      // must never make one finished run submit twice.
      submittedRunIds.add(runKey);
      try {
        const response = await candidate.submitLeaderboardScore(String(Math.round(numericScore)));
        return response?.statusCode === 'SUCCESS'
          ? { ok: true }
          : { ok: false, reason: response?.statusCode || 'no-response' };
      } catch {
        return { ok: false, reason: 'bridge-error' };
      }
    },

    async open() {
      const candidate = await supportedProvider();
      if (!candidate) {
        return {
          ok: false,
          reason: isAppsInTossWebView(scope) ? 'unsupported' : 'outside-toss',
        };
      }
      try {
        await candidate.openLeaderboard();
        return { ok: true };
      } catch {
        return { ok: false, reason: 'bridge-error' };
      }
    },
  });
}

export const gameLeaderboardAdapter = createGameLeaderboardAdapter();
