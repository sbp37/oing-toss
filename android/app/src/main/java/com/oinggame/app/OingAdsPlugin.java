package com.oinggame.app;

import android.app.Activity;

import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "OingAds")
public class OingAdsPlugin extends Plugin {

    private static final class PendingAction {
        final Runnable ready;
        final Runnable unavailable;

        PendingAction(Runnable ready, Runnable unavailable) {
            this.ready = ready;
            this.unavailable = unavailable;
        }
    }

    private final List<PendingAction> pendingActions = new ArrayList<>();
    private final List<PluginCall> rewardedLoadCalls = new ArrayList<>();
    private final List<PluginCall> interstitialLoadCalls = new ArrayList<>();

    private boolean initializationStarted = false;
    private boolean sdkReady = false;
    private boolean rewardedLoading = false;
    private boolean interstitialLoading = false;
    private boolean fullScreenShowing = false;
    private RewardedAd rewardedAd;
    private InterstitialAd interstitialAd;

    @Override
    public void load() {
        super.load();
        if (!BuildConfig.ADMOB_ENABLED) return;
        getActivity().runOnUiThread(() -> ensureSdkReady(() -> {}, () -> {}));
    }

    @PluginMethod
    public void status(PluginCall call) {
        ensureSdkReady(
            () -> call.resolve(new JSObject()
                .put("available", true)
                .put("testMode", BuildConfig.ADMOB_TEST_MODE)),
            () -> call.resolve(new JSObject()
                .put("available", false)
                .put("testMode", BuildConfig.ADMOB_TEST_MODE))
        );
    }

    @PluginMethod
    public void preloadRewarded(PluginCall call) {
        ensureSdkReady(() -> loadRewarded(call), () -> resolveReady(call, false));
    }

    @PluginMethod
    public void showRewarded(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (!sdkReady || rewardedAd == null || fullScreenShowing) {
                resolveReward(call, false, false);
                return;
            }
            RewardedAd ad = rewardedAd;
            rewardedAd = null;
            fullScreenShowing = true;
            AtomicBoolean rewarded = new AtomicBoolean(false);
            AtomicBoolean shown = new AtomicBoolean(false);
            AtomicBoolean settled = new AtomicBoolean(false);
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdShowedFullScreenContent() {
                    shown.set(true);
                }

                @Override
                public void onAdDismissedFullScreenContent() {
                    fullScreenShowing = false;
                    if (settled.compareAndSet(false, true)) {
                        resolveReward(call, rewarded.get(), shown.get());
                    }
                }

                @Override
                public void onAdFailedToShowFullScreenContent(@NonNull AdError adError) {
                    fullScreenShowing = false;
                    if (settled.compareAndSet(false, true)) {
                        resolveReward(call, false, false);
                    }
                }
            });
            try {
                ad.show(getActivity(), rewardItem -> rewarded.set(true));
            } catch (RuntimeException error) {
                fullScreenShowing = false;
                if (settled.compareAndSet(false, true)) resolveReward(call, false, false);
            }
        });
    }

    @PluginMethod
    public void preloadInterstitial(PluginCall call) {
        ensureSdkReady(() -> loadInterstitial(call), () -> resolveReady(call, false));
    }

    @PluginMethod
    public void showInterstitial(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (!sdkReady || interstitialAd == null || fullScreenShowing) {
                resolveShown(call, false);
                return;
            }
            InterstitialAd ad = interstitialAd;
            interstitialAd = null;
            fullScreenShowing = true;
            AtomicBoolean shown = new AtomicBoolean(false);
            AtomicBoolean settled = new AtomicBoolean(false);
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdShowedFullScreenContent() {
                    shown.set(true);
                }

                @Override
                public void onAdDismissedFullScreenContent() {
                    fullScreenShowing = false;
                    if (settled.compareAndSet(false, true)) resolveShown(call, shown.get());
                }

                @Override
                public void onAdFailedToShowFullScreenContent(@NonNull AdError adError) {
                    fullScreenShowing = false;
                    if (settled.compareAndSet(false, true)) resolveShown(call, false);
                }
            });
            try {
                ad.show(getActivity());
            } catch (RuntimeException error) {
                fullScreenShowing = false;
                if (settled.compareAndSet(false, true)) resolveShown(call, false);
            }
        });
    }

    private void ensureSdkReady(Runnable ready, Runnable unavailable) {
        if (!BuildConfig.ADMOB_ENABLED) {
            unavailable.run();
            return;
        }
        Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            if (sdkReady) {
                ready.run();
                return;
            }
            pendingActions.add(new PendingAction(ready, unavailable));
            if (initializationStarted) return;
            initializationStarted = true;

            ConsentInformation consent = UserMessagingPlatform.getConsentInformation(activity);
            ConsentRequestParameters parameters = new ConsentRequestParameters.Builder().build();
            consent.requestConsentInfoUpdate(
                activity,
                parameters,
                () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(
                    activity,
                    formError -> finishConsent(consent)
                ),
                requestError -> finishConsent(consent)
            );
        });
    }

    private void finishConsent(ConsentInformation consent) {
        if (!consent.canRequestAds()) {
            initializationStarted = false;
            drainPending(false);
            return;
        }
        MobileAds.initialize(getContext(), status -> getActivity().runOnUiThread(() -> {
            sdkReady = true;
            drainPending(true);
        }));
    }

    private void drainPending(boolean available) {
        List<PendingAction> actions = new ArrayList<>(pendingActions);
        pendingActions.clear();
        for (PendingAction action : actions) {
            if (available) action.ready.run();
            else action.unavailable.run();
        }
    }

    private void loadRewarded(PluginCall call) {
        if (rewardedAd != null) {
            resolveReady(call, true);
            return;
        }
        rewardedLoadCalls.add(call);
        if (rewardedLoading) return;
        rewardedLoading = true;
        RewardedAd.load(
            getContext(),
            BuildConfig.ADMOB_REWARDED_AD_UNIT_ID,
            new AdRequest.Builder().build(),
            new RewardedAdLoadCallback() {
                @Override
                public void onAdLoaded(@NonNull RewardedAd ad) {
                    rewardedLoading = false;
                    rewardedAd = ad;
                    resolveRewardedLoads(true);
                }

                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError error) {
                    rewardedLoading = false;
                    rewardedAd = null;
                    resolveRewardedLoads(false);
                }
            }
        );
    }

    private void loadInterstitial(PluginCall call) {
        if (interstitialAd != null) {
            resolveReady(call, true);
            return;
        }
        interstitialLoadCalls.add(call);
        if (interstitialLoading) return;
        interstitialLoading = true;
        InterstitialAd.load(
            getContext(),
            BuildConfig.ADMOB_INTERSTITIAL_AD_UNIT_ID,
            new AdRequest.Builder().build(),
            new InterstitialAdLoadCallback() {
                @Override
                public void onAdLoaded(@NonNull InterstitialAd ad) {
                    interstitialLoading = false;
                    interstitialAd = ad;
                    resolveInterstitialLoads(true);
                }

                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError error) {
                    interstitialLoading = false;
                    interstitialAd = null;
                    resolveInterstitialLoads(false);
                }
            }
        );
    }

    private void resolveRewardedLoads(boolean ready) {
        List<PluginCall> calls = new ArrayList<>(rewardedLoadCalls);
        rewardedLoadCalls.clear();
        for (PluginCall call : calls) resolveReady(call, ready);
    }

    private void resolveInterstitialLoads(boolean ready) {
        List<PluginCall> calls = new ArrayList<>(interstitialLoadCalls);
        interstitialLoadCalls.clear();
        for (PluginCall call : calls) resolveReady(call, ready);
    }

    private void resolveReady(PluginCall call, boolean ready) {
        call.resolve(new JSObject().put("ready", ready));
    }

    private void resolveReward(PluginCall call, boolean rewarded, boolean shown) {
        call.resolve(new JSObject()
            .put("rewarded", rewarded)
            .put("shown", shown));
    }

    private void resolveShown(PluginCall call, boolean shown) {
        call.resolve(new JSObject().put("shown", shown));
    }
}
