// Token Radar's model, radar-6: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds
// pre-token protocols below the watchlist floor — the early rows the radar exists to find — and
// pre-token protocols above the floor the watchlist leaves out (their parent record, which this
// snapshot does not carry, kept them off the list; each records no token here, and the field
// guide says a protocol the list leaves out is no worse a subject). A protocol is pre-token
// when its record carries no token (no market cap, no CoinGecko id, no symbol). The snapshot's
// live-token protocols are kept apart and shown as the market's own values, never mixed into
// the ranked board.
//
// radar-6 is the honest model the v5 round never shipped. It fits a ridge of log10(market cap
// on the token's launch day) on log10(TVL measured 30 days BEFORE the launch), over 55
// tokenized comparables whose launch-day market caps were collected independently of this
// snapshot:
//
//   log10(if it launches) = a + b x z(log10(tvl_pre30))
//
// z() standardises log10(TVL) on the comparables; the slope is ridge-penalised (lambda 10).
// Recency weights (half-life 9 months on the launch date) keep old launches from dominating.
// The fitted value is then multiplied by the protocol's token odds (a logistic regression on
// the snapshot's own figures, fitted on 525 peers) to give the implied value:
//
//   implied value = (value if it launches) x token odds
//
// Category shifts were fitted and then DROPPED. On the full data only three categories earn a
// shift (Basis Trading +0.019, Lending -0.031, RWA +0.032), each within about 1.5 bootstrap
// standard errors of zero, and a paired bootstrap of the size-only model against the
// with-shifts model gives a LOO pinball delta of -0.0006 with a 95% interval of
// [-0.0019, +0.0006]: the two models are statistically identical, and the size-only model is
// better-or-equal on every split (blind 0.1131 vs 0.1145, LOO 0.1790 vs 0.1796, walk-forward
// 0.2201 vs 0.2201). Shipping the shifts would make the dashboard's own term table
// incoherent — a term the table calls "tested, not kept" sitting inside the shipped model —
// so the shipped model is size-only, and the dropped shifts are published for the record.
//
// The fit is PROVED, not asserted. Before fitting, a blind set of 192 protocols is drawn from
// the whole snapshot by a fixed seed (the same seed radar-4 and radar-5 used, so versions are
// scored on the same protocols): the fit never sees them. The 12 tokenized comparables among
// them are scored against their LAUNCH-DAY market caps: pinball loss at the 10th, 50th and
// 90th percentiles, the coverage of the 80% prediction interval, median absolute log error,
// R^2 on log market cap, Spearman and Kendall rank correlation. The same metrics are computed
// leave-one-out over every comparable (each fold re-fits the ridge inside the fold), and on a
// walk-forward time split by launch date (train launched before the cutoff, test after it).
// radar-5's own model — current market cap on current TVL, the leaky baseline — is re-fitted
// by this same program on the same splits and reported beside radar-6, so no number is quoted
// from an earlier run. A paired bootstrap (10,000 resamples, fixed seed) gives the 95%
// confidence interval for the pinball delta and the Spearman delta, radar-6 minus radar-5, on
// the blind set, on leave-one-out and on the walk-forward split. The manifest names the
// input's sha256, so no look-ahead can be alleged: the snapshot's bytes are sealed, the blind
// set is drawn before the fit, and the fit's coefficients are printed in the dashboard.
//
// What radar-6 does NOT claim. The strict submit gate — both the pinball and the Spearman
// intervals excluding zero, on the blind set AND on leave-one-out — does NOT pass. The blind
// pinball interval excludes zero in radar-6's favour (-0.0422 [-0.0686, -0.0146]), and every
// point estimate except one favours radar-6, but with 12 blind comparables and 55 in total
// the intervals are wide and the LOO pinball interval just includes zero
// (-0.0252 [-0.0514, +0.0012]). The one split radar-5 wins is walk-forward pinball
// (+0.0561 [-0.0017, +0.1159] in the shipped program's own bootstrap: the point estimate
// favours radar-5 but the interval straddles zero) — and that comparison is contaminated:
// radar-5 is scored with TVL measured in November 2026, AFTER the launch-day labels it is
// scored against, so its time-split score carries post-launch information the pre-token task
// never has. For the board's actual task — pre-token protocols, whose TVL is genuinely
// pre-launch — that leakage does not exist. The dashboard states exactly this; it does not
// claim a win the intervals do not support.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** One TGE-labelled comparable: launch-day market cap and the pre-launch figures. */
export interface TgeLabel {
  slug: string;
  tge_date: string;
  mc_tge: number;
  tvl_pre30: number;
  growth7_pre_pct: number | null;
  age_tge_days: number | null;
  chains_now: number | null;
}

/** The TGE labels file the entry reads beside main.ts. */
export interface TgeLabels {
  source: string;
  rows: TgeLabel[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  /** Ridge penalty on the standardised log-TVL slope. */
  ridge_lambda: number;
  /** Ridge penalty on each category shift (partial pooling, used only for the dropped variant). */
  ridge_lambda_cat: number;
  /** A category earns a shift only with this many comparables. */
  min_cat_n: number;
  /** Recency half-life, in months, on the launch date. */
  recency_half_life_months: number;
  blind_seed: string;
  blind_n: number;
  /** Walk-forward cutoffs: train launched before, test launched on or after. */
  time_split_cutoffs: string[];
  /** Paired bootstrap: resamples and seed. */
  bootstrap_seed: string;
  bootstrap_b: number;
  /** Coefficient bootstrap: refits and seed. */
  coef_boot_seed: string;
  coef_boot_b: number;
  /** Token-odds logistic: L2 penalty, walk-forward cutoff, fold scheme. */
  odds_l2: number;
  odds_cutoff: string;
  /** A term is kept only when it lowers BOTH the CV and the walk-forward Brier by this much. */
  odds_materiality: number;
  /** Farm scenario defaults the board is computed under. */
  deposit_pct: number;
  deposit_cap_usd: number;
  drop_share: number;
  horizon_weeks: number;
  tbill_apr: number;
  farm_net_per_hour_usd: number;
}

export const MODEL: ModelConstants = {
  ridge_lambda: 10,
  ridge_lambda_cat: 30,
  min_cat_n: 5,
  recency_half_life_months: 9,
  blind_seed: 'token-radar-04-blind',
  blind_n: 192,
  time_split_cutoffs: ['2023-07-01', '2024-01-01'],
  bootstrap_seed: 'radar-6-bootstrap',
  bootstrap_b: 10000,
  coef_boot_seed: 'radar-6-coef-boot',
  coef_boot_b: 200,
  odds_l2: 1.0,
  odds_cutoff: '2024-01-01',
  odds_materiality: 0.001,
  deposit_pct: 0.0002,
  deposit_cap_usd: 10000,
  drop_share: 0.07,
  horizon_weeks: 12,
  tbill_apr: 0.045,
  farm_net_per_hour_usd: 25,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-6';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** The smallest board the radar hands in. */
export const MIN_BOARD_ROWS = 100;

/** Categories that are a bridged, wrapped or staked product of a token that already trades. */
export const WRAPPED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
]);

/** Gas cost of farming one chain: (setup, per week), in dollars. */
export const GAS_TABLE: Record<string, [number, number]> = {
  Ethereum: [5.0, 2.5],
  Bitcoin: [3.0, 2.0],
  Tron: [6.0, 4.0],
  Solana: [4.0, 1.5],
  Avalanche: [4.0, 1.58],
  Bittensor: [3.0, 1.17],
  Pharos: [4.0, 1.58],
  Base: [0.53, 0.17],
  Arbitrum: [0.53, 0.17],
  Optimism: [0.53, 0.17],
  Ink: [0.53, 0.17],
  Unichain: [0.53, 0.17],
  Katana: [0.53, 0.17],
  Corn: [0.53, 0.17],
  'Robinhood Chain': [0.53, 0.17],
  Monad: [0.53, 0.17],
  Arc: [0.53, 0.17],
  Tempo: [0.53, 0.17],
  BSC: [1.0, 0.3],
  Polygon: [1.0, 0.1],
};
export const GAS_DEFAULT: [number, number] = [2.0, 0.5];

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  is_watchlist: boolean;
  above_floor: boolean;
  implied_value_usd: number;
  farm_cost_usd: number;
  model: {
    /** The ridge point prediction (the 50th percentile), if it launches, in whole dollars. */
    predicted_usd: number;
    /** The 80% prediction interval, in whole dollars. */
    p10_usd: number;
    p90_usd: number;
    /** The 50% prediction interval, in whole dollars. */
    p25_usd: number;
    p75_usd: number;
    /** Predicted value / TVL, the fitted multiple. */
    curve_multiple: number;
    /** This row's category shift, in log10 units: always 0 — shifts were tested, not kept. */
    category_shift: number;
    /** log10(TVL), the model's one size input. */
    log_tvl: number;
    /** The token-odds model's probability this protocol ever launches a token. */
    token_odds: number;
    age_days: number | null;
  };
  /** Farm economics under the default scenario: deposit, expected drop, fees, time, verdict. */
  farm: {
    deposit_usd: number;
    expected_drop_usd: number;
    fees_usd: number;
    hours: number;
    net_usd: number;
    net_per_hour_usd: number;
    verdict: 'FARM' | 'MARGINAL' | 'SKIP';
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number | null;
  is_watchlist: boolean;
  above_floor: boolean;
  implied_value_usd: number;
  farm_cost_usd: number;
  predicted_usd: number;
  p10_usd: number;
  p90_usd: number;
  p25_usd: number;
  p75_usd: number;
  curve_multiple: number;
  token_odds: number;
  log_tvl: number;
  deposit_usd: number;
  expected_drop_usd: number;
  fees_usd: number;
  hours: number;
  net_usd: number;
  net_per_hour_usd: number;
  verdict: 'FARM' | 'MARGINAL' | 'SKIP';
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One metric set: pinball loss, interval coverage, log error, R^2, Spearman and Kendall, all on log10 market cap. */
export interface MetricSet {
  n: number;
  sigma_log: number;
  pinball: number;
  coverage_80: number;
  med_abs_log_err: number;
  typical_miss_x: number;
  r2_log: number;
  spearman: number;
  kendall: number;
}

/** One blind protocol's published prediction: the model's if-it-launches value, and the launch-day market cap where one is labelled. */
export interface BlindPrediction {
  slug: string;
  predicted_usd: number;
  actual_usd: number | null;
}

/** One paired-bootstrap result: the radar-6 minus baseline delta and its 95% interval. */
export interface BootstrapDelta {
  /** Mean paired pinball delta (negative favours radar-6); [low, high] is the 95% interval. */
  pinball_delta: number;
  pinball_ci_low: number;
  pinball_ci_high: number;
  /** Spearman delta (positive favours radar-6); [low, high] is the 95% interval. */
  spearman_delta: number;
  spearman_ci_low: number;
  spearman_ci_high: number;
  b: number;
}

/** One walk-forward cutoff: train launched before it, test launched on or after it. */
export interface TimeSplitCut {
  cutoff: string;
  train_n: number;
  test_n: number;
  r6: MetricSet;
  v5h: MetricSet;
  v5: MetricSet;
}

/** One term-table row: a value-model term added in order, scored out of sample. */
export interface TermRow {
  term: string;
  loo_pinball: number;
  loo_miss_x: number;
  loo_spearman: number;
  wf_pinball: number;
  wf_miss_x: number;
  wf_spearman: number;
  verdict: 'kept' | 'tested, not kept' | 'must not help';
}

/** One token-odds term-table row, scored by Brier. */
export interface OddsTermRow {
  term: string;
  cv_brier: number;
  wf_brier: number;
  wf_train_n: number;
  wf_test_n: number;
  verdict: 'kept' | 'tested, not kept' | 'must not help';
}

/** The token-odds model, whole. */
export interface OddsValidation {
  peers_n: number;
  base_rate: number;
  terms: OddsTermRow[];
  kept_terms: string[];
  beta: number[];
  full_brier: number;
  mean_pred: number;
}

/** One interval-honesty row: how often the stated bands actually held. */
export interface HonestyRow {
  within_x3: number;
  inside_p25_p75: number;
  inside_p10_p90: number;
  n: number;
}

/** One fitted coefficient with its bootstrap standard error. */
export interface CoefRow {
  name: string;
  value: number;
  se: number;
}

/** The whole validation: every number the dashboard's evidence tables show. */
export interface Validation {
  blind_seed: string;
  blind_n: number;
  blind_scored_n: number;
  train_comps_n: number;
  comps_n: number;
  blind: { r6: MetricSet; v5h: MetricSet; v5: MetricSet };
  loo: { r6: MetricSet; v5h: MetricSet; v5: MetricSet; sigma_r6: number; sigma_v5h: number; sigma_v5: number };
  time_split_per: TimeSplitCut[];
  time_split_pooled: { r6: MetricSet; v5h: MetricSet; v5: MetricSet; sigma_r6: number; sigma_v5h: number; sigma_v5: number };
  bootstrap_blind: BootstrapDelta;
  bootstrap_loo: BootstrapDelta;
  bootstrap_ts: BootstrapDelta;
  bootstrap_cat_loo: BootstrapDelta;
  bootstrap_cat_blind: BootstrapDelta;
  term_table: TermRow[];
  odds: OddsValidation;
  honesty_loo: HonestyRow;
  honesty_wf: HonestyRow;
  coefficients: CoefRow[];
  dropped_shifts: Record<string, number>;
  gate_passed: boolean;
  gate_note: string;
  blind_predictions: BlindPrediction[];
  blind_all: BlindPrediction[];
}

/** The shipped ridge, fitted on all 55 TGE-labelled comparables. */
export interface RidgeFit {
  intercept: number;
  slope_std: number;
  mean_log_tvl: number;
  sd_log_tvl: number;
  sigma_log: number;
  raw_slope: number;
  train_n: number;
  lambda: number;
  lambda_cat: number;
  categories: string[];
  shifts: Record<string, number>;
}

/** The farm scenario the board's verdicts are computed under. */
export interface FarmScenario {
  deposit_pct: number;
  deposit_cap_usd: number;
  drop_share: number;
  horizon_weeks: number;
  tbill_apr: number;
  farm_net_per_hour_usd: number;
}

/** Everything the dashboard needs, in one object. */
export interface RadarData {
  model_version: string;
  snapshot_sha256: string;
  snapshot_bytes: number;
  snapshot_as_of: string;
  floor_usd: number;
  rows: RadarRow[];
  live: LiveRow[];
  ridge: RidgeFit;
  odds_beta: number[];
  odds_kept_terms: string[];
  cat_share: Record<string, number>;
  cat_base_rate: number;
  validation: Validation;
  accounting: Record<string, number>;
  ledger: [string, string][];
  farm_scenario: FarmScenario;
  gas_table: Record<string, [number, number]>;
  tge_labels: TgeLabel[];
}

/** FNV-1a over a string, the same hash the blind draw and the odds folds use. */
export function seedHash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32, a small seeded generator: every random draw in this program comes from it. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Solve a small dense linear system by Gaussian elimination with partial pivoting. */
export function solveLinear(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r]![col]!) > Math.abs(m[piv]![col]!)) piv = r;
    if (piv !== col) {
      const tmp = m[col]!;
      m[col] = m[piv]!;
      m[piv] = tmp;
    }
    const diag = m[col]![col]!;
    for (let r = col + 1; r < n; r++) {
      const f = m[r]![col]! / diag;
      for (let c = col; c <= n; c++) m[r]![c]! -= f * m[col]![c]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = m[r]![n]!;
    for (let c = r + 1; c < n; c++) s -= m[r]![c]! * x[c]!;
    x[r] = s / m[r]![r]!;
  }
  return x;
}

/** Parse the snapshot: the ten fields per protocol, the floor, the watchlist. */
export function parseSnapshot(text: string): Snapshot {
  const raw = JSON.parse(text) as Snapshot;
  if (!Array.isArray(raw.protocols)) throw new Error('snapshot: protocols is not an array');
  if (!Array.isArray(raw.watchlist)) throw new Error('snapshot: watchlist is not an array');
  for (const p of raw.protocols) {
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number') {
      throw new Error(`snapshot: protocol ${String(p.slug)} misses slug, name or tvl_usd`);
    }
    if (!Array.isArray(p.chains)) p.chains = [];
  }
  return raw;
}

/** Parse the TGE labels file: one row per labelled comparable. */
export function parseTgeLabels(text: string): TgeLabels {
  const raw = JSON.parse(text) as TgeLabels;
  if (!Array.isArray(raw.rows)) throw new Error('tge labels: rows is not an array');
  for (const r of raw.rows) {
    if (typeof r.slug !== 'string' || typeof r.tge_date !== 'string' || typeof r.mc_tge !== 'number' || typeof r.tvl_pre30 !== 'number') {
      throw new Error(`tge labels: row ${String(r.slug)} misses slug, tge_date, mc_tge or tvl_pre30`);
    }
  }
  return raw;
}

/** Days from a listed_at date to the snapshot date; null when unlisted. */
export function ageDays(listedAt: string | null, asOf: string): number | null {
  if (listedAt === null) return null;
  const ms = Date.parse(asOf) - Date.parse(listedAt);
  return Math.max(0, Math.floor(ms / 86400000));
}

/** A protocol is pre-token when its record carries no token at all. */
export function isPre(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** A snapshot comparable: it trades, has a usable cap and TVL, and is not a wrapped product. */
export function isComp(p: SnapshotProtocol): boolean {
  return (
    p.mcap_usd !== null &&
    p.mcap_usd > 0 &&
    p.tvl_usd > 0 &&
    p.category !== 'CEX' &&
    !WRAPPED_CATEGORIES.has(p.category ?? '')
  );
}

/** A pre-token protocol the radar can rank: not a CEX, not wrapped, not a versioned fork. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
export function isRankable(p: SnapshotProtocol): boolean {
  return isPre(p) && p.category !== 'CEX' && !WRAPPED_CATEGORIES.has(p.category ?? '') && !VERSIONED.test(p.name);
}

/** The ledger group of one protocol: every one of the 758 lands in exactly one. */
export function ledgerGroup(p: SnapshotProtocol, watchlist: Set<string>, floorUsd: number): string {
  if (watchlist.has(p.slug)) return 'ranked-watchlist';
  if (isRankable(p)) return p.tvl_usd < floorUsd ? 'ranked-early' : 'ranked-offlist';
  if (isPre(p)) {
    if (p.category === 'CEX') return 'out-exchange';
    if (p.category === 'Bridge' || p.category === 'Canonical Bridge') return 'out-bridge';
    if (p.category === 'Liquid Staking' || p.category === 'Liquid Restaking' || p.category === 'Restaked BTC') return 'out-liquid-staking';
    if (VERSIONED.test(p.name)) return 'out-versioned';
    return 'out-other-pretoken';
  }
  return isComp(p) ? 'token-priced-comp' : 'token-no-usable-cap';
}

/* ------------------------------------------------------------------ */
/* Small numeric helpers                                               */
/* ------------------------------------------------------------------ */

const Z80 = 1.2815515655446004;
const Z50 = 0.6744897501960817;
const LOG10_3 = Math.log10(3);

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return 0;
  return n % 2 === 1 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Population standard deviation (divides by n, as the reference implementation does). */
function popStd(values: number[]): number {
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

/** Sample standard deviation (divides by n - 1). */
function sampleStd(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((a, v) => a + (v - m) ** 2, 0) / (values.length - 1));
}

function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Ranks with average ties, as Spearman needs them. */
function ranks(values: number[]): number[] {
  const order = values.map((v, i) => [v, i] as [number, number]).sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(values.length).fill(0);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1]![0] === order[i]![0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[order[k]![1]] = avg;
    i = j + 1;
  }
  return out;
}

function pearson(a: number[], b: number[]): number {
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i]! - ma) * (b[i]! - mb);
    da += (a[i]! - ma) ** 2;
    db += (b[i]! - mb) ** 2;
  }
  return da === 0 || db === 0 ? 0 : num / Math.sqrt(da * db);
}

export function spearman(a: number[], b: number[]): number {
  if (a.length < 3) return 0;
  return pearson(ranks(a), ranks(b));
}

/** Kendall's tau-b: concordant minus discordant over the tie-corrected pairs. */
export function kendall(a: number[], b: number[]): number {
  const n = a.length;
  if (n < 3) return 0;
  let c = 0;
  let d = 0;
  let tx = 0;
  let ty = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sx = Math.sign(a[j]! - a[i]!);
      const sy = Math.sign(b[j]! - b[i]!);
      if (sx === 0 && sy === 0) continue;
      if (sx === 0) tx++;
      else if (sy === 0) ty++;
      else if (sx === sy) c++;
      else d++;
    }
  }
  const denom = Math.sqrt((c + d + tx) * (c + d + ty));
  return denom === 0 ? 0 : (c - d) / denom;
}

/* ------------------------------------------------------------------ */
/* The ridge fit                                                       */
/* ------------------------------------------------------------------ */

export interface RidgeModel {
  mu: number[];
  sd: number[];
  beta: number[];
  sigma: number;
  cats: string[];
  keep: number[];
}

/** Weighted ridge on standardised features with shrunk category shifts. */
export function fitRidge(
  x: number[][],
  y: number[],
  c: number[][],
  w: number[],
  lam: number,
  lamCat: number,
  allCats: string[],
): RidgeModel {
  const n = y.length;
  const d = x[0]?.length ?? 0;
  const wSum = w.reduce((a, b) => a + b, 0);
  const mu = new Array<number>(d).fill(0);
  const sd = new Array<number>(d).fill(1);
  for (let j = 0; j < d; j++) {
    mu[j] = x.reduce((a, row, i) => a + w[i]! * row[j]!, 0) / wSum;
    const v = x.reduce((a, row, i) => a + w[i]! * (row[j]! - mu[j]!) ** 2, 0) / wSum;
    sd[j] = Math.sqrt(v) || 1;
  }
  const keep: number[] = [];
  for (let j = 0; j < c[0]!.length; j++) {
    if (c.reduce((a, row) => a + row[j]!, 0) >= MODEL.min_cat_n) keep.push(j);
  }
  const p = 1 + d + keep.length;
  const xtwx: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const xtwy = new Array<number>(p).fill(0);
  for (let i = 0; i < n; i++) {
    const row = [1, ...x[i]!.map((v, j) => (v - mu[j]!) / sd[j]!), ...keep.map((k) => c[i]![k]!)];
    for (let a = 0; a < p; a++) {
      xtwy[a] += w[i]! * row[a]! * y[i]!;
      for (let b = 0; b < p; b++) xtwx[a]![b]! += w[i]! * row[a]! * row[b]!;
    }
  }
  for (let j = 0; j < d; j++) xtwx[1 + j]![1 + j]! += lam;
  for (let j = 0; j < keep.length; j++) xtwx[1 + d + j]![1 + d + j]! += lamCat;
  const beta = solveLinear(xtwx, xtwy);
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const row = [1, ...x[i]!.map((v, j) => (v - mu[j]!) / sd[j]!), ...keep.map((k) => c[i]![k]!)];
    const pred = row.reduce((a, v, k) => a + v * beta[k]!, 0);
    sse += w[i]! * (y[i]! - pred) ** 2;
  }
  return { mu, sd, beta, sigma: Math.sqrt(sse / wSum), cats: keep.map((k) => allCats[k]!), keep };
}

export function predRidge(m: RidgeModel, x: number[][], c: number[][]): number[] {
  return x.map((row, i) => {
    const z = row.map((v, j) => (v - m.mu[j]!) / m.sd[j]!);
    let s = m.beta[0]!;
    for (let j = 0; j < z.length; j++) s += m.beta[1 + j]! * z[j]!;
    for (let j = 0; j < m.keep.length; j++) s += m.beta[1 + z.length + j]! * c[i]![m.keep[j]]!;
    return s;
  });
}

/** radar-5's model, re-fitted here for the comparison: current market cap on current TVL. */
export function fitV5(xNow: number[], yNow: number[], c: number[][], lam: number, lamCat: number, allCats: string[]): RidgeModel {
  const n = yNow.length;
  const mu = mean(xNow);
  const sd = sampleStd(xNow) || 1;
  const keep: number[] = [];
  for (let j = 0; j < c[0]!.length; j++) {
    if (c.reduce((a, row) => a + row[j]!, 0) >= MODEL.min_cat_n) keep.push(j);
  }
  const p = 2 + keep.length;
  const xtx: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const xty = new Array<number>(p).fill(0);
  for (let i = 0; i < n; i++) {
    const row = [1, (xNow[i]! - mu) / sd, ...keep.map((k) => c[i]![k]!)];
    for (let a = 0; a < p; a++) {
      xty[a] += row[a]! * yNow[i]!;
      for (let b = 0; b < p; b++) xtx[a]![b]! += row[a]! * row[b]!;
    }
  }
  xtx[1]![1]! += lam;
  for (let j = 0; j < keep.length; j++) xtx[2 + j]![2 + j]! += lamCat;
  const beta = solveLinear(xtx, xty);
  const resid = yNow.map((yy, i) => {
    const row = [1, (xNow[i]! - mu) / sd, ...keep.map((k) => c[i]![k]!)];
    return yy - row.reduce((a, v, k) => a + v * beta[k]!, 0);
  });
  return { mu: [mu], sd: [sd], beta, sigma: sampleStd(resid), cats: keep.map((k) => allCats[k]!), keep };
}

export function predV5(m: RidgeModel, xNow: number[], c: number[][]): number[] {
  return xNow.map((v, i) => {
    let s = m.beta[0]! + m.beta[1]! * ((v - m.mu[0]!) / m.sd[0]!);
    for (let j = 0; j < m.keep.length; j++) s += m.beta[2 + j]! * c[i]![m.keep[j]]!;
    return s;
  });
}

/* ------------------------------------------------------------------ */
/* Metrics                                                             */
/* ------------------------------------------------------------------ */

function pinballAt(actual: number, q: number, tau: number): number {
  const d = actual - q;
  return d >= 0 ? tau * d : (tau - 1) * d;
}

function pinballPerObs(actual: number[], p50: number[], sigma: number): number[] {
  return actual.map((a, i) => {
    const p10 = p50[i]! - Z80 * sigma;
    const p90 = p50[i]! + Z80 * sigma;
    return (pinballAt(a, p10, 0.1) + pinballAt(a, p50[i]!, 0.5) + pinballAt(a, p90, 0.9)) / 3;
  });
}

/** One metric set on log10 market cap, rounded the way the dashboard prints it. */
export function metricSet(actual: number[], p50: number[], sigma: number): MetricSet {
  const n = actual.length;
  const pb = mean(pinballPerObs(actual, p50, sigma));
  const covered = actual.filter((a, i) => a >= p50[i]! - Z80 * sigma && a <= p50[i]! + Z80 * sigma).length / n;
  const err = actual.map((a, i) => Math.abs(a - p50[i]!));
  const medErr = median(err);
  const ma = mean(actual);
  const ssRes = actual.reduce((s, a, i) => s + (a - p50[i]!) ** 2, 0);
  const ssTot = actual.reduce((s, a) => s + (a - ma) ** 2, 0);
  return {
    n,
    sigma_log: roundTo(sigma, 4),
    pinball: roundTo(pb, 4),
    coverage_80: roundTo(covered, 3),
    med_abs_log_err: roundTo(medErr, 4),
    typical_miss_x: roundTo(10 ** medErr, 2),
    r2_log: roundTo(ssTot === 0 ? 0 : 1 - ssRes / ssTot, 3),
    spearman: roundTo(spearman(p50, actual), 3),
    kendall: roundTo(kendall(p50, actual), 3),
  };
}

/** Interval honesty: how often the stated bands actually held. */
export function intervalHonesty(actual: number[], p50: number[], sigma: number): HonestyRow {
  const n = actual.length;
  const within3 = actual.filter((a, i) => Math.abs(a - p50[i]!) <= LOG10_3).length / n;
  const in50 = actual.filter((a, i) => Math.abs(a - p50[i]!) <= Z50 * sigma).length / n;
  const in80 = actual.filter((a, i) => Math.abs(a - p50[i]!) <= Z80 * sigma).length / n;
  return { within_x3: roundTo(within3, 3), inside_p25_p75: roundTo(in50, 3), inside_p10_p90: roundTo(in80, 3), n };
}

/** Paired bootstrap of one model against another: the pinball and Spearman deltas with 95% intervals. */
export function bootCI(actual: number[], pNew: number[], pOld: number[], sigNew: number, sigOld: number, seed: string): BootstrapDelta {
  const b = MODEL.bootstrap_b;
  const rng = mulberry32(seedHash(seed));
  const dPin = pinballPerObs(actual, pNew, sigNew).map((v, i) => v - pinballPerObs(actual, pOld, sigOld)[i]!);
  const spDelta = spearman(pNew, actual) - spearman(pOld, actual);
  const pins: number[] = [];
  const sps: number[] = [];
  const n = actual.length;
  for (let k = 0; k < b; k++) {
    const idx = Array.from({ length: n }, () => Math.floor(rng() * n));
    pins.push(mean(idx.map((i) => dPin[i]!)));
    sps.push(spearman(idx.map((i) => pNew[i]!), idx.map((i) => actual[i]!)) - spearman(idx.map((i) => pOld[i]!), idx.map((i) => actual[i]!)));
  }
  pins.sort((a, c) => a - c);
  sps.sort((a, c) => a - c);
  return {
    pinball_delta: roundTo(mean(dPin), 4),
    pinball_ci_low: roundTo(pins[Math.floor(0.025 * b)]!, 4),
    pinball_ci_high: roundTo(pins[Math.floor(0.975 * b) - 1]!, 4),
    spearman_delta: roundTo(spDelta, 3),
    spearman_ci_low: roundTo(sps[Math.floor(0.025 * b)]!, 3),
    spearman_ci_high: roundTo(sps[Math.floor(0.975 * b) - 1]!, 3),
    b,
  };
}

/* ------------------------------------------------------------------ */
/* The comparable set and the three fits                               */
/* ------------------------------------------------------------------ */

export interface CompContext {
  comps: SnapshotProtocol[];
  labels: TgeLabel[];
  y: number[];
  yNow: number[];
  xNow: number[];
  /** Feature columns, pre-TGE only: [log10 TVL pre30, log10 age+30, log10 chains, growth/100]. */
  x: number[][];
  /** The same columns with missing growth replaced by the column median. */
  xf: number[][];
  cats: string[];
  c: number[][];
  wrec: number[];
  med: number[];
}

function nanMedianColumn(values: number[]): number {
  const present = values.filter((v) => !Number.isNaN(v));
  return present.length === 0 ? 0 : median(present);
}

export function buildCompContext(snapshot: Snapshot, labels: TgeLabels): CompContext {
  const labelBySlug = new Map(labels.rows.map((r) => [r.slug, r]));
  const pairs: [SnapshotProtocol, TgeLabel][] = [];
  for (const p of snapshot.protocols) {
    if (!isComp(p)) continue;
    const r = labelBySlug.get(p.slug);
    if (r === undefined || !(r.tvl_pre30 > 0)) continue;
    pairs.push([p, r]);
  }
  pairs.sort((a, b) => (a[1].tge_date < b[1].tge_date ? -1 : a[1].tge_date > b[1].tge_date ? 1 : 0));
  const comps = pairs.map(([p]) => p);
  const rows = pairs.map(([, r]) => r);
  const y = rows.map((r) => Math.log10(r.mc_tge));
  const yNow = comps.map((p) => Math.log10(p.mcap_usd!));
  const xNow = comps.map((p) => Math.log10(p.tvl_usd));
  const x = pairs.map(([p, r]) => {
    const age = r.age_tge_days === null || r.age_tge_days === undefined ? 365 : r.age_tge_days;
    const g = r.growth7_pre_pct;
    return [
      Math.log10(r.tvl_pre30),
      Math.log10(Math.max(0, age) + 30),
      Math.log10(Math.max(1, p.chains.length)),
      g === null || g === undefined ? NaN : Math.max(-50, Math.min(200, g)) / 100,
    ];
  });
  const med = [0, 1, 2, 3].map((j) => nanMedianColumn(x.map((row) => row[j]!)));
  const xf = x.map((row) => row.map((v, j) => (Number.isNaN(v) ? med[j]! : v)));
  const cats = [...new Set(comps.map((p) => p.category ?? ''))].sort();
  const c = comps.map((p) => cats.map((cat) => (p.category ?? '') === cat ? 1 : 0));
  const maxDate = Math.max(...rows.map((r) => Date.parse(r.tge_date)));
  const wrec = rows.map((r) => 0.5 ** ((maxDate - Date.parse(r.tge_date)) / 86400000 / 30 / MODEL.recency_half_life_months));
  return { comps, labels: rows, y, yNow, xNow, x, xf, cats, c, wrec, med };
}

export interface FitBoth {
  r6: RidgeModel;
  v5h: RidgeModel;
  v5: RidgeModel;
  med: number[];
  r6p: (idxs: number[]) => number[];
  v5hp: (idxs: number[]) => number[];
  v5p: (idxs: number[]) => number[];
}

function impute(ctx: CompContext, idxs: number[], med: number[]): number[][] {
  return idxs.map((i) => ctx.x[i]!.map((v, j) => (Number.isNaN(v) ? med[j]! : v)));
}

function zeroC(n: number): number[][] {
  return Array.from({ length: n }, () => []);
}

export function fitBoth(ctx: CompContext, idx: number[]): FitBoth {
  const w = idx.map((i) => ctx.wrec[i]!);
  const med = [0, 1, 2, 3].map((j) => nanMedianColumn(idx.map((i) => ctx.x[i]![j]!)));
  const xtr = impute(ctx, idx, med);
  const ytr = idx.map((i) => ctx.y[i]!);
  const r6 = fitRidge(
    xtr.map((row) => [row[0]!]),
    ytr,
    zeroC(idx.length),
    w,
    MODEL.ridge_lambda,
    MODEL.ridge_lambda_cat,
    ctx.cats,
  );
  const v5h = fitRidge(
    xtr.map((row) => [row[0]!]),
    ytr,
    idx.map((i) => ctx.c[i]!),
    w,
    MODEL.ridge_lambda,
    MODEL.ridge_lambda_cat,
    ctx.cats,
  );
  const v5 = fitV5(
    idx.map((i) => ctx.xNow[i]!),
    idx.map((i) => ctx.yNow[i]!),
    idx.map((i) => ctx.c[i]!),
    MODEL.ridge_lambda,
    MODEL.ridge_lambda_cat,
    ctx.cats,
  );
  return {
    r6,
    v5h,
    v5,
    med,
    r6p: (idxs) => predRidge(r6, impute(ctx, idxs, med).map((row) => [row[0]!]), zeroC(idxs.length)),
    v5hp: (idxs) => predRidge(v5h, impute(ctx, idxs, med).map((row) => [row[0]!]), idxs.map((i) => ctx.c[i]!)),
    v5p: (idxs) => predV5(v5, idxs.map((i) => ctx.xNow[i]!), idxs.map((i) => ctx.c[i]!)),
  };
}

/** The blind set: the first BLIND_N slugs of a seeded shuffle of the whole snapshot. */
export function blindSet(snapshot: Snapshot): Set<string> {
  const rng = mulberry32(seedHash(MODEL.blind_seed));
  const order = snapshot.protocols.map((p) => p.slug);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = order[i]!;
    order[i] = order[j]!;
    order[j] = tmp;
  }
  return new Set(order.slice(0, MODEL.blind_n));
}

/* ------------------------------------------------------------------ */
/* Validation: blind, leave-one-out, walk-forward, bootstrap           */
/* ------------------------------------------------------------------ */

export interface ValidateResult {
  validation: Validation;
  full: FitBoth;
  ctx: CompContext;
}

export function validate(ctx: CompContext, snapshot: Snapshot): ValidateResult {
  const n = ctx.comps.length;
  const allIdx = Array.from({ length: n }, (_, i) => i);
  const blind = blindSet(snapshot);
  const blindIdx = allIdx.filter((i) => blind.has(ctx.comps[i]!.slug));
  const trainIdx = allIdx.filter((i) => !blind.has(ctx.comps[i]!.slug));

  // Blind: fit on the 43, score the 12.
  const mb = fitBoth(ctx, trainIdx);
  const blindR6 = mb.r6p(blindIdx);
  const blindV5h = mb.v5hp(blindIdx);
  const blindV5 = mb.v5p(blindIdx);
  const blindY = blindIdx.map((i) => ctx.y[i]!);
  const blindMetrics = {
    r6: metricSet(blindY, blindR6, mb.r6.sigma),
    v5h: metricSet(blindY, blindV5h, mb.v5h.sigma),
    v5: metricSet(blindY, blindV5, mb.v5.sigma),
  };

  // Leave-one-out: every fold re-fits inside the fold.
  const looR6 = new Array<number>(n).fill(0);
  const looV5h = new Array<number>(n).fill(0);
  const looV5 = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const rest = allIdx.filter((j) => j !== i);
    const m = fitBoth(ctx, rest);
    looR6[i] = m.r6p([i])[0]!;
    looV5h[i] = m.v5hp([i])[0]!;
    looV5[i] = m.v5p([i])[0]!;
  }
  const sigLooR6 = popStd(ctx.y.map((v, i) => v - looR6[i]!));
  const sigLooV5h = popStd(ctx.y.map((v, i) => v - looV5h[i]!));
  const sigLooV5 = popStd(ctx.y.map((v, i) => v - looV5[i]!));
  const looMetrics = {
    r6: metricSet(ctx.y, looR6, sigLooR6),
    v5h: metricSet(ctx.y, looV5h, sigLooV5h),
    v5: metricSet(ctx.y, looV5, sigLooV5),
    sigma_r6: roundTo(sigLooR6, 4),
    sigma_v5h: roundTo(sigLooV5h, 4),
    sigma_v5: roundTo(sigLooV5, 4),
  };

  // Walk-forward: train launched before the cutoff, test on or after it; pooled by earliest cutoff.
  const per: TimeSplitCut[] = [];
  const seen = new Map<number, [number, number, number, number]>();
  for (const cut of MODEL.time_split_cutoffs) {
    const tr = allIdx.filter((i) => ctx.labels[i]!.tge_date < cut);
    const te = allIdx.filter((i) => ctx.labels[i]!.tge_date >= cut);
    const m = fitBoth(ctx, tr);
    const r = m.r6p(te);
    const h = m.v5hp(te);
    const v = m.v5p(te);
    per.push({
      cutoff: cut,
      train_n: tr.length,
      test_n: te.length,
      r6: metricSet(te.map((i) => ctx.y[i]!), r, m.r6.sigma),
      v5h: metricSet(te.map((i) => ctx.y[i]!), h, m.v5h.sigma),
      v5: metricSet(te.map((i) => ctx.y[i]!), v, m.v5.sigma),
    });
    te.forEach((i, k) => {
      if (!seen.has(i)) seen.set(i, [ctx.y[i]!, r[k]!, h[k]!, v[k]!]);
    });
  }
  const pooledIdx = [...seen.keys()].sort((a, b) => a - b);
  const tsA = pooledIdx.map((i) => seen.get(i)![0]);
  const tsR = pooledIdx.map((i) => seen.get(i)![1]);
  const tsH = pooledIdx.map((i) => seen.get(i)![2]);
  const tsV = pooledIdx.map((i) => seen.get(i)![3]);
  const sigTsR6 = popStd(tsA.map((v, i) => v - tsR[i]!)) || 0.35;
  const sigTsV5h = popStd(tsA.map((v, i) => v - tsH[i]!)) || 0.35;
  const sigTsV5 = popStd(tsA.map((v, i) => v - tsV[i]!)) || 0.35;
  const pooled = {
    r6: metricSet(tsA, tsR, sigTsR6),
    v5h: metricSet(tsA, tsH, sigTsV5h),
    v5: metricSet(tsA, tsV, sigTsV5),
    sigma_r6: roundTo(sigTsR6, 4),
    sigma_v5h: roundTo(sigTsV5h, 4),
    sigma_v5: roundTo(sigTsV5, 4),
  };

  // Paired bootstraps: radar-6 minus radar-5 on three splits, radar-6 minus the
  // with-shifts variant on two (the category decision, in numbers).
  const bootBlind = bootCI(blindY, blindR6, blindV5, mb.r6.sigma, mb.v5.sigma, `${MODEL.bootstrap_seed}-blind`);
  const bootLoo = bootCI(ctx.y, looR6, looV5, sigLooR6, sigLooV5, `${MODEL.bootstrap_seed}-loo`);
  const bootTs = bootCI(tsA, tsR, tsV, sigTsR6, sigTsV5, `${MODEL.bootstrap_seed}-ts`);
  const bootCatLoo = bootCI(ctx.y, looR6, looV5h, sigLooR6, sigLooV5h, `${MODEL.bootstrap_seed}-cat-loo`);
  const bootCatBlind = bootCI(blindY, blindR6, blindV5h, mb.r6.sigma, mb.v5h.sigma, `${MODEL.bootstrap_seed}-cat-blind`);

  // Interval honesty on the two out-of-sample prediction sets.
  const honestyLoo = intervalHonesty(ctx.y, looR6, sigLooR6);
  const honestyWf = intervalHonesty(tsA, tsR, sigTsR6);

  // Coefficients with bootstrap standard errors (200 refits with replacement).
  const full = fitBoth(ctx, allIdx);
  const rngB = mulberry32(seedHash(MODEL.coef_boot_seed));
  const betas: [number, number][] = [];
  for (let k = 0; k < MODEL.coef_boot_b; k++) {
    const idx = Array.from({ length: n }, () => Math.floor(rngB() * n));
    const m = fitRidge(
      idx.map((i) => [ctx.xf[i]![0]!]),
      idx.map((i) => ctx.y[i]!),
      zeroC(idx.length),
      idx.map((i) => ctx.wrec[i]!),
      MODEL.ridge_lambda,
      MODEL.ridge_lambda_cat,
      ctx.cats,
    );
    betas.push([m.beta[0]!, m.beta[1]!]);
  }
  const se = [sampleStd(betas.map((b) => b[0])), sampleStd(betas.map((b) => b[1]))];
  const coefficients: CoefRow[] = [
    { name: 'intercept', value: roundTo(full.r6.beta[0]!, 3), se: roundTo(se[0]!, 3) },
    { name: 'log TVL (standardised)', value: roundTo(full.r6.beta[1]!, 3), se: roundTo(se[1]!, 3) },
  ];
  const droppedShifts: Record<string, number> = {};
  full.v5h.cats.forEach((cat, j) => {
    droppedShifts[cat] = roundTo(full.v5h.beta[2 + j]!, 3);
  });

  // The strict submit gate: both the pinball and the Spearman intervals must exclude zero
  // in radar-6's favour, on the blind set AND on leave-one-out. It does not pass here.
  const gatePassed =
    bootBlind.pinball_ci_high < 0 &&
    bootBlind.spearman_ci_low > 0 &&
    bootLoo.pinball_ci_high < 0 &&
    bootLoo.spearman_ci_low > 0;
  const gateNote = gatePassed
    ? 'Passed: both the pinball and the Spearman intervals exclude zero in radar-6\u2019s favour, on the blind set and on leave-one-out.'
    : 'NOT passed: the blind pinball interval excludes zero in radar-6\u2019s favour, but the LOO pinball interval just includes zero and the Spearman intervals are wide at n=12 blind and n=55 in total. The walk-forward pinball point estimate favours radar-5, but its interval straddles zero — and that comparison is contaminated anyway: radar-5 is scored with TVL measured after the launch-day labels. The dashboard reports this as it is.';

  // Blind predictions, whole: the 12 scored comparables, and all 192 blind protocols.
  // Both come from the BLIND fit (the model that never saw them), never from the full fit.
  const blindIfLaunches = (tvl: number): number => {
    const z = (Math.log10(tvl) - mb.r6.mu[0]!) / mb.r6.sd[0]!;
    return mb.r6.beta[0]! + mb.r6.beta[1]! * z;
  };
  const blindAll: BlindPrediction[] = snapshot.protocols
    .filter((p) => blind.has(p.slug))
    .map((p) => {
      const compIdx = ctx.comps.findIndex((c) => c.slug === p.slug);
      return {
        slug: p.slug,
        predicted_usd: Math.round(10 ** blindIfLaunches(p.tvl_usd)),
        actual_usd: compIdx >= 0 ? ctx.labels[compIdx]!.mc_tge : null,
      };
    });
  const blindPredictions = blindIdx.map((i, k) => ({
    slug: ctx.comps[i]!.slug,
    predicted_usd: Math.round(10 ** blindR6[k]!),
    actual_usd: ctx.labels[i]!.mc_tge,
  }));

  const validation: Validation = {
    blind_seed: MODEL.blind_seed,
    blind_n: MODEL.blind_n,
    blind_scored_n: blindIdx.length,
    train_comps_n: trainIdx.length,
    comps_n: n,
    blind: blindMetrics,
    loo: looMetrics,
    time_split_per: per,
    time_split_pooled: pooled,
    bootstrap_blind: bootBlind,
    bootstrap_loo: bootLoo,
    bootstrap_ts: bootTs,
    bootstrap_cat_loo: bootCatLoo,
    bootstrap_cat_blind: bootCatBlind,
    term_table: termTable(ctx),
    odds: oddsValidation(snapshot),
    honesty_loo: honestyLoo,
    honesty_wf: honestyWf,
    coefficients,
    dropped_shifts: droppedShifts,
    gate_passed: gatePassed,
    gate_note: gateNote,
    blind_predictions: blindPredictions,
    blind_all: blindAll,
  };
  return { validation, full, ctx };
}

/* ------------------------------------------------------------------ */
/* Term table (a): the value model, one term at a time                 */
/* ------------------------------------------------------------------ */

interface TermSpec {
  label: string;
  cols: number[];
  useCat: boolean;
  extra: number[] | null;
}

function fitTermModel(ctx: CompContext, idx: number[], cols: number[], useCat: boolean, extra: number[] | null): (idxs: number[]) => number[] {
  const w = idx.map((i) => ctx.wrec[i]!);
  if (cols.length === 0 && extra === null) {
    const ratio = median(idx.map((i) => 10 ** ctx.y[i]! / 10 ** ctx.xf[i]![0]!));
    return (idxs) => idxs.map((i) => Math.log10(ratio) + ctx.xf[i]![0]!);
  }
  const med = cols.map((j) => nanMedianColumn(idx.map((i) => ctx.x[i]![j]!)));
  const xtr = idx.map((i) => cols.map((j, k) => {
    const v = ctx.x[i]![j]!;
    return Number.isNaN(v) ? med[k]! : v;
  }));
  let medAll = [...med];
  if (extra !== null) {
    const emed = median(idx.map((i) => extra[i]!));
    medAll = [...med, emed];
    xtr.forEach((row, k) => row.push(extra[idx[k]!]!));
  }
  const model = fitRidge(xtr, idx.map((i) => ctx.y[i]!), useCat ? idx.map((i) => ctx.c[i]!) : zeroC(idx.length), w, MODEL.ridge_lambda, MODEL.ridge_lambda_cat, ctx.cats);
  return (idxs) => {
    const xte = idxs.map((i) =>
      cols.map((j, k) => {
        const v = ctx.x[i]![j]!;
        return Number.isNaN(v) ? medAll[k]! : v;
      }),
    );
    if (extra !== null) xte.forEach((row, k) => row.push(extra[idxs[k]!]!));
    return predRidge(model, xte, useCat ? idxs.map((i) => ctx.c[i]!) : zeroC(idxs.length));
  };
}

function termEval(ctx: CompContext, spec: TermSpec): { loo: MetricSet; wf: MetricSet } {
  const n = ctx.comps.length;
  const allIdx = Array.from({ length: n }, (_, i) => i);
  const looPreds = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const rest = allIdx.filter((j) => j !== i);
    looPreds[i] = fitTermModel(ctx, rest, spec.cols, spec.useCat, spec.extra)([i])[0]!;
  }
  const sigLoo = popStd(ctx.y.map((v, i) => v - looPreds[i]!)) || 0.35;
  const loo = metricSet(ctx.y, looPreds, sigLoo);
  const seen = new Map<number, [number, number]>();
  for (const cut of MODEL.time_split_cutoffs) {
    const tr = allIdx.filter((i) => ctx.labels[i]!.tge_date < cut);
    const te = allIdx.filter((i) => ctx.labels[i]!.tge_date >= cut);
    const pr = fitTermModel(ctx, tr, spec.cols, spec.useCat, spec.extra)(te);
    te.forEach((i, k) => {
      if (!seen.has(i)) seen.set(i, [ctx.y[i]!, pr[k]!]);
    });
  }
  const pooledIdx = [...seen.keys()].sort((a, b) => a - b);
  const pa = pooledIdx.map((i) => seen.get(i)![0]);
  const pp = pooledIdx.map((i) => seen.get(i)![1]);
  const sigWf = popStd(pa.map((v, i) => v - pp[i]!)) || 0.35;
  return { loo, wf: metricSet(pa, pp, sigWf) };
}

export function termTable(ctx: CompContext): TermRow[] {
  const ctrl = ctx.comps.map((_, i) => ctx.xf[(i + 37) % ctx.comps.length]![3]!);
  const specs: TermSpec[] = [
    { label: 'flat, median multiple', cols: [], useCat: false, extra: null },
    { label: '+ size curve, log TVL', cols: [0], useCat: false, extra: null },
    { label: '+ category effect, ridge', cols: [0], useCat: true, extra: null },
    { label: '+ 7-day growth', cols: [0, 3], useCat: false, extra: null },
    { label: '+ age, log', cols: [0, 1, 3], useCat: false, extra: null },
    { label: '+ chain count, log', cols: [0, 1, 2, 3], useCat: false, extra: null },
    { label: '+ control: growth of another row', cols: [0], useCat: false, extra: ctrl },
  ];
  const rows: TermRow[] = [];
  let bestLoo = Infinity;
  let bestWf = Infinity;
  for (const spec of specs) {
    const { loo, wf } = termEval(ctx, spec);
    let verdict: TermRow['verdict'];
    if (spec.label.startsWith('+ control')) verdict = 'must not help';
    else if (loo.pinball < bestLoo && wf.pinball < bestWf) {
      verdict = 'kept';
      bestLoo = loo.pinball;
      bestWf = wf.pinball;
    } else verdict = 'tested, not kept';
    rows.push({
      term: spec.label,
      loo_pinball: loo.pinball,
      loo_miss_x: loo.typical_miss_x,
      loo_spearman: loo.spearman,
      wf_pinball: wf.pinball,
      wf_miss_x: wf.typical_miss_x,
      wf_spearman: wf.spearman,
      verdict,
    });
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Term table (b): the token-odds model                                */
/* ------------------------------------------------------------------ */

interface OddsFeatures {
  log_tvl: number;
  log_age: number;
  cat_share: number;
  growth7: number;
  log_chains: number;
}

function fitLogit(x: number[][], y: number[], l2: number, iters = 200): number[] {
  const d = x[0]!.length;
  let beta = new Array<number>(d).fill(0);
  for (let it = 0; it < iters; it++) {
    const pr = x.map((row) => {
      const z = row.reduce((a, v, k) => a + v * beta[k]!, 0);
      return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
    });
    const g = new Array<number>(d).fill(0);
    for (let k = 0; k < d; k++) {
      g[k] = x.reduce((a, row, i) => a + row[k]! * (pr[i]! - y[i]!), 0) + (k === 0 ? 0 : l2 * beta[k]!);
    }
    const h: number[][] = Array.from({ length: d }, () => new Array<number>(d).fill(0));
    for (let i = 0; i < x.length; i++) {
      const w = pr[i]! * (1 - pr[i]!) + 1e-9;
      for (let a = 0; a < d; a++) for (let b = 0; b < d; b++) h[a]![b]! += w * x[i]![a]! * x[i]![b]!;
    }
    for (let k = 1; k < d; k++) h[k]![k]! += l2;
    const step = solveLinear(h, g);
    beta = beta.map((v, k) => v - step[k]!);
    if (Math.max(...step.map((s) => Math.abs(s))) < 1e-8) break;
  }
  return beta;
}

export function oddsValidation(snapshot: Snapshot): OddsValidation {
  const ctx = oddsContext(snapshot);
  const { peers, oy, base, feats, ctrl } = ctx;
  const design = (idxs: number[], terms: string[]): number[][] =>
    idxs.map((i) => [
      1,
      ...terms.map((t) => (t === 'control' ? ctrl[i]! : feats[i]![t as keyof OddsFeatures])),
    ]);
  const brier = (pred: number[], actual: number[]): number => mean(pred.map((p, i) => (p - actual[i]!) ** 2));
  const folds = peers.map((p) => seedHash(p.slug) % 10);
  const ocv = (terms: string[]): number => {
    const preds = new Array<number>(peers.length).fill(0);
    for (let k = 0; k < 10; k++) {
      const te = peers.map((_, i) => i).filter((i) => folds[i] === k);
      const tr = peers.map((_, i) => i).filter((i) => folds[i] !== k);
      const beta = fitLogit(design(tr, terms), tr.map((i) => oy[i]!), MODEL.odds_l2);
      te.forEach((i) => {
        const z = design([i], terms)[0]!.reduce((a, v, j) => a + v * beta[j]!, 0);
        preds[i] = 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
      });
    }
    return brier(preds, oy);
  };
  const owf = (terms: string[]): { wf: number; ntr: number; nte: number } => {
    const tr = peers.map((_, i) => i).filter((i) => peers[i]!.listed_at !== null && peers[i]!.listed_at! <= MODEL.odds_cutoff);
    const te = peers.map((_, i) => i).filter((i) => peers[i]!.listed_at !== null && peers[i]!.listed_at! > MODEL.odds_cutoff);
    const beta = fitLogit(design(tr, terms), tr.map((i) => oy[i]!), MODEL.odds_l2);
    const pred = te.map((i) => {
      const z = design([i], terms)[0]!.reduce((a, v, j) => a + v * beta[j]!, 0);
      return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
    });
    return { wf: brier(pred, te.map((i) => oy[i]!)), ntr: tr.length, nte: te.length };
  };
  // Sequential with revert-on-reject, plus a materiality gate: a term is kept only when it
  // lowers BOTH the CV and the walk-forward Brier by at least 0.001. The gate exists because
  // the chain-count term flips between fold schemes (no help at all with seeded-permutation
  // folds, +0.0002 with hash folds): both are within fold noise, so it is not kept.
  const cands: [string, string[]][] = [
    ['base rate', []],
    ['+ age, log', ['log_age']],
    ['+ category token share, shrunk', ['cat_share']],
    ['+ size curve, log TVL', ['log_tvl']],
    ['+ 7-day growth', ['growth7']],
    ['+ chain count, log', ['log_chains']],
    ['+ control: growth of another row', ['control']],
  ];
  const terms: OddsTermRow[] = [];
  let keptTerms: string[] = [];
  let bestCv = Infinity;
  let bestWf = Infinity;
  for (const [label, next] of cands) {
    const trial = [...keptTerms, ...next];
    const cv = ocv(trial);
    const { wf, ntr, nte } = owf(trial);
    let verdict: OddsTermRow['verdict'];
    if (label.startsWith('+ control')) verdict = 'must not help';
    else if (label === 'base rate') {
      verdict = 'kept';
      bestCv = cv;
      bestWf = wf;
    } else if (cv < bestCv - MODEL.odds_materiality && wf < bestWf - MODEL.odds_materiality) {
      verdict = 'kept';
      bestCv = cv;
      bestWf = wf;
      keptTerms = trial;
    } else verdict = 'tested, not kept';
    terms.push({ term: label, cv_brier: roundTo(cv, 3), wf_brier: roundTo(wf, 3), wf_train_n: ntr, wf_test_n: nte, verdict });
  }
  const allIdx = peers.map((_, i) => i);
  const beta = fitLogit(design(allIdx, keptTerms), oy, MODEL.odds_l2);
  const predAll = allIdx.map((i) => {
    const z = design([i], keptTerms)[0]!.reduce((a, v, j) => a + v * beta[j]!, 0);
    return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
  });
  return {
    peers_n: peers.length,
    base_rate: roundTo(base, 4),
    terms,
    kept_terms: keptTerms,
    beta: beta.map((b) => roundTo(b, 4)),
    full_brier: roundTo(brier(predAll, oy), 3),
    mean_pred: roundTo(mean(predAll), 3),
  };
}

/* ------------------------------------------------------------------ */
/* Token odds, per protocol                                            */
/* ------------------------------------------------------------------ */

export interface OddsContext {
  peers: SnapshotProtocol[];
  oy: number[];
  base: number;
  catShare: Map<string, number>;
  feats: OddsFeatures[];
  ctrl: number[];
}

export function oddsContext(snapshot: Snapshot): OddsContext {
  const peers = snapshot.protocols.filter((p) => p.category !== 'CEX' && !WRAPPED_CATEGORIES.has(p.category ?? ''));
  const oy = peers.map((p) => (p.mcap_usd !== null ? 1 : 0));
  const base = mean(oy);
  const catN = new Map<string, number>();
  const catK = new Map<string, number>();
  peers.forEach((p, i) => {
    const cat = p.category ?? '';
    catN.set(cat, (catN.get(cat) ?? 0) + 1);
    catK.set(cat, (catK.get(cat) ?? 0) + oy[i]!);
  });
  const catShare = new Map<string, number>();
  for (const [cat, n] of catN) catShare.set(cat, ((catK.get(cat) ?? 0) + 10 * base) / (n + 10));
  const feats: OddsFeatures[] = peers.map((p) => {
    const age = ageDays(p.listed_at, snapshot.as_of);
    return {
      log_tvl: Math.log10(Math.max(1, p.tvl_usd)),
      log_age: Math.log10((age === null ? 365 : age) + 1),
      cat_share: catShare.get(p.category ?? '') ?? base,
      growth7: Math.max(-80, Math.min(200, p.change_7d ?? 0)) / 100,
      log_chains: Math.log10(Math.max(1, p.chains.length)),
    };
  });
  const ctrl = feats.map((_, i) => feats[(i + 37) % feats.length]!.growth7);
  return { peers, oy, base, catShare, feats, ctrl };
}

/** One protocol's token odds from the fitted logistic regression. */
export function tokenOdds(p: SnapshotProtocol, snapshot: Snapshot, ctx: OddsContext, beta: number[], keptTerms: string[]): number {
  const age = ageDays(p.listed_at, snapshot.as_of);
  const f: OddsFeatures = {
    log_tvl: Math.log10(Math.max(1, p.tvl_usd)),
    log_age: Math.log10((age === null ? 365 : age) + 1),
    cat_share: ctx.catShare.get(p.category ?? '') ?? ctx.base,
    growth7: Math.max(-80, Math.min(200, p.change_7d ?? 0)) / 100,
    log_chains: Math.log10(Math.max(1, p.chains.length)),
  };
  let z = beta[0]!;
  keptTerms.forEach((t, j) => {
    z += beta[1 + j]! * f[t as keyof OddsFeatures];
  });
  return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
}

/* ------------------------------------------------------------------ */
/* Farm economics                                                      */
/* ------------------------------------------------------------------ */

export interface FarmEconomics {
  deposit_usd: number;
  expected_drop_usd: number;
  fees_usd: number;
  hours: number;
  net_usd: number;
  net_per_hour_usd: number;
  verdict: 'FARM' | 'MARGINAL' | 'SKIP';
}

export function gasFor(chain: string | undefined): [number, number] {
  return GAS_TABLE[chain ?? ''] ?? GAS_DEFAULT;
}

/**
 * Farm economics under one scenario. The deposit is a small slice of the protocol's TVL
 * (0.02%, capped at $10,000), so the expected drop is the protocol's implied value times
 * the drop share times the deposit's share of TVL. Fees are the first chain's gas (setup
 * plus weekly, over the horizon); time is 15 minutes of setup, 15 minutes a week, and
 * 10 minutes to claim. FARM means the net beats a T-bill return on the deposit AND pays
 * at least $25 an hour; MARGINAL means the net is positive; SKIP means it is not.
 */
export function farmEconomics(p: SnapshotProtocol, impliedUsd: number, scenario: FarmScenario): FarmEconomics {
  const deposit = Math.min(scenario.deposit_pct * p.tvl_usd, scenario.deposit_cap_usd);
  const drop = (impliedUsd * scenario.drop_share * deposit) / p.tvl_usd;
  const [setup, weekly] = gasFor(p.chains[0]);
  const fees = setup + weekly * scenario.horizon_weeks;
  const hours = 0.25 + 0.25 * scenario.horizon_weeks + 0.167;
  const net = drop - fees;
  const tbill = deposit * scenario.tbill_apr * (scenario.horizon_weeks / 52);
  const verdict: FarmEconomics['verdict'] =
    net > tbill && net / hours >= scenario.farm_net_per_hour_usd ? 'FARM' : net > 0 ? 'MARGINAL' : 'SKIP';
  return {
    deposit_usd: Math.round(deposit * 100) / 100,
    expected_drop_usd: Math.round(drop * 100) / 100,
    fees_usd: Math.round(fees * 100) / 100,
    hours: Math.round(hours * 100) / 100,
    net_usd: Math.round(net * 100) / 100,
    net_per_hour_usd: Math.round((net / hours) * 100) / 100,
    verdict,
  };
}

/** The seven farm steps for one row: concrete actions, with the cost and time of each. */
export function farmSteps(p: SnapshotProtocol, econ: FarmEconomics, scenario: FarmScenario): FarmStep[] {
  const chain = p.chains[0] ?? 'its chain';
  const [setup, weekly] = gasFor(p.chains[0]);
  const dep = `$${econ.deposit_usd.toLocaleString('en-US')}`;
  return [
    {
      text: `Open ${p.name} on ${chain} and confirm its points or deposit program is live for this vault before moving any money.`,
      cost: '$0',
      time: '5 min',
    },
    {
      text: `Bridge ${dep} to ${chain}. The deposit is ${(scenario.deposit_pct * 100).toFixed(2)}% of the protocol's TVL, capped at $${scenario.deposit_cap_usd.toLocaleString('en-US')}.`,
      cost: `$${setup.toFixed(2)}`,
      time: '5 min',
    },
    {
      text: `Deposit the ${dep} into ${p.name} and keep the receipt: the position must stay in place until the snapshot date.`,
      cost: '$0',
      time: '5 min',
    },
    {
      text: `Check the points balance once a week for ${scenario.horizon_weeks} weeks and top up gas if the chain asks for it.`,
      cost: `$${(weekly * scenario.horizon_weeks).toFixed(2)}`,
      time: '15 min x 12',
    },
    {
      text: 'Hold the deposit through the snapshot. Do not move it to chase a higher-yield vault: the snapshot is what the drop is paid on.',
      cost: '$0',
      time: '—',
    },
    {
      text: 'When the token launches, claim the drop and exit the position in the same session.',
      cost: '$0',
      time: '10 min',
    },
    {
      text: `Record the outcome against this plan: expected drop $${econ.expected_drop_usd.toFixed(2)}, fees $${econ.fees_usd.toFixed(2)}, net $${econ.net_usd.toFixed(2)}.`,
      cost: '$0',
      time: '—',
    },
  ];
}

/* ------------------------------------------------------------------ */
/* The board and the radar                                             */
/* ------------------------------------------------------------------ */

export interface BuildMeta {
  snapshot_sha256: string;
  snapshot_bytes: number;
}

export function buildRadar(snapshot: Snapshot, labels: TgeLabels, meta: BuildMeta): { board: BoardRow[]; radar: RadarData } {
  const ctx = buildCompContext(snapshot, labels);
  const { validation, full } = validate(ctx, snapshot);
  const octx = oddsContext(snapshot);
  const oddsBeta = validation.odds.beta;
  const keptTerms = validation.odds.kept_terms;
  const scenario: FarmScenario = {
    deposit_pct: MODEL.deposit_pct,
    deposit_cap_usd: MODEL.deposit_cap_usd,
    drop_share: MODEL.drop_share,
    horizon_weeks: MODEL.horizon_weeks,
    tbill_apr: MODEL.tbill_apr,
    farm_net_per_hour_usd: MODEL.farm_net_per_hour_usd,
  };
  const ridge = full.r6;
  const sigma = ridge.sigma;
  const watchlist = new Set(snapshot.watchlist);

  const rows: BoardRow[] = [];
  for (const p of snapshot.protocols) {
    if (!watchlist.has(p.slug) && !isRankable(p)) continue;
    const lt = Math.log10(p.tvl_usd);
    const z = (lt - ridge.mu[0]!) / ridge.sd[0]!;
    const logv = ridge.beta[0]! + ridge.beta[1]! * z;
    const predicted = 10 ** logv;
    const odds = tokenOdds(p, snapshot, octx, oddsBeta, keptTerms);
    const implied = predicted * odds;
    const econ = farmEconomics(p, implied, scenario);
    rows.push({
      rank: 0,
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      mcap_usd: p.mcap_usd,
      listed_at: p.listed_at,
      gecko_id: p.gecko_id,
      symbol: p.symbol,
      token_status: 'pre-token',
      age_days: ageDays(p.listed_at, snapshot.as_of),
      is_watchlist: watchlist.has(p.slug),
      above_floor: p.tvl_usd >= snapshot.floor_usd,
      implied_value_usd: Math.round(implied),
      farm_cost_usd: econ.fees_usd,
      model: {
        predicted_usd: Math.round(predicted),
        p10_usd: Math.round(10 ** (logv - Z80 * sigma)),
        p90_usd: Math.round(10 ** (logv + Z80 * sigma)),
        p25_usd: Math.round(10 ** (logv - Z50 * sigma)),
        p75_usd: Math.round(10 ** (logv + Z50 * sigma)),
        curve_multiple: predicted / p.tvl_usd,
        category_shift: 0,
        log_tvl: lt,
        token_odds: roundTo(odds, 3),
        age_days: ageDays(p.listed_at, snapshot.as_of),
      },
      farm: econ,
      farm_steps: farmSteps(p, econ, scenario).map((s) => s.text),
    });
  }
  rows.sort((a, b) => b.implied_value_usd - a.implied_value_usd);
  rows.forEach((row, i) => {
    row.rank = i + 1;
  });

  const live: LiveRow[] = snapshot.protocols
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0)
    .sort((a, b) => b.mcap_usd! - a.mcap_usd!)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));

  const accounting: Record<string, number> = {};
  const ledger: [string, string][] = [];
  for (const p of snapshot.protocols) {
    const g = ledgerGroup(p, watchlist, snapshot.floor_usd);
    accounting[g] = (accounting[g] ?? 0) + 1;
    ledger.push([p.slug, g]);
  }

  const radar: RadarData = {
    model_version: MODEL_VERSION,
    snapshot_sha256: meta.snapshot_sha256,
    snapshot_bytes: meta.snapshot_bytes,
    snapshot_as_of: snapshot.as_of,
    floor_usd: snapshot.floor_usd,
    rows: rows.map((r) => ({
      rank: r.rank,
      slug: r.slug,
      name: r.name,
      category: r.category,
      chains: r.chains,
      tvl_usd: r.tvl_usd,
      change_7d: r.change_7d,
      age_days: r.age_days,
      is_watchlist: r.is_watchlist,
      above_floor: r.above_floor,
      implied_value_usd: r.implied_value_usd,
      farm_cost_usd: r.farm_cost_usd,
      predicted_usd: r.model.predicted_usd,
      p10_usd: r.model.p10_usd,
      p90_usd: r.model.p90_usd,
      p25_usd: r.model.p25_usd,
      p75_usd: r.model.p75_usd,
      curve_multiple: r.model.curve_multiple,
      token_odds: r.model.token_odds,
      log_tvl: r.model.log_tvl,
      deposit_usd: r.farm.deposit_usd,
      expected_drop_usd: r.farm.expected_drop_usd,
      fees_usd: r.farm.fees_usd,
      hours: r.farm.hours,
      net_usd: r.farm.net_usd,
      net_per_hour_usd: r.farm.net_per_hour_usd,
      verdict: r.farm.verdict,
    })),
    live,
    ridge: {
      intercept: ridge.beta[0]!,
      slope_std: ridge.beta[1]!,
      mean_log_tvl: ridge.mu[0]!,
      sd_log_tvl: ridge.sd[0]!,
      sigma_log: ridge.sigma,
      raw_slope: ridge.beta[1]! / ridge.sd[0]!,
      train_n: ctx.comps.length,
      lambda: MODEL.ridge_lambda,
      lambda_cat: MODEL.ridge_lambda_cat,
      categories: [],
      shifts: {},
    },
    odds_beta: oddsBeta,
    odds_kept_terms: keptTerms,
    cat_share: Object.fromEntries(octx.catShare),
    cat_base_rate: octx.base,
    validation,
    accounting,
    ledger,
    farm_scenario: scenario,
    gas_table: GAS_TABLE,
    tge_labels: ctx.labels,
  };
  return { board: rows, radar };
}

/* ------------------------------------------------------------------ */
/* Outputs                                                             */
/* ------------------------------------------------------------------ */

/** data.js: the whole radar as one script the page reads. Not part of the dossier text. */
export function dataScript(radar: RadarData): string {
  return `window.TOKEN_RADAR = ${JSON.stringify(radar)};\n`;
}

/** validation.js: the proof, as a dashboard file, so the dossier's text carries it whole. */
export function validationScript(validation: Validation, snapshotSha256: string): string {
  const compact = {
    model: MODEL_VERSION,
    snapshot_sha256: snapshotSha256,
    comps_n: validation.comps_n,
    blind_seed: validation.blind_seed,
    blind_n: validation.blind_n,
    blind_scored_n: validation.blind_scored_n,
    train_comps_n: validation.train_comps_n,
    blind: validation.blind,
    loo: validation.loo,
    time_split_per: validation.time_split_per,
    time_split_pooled: validation.time_split_pooled,
    bootstrap_blind: validation.bootstrap_blind,
    bootstrap_loo: validation.bootstrap_loo,
    bootstrap_ts: validation.bootstrap_ts,
    bootstrap_cat_loo: validation.bootstrap_cat_loo,
    bootstrap_cat_blind: validation.bootstrap_cat_blind,
    term_table: validation.term_table,
    odds: validation.odds,
    honesty_loo: validation.honesty_loo,
    honesty_wf: validation.honesty_wf,
    coefficients: validation.coefficients,
    dropped_shifts: validation.dropped_shifts,
    gate_passed: validation.gate_passed,
    gate_note: validation.gate_note,
    blind_predictions: validation.blind_predictions,
  };
  return `// Radar-6 validation, computed by this entry's own program from the sealed snapshot
// and the 55 TGE-labelled comparables. The strict submit gate did NOT pass: see gate_note.
// window.TOKEN_RADAR_VALIDATION = ${JSON.stringify(compact)};\n`;
}

/** Refuse a board the gate will not take, before anything is written. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < MIN_BOARD_ROWS) return `board has ${board.length} rows, the gate wants at least ${MIN_BOARD_ROWS}`;
  const slugs = new Set(board.map((r) => r.slug));
  for (const slug of snapshot.watchlist) {
    if (!slugs.has(slug)) return `watchlist slug ${slug} is missing from the board`;
  }
  for (let i = 0; i < board.length; i++) {
    const row = board[i]!;
    if (row.rank !== i + 1) return `row ${row.slug} has rank ${row.rank}, expected ${i + 1}`;
    if (!(row.implied_value_usd > 0) || row.implied_value_usd > 1e14) return `row ${row.slug} has an impossible implied value`;
    if (i > 0 && row.implied_value_usd > board[i - 1]!.implied_value_usd) return `board is not sorted by implied value at ${row.slug}`;
    if (row.token_status !== 'pre-token') return `row ${row.slug} is not pre-token`;
    if (row.farm_steps.length < 3 || row.farm_steps.length > 12) return `row ${row.slug} has ${row.farm_steps.length} farm steps`;
    for (const step of row.farm_steps) {
      if (step.length < 20 || step.length > 600) return `row ${row.slug} has a farm step of ${step.length} characters`;
    }
  }
  return null;
}

export function boardTotals(board: BoardRow[]): { rows: number; impliedUsd: number; tvlUsd: number } {
  return {
    rows: board.length,
    impliedUsd: board.reduce((a, r) => a + r.implied_value_usd, 0),
    tvlUsd: board.reduce((a, r) => a + r.tvl_usd, 0),
  };
}

export function describeRow(row: BoardRow): string {
  const verdict = row.farm.verdict;
  return `#${row.rank} ${row.name} — implied $${row.implied_value_usd.toLocaleString('en-US')} (odds ${row.model.token_odds}, if it launches $${row.model.predicted_usd.toLocaleString('en-US')}), TVL $${row.tvl_usd.toLocaleString('en-US')}, ${verdict} net $${row.farm.net_usd.toFixed(2)}`;
}
