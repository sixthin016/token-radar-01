# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/sixthin016/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/sixthin016/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar (radar-3) scores every pre-token protocol from a sealed DeFi snapshot and ranks them by implied launch value, with a dark dashboard, seven-step farm plans and a byte-reproducible dossier.

## How it works

Each protocol's implied value is its TVL times a base multiple calibrated from the snapshot itself — the median market-cap/TVL of the tokenized protocols in the same category (at least three comparables, else the market-wide median, clamped 0.05–1.00) — then three multipliers: growth (clamped weekly change, gains count double), maturity (a hump that peaks at three years without a token), and breadth (more chains, more surface). No protocol name is ever special-cased, and no multiple is a hardcoded constant: the same rule reprices every category on any snapshot it is handed. The board covers the whole watchlist plus every rankable pre-token protocol below the floor, and the dashboard shows the model behind every row.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=wffmhs5a&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
