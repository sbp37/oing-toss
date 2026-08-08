# OING V2 balance baseline

This report measures the real `BoardModel`, sum-ten removal, combo, scoring,
round bonus and seven-combo item rules. It is a deterministic design check,
not a replacement for human play telemetry.

Run it with:

```sh
npm run balance -- --runs 40
```

## Player model assumptions

| Profile | Find/gesture time | Wrong-selection rate | Rich-answer preference | Earned-item use |
|---|---:|---:|---:|---:|
| novice | 4.15s + variation | 15% | 12% | 62% |
| regular | 2.65s + variation | 7% | 48% | 82% |
| expert | 1.50s + variation | 2% | 82% | 94% |

Each action also includes 0.2 seconds of feedback/settling time and a small
late-round search penalty. Clock and freeze drops extend the measured real
session exactly as they do in the game.

## 2026-08-08 seeded baseline (12 runs per profile)

| Profile | Mean score | Real duration | Reached round | Clears | Max combo | Rich clears | Round bonus | Item time bonus |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| novice | 17,042 | 130.6s | 4.3 | 24.3 | 16.1 | 21.2% | 6.5s | 2.0s |
| regular | 37,894 | 143.5s | 6.2 | 43.0 | 31.8 | 39.0% | 11.5s | 10.4s |
| expert | 92,368 | 173.1s | 9.3 | 82.5 | 77.5 | 49.9% | 20.8s | 31.3s |

No run hit the five-minute safety cap. Before the correction, every expert
run hit that cap because time rewards recursively created enough play time to
earn more time rewards.

## Changes justified by the measurement

- The seven-combo reward cadence remains unchanged.
- Board-impact drops now outweigh clock/freeze drops at every reward tier.
- A board clear grants 2 seconds in rounds 1-4 and 3 seconds afterward,
  replacing the previous 4-8 second growth curve.
- Number distribution, drag input, combo loss, score values, board dimensions,
  answer guarantees and item effects remain unchanged.

## What still requires real telemetry

- Median human search time per round and device width.
- Accidental-selection rate for drag versus endpoint taps.
- Item pickup rate before a board transition.
- Quit rate by elapsed time and reached round.
- Score percentiles from at least several hundred completed sessions.

Do not tune score tiers or monetization from the simulator alone. Recalibrate
the profiles against real sessions first.

## Local play telemetry

The prototype now stores the latest 50 runs only in the current browser. It
records play duration, first-input delay, selections, accuracy, clear size,
rounds, combo, item use, hints, pauses and exit reason. It does not store an
account, device identifier, user agent, location or any text entered by a user,
and it does not send data to a server.

In test mode (`?test=1`), the browser console can inspect the local aggregate:

```js
OING_TELEMETRY.summary()
OING_TELEMETRY.runs()
OING_TELEMETRY.clear()
```
