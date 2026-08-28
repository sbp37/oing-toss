import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  GOOGLE_INTERSTITIAL_RUN_INTERVAL,
  shouldOfferGoogleInterstitial,
} from '../js/ad-pacing.js';

test('Google interstitial pacing starts at the third completed run', () => {
  assert.equal(GOOGLE_INTERSTITIAL_RUN_INTERVAL, 3);
  assert.equal(shouldOfferGoogleInterstitial({ completedRuns: 1 }), false);
  assert.equal(shouldOfferGoogleInterstitial({ completedRuns: 2 }), false);
  assert.equal(shouldOfferGoogleInterstitial({ completedRuns: 3 }), true);
  assert.equal(shouldOfferGoogleInterstitial({ completedRuns: 4 }), true);
});

test('a rewarded ad in the due run suppresses the interstitial', () => {
  assert.equal(shouldOfferGoogleInterstitial({ completedRuns: 3, rewardedShown: true }), false);
  assert.equal(shouldOfferGoogleInterstitial({ completedRuns: 99, rewardedShown: true }), false);
});

test('the web adapter routes Google rewarded and interstitial calls to Capacitor', async () => {
  const calls = [];
  const previous = globalThis.Capacitor;
  globalThis.Capacitor = {
    Plugins: {
      OingAds: {
        async preloadRewarded() {
          calls.push('preloadRewarded');
          return { ready: true };
        },
        async showRewarded({ kind }) {
          calls.push(`showRewarded:${kind}`);
          return { rewarded: true, shown: true };
        },
        async preloadInterstitial() {
          calls.push('preloadInterstitial');
          return { ready: true };
        },
        async showInterstitial() {
          calls.push('showInterstitial');
          return { shown: true };
        },
      },
    },
  };

  try {
    const ads = await import(`../js/ads.js?google=${Date.now()}`);
    assert.equal(ads.isGoogleAdsEnvironment(), true);
    assert.equal(await ads.preloadAd('continue'), true);
    assert.equal(ads.adReady('continue'), true);
    assert.equal(ads.adReady('helpPack'), true, 'one native rewarded slot serves both rewards');

    const reward = await ads.showAd('continue');
    assert.deepEqual(reward, { rewarded: true, amount: 0, shown: true });

    assert.equal(await ads.preloadInterstitial(), true);
    assert.equal(ads.interstitialReady(), true);
    assert.deepEqual(await ads.showInterstitial(), { shown: true });
    assert.ok(calls.includes('showRewarded:continue'));
    assert.ok(calls.includes('showInterstitial'));
  } finally {
    if (previous === undefined) delete globalThis.Capacitor;
    else globalThis.Capacitor = previous;
  }
});

test('Android release ads stay disabled until all live IDs are present', async () => {
  const gradle = await readFile(new URL('../android/app/build.gradle', import.meta.url), 'utf8');
  const plugin = await readFile(
    new URL('../android/app/src/main/java/com/oinggame/app/OingAdsPlugin.java', import.meta.url),
    'utf8',
  );
  const activity = await readFile(
    new URL('../android/app/src/main/java/com/oinggame/app/MainActivity.java', import.meta.url),
    'utf8',
  );

  assert.match(gradle, /def admobEnabled = !admobTestMode \|\| admobTestAdsEnabled/);
  assert.match(gradle, /buildConfigField "boolean", "ADMOB_ENABLED"/);
  assert.match(plugin, /if \(!BuildConfig\.ADMOB_ENABLED\) return;/);
  assert.match(plugin, /ConsentInformation/);
  assert.match(plugin, /MobileAds\.initialize/);
  assert.ok(
    activity.indexOf('registerPlugin(OingAdsPlugin.class)') < activity.indexOf('super.onCreate(savedInstanceState)'),
    'the plugin must be registered before Capacitor creates the bridge',
  );
});

test('the game shows interstitial only on a later play action and keeps final score submission intact', async () => {
  const game = await readFile(new URL('../js/game.js', import.meta.url), 'utf8');
  const entry = game.slice(
    game.indexOf('async startClassicFromEntry'),
    game.indexOf('// The scene behind the board', game.indexOf('async startClassicFromEntry')),
  );
  assert.match(entry, /if \(this\.interstitialDueAfterLastRun\)/);
  assert.match(entry, /await showInterstitial\(\)/);
  assert.match(entry, /await this\.start\(1, \{ \.\.\.options, classic: true \}\)/);

  const finish = game.slice(game.indexOf('async finishClassic()'), game.indexOf('\n  async ', game.indexOf('async finishClassic()') + 20));
  assert.match(finish, /isGoogleAdsEnvironment\(\)/);
  assert.match(finish, /shouldOfferGoogleInterstitial/);
  assert.match(finish, /gameLeaderboardAdapter\.submitClassicScoreOnce/);
});
