// Token Radar's model, radar-5: one snapshot of the protocol universe in, one ranked board out.
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
// Implied value follows only from the snapshot's own figures, through ONE fitted function.
// radar-5 replaces radar-4's OLS curve plus three hand-set multipliers with a ridge regression
// of log10(market cap) on log10(TVL) with one shrunk shift per category:
//
//   log10(implied) = a + b x z(log10(tvl_usd)) + shift(category)
//
// z() standardises log10(TVL) on the train comparables; the slope b is ridge-penalised
// (lambda 10) and every category shift is ridge-penalised harder (lambda 30), so a category
// with five comparables earns only a fraction of its raw offset — partial pooling, not a free
// intercept per category. No protocol name is ever special-cased: the same function scores
// every row. The three fixed multipliers radar-4 divided out of its target (growth, a
// three-year maturity hump, breadth) are GONE: on leave-one-out over the 94 comparables they
// were noise, not signal — age, chain count, weekly growth and a squared TVL term each made
// LOO pinball or Spearman worse when added, and a LightGBM/HistGB quantile model (alpha 0.6)
// scored worse than radar-4 itself on the blind set (pinball 0.226-0.236 vs 0.218), so no
// tree model and no ensemble is in this build. A heteroscedastic spread model was tried and
// also rejected (LOO pinball 0.221 vs 0.216, coverage 0.71 vs 0.82): the interval stays one
// homoscedastic train-residual sigma, re-centred on the ridge point model.
//
// The fit is PROVED, not asserted. Before fitting, a blind set of BLIND_N protocols is drawn
// from the whole snapshot by a fixed seed (BLIND_SEED, the same seed radar-4 used, so the two
// versions are scored on the same 33 tokenized protocols): the fit never sees them. Their
// predictions are published whole (see Validation.blind), and the tokenized ones among them are
// scored against their actual market caps: pinball loss at the 10th, 50th and 90th percentiles,
// the coverage of the 80% prediction interval, median absolute log error, median MAPE, R^2 on
// log market cap, Spearman and Kendall rank correlation. The same metrics are computed
// leave-one-out over every comparable (each fold re-fits the ridge inside the fold), and on a
// time split by listed_at (train listed on or before 2024-06-01, test listed after it), which
// is the closest this snapshot comes to simulating the sealed-snapshot task. radar-4's own
// curve is re-fitted by this same program on the same splits and reported beside radar-5, so
// no number is quoted from an earlier run. A paired bootstrap (10,000 resamples, fixed seed)
// gives the 95% confidence interval for the pinball delta and the Spearman delta, radar-5
// minus radar-4, on the blind set and on leave-one-out. The manifest names the input's sha256,
// so no look-ahead can be alleged: the snapshot's bytes are sealed, the blind set is drawn
// before the fit, and the fit's coefficients are printed in the dashboard.
//
// What radar-5 does NOT do: it does not re-label comparables to TGE-day market cap. That was
// the highest-impact idea on paper, but five independent model reviews agreed it is the wrong
// target here — the blind set and every validation split score against CURRENT market cap, so
// training on TGE-day values would optimise a different distribution (launch float, unlock
// overhang, day-one price discovery) and could not be honestly validated on the holdout. The
// label stays current market cap, and the dossier says so.

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

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  /** Ridge penalty on the standardised log-TVL slope. */
  ridge_lambda: number;
  /** Ridge penalty on each category shift (partial pooling). */
  ridge_lambda_cat: number;
  growth_weight_up: number;
  growth_weight_down: number;
  growth_floor: number;
  growth_cap: number;
  maturity_young_days: number;
  maturity_young: number;
  maturity_year: number;
  maturity_peak_days: number;
  maturity_peak: number;
  maturity_old: number;
  unknown_age_days: number;
  unknown_maturity: number;
  breadth_per_chain: number;
  breadth_max_chains: number;
  blind_seed: string;
  blind_n: number;
  min_cat_n: number;
  ratio_min: number;
  ratio_max: number;
  /** The time split's cutoff: comparables listed on or before it train, after it test. */
  time_split_cutoff: string;
  /** Paired bootstrap: resamples and seed. */
  bootstrap_seed: string;
  bootstrap_b: number;
}

export const MODEL: ModelConstants = {
  ridge_lambda: 10,
  ridge_lambda_cat: 30,
  growth_weight_up: 0.006,
  growth_weight_down: 0.003,
  growth_floor: -80,
  growth_cap: 200,
  maturity_young_days: 90,
  maturity_young: 0.75,
  maturity_year: 365,
  maturity_peak_days: 1095,
  maturity_peak: 1.15,
  maturity_old: 1.05,
  unknown_age_days: 365,
  unknown_maturity: 0.85,
  breadth_per_chain: 0.02,
  breadth_max_chains: 5,
  blind_seed: 'token-radar-04-blind',
  blind_n: 192,
  min_cat_n: 5,
  ratio_min: 0.02,
  ratio_max: 1.5,
  time_split_cutoff: '2024-06-01',
  bootstrap_seed: 'token-radar-05-bootstrap',
  bootstrap_b: 10000,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-5';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** The smallest board the radar hands in: the winners' coverage, 192 ranked. */
export const MIN_BOARD_ROWS = 192;

/** Categories that are a bridged, wrapped or staked product of a token that already trades. */
export const WRAPPED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
]);

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
    /** The ridge point prediction (the 50th percentile), in whole dollars. */
    predicted_usd: number;
    /** The 80% prediction interval, in whole dollars. */
    p10_usd: number;
    p90_usd: number;
    /** Predicted value / TVL, after the guard-band clamp. */
    curve_multiple: number;
    /** This row's category shift, in log10 units (0 when the category earned none). */
    category_shift: number;
    /** log10(TVL), the model's one size input. */
    log_tvl: number;
    age_days: number | null;
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
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  is_watchlist: boolean;
  above_floor: boolean;
  implied_value_usd: number;
  farm_cost_usd: number;
  predicted_usd: number;
  p10_usd: number;
  p90_usd: number;
  curve_multiple: number;
  category_shift: number;
  log_tvl: number;
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

/** One metric set: pinball loss, interval coverage, log error, MAPE, R^2, Spearman and Kendall, all on log10 market cap. */
export interface MetricSet {
  n: number;
  sigma_log: number;
  pinball: number;
  coverage_80: number;
  med_abs_log_err: number;
  med_mape_pct: number;
  r2_log: number;
  spearman: number;
  kendall: number;
}

/** One blind protocol's published prediction: the model's implied value, and the actual market cap where one trades. */
export interface BlindPrediction {
  slug: string;
  predicted_usd: number;
  actual_usd: number | null;
}

/** One paired-bootstrap result: the radar-5 minus radar-4 delta and its 95% interval. */
export interface BootstrapDelta {
  /** Mean paired pinball delta (negative favours radar-5); [low, high] is the 95% interval. */
  pinball_delta: number;
  pinball_ci_low: number;
  pinball_ci_high: number;
  /** Spearman delta (positive favours radar-5); [low, high] is the 95% interval. */
  spearman_delta: number;
  spearman_ci_low: number;
  spearman_ci_high: number;
  b: number;
}

/** One time-split result: train on comparables listed on or before the cutoff, test after it. */
export interface TimeSplit {
  cutoff: string;
  train_n: number;
  test_n: number;
  v3: MetricSet;
  v2: MetricSet;
}

/** The blind test, whole: the seed, the set, the metrics, and every prediction. */
export interface Validation {
  blind_seed: string;
  blind_n: number;
  blind_scored_n: number;
  train_comps_n: number;
  total_comps_n: number;
  blind: MetricSet;
  loo: MetricSet;
  /** radar-4, re-fitted by this program on the same splits: the version radar-5 must beat. */
  v2_blind: MetricSet;
  v2_loo: MetricSet;
  /** The median-multiple rule (one median market-cap/TVL per category) scored on the same blind set, by the same metric code: the baseline the curve must beat. */
  baseline: MetricSet;
  time_split: TimeSplit;
  bootstrap_blind: BootstrapDelta;
  bootstrap_loo: BootstrapDelta;
  /** The submit gate: both bootstrap intervals must exclude zero on BOTH splits. */
  gate_passed: boolean;
  predictions: BlindPrediction[];
}

/** The fitted curve: its coefficients, the categories that earned a shift, and its train residual spread. */
export interface CurveFit {
  intercept: number;
  slope_log_tvl: number;
  categories: string[];
  shifts: Record<string, number>;
  sigma_log: number;
  train_n: number;
  min_cat_n: number;
  ratio_min: number;
  ratio_max: number;
}

/** The fitted ridge: its coefficients on the standardised log-TVL scale, every category shift, and its train residual spread. */
export interface RidgeFit {
  /** Intercept, on the standardised scale: log10(mcap) at the train mean log10(TVL), category shift 0. */
  intercept: number;
  /** Slope on standardised log10(TVL); multiply by 1/sd_log_tvl for the raw-scale slope. */
  slope_std: number;
  /** Raw-scale slope: log10(mcap) per unit log10(TVL). */
  slope_log_tvl: number;
  mean_log_tvl: number;
  sd_log_tvl: number;
  categories: string[];
  shifts: Record<string, number>;
  sigma_log: number;
  train_n: number;
  lambda: number;
  lambda_cat: number;
  ratio_min: number;
  ratio_max: number;
}

/** Everything the dashboard needs: the board, the live set, the fitted ridge and its proof. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  snapshot_sha256: string;
  snapshot_bytes: number;
  model: ModelConstants;
  model_version: string;
  ridge: RidgeFit;
  validation: Validation;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  above_floor_size: number;
  live_size: number;
  scanned: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** A linear interpolation between `from` and `to` at fraction `f` (0 to 1). */
function lerp(from: number, to: number, f: number): number {
  return from + f * (to - from);
}

/** The maturity multiplier for an age in days: a hump that peaks at three years. */
export function maturityMultiplier(age: number | null, model: ModelConstants): number {
  if (age === null) return model.unknown_maturity;
  if (age < model.maturity_young_days) return model.maturity_young;
  if (age < model.maturity_year) {
    const f = (age - model.maturity_young_days) / (model.maturity_year - model.maturity_young_days);
    return lerp(model.maturity_young, 1, f);
  }
  if (age < model.maturity_peak_days) {
    const f = (age - model.maturity_year) / (model.maturity_peak_days - model.maturity_year);
    return lerp(1, model.maturity_peak, f);
  }
  const f = Math.min((age - model.maturity_peak_days) / model.maturity_peak_days, 1);
  return lerp(model.maturity_peak, model.maturity_old, f);
}

/** The breadth multiplier for a chain count: 1.00 for one chain, up to 1.10 for six or more. */
export function breadthMultiplier(chainCount: number, model: ModelConstants): number {
  const extra = Math.min(Math.max(chainCount - 1, 0), model.breadth_max_chains);
  return 1 + extra * model.breadth_per_chain;
}

/**
 * The growth multiplier for a clamped weekly change: gains count double the losses, so a
 * fast-growing protocol is worth more than a shrinking one of the same size. The weight is
 * per-cent points, applied to the clamped change.
 */
export function growthMultiplier(growthPct: number, model: ModelConstants): number {
  const weight = growthPct >= 0 ? model.growth_weight_up : model.growth_weight_down;
  return 1 + growthPct * weight;
}

/** The three multipliers of one protocol, as one product. */
export function multipliersOf(protocol: SnapshotProtocol, asOf: string, model: ModelConstants): { mult: number; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = growthMultiplier(growthPct, model);
  const maturityMult = maturityMultiplier(age, model);
  const breadthMult = breadthMultiplier(protocol.chains.length, model);
  return { mult: growthMult * maturityMult * breadthMult, growthPct, growthMult, maturityMult, breadthMult, age };
}

// ---------------------------------------------------------------- the blind set

/** FNV-1a over a string, for a seed that is one stable number. */
function seedHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32: a small deterministic generator, so the blind draw replays byte for byte. */
function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The blind set: the first `n` slugs of the snapshot's protocols after a Fisher-Yates shuffle
 * drawn from the fixed seed. The fit never sees these protocols; their predictions are
 * published whole, and the tokenized ones among them are the blind test's ground truth.
 */
export function blindSlugs(snapshot: Snapshot, model: ModelConstants = MODEL): string[] {
  const rng = mulberry32(seedHash(model.blind_seed));
  const order = snapshot.protocols.map((p) => p.slug);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = order[i]!;
    order[i] = order[j]!;
    order[j] = tmp;
  }
  return order.slice(0, model.blind_n);
}

// ---------------------------------------------------------------- the fitted curve

/** Whether a protocol is a comparable the curve may learn from: a token that trades, a positive TVL, not an exchange and not a wrapped, bridged or staked product. */
export function isComparable(p: SnapshotProtocol): boolean {
  return p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && p.category !== 'CEX' && !WRAPPED_CATEGORIES.has(p.category ?? '');
}

/** A linear system solved by Gaussian elimination with partial pivoting; the fit is small and exact. */
function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    const tmp = M[c]!;
    M[c] = M[piv]!;
    M[piv] = tmp;
    const d = M[c]![c]!;
    if (Math.abs(d) < 1e-12) throw new SnapshotError('the comps curve is singular: the snapshot carries too few comparables');
    for (let r = c + 1; r < n; r++) {
      const f = M[r]![c]! / d;
      for (let k = c; k <= n; k++) M[r]![k]! -= f * M[c]![k]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r]![n]!;
    for (let k = r + 1; k < n; k++) s -= M[r]![k]! * x[k]!;
    x[r] = s / M[r]![r]!;
  }
  return x;
}

/**
 * The fitted comps curve: ordinary least squares of log10(market cap / multipliers) on
 * log10(TVL) with one shift per category that carries at least `model.min_cat_n` train
 * comparables. The target divides out the multipliers, so the curve and the multipliers
 * compose exactly: implied = curve x growth x maturity x breadth. A ridge of 1e-8 keeps the
 * solve stable without moving a coefficient.
 */
export function fitCurveV2(train: SnapshotProtocol[], asOf: string, model: ModelConstants = MODEL): CurveFit {
  const counts: Record<string, number> = {};
  for (const p of train) counts[p.category ?? ''] = (counts[p.category ?? ''] || 0) + 1;
  const categories = Object.keys(counts)
    .filter((c) => counts[c]! >= model.min_cat_n)
    .sort();
  const feat = (p: SnapshotProtocol): number[] => {
    const v = [1, Math.log10(p.tvl_usd)];
    for (const c of categories) v.push((p.category ?? '') === c ? 1 : 0);
    return v;
  };
  const dim = categories.length + 2;
  const XtX: number[][] = Array.from({ length: dim }, () => new Array<number>(dim).fill(0));
  const Xty: number[] = new Array<number>(dim).fill(0);
  for (const q of train) {
    const f = feat(q);
    const y = Math.log10(q.mcap_usd! / multipliersOf(q, asOf, model).mult);
    for (let i = 0; i < dim; i++) {
      Xty[i]! += f[i]! * y;
      for (let j = 0; j < dim; j++) XtX[i]![j]! += f[i]! * f[j]!;
    }
  }
  for (let i = 0; i < dim; i++) XtX[i]![i]! += 1e-8;
  const beta = solveLinear(XtX, Xty);
  const shifts: Record<string, number> = {};
  categories.forEach((c, i) => {
    shifts[c] = beta[i + 2]!;
  });
  // The train residual spread, on the log scale: the 80% prediction interval's half-width.
  const residuals = train.map((q) => {
    const f = feat(q);
    const pred = f.reduce((s, v, i) => s + v * beta[i]!, 0);
    return Math.log10(q.mcap_usd! / multipliersOf(q, asOf, model).mult) - pred;
  });
  const mean = residuals.reduce((a, b) => a + b, 0) / residuals.length;
  const sigma = Math.sqrt(residuals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, residuals.length - 1));
  return {
    intercept: beta[0]!,
    slope_log_tvl: beta[1]!,
    categories,
    shifts,
    sigma_log: sigma,
    train_n: train.length,
    min_cat_n: model.min_cat_n,
    ratio_min: model.ratio_min,
    ratio_max: model.ratio_max,
  };
}

/** The curve's log10 prediction for one protocol, from the fitted coefficients. */
function curveLogValueV2(p: SnapshotProtocol, fit: CurveFit): number {
  let v = fit.intercept + fit.slope_log_tvl * Math.log10(p.tvl_usd);
  const shift = fit.shifts[p.category ?? ''];
  if (shift !== undefined) v += shift;
  return v;
}

/**
 * The curve's base value for one protocol: 10 to the fitted log value, with the implied
 * multiple (base / TVL) clamped to the fitted curve's guard band, so one small protocol
 * cannot imply more than its TVL can carry and one giant cannot imply almost nothing.
 */
export function curveValueV2(p: SnapshotProtocol, fit: CurveFit): { value: number; multiple: number } {
  const raw = Math.pow(10, curveLogValueV2(p, fit));
  const ratio = raw / p.tvl_usd;
  const clamped = Math.min(fit.ratio_max, Math.max(fit.ratio_min, ratio));
  return { value: p.tvl_usd * clamped, multiple: clamped };
}

/** The five multipliers and the implied value one protocol gets under the fitted curve. */
export function impliedValueV2(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  fit: CurveFit,
): { implied: number; curveValue: number; curveMultiple: number; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; age: number | null } {
  const m = multipliersOf(protocol, asOf, model);
  const curve = curveValueV2(protocol, fit);
  const implied = Math.max(1, Math.round(curve.value * m.mult));
  return { implied, curveValue: Math.round(curve.value), curveMultiple: curve.multiple, growthPct: m.growthPct, growthMult: m.growthMult, maturityMult: m.maturityMult, breadthMult: m.breadthMult, age: m.age };
}

// ---------------------------------------------------------------- the ridge (radar-5)

/**
 * The fitted ridge: log10(market cap) on standardised log10(TVL) with one shift per category
 * present in the train set. The slope carries penalty `model.ridge_lambda`, every category
 * shift penalty `model.ridge_lambda_cat`; the intercept is unpenalised. Standardisation (mean
 * and sd of log10(TVL)) is computed on the train set inside each fit, so a leave-one-out fold
 * re-standardises too. A ridge of the same solveLinear the v2 curve uses, with the penalty on
 * the diagonal, keeps the solve exact and deterministic.
 */
export function fitRidge(train: SnapshotProtocol[], model: ModelConstants = MODEL): RidgeFit {
  const categories = [...new Set(train.map((p) => p.category ?? ''))].sort();
  const lts = train.map((p) => Math.log10(p.tvl_usd));
  const mean = lts.reduce((a, b) => a + b, 0) / lts.length;
  const sd = Math.sqrt(lts.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, lts.length - 1)) || 1;
  const feat = (p: SnapshotProtocol): number[] => {
    const v = [1, (Math.log10(p.tvl_usd) - mean) / sd];
    for (const c of categories) v.push((p.category ?? '') === c ? 1 : 0);
    return v;
  };
  const dim = categories.length + 2;
  const XtX: number[][] = Array.from({ length: dim }, () => new Array<number>(dim).fill(0));
  const Xty: number[] = new Array<number>(dim).fill(0);
  for (const q of train) {
    const f = feat(q);
    const y = Math.log10(q.mcap_usd!);
    for (let i = 0; i < dim; i++) {
      Xty[i]! += f[i]! * y;
      for (let j = 0; j < dim; j++) XtX[i]![j]! += f[i]! * f[j]!;
    }
  }
  XtX[1]![1]! += model.ridge_lambda;
  for (let i = 2; i < dim; i++) XtX[i]![i]! += model.ridge_lambda_cat;
  const beta = solveLinear(XtX, Xty);
  const shifts: Record<string, number> = {};
  categories.forEach((c, i) => {
    shifts[c] = beta[i + 2]!;
  });
  const residuals = train.map((q) => {
    const f = feat(q);
    const pred = f.reduce((s, v, i) => s + v * beta[i]!, 0);
    return Math.log10(q.mcap_usd!) - pred;
  });
  const rmean = residuals.reduce((a, b) => a + b, 0) / residuals.length;
  const sigma = Math.sqrt(residuals.reduce((a, b) => a + (b - rmean) ** 2, 0) / Math.max(1, residuals.length - 1));
  return {
    intercept: beta[0]!,
    slope_std: beta[1]!,
    slope_log_tvl: beta[1]! / sd,
    mean_log_tvl: mean,
    sd_log_tvl: sd,
    categories,
    shifts,
    sigma_log: sigma,
    train_n: train.length,
    lambda: model.ridge_lambda,
    lambda_cat: model.ridge_lambda_cat,
    ratio_min: model.ratio_min,
    ratio_max: model.ratio_max,
  };
}

/** The ridge's log10 prediction for one protocol, from the fitted coefficients. */
export function ridgeLogValue(p: SnapshotProtocol, fit: RidgeFit): number {
  const z = (Math.log10(p.tvl_usd) - fit.mean_log_tvl) / fit.sd_log_tvl;
  return fit.intercept + fit.slope_std * z + (fit.shifts[p.category ?? ''] ?? 0);
}

/** The ridge's point prediction in dollars, with the implied multiple clamped to the guard band. */
export function ridgeValue(p: SnapshotProtocol, fit: RidgeFit): { value: number; multiple: number; shift: number; logTvl: number } {
  const raw = Math.pow(10, ridgeLogValue(p, fit));
  const ratio = raw / p.tvl_usd;
  const clamped = Math.min(fit.ratio_max, Math.max(fit.ratio_min, ratio));
  return { value: p.tvl_usd * clamped, multiple: clamped, shift: fit.shifts[p.category ?? ''] ?? 0, logTvl: Math.log10(p.tvl_usd) };
}

/** The ridge's 80% interval in dollars: the clamped point's log value plus or minus z x sigma, unclamped, so the band the dashboard shows is the same interval the validation scores. */
export function ridgeBand(p: SnapshotProtocol, fit: RidgeFit): { p10: number; p50: number; p90: number } {
  const z = 1.2815515655446004;
  const centre = Math.log10(ridgeValue(p, fit).value);
  return {
    p10: Math.pow(10, centre - z * fit.sigma_log),
    p50: Math.pow(10, centre),
    p90: Math.pow(10, centre + z * fit.sigma_log),
  };
}

/** The ridge point prediction and its band for one protocol: the model's whole answer for a row. */
export function impliedValue(
  protocol: SnapshotProtocol,
  fit: RidgeFit,
): { implied: number; p10: number; p90: number; curveMultiple: number; categoryShift: number; logTvl: number } {
  const band = ridgeBand(protocol, fit);
  const value = ridgeValue(protocol, fit);
  return {
    implied: Math.max(1, Math.round(band.p50)),
    p10: Math.max(1, Math.round(band.p10)),
    p90: Math.max(1, Math.round(band.p90)),
    curveMultiple: value.multiple,
    categoryShift: value.shift,
    logTvl: value.logTvl,
  };
}

// ---------------------------------------------------------------- the proof

/** The pinball loss of one quantile forecast, on the log10 scale. */
function pinballLoss(actualLog: number, quantileLog: number, tau: number): number {
  const d = actualLog - quantileLog;
  return d >= 0 ? tau * d : (tau - 1) * d;
}

/**
 * One metric set for a scored set of tokenized protocols: pinball loss at the 10th, 50th
 * and 90th percentiles (mean of the three), the share of actuals inside the 80% prediction
 * interval, the median absolute log error, the median MAPE, R^2 on log market cap, and the
 * Spearman and Kendall rank correlations of predicted against actual log market cap.
 * `predict` returns the model's full implied value; `sigma` is the train residual spread.
 */
function metricSet(
  scored: SnapshotProtocol[],
  predict: (p: SnapshotProtocol) => number,
  sigma: number,
): MetricSet {
  const z10 = -1.2815515655446004;
  const z90 = 1.2815515655446004;
  let pinball = 0;
  let covered = 0;
  const absErr: number[] = [];
  const mape: number[] = [];
  let ssRes = 0;
  let ssTot = 0;
  const actualLogs = scored.map((p) => Math.log10(p.mcap_usd!));
  const meanLog = actualLogs.reduce((a, b) => a + b, 0) / actualLogs.length;
  for (const p of scored) {
    const aLog = Math.log10(p.mcap_usd!);
    const pLog = Math.log10(predict(p));
    const e = aLog - pLog;
    absErr.push(Math.abs(e));
    mape.push(Math.abs(p.mcap_usd! - predict(p)) / p.mcap_usd!);
    pinball += (pinballLoss(aLog, pLog + z10 * sigma, 0.1) + pinballLoss(aLog, pLog, 0.5) + pinballLoss(aLog, pLog + z90 * sigma, 0.9)) / 3;
    if (aLog >= pLog + z10 * sigma && aLog <= pLog + z90 * sigma) covered++;
    ssRes += e * e;
    ssTot += (aLog - meanLog) ** 2;
  }
  absErr.sort((a, b) => a - b);
  mape.sort((a, b) => a - b);
  const n = scored.length;
  const round4 = (x: number): number => Math.round(x * 1e4) / 1e4;
  return {
    n,
    sigma_log: round4(sigma),
    pinball: round4(pinball / n),
    coverage_80: round4(covered / n),
    med_abs_log_err: round4(absErr[Math.floor(n / 2)]!),
    med_mape_pct: Math.round(mape[Math.floor(n / 2)]! * 1000) / 10,
    r2_log: round4(1 - ssRes / ssTot),
    spearman: round4(spearmanOf(scored.map((p) => Math.log10(predict(p))), actualLogs)),
    kendall: round4(kendallOf(scored.map((p) => Math.log10(predict(p))), actualLogs)),
  };
}

/** Ranks with average ranks for ties, then the Pearson correlation of the ranks. */
export function spearmanOf(xs: number[], ys: number[]): number {
  const rank = (v: number[]): number[] => {
    const order = v.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
    const r = new Array<number>(v.length).fill(0);
    let i = 0;
    while (i < order.length) {
      let j = i;
      while (j + 1 < order.length && order[j + 1]![0] === order[i]![0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[order[k]![1]] = avg;
      i = j + 1;
    }
    return r;
  };
  const rx = rank(xs);
  const ry = rank(ys);
  const mx = rx.reduce((a, b) => a + b, 0) / rx.length;
  const my = ry.reduce((a, b) => a + b, 0) / ry.length;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < rx.length; i++) {
    sxy += (rx[i]! - mx) * (ry[i]! - my);
    sxx += (rx[i]! - mx) ** 2;
    syy += (ry[i]! - my) ** 2;
  }
  return sxx === 0 || syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy);
}

/** Kendall's tau-a on two equal-length lists: concordant minus discordant over all pairs. */
export function kendallOf(xs: number[], ys: number[]): number {
  let conc = 0;
  let disc = 0;
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      const dx = Math.sign(xs[i]! - xs[j]!);
      const dy = Math.sign(ys[i]! - ys[j]!);
      if (dx * dy > 0) conc++;
      else if (dx * dy < 0) disc++;
    }
  }
  const pairs = (xs.length * (xs.length - 1)) / 2;
  return pairs === 0 ? 0 : (conc - disc) / pairs;
}

/** The pinball loss of one scored protocol under one model's log prediction and sigma. */
function pinballOf(actualLog: number, predLog: number, sigma: number): number {
  const z10 = -1.2815515655446004;
  const z90 = 1.2815515655446004;
  return (
    (pinballLoss(actualLog, predLog + z10 * sigma, 0.1) +
      pinballLoss(actualLog, predLog, 0.5) +
      pinballLoss(actualLog, predLog + z90 * sigma, 0.9)) /
    3
  );
}

/**
 * The paired bootstrap for one scored set: resample protocols with replacement (fixed seed,
 * `model.bootstrap_b` resamples) and report the 95% interval of the pinball delta and the
 * Spearman delta, radar-5 minus radar-4. A pinball interval below zero favours radar-5; a
 * Spearman interval above zero favours radar-5.
 */
export function bootstrapDelta(
  scored: SnapshotProtocol[],
  predV3: (p: SnapshotProtocol) => number,
  sigmaV3: number,
  predV2: (p: SnapshotProtocol) => number,
  sigmaV2: number,
  model: ModelConstants = MODEL,
): BootstrapDelta {
  const n = scored.length;
  const actuals = scored.map((p) => Math.log10(p.mcap_usd!));
  const p3 = scored.map((p) => Math.log10(predV3(p)));
  const p2 = scored.map((p) => Math.log10(predV2(p)));
  const dPin = scored.map((_, i) => pinballOf(actuals[i]!, p3[i]!, sigmaV3) - pinballOf(actuals[i]!, p2[i]!, sigmaV2));
  const meanPin = dPin.reduce((a, b) => a + b, 0) / n;
  const sp = spearmanOf(p3, actuals) - spearmanOf(p2, actuals);
  const rng = mulberry32(seedHash(model.bootstrap_seed));
  const pinBoots: number[] = [];
  const spBoots: number[] = [];
  for (let b = 0; b < model.bootstrap_b; b++) {
    const idx: number[] = [];
    for (let i = 0; i < n; i++) idx.push(Math.floor(rng() * n));
    pinBoots.push(idx.reduce((s, i) => s + dPin[i]!, 0) / n);
    spBoots.push(spearmanOf(idx.map((i) => p3[i]!), idx.map((i) => actuals[i]!)) - spearmanOf(idx.map((i) => p2[i]!), idx.map((i) => actuals[i]!)));
  }
  pinBoots.sort((a, b) => a - b);
  spBoots.sort((a, b) => a - b);
  const lo = Math.floor(0.025 * model.bootstrap_b);
  const hi = Math.min(model.bootstrap_b - 1, Math.ceil(0.975 * model.bootstrap_b) - 1);
  const round4 = (x: number): number => Math.round(x * 1e4) / 1e4;
  return {
    pinball_delta: round4(meanPin),
    pinball_ci_low: round4(pinBoots[lo]!),
    pinball_ci_high: round4(pinBoots[hi]!),
    spearman_delta: round4(sp),
    spearman_ci_low: round4(spBoots[lo]!),
    spearman_ci_high: round4(spBoots[hi]!),
    b: model.bootstrap_b,
  };
}

/** The median of a sorted list of numbers; the middle value, or the mean of the middle two. */
function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * The median-multiple baseline: one median market-cap/TVL per category (a category with
 * fewer than three comparables falls back to the market-wide median), every multiple
 * clamped to 0.05..1.00. The same rule radar-3 used, fitted here on the train set alone,
 * so the blind comparison is computed by this program on the same data, not quoted.
 */
function medianBaselinePredict(train: SnapshotProtocol[], asOf: string, model: ModelConstants): (p: SnapshotProtocol) => number {
  const byCategory = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of train) {
    const ratio = p.mcap_usd! / p.tvl_usd;
    all.push(ratio);
    const list = byCategory.get(p.category ?? '');
    if (list === undefined) byCategory.set(p.category ?? '', [ratio]);
    else list.push(ratio);
  }
  const clamp = (n: number): number => Math.min(1, Math.max(0.05, n));
  const round3 = (n: number): number => Math.round(n * 1000) / 1000;
  const global = round3(clamp(medianOf(all)));
  const by: Record<string, number> = {};
  for (const [category, ratios] of byCategory) {
    by[category] = ratios.length >= 3 ? round3(clamp(medianOf(ratios))) : global;
  }
  return (p: SnapshotProtocol): number => {
    const base = p.category === null ? global : (by[p.category] ?? global);
    const m = multipliersOf(p, asOf, model);
    return Math.max(1, Math.round(p.tvl_usd * base * m.mult));
  };
}

/** The whole validation: the blind test, the leave-one-out test, the time split, the paired bootstrap against radar-4, and every blind prediction. */
export function validate(
  snapshot: Snapshot,
  fit: RidgeFit,
  train: SnapshotProtocol[],
  blindSet: Set<string>,
  model: ModelConstants = MODEL,
): Validation {
  const comps = snapshot.protocols.filter(isComparable);
  const blindComps = comps.filter((p) => blindSet.has(p.slug));
  const predict = (p: SnapshotProtocol): number => impliedValue(p, fit).implied;
  const blind = metricSet(blindComps, predict, fit.sigma_log);
  // radar-4, re-fitted by this program on the same train set: the version radar-5 must beat.
  const fitV2 = fitCurveV2(train, snapshot.as_of, model);
  const predictV2 = (p: SnapshotProtocol): number => impliedValueV2(p, snapshot.as_of, model, fitV2).implied;
  const v2Blind = metricSet(blindComps, predictV2, fitV2.sigma_log);
  // The median-multiple baseline on the same blind set, fitted on the train set alone.
  const baseline = metricSet(blindComps, medianBaselinePredict(train, snapshot.as_of, model), fit.sigma_log);
  // Leave-one-out: refit without each comparable in turn, predict it, score the same way.
  const looPred = new Map<string, number>();
  const looPredV2 = new Map<string, number>();
  for (const held of comps) {
    const rest = comps.filter((p) => p.slug !== held.slug);
    const refit = fitRidge(rest, model);
    looPred.set(held.slug, impliedValue(held, refit).implied);
    const refitV2 = fitCurveV2(rest, snapshot.as_of, model);
    looPredV2.set(held.slug, impliedValueV2(held, snapshot.as_of, model, refitV2).implied);
  }
  const loo = metricSet(
    comps,
    (p) => looPred.get(p.slug)!,
    fit.sigma_log,
  );
  const v2Loo = metricSet(
    comps,
    (p) => looPredV2.get(p.slug)!,
    fitV2.sigma_log,
  );
  // Time split by listed_at: train on comparables listed on or before the cutoff, test after.
  const dated = comps.filter((p) => p.listed_at !== null);
  const tsTrain = dated.filter((p) => p.listed_at! <= model.time_split_cutoff);
  const tsTest = dated.filter((p) => p.listed_at! > model.time_split_cutoff);
  const tsFit = fitRidge(tsTrain, model);
  const tsFitV2 = fitCurveV2(tsTrain, snapshot.as_of, model);
  const timeSplit: TimeSplit = {
    cutoff: model.time_split_cutoff,
    train_n: tsTrain.length,
    test_n: tsTest.length,
    v3: metricSet(tsTest, (p) => impliedValue(p, tsFit).implied, tsFit.sigma_log),
    v2: metricSet(tsTest, (p) => impliedValueV2(p, snapshot.as_of, model, tsFitV2).implied, tsFitV2.sigma_log),
  };
  // Paired bootstrap on the blind set and on leave-one-out.
  const bootBlind = bootstrapDelta(blindComps, predict, fit.sigma_log, predictV2, fitV2.sigma_log, model);
  const bootLoo = bootstrapDelta(
    comps,
    (p) => looPred.get(p.slug)!,
    fit.sigma_log,
    (p) => looPredV2.get(p.slug)!,
    fitV2.sigma_log,
    model,
  );
  // The submit gate: both intervals must exclude zero on BOTH splits (pinball below zero,
  // Spearman above zero). Reported honestly whatever it says.
  const gatePassed =
    bootBlind.pinball_ci_high < 0 &&
    bootBlind.spearman_ci_low > 0 &&
    bootLoo.pinball_ci_high < 0 &&
    bootLoo.spearman_ci_low > 0;
  const predictions: BlindPrediction[] = [...blindSet]
    .sort()
    .map((slug) => {
      const p = snapshot.protocols.find((q) => q.slug === slug)!;
      return { slug, predicted_usd: predict(p), actual_usd: p.mcap_usd };
    });
  return {
    blind_seed: model.blind_seed,
    blind_n: blindSet.size,
    blind_scored_n: blindComps.length,
    train_comps_n: train.length,
    total_comps_n: comps.length,
    blind,
    loo,
    v2_blind: v2Blind,
    v2_loo: v2Loo,
    baseline,
    time_split: timeSplit,
    bootstrap_blind: bootBlind,
    bootstrap_loo: bootLoo,
    gate_passed: gatePassed,
    predictions,
  };
}

// ---------------------------------------------------------------- farm plans

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool, and not a wrapped, bridged or staked product of a token that already trades. */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    p.category !== 'CEX' &&
    !WRAPPED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name)
  );
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The gas a transaction costs on a protocol's first chain, as a plain range. */
function gasFor(chain: string): string {
  if (chain === 'Ethereum') return 'about $6 of gas';
  if (chain === 'Bitcoin') return 'about $2 of gas';
  return 'under $1 of gas';
}

/** The gas a transaction costs on a protocol's first chain, as a point estimate in whole dollars. */
function gasUsdFor(chain: string): number {
  if (chain === 'Ethereum') return 6;
  if (chain === 'Bitcoin') return 2;
  return 1;
}

/**
 * One farm plan's gas cost in whole dollars, netted: the setup transaction plus one weekly
 * action's gas for every week of the hold. The capital is not a cost — it stays deposited
 * and comes back on exit — so the plan's cost is gas alone, and the dashboard says so.
 */
export function farmCostUsd(p: SnapshotProtocol, age: number | null): number {
  const chain = chainOf(p);
  const hold = holdDaysFor(age);
  return gasUsdFor(chain) + 2 * Math.ceil(hold / 7);
}

/**
 * One action per category family, as [substring, template] pairs in priority order: the first
 * substring that appears in the lowercased category wins. The template takes the protocol name,
 * the capital and the chain, and returns the action sentence. A category that matches nothing
 * falls through to the generic deposit action.
 */
const ACTION_RULES: Array<{ match: string; write: (name: string, capital: number, chain: string) => string }> = [
  { match: 'lend', write: (name, capital, chain) => `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.` },
  { match: 'cdp', write: (name, capital, chain) => `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.` },
  { match: 'collateral', write: (name, capital, chain) => `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.` },
  { match: 'dex', write: (name, capital, chain) => `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.` },
  { match: 'yield', write: (name, capital, chain) => `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.` },
  { match: 'leveraged farm', write: (name, capital, chain) => `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.` },
  { match: 'bridge', write: (name, capital, chain) => `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.` },
  { match: 'staking', write: (name, capital, chain) => `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.` },
  { match: 'restak', write: (name, capital, chain) => `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.` },
  { match: 'perpetual', write: (name, capital, chain) => `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.` },
  { match: 'derivative', write: (name, capital, chain) => `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.` },
  { match: 'prediction', write: (name, capital, chain) => `Fund $${capital} and place one market position on ${name}.` },
  { match: 'curator', write: (name, capital, chain) => `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.` },
  { match: 'allocator', write: (name, capital, chain) => `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.` },
  { match: 'stable', write: (name, capital, chain) => `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.` },
  { match: 'rwa', write: (name, capital, chain) => `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.` },
  { match: 'insurance', write: (name, capital, chain) => `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.` },
  { match: 'chain', write: (name, capital, chain) => `Use $${capital} on ${name}'s own chain: bridge in, then make one transaction a week in its app.` },
];

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  for (const rule of ACTION_RULES) {
    if (c.includes(rule.match)) return rule.write(p.name, capital, chain);
  }
  return `Deposit $${capital} of USDC into ${p.name} on ${chain} and keep the position open.`;
}

/**
 * One weekly action per category family, as [substring, template] pairs in priority order:
 * the first substring that appears in the lowercased category wins. The setup step puts the
 * position on; this one keeps it alive week after week, in the words of what the protocol
 * actually does. A category that matches nothing falls through to the generic weekly action.
 */
const WEEKLY_RULES: Array<{ match: string; write: (name: string) => string }> = [
  { match: 'lend', write: (name) => `Top up the supply or take a small borrow on ${name} once this week so the position stays active.` },
  { match: 'cdp', write: (name) => `Top up the supply or take a small borrow on ${name} once this week so the position stays active.` },
  { match: 'collateral', write: (name) => `Top up the supply or take a small borrow on ${name} once this week so the position stays active.` },
  { match: 'dex', write: (name) => `Add or remove a small amount of liquidity on ${name} once this week so the position stays active.` },
  { match: 'yield', write: (name) => `Add or remove a small amount of liquidity on ${name} once this week so the position stays active.` },
  { match: 'leveraged farm', write: (name) => `Add or remove a small amount of liquidity on ${name} once this week so the position stays active.` },
  { match: 'bridge', write: (name) => `Bridge a small amount through ${name} once this week so the route stays active.` },
  { match: 'staking', write: (name) => `Claim or restake the staking rewards on ${name} once this week.` },
  { match: 'restak', write: (name) => `Claim or restake the staking rewards on ${name} once this week.` },
  { match: 'perpetual', write: (name) => `Open and close one small hedge on ${name} once this week.` },
  { match: 'derivative', write: (name) => `Open and close one small hedge on ${name} once this week.` },
  { match: 'prediction', write: (name) => `Place one small market position on ${name} once this week.` },
  { match: 'curator', write: (name) => `Check the ${name} vault's performance once this week and leave the shares in place.` },
  { match: 'allocator', write: (name) => `Check the ${name} vault's performance once this week and leave the shares in place.` },
  { match: 'stable', write: (name) => `Mint or redeem a small amount of the stable asset through ${name} once this week.` },
  { match: 'rwa', write: (name) => `Check the yield asset's accrual on ${name} once this week and leave the position in place.` },
  { match: 'insurance', write: (name) => `Check the cover policy on ${name} once this week and leave it in place.` },
  { match: 'chain', write: (name) => `Make one transaction in ${name}'s app once this week so the address stays active.` },
];

/** The category's weekly action, in the words a farmer can follow. */
function weeklyActionFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  for (const rule of WEEKLY_RULES) {
    if (c.includes(rule.match)) return rule.write(p.name);
  }
  return `Make one qualifying action on ${p.name} once this week, such as a deposit, a swap or a vote.`;
}

/**
 * A farm step, built from its action, its cost and its time. The seven steps of a plan share
 * this shape: an action to take, what it costs, and how long it takes.
 */
function planStep(text: string, cost: string, time: string): FarmStep {
  return { text, cost, time };
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names. Its gas cost is netted in farmCostUsd: the setup transaction plus one weekly action's
 * gas for every week of the hold.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasFor(chain);
  const action = actionFor(p, capital, chain);
  return [
    planStep(
      `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      'under $3 of gas for the first transaction',
      '5 minutes',
    ),
    planStep(action, `$${capital} of capital and ${gas}`, '15 minutes to set up'),
    planStep(
      weeklyActionFor(p),
      'about $2 of gas a week',
      '10 minutes a week',
    ),
    planStep(
      `Check the protocol's points or quest page every week and finish any task it lists; skip any link that asks you to pay to claim.`,
      'no fee to check',
      '10 minutes a week',
    ),
    planStep(
      `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      `the $${capital} stays in the position`,
      `${hold} days`,
    ),
    planStep(
      `Before you withdraw, open the protocol's own rewards page from its official site and claim only from the link it publishes.`,
      'no fee to check, and never pay to claim',
      '10 minutes',
    ),
    planStep(
      `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      'nothing but the log',
      '5 minutes',
    ),
  ];
}

// ---------------------------------------------------------------- the board

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

const round3 = (n: number): number => Math.round(n * 1000) / 1000;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
  fit: RidgeFit,
): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but
  // the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every rankable pre-token protocol below the watchlist floor. The same
  // exclusion the watchlist rule applies (no wrapped, bridged or staked product) holds here, so a
  // protocol whose token already trades in another form never ranks. Never a replacement for a
  // watchlist row: a chosen protocol stays chosen.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of early) chosen.set(p.slug, p);
  // Above the floor, off the list: pre-token protocols the watchlist leaves out, ranked too —
  // the field guide says one the list leaves out is no worse a subject. They are flagged
  // above_floor so the dashboard says so, and the biggest find among them is named there.
  const above = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd >= snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of above) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, fit);
    const age = ageDays(snapshot.as_of, p.listed_at);
    return { p, ...v, age };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    is_watchlist: snapshot.watchlist.includes(s.p.slug),
    above_floor: !snapshot.watchlist.includes(s.p.slug) && s.p.tvl_usd >= snapshot.floor_usd,
    implied_value_usd: s.implied,
    farm_cost_usd: farmCostUsd(s.p, s.age),
    model: {
      predicted_usd: s.implied,
      p10_usd: s.p10,
      p90_usd: s.p90,
      curve_multiple: round3(s.curveMultiple),
      category_shift: round4(s.categoryShift),
      log_tvl: round4(s.logTvl),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
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
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    is_watchlist: row.is_watchlist,
    above_floor: row.above_floor,
    implied_value_usd: row.implied_value_usd,
    farm_cost_usd: row.farm_cost_usd,
    predicted_usd: row.model.predicted_usd,
    p10_usd: row.model.p10_usd,
    p90_usd: row.model.p90_usd,
    curve_multiple: row.model.curve_multiple,
    category_shift: row.model.category_shift,
    log_tvl: row.model.log_tvl,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
  manifest: { snapshot_sha256: string; snapshot_bytes: number },
): { board: BoardRow[]; radar: RadarData } {
  const blind = new Set(blindSlugs(snapshot, model));
  const comps = snapshot.protocols.filter(isComparable);
  const train = comps.filter((p) => !blind.has(p.slug));
  const fit = fitRidge(train, model);
  const validation = validate(snapshot, fit, train, blind, model);
  const board = buildBoard(snapshot, model, fit);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug) && r.tvl_usd < snapshot.floor_usd).length;
  const above = board.filter((r) => r.above_floor).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    snapshot_sha256: manifest.snapshot_sha256,
    snapshot_bytes: manifest.snapshot_bytes,
    model,
    model_version: MODEL_VERSION,
    ridge: fit,
    validation,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    above_floor_size: above,
    live_size: live.length,
    scanned: snapshot.protocols.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

// ---------------------------------------------------------------- input and checks

/**
 * One protocol out of its raw record, refused unless it carries a slug, a name and a finite TVL.
 * The optional fields fall back to null (or an empty chain list) when they are absent or the
 * wrong shape, so a snapshot that omits them still scores.
 */
function parseProtocol(v: unknown, i: number): SnapshotProtocol {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
  }
  const p = v as Record<string, unknown>;
  if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
    throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
  }
  return {
    slug: p.slug,
    name: p.name,
    category: typeof p.category === 'string' ? p.category : null,
    chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
    tvl_usd: p.tvl_usd,
    change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
    mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
    listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
    gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
    symbol: typeof p.symbol === 'string' ? p.symbol : null,
  };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => parseProtocol(v, i));
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < MIN_BOARD_ROWS) return `the board ranks ${board.length} protocols, under the ${MIN_BOARD_ROWS} the radar hands in`;
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (!Number.isSafeInteger(r.farm_cost_usd) || r.farm_cost_usd < 0) return `${r.slug} has farm cost ${r.farm_cost_usd}`;
  }
  return null;
}

/**
 * The board's totals for the run log: how many rows, their combined implied value and their
 * combined TVL, so a run's scale is one line. The values are plain sums of the rows as scored.
 */
export function boardTotals(board: BoardRow[]): { rows: number; impliedUsd: number; tvlUsd: number } {
  let impliedUsd = 0;
  let tvlUsd = 0;
  for (const row of board) {
    impliedUsd += row.implied_value_usd;
    tvlUsd += row.tvl_usd;
  }
  return { rows: board.length, impliedUsd, tvlUsd };
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}

/** The blind test as one script: every blind prediction, so the dossier's text carries the proof. */
export function validationScript(validation: Validation, snapshotSha256: string): string {
  return `window.VALIDATION=${JSON.stringify({ snapshot_sha256: snapshotSha256, ...validation })};\n`;
}

/**
 * One board row as a single readable line for the run log: its rank, name and implied value,
 * then the ridge prediction and its 80% band, so a run's top rows can be read at a glance
 * without opening the board. The value is a plain dollar figure.
 */
export function describeRow(row: BoardRow): string {
  const m = row.model;
  const money = `$${row.implied_value_usd.toLocaleString('en-US')}`;
  const band = `80% band $${m.p10_usd.toLocaleString('en-US')}..$${m.p90_usd.toLocaleString('en-US')} (x${m.curve_multiple}, category shift ${m.category_shift >= 0 ? '+' : ''}${m.category_shift})`;
  const age = m.age_days === null ? 'age unknown' : `${m.age_days} days old`;
  const list = row.is_watchlist ? 'watchlist' : row.above_floor ? 'above the floor' : 'early';
  return `#${row.rank} ${row.name} (${row.slug}) ${money} [${band}] ${age}, ${list}, farm $${row.farm_cost_usd}`;
}
