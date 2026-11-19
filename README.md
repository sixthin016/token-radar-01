# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/sixthin016/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/sixthin016/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar (radar-4) scores every pre-token protocol from a sealed DeFi snapshot and ranks them by implied launch value, with a dark dashboard, seven-step farm plans and a byte-reproducible dossier.

## How it works

Each protocol's implied value comes from a valuation curve FITTED on the snapshot itself — an OLS regression of log10(market cap / multipliers) on log10(TVL) with one shift per category that carries at least five tokenized comparables (intercept 3.979, slope 0.407 on this snapshot) — then three multipliers: growth (clamped weekly change, gains count double), maturity (a hump that peaks at three years without a token), and breadth (more chains, more surface). The curve is proved, not asserted: before fitting, a blind set of 192 protocols is drawn by fixed seed `token-radar-04-blind`; the fit never sees them, all 192 predictions are published, and the 33 tokenized ones are scored against their actual market caps (pinball 0.218, R² −0.04, 80% interval coverage 0.82), with a leave-one-out check over all 94 comparables (pinball 0.224, R² +0.02) and a median-multiple baseline on the same blind set (pinball 0.241, R² −0.27) for comparison. A manifest names the input snapshot's sha256 so no look-ahead can be alleged. No protocol name is ever special-cased: the same rule prices every row on any snapshot it is handed. The board covers the whole watchlist plus every rankable pre-token protocol below the floor and above it that the watchlist leaves out (203 rows), and the dashboard shows the model behind every row.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=wffmhs5a&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
