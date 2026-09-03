# Toss leaderboard handoff

## Branch and scope

- Branch: `codex/toss-leaderboard-v1`
- Base: `main` at `770d107a9f014787f302b0ae8c252ba26db038f2`
- Purpose: connect the Classic final score to the Apps in Toss Game Center leaderboard and add a separate home entry for the native leaderboard.
- This branch does not merge or deploy itself.

The existing local `내 기록` feature remains independent. It still owns recent runs, best score, cards, and the cat adventure. The new `랭킹` button opens the Apps in Toss native leaderboard only when the official bridge is available.

## Implementation

### Platform boundary

- `js/leaderboard.js` is the runtime adapter.
- It recognizes Apps in Toss only when both `ReactNativeWebView` and `__appsInTossConstants` exist.
- Outside Toss it never loads the SDK bundle and returns a quiet fallback result.
- `tools/toss-game-center-entry.mjs` is the rebuildable source for the official SDK wrapper.
- `js/vendor/toss-game-center-v1.js` is the browser bundle loaded lazily in Toss only.

Official calls:

- `Game.setLeaderboardScore({ score })`
- `Game.openLeaderboard()`
- Both are guarded with `isSupported()`.

### Score lifecycle

`OingGame.finishClassic()` submits `this.state.score` after the existing local Classic score save. Submission is fire-and-forget so a native bridge failure cannot block the result screen.

Each `start()` creates a new in-memory run ID. `submitClassicScoreOnce()` records the run ID before awaiting the native bridge, so a slow or rejected call cannot submit one finished run twice. Stage/test mode does not submit.

If the scoring formula or late-game score curve changes later, keep this boundary intact: calculate the score in the existing game/data layer and pass only the final Classic score to the adapter. Do not move scoring rules into `js/leaderboard.js` or the Toss SDK wrapper.

### Home entry and asset

- Existing `내 기록`: unchanged.
- New `랭킹`: hidden by default and shown only when the Toss leaderboard API is supported.
- Source art: `assets/source/ranking/ranking-trophy-v1.png`.
- Runtime art: `assets/icons/navigation/ranking-trophy-v1.webp`.
- Art direction: simple familiar trophy with an embossed star and coral base; no cat, crown, text, casino, or esports treatment.

## Verification already completed

- Unit/static tests: 173 passed, 0 failed.
- Apps in Toss AIT build: completed successfully.
- Browser verification at 360x740, 390x844, and 430x932:
  - no page errors;
  - no horizontal or vertical overflow;
  - the separate `랭킹`, `내 기록`, and best-score cards fit without clipping;
  - the 320x320 WebP loads at its natural resolution;
  - outside Toss the leaderboard entry stays hidden and the original home layout remains.
- One-submit-per-run, bridge-error containment, unsupported-version fallback, and outside-Toss lazy-load prevention have dedicated tests in `tests/leaderboard.test.mjs`.

## External requirement not verifiable in a normal browser

The Apps in Toss console must have a leaderboard configured and the miniapp information approved. The user has confirmed these console values:

- Korean score unit: `점`
- English score unit: `points`
- Sort order: highest score first

Final E2E acceptance requires a new AIT uploaded to the Apps in Toss sandbox or release channel:

1. Finish one Classic run.
2. Confirm the result screen appears even if score submission is unavailable.
3. Open the home `랭킹` entry.
4. Confirm the native Toss leaderboard opens and contains the submitted score.
5. Reopen it and confirm one run did not create a duplicate submission attempt.

## Next owner: late-game scoring study

The next task may study and tune how score growth behaves late in a run. Keep these boundaries:

- Preserve `js/leaderboard.js`, `tools/toss-game-center-entry.mjs`, and the one-submit-per-run contract unless a verified integration bug requires a focused fix.
- Keep local records and Toss rankings separate.
- Preserve the Classic final-score submission call in `finishClassic()`.
- Do not add a custom ranking server, database, login, nickname system, or anti-cheat backend.
- Measure current score distributions before changing formulas, then compare novice/regular/expert runs and report the effect on both local records and submitted leaderboard scores.
- Do not merge to `main` or deploy without explicit user approval.

## Recommended review commands

```sh
git fetch origin
git checkout codex/toss-leaderboard-v1
npm install
npm test
pnpm run build
pnpm exec ait build
```

