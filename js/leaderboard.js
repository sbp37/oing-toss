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

export function isGooglePlayGamesWebView(scope = globalThis) {
  const target = webViewScope(scope);
  const capacitor = target?.Capacitor;
  const platform = typeof capacitor?.getPlatform === 'function'
    ? capacitor.getPlatform()
    : capacitor?.platform;
  const plugin = capacitor?.Plugins?.GooglePlayLeaderboard;
  return platform === 'android'
    && Boolean(plugin?.isAvailable && plugin?.submitScore && plugin?.open);
}

const defaultGoogleProviderLoader = (scope) => async () => (
  webViewScope(scope)?.Capacitor?.Plugins?.GooglePlayLeaderboard
);

export function createGameLeaderboardAdapter({
  scope = globalThis,
  loadProvider = defaultProviderLoader,
  loadGoogleProvider = defaultGoogleProviderLoader(scope),
} = {}) {
  const submittedRunIds = new Set();
  let tossProviderPromise = null;
  let googleProviderPromise = null;

  const tossProvider = () => {
    tossProviderPromise ||= Promise.resolve().then(loadProvider);
    return tossProviderPromise;
  };

  const googleProvider = () => {
    googleProviderPromise ||= Promise.resolve().then(loadGoogleProvider);
    return googleProviderPromise;
  };

  const environment = () => {
    // An Apps in Toss build can itself be hosted in an Android WebView. Toss
    // must win so its verified Game Center path is never replaced by Google.
    if (isAppsInTossWebView(scope)) return 'toss';
    if (isGooglePlayGamesWebView(scope)) return 'google-play';
    return null;
  };

  const supportedProvider = async () => {
    const activeEnvironment = environment();
    if (!activeEnvironment) return null;
    try {
      if (activeEnvironment === 'toss') {
        const candidate = await tossProvider();
        return candidate.isLeaderboardSupported()
          ? {
              kind: 'toss',
              submit: (score) => candidate.submitLeaderboardScore(String(score)),
              open: () => candidate.openLeaderboard(),
            }
          : null;
      }

      const candidate = await googleProvider();
      const availability = await candidate?.isAvailable?.();
      return availability?.available
        ? {
            kind: 'google-play',
            submit: (score) => candidate.submitScore({ score }),
            open: () => candidate.open(),
          }
        : null;
    } catch {
      return null;
    }
  };

  return Object.freeze({
    isTossEnvironment: () => isAppsInTossWebView(scope),
    isGooglePlayEnvironment: () => isGooglePlayGamesWebView(scope),
    isSupportedEnvironment: () => Boolean(environment()),

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
          reason: environment() ? 'unsupported' : 'outside-supported-platform',
        };
      }

      // Mark before awaiting the native bridge. A slow or rejected bridge call
      // must never make one finished run submit twice.
      submittedRunIds.add(runKey);
      try {
        const response = await candidate.submit(Math.round(numericScore));
        if (candidate.kind === 'toss') {
          return response?.statusCode === 'SUCCESS'
            ? { ok: true }
            : { ok: false, reason: response?.statusCode || 'no-response' };
        }
        return response?.ok
          ? { ok: true }
          : { ok: false, reason: response?.reason || 'no-response' };
      } catch {
        return { ok: false, reason: 'bridge-error' };
      }
    },

    async open() {
      const candidate = await supportedProvider();
      if (!candidate) {
        return {
          ok: false,
          reason: environment() ? 'unsupported' : 'outside-supported-platform',
        };
      }
      try {
        const response = await candidate.open();
        return candidate.kind === 'google-play' && response?.ok === false
          ? { ok: false, reason: response?.reason || 'bridge-error' }
          : { ok: true };
      } catch {
        return { ok: false, reason: 'bridge-error' };
      }
    },
  });
}

export const gameLeaderboardAdapter = createGameLeaderboardAdapter();
