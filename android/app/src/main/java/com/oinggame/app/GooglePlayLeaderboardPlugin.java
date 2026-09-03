package com.oinggame.app;

import android.app.Activity;
import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.games.GamesSignInClient;
import com.google.android.gms.games.PlayGames;

@CapacitorPlugin(name = "GooglePlayLeaderboard")
public class GooglePlayLeaderboardPlugin extends Plugin {
    private static final int RC_LEADERBOARD_UI = 9004;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            resolveAvailability(call, false, false);
            return;
        }

        boolean available = GoogleApiAvailability.getInstance()
            .isGooglePlayServicesAvailable(activity) == ConnectionResult.SUCCESS;
        if (!available) {
            resolveAvailability(call, false, false);
            return;
        }

        PlayGames.getGamesSignInClient(activity).isAuthenticated()
            .addOnCompleteListener(activity, task -> resolveAvailability(
                call,
                true,
                task.isSuccessful() && task.getResult().isAuthenticated()
            ));
    }

    @PluginMethod
    public void submitScore(PluginCall call) {
        Double rawScore = call.getDouble("score");
        if (rawScore == null || !Double.isFinite(rawScore) || rawScore < 0) {
            resolveFailure(call, "invalid-score");
            return;
        }

        Activity activity = getActivity();
        if (activity == null) {
            resolveFailure(call, "activity-unavailable");
            return;
        }

        GamesSignInClient signInClient = PlayGames.getGamesSignInClient(activity);
        signInClient.isAuthenticated().addOnCompleteListener(activity, task -> {
            boolean authenticated = task.isSuccessful() && task.getResult().isAuthenticated();
            if (!authenticated) {
                // A finished run must never interrupt the result screen with a
                // login dialog. The explicit ranking button owns that prompt.
                resolveFailure(call, "not-authenticated");
                return;
            }
            try {
                PlayGames.getLeaderboardsClient(activity).submitScore(
                    activity.getString(R.string.classic_leaderboard_id),
                    Math.round(rawScore)
                );
                JSObject result = new JSObject();
                result.put("ok", true);
                call.resolve(result);
            } catch (RuntimeException error) {
                resolveFailure(call, "submit-failed");
            }
        });
    }

    @PluginMethod
    public void open(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            resolveFailure(call, "activity-unavailable");
            return;
        }

        GamesSignInClient signInClient = PlayGames.getGamesSignInClient(activity);
        signInClient.isAuthenticated().addOnCompleteListener(activity, task -> {
            boolean authenticated = task.isSuccessful() && task.getResult().isAuthenticated();
            if (authenticated) {
                openLeaderboard(activity, call);
                return;
            }
            signInClient.signIn().addOnCompleteListener(activity, signInTask -> {
                boolean signedIn = signInTask.isSuccessful()
                    && signInTask.getResult().isAuthenticated();
                if (signedIn) openLeaderboard(activity, call);
                else resolveFailure(call, "not-authenticated");
            });
        });
    }

    private void openLeaderboard(Activity activity, PluginCall call) {
        PlayGames.getLeaderboardsClient(activity)
            .getLeaderboardIntent(activity.getString(R.string.classic_leaderboard_id))
            .addOnSuccessListener(activity, intent -> {
                activity.startActivityForResult(intent, RC_LEADERBOARD_UI);
                JSObject result = new JSObject();
                result.put("ok", true);
                call.resolve(result);
            })
            .addOnFailureListener(error -> resolveFailure(call, "open-failed"));
    }

    private void resolveAvailability(PluginCall call, boolean available, boolean authenticated) {
        JSObject result = new JSObject();
        result.put("available", available);
        result.put("authenticated", authenticated);
        call.resolve(result);
    }

    private void resolveFailure(PluginCall call, String reason) {
        JSObject result = new JSObject();
        result.put("ok", false);
        result.put("reason", reason);
        call.resolve(result);
    }
}
