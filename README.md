# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/sixthin016/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/sixthin016/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar (radar-5) scores every pre-token protocol from a sealed DeFi snapshot and ranks them by implied launch value, with a dark dashboard, seven-step farm plans and a byte-reproducible dossier.

## How it works

Each protocol's implied value comes from a ridge regression FITTED on the snapshot itself — log10(market cap) on standardised log10(TVL) with one shrunk shift per category (intercept 7.020, slope 0.293 on standardised log-TVL, raw slope 0.369; slope penalty 10, category-shift penalty 30) — fitted on the 61 tokenized comparables outside the blind set, with an 80% prediction band from the train residual spread (sigma 0.842 in log10). The three hand-set multipliers radar-4 used (growth, maturity hump, breadth) are gone: on leave-one-out they were noise, and a LightGBM/HistGB quantile model scored worse than radar-4 itself, so no tree model is in this build. The ridge is proved, not asserted: before fitting, a blind set of 192 protocols is drawn by fixed seed `token-radar-04-blind` (the same 33 tokenized protocols radar-4 was scored on); the fit never sees them, all 192 predictions are published, and the 33 tokenized ones are scored against their actual market caps (pinball 0.209 vs radar-4 0.218, R² +0.03 vs −0.04, Spearman 0.30 vs 0.25, 80% interval coverage 0.85), with a leave-one-out check over all 94 comparables (pinball 0.216 vs 0.224, R² +0.07 vs +0.02, Spearman 0.31 vs 0.25), a time split by listed_at (pinball 0.217 vs 0.225), and a paired bootstrap (10,000 resamples) for the pinball and Spearman deltas — reported honestly in the dashboard, including that the strict dual-CI submit gate does not pass: the gain is real on every split but small next to sampling noise. A manifest names the input snapshot's sha256 so no look-ahead can be alleged. No protocol name is ever special-cased: the same rule prices every row on any snapshot it is handed. The board covers the whole watchlist plus every rankable pre-token protocol below the floor and above it that the watchlist leaves out (203 rows), and the dashboard shows the model behind every row, with a worked recomputation for the top row.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=wffmhs5a&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
