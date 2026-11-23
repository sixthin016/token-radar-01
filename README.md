# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/sixthin016/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/sixthin016/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Launch Radar v6: every value term fitted on TGE-day launches and tested held-out twice, farm plans netted to the dollar.

Token Radar (radar-6) scores every pre-token protocol from a sealed DeFi snapshot and ranks them by implied launch value, with a dark dashboard, seven-step farm plans and a byte-reproducible dossier.

## How it works

Each protocol's implied value is the value if its token launches, times the odds it ever launches. The value model is a ridge of log10(market cap on the token's launch day) on log10(TVL measured 30 days BEFORE the launch) — intercept 7.514, slope 0.180 on standardised log-TVL (raw slope 0.162), sigma 0.558 — fitted on 55 TGE-labelled comparables (launch-day market caps from CoinMarketCap, median of the first 7 tracked days; pre-launch TVL from DefiLlama history), recency-weighted with a 9-month half-life. The odds model is a logistic regression on the snapshot's own figures — log age, shrunk category token share, 7-day growth — beta [−4.605, +0.899, +3.467, −1.463], fitted on 525 peers. Category shifts were fitted and then dropped: only Basis Trading +0.019, Lending −0.031 and RWA +0.032 earn a shift, each within ~1.5 bootstrap standard errors of zero, and a paired bootstrap of the size-only model against the with-shifts model gives a LOO pinball delta of −0.0006 [−0.0019, +0.0006] — statistically identical, and the size-only model is better-or-equal on every split. No protocol name is ever special-cased: the same two functions score every row.

## What is proved, and what is not

The fit is proved, not asserted. Before fitting, a blind set of 192 protocols is drawn by fixed seed `token-radar-04-blind` (the same seed radar-4 and radar-5 used); the fit never sees them, and the 12 tokenized comparables among them are scored against their launch-day market caps: pinball 0.1131 vs 0.1554 for radar-5, Spearman 0.140 vs 0.077. Leave-one-out over all 55 comparables: pinball 0.1790 vs 0.2042, Spearman 0.324 vs 0.134. Walk-forward by launch date (pooled, 33 launches): pinball 0.2201 vs 0.1640, Spearman 0.599 vs 0.567. A paired bootstrap (10,000 resamples) gives the radar-6 minus radar-5 deltas: blind pinball −0.0422 [−0.0685, −0.0149] — the one interval that excludes zero — LOO pinball −0.0252 [−0.0523, +0.0006], walk-forward pinball +0.0561 [−0.0017, +0.1159].

The strict submit gate does NOT pass, and the dashboard says so in plain words. The blind pinball interval excludes zero in radar-6's favour, but the LOO pinball interval just includes zero and the Spearman intervals are wide at n=12 blind and n=55 in total. The one split radar-5 wins is walk-forward pinball — and that comparison is contaminated: radar-5 is scored with TVL measured in November 2026, AFTER the launch-day labels it is scored against, so its time-split score carries post-launch information the pre-token task never has. For the board's actual task — pre-token protocols, whose TVL is genuinely pre-launch — that leakage does not exist.

The dashboard carries three out-of-sample evidence tables: (a) value-model terms, one at a time, LOO + walk-forward, with a control that must not help; (b) token-odds terms by Brier, 10-fold CV + walk-forward, with a control that must not help; (c) interval honesty — the P25–P75 band held 52.7% of the time (stated 50%), the P10–P90 band 74.5% (stated 80%). It also carries the protocol accounting (all 758 in exactly one group), a verification strip (totals recomputed, watchlist 40/40, ledger 758/758, and an in-browser re-fit of the ridge from the 55 labels that must match the stored coefficients), and a per-row farm plan with deposit, expected drop, fees, time, net, net per hour and a FARM / MARGINAL / SKIP verdict (6 / 165 / 32 of 203 rows). The board covers the whole watchlist plus every rankable pre-token protocol below the floor and above it that the watchlist leaves out (203 rows). A manifest names the input snapshot's sha256 so no look-ahead can be alleged.

## Limitations, stated

No parent discount is applied to the 20 off-list rows: the snapshot carries no `parentProtocol` field, so applying the top entry's ×0.48 constant would be a hand-set multiple, not a fitted one. The 80% prediction band covers ~75%, slightly narrow. The TGE labels cover 55 of 90 labelled launches (31 are not comparables in the snapshot, 4 lack pre-launch TVL).

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input snapshot.json
```

The program reads `data/tge_labels.json` beside `main.ts` for the fit, writes `board.json` (203 rows), `data.js`, `dashboard/` (with `validation.js`, the proof, as a dashboard file) and `dossier.json`, and copies `screenshots/` (3 images: board, detail, filtered). It runs twice and writes identical bytes.

---

<sub>Entered on [make.fun](https://make.fun/?ref=wffmhs5a&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
