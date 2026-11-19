// Token Radar's model, radar-4: one snapshot of the protocol universe in, one ranked board out.
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
// Implied value follows only from the snapshot's own figures. No protocol name is ever
// special-cased: the same function scores every row. The value curve is FITTED, not hand-set:
// a log-log regression of market cap on TVL with a shift per category, fitted on the
// snapshot's own tokenized protocols (see fitCurve). The three multipliers that follow it —
// growth, maturity, breadth — are the same shape radar-3 used, and the fit's target is the
// market cap divided by those multipliers, so the curve and the multipliers compose exactly:
//
//   curve    = 10^(a + b x log10(tvl_usd) + shift(category))     (OLS on the train comparables,
//                                                                 categories with at least
//                                                                 MIN_CAT_N of them get a shift)
//   base     = curve, with base / tvl_usd clamped to RATIO_MIN..RATIO_MAX
//   growth   = clamp(change_7d, -80, 200) per cent
//   growthMult = 1 + growth x (0.006 when growth >= 0, 0.003 when growth < 0)
//                Launches are option-like: a fast-growing protocol is worth more than a shrinking
//                one of the same size, and the upside counts double the downside.
//   maturity = a hump over age_days (time listed with no token):
//              under 90 days  -> 0.75 (too young to read)
//              90 to 365 days -> 0.75 rising to 1.00
//              1 to 3 years   -> 1.00 rising to 1.15 (prime: proven, still no token)
//              over 3 years   -> 1.15 falling back toward 1.05 (old enough that no token
//                                starts to look like a choice, not a delay)
//              age unknown    -> 0.85
//   breadth  = 1 + min(chains - 1, 5) x 0.02                (1.00 to 1.10)
//              A protocol live on more chains has more surface to farm and more users to reward.
//   implied  = max(1, round(base x growthMult x maturity x breadth))
//
// The fit is PROVED, not asserted. Before fitting, a blind set of BLIND_N protocols is drawn
// from the whole snapshot by a fixed seed (BLIND_SEED): the fit never sees them. Their
// predictions are published whole (see Validation.blind), and the tokenized ones among them are
// scored against their actual market caps: pinball loss at the 10th, 50th and 90th percentiles,
// the coverage of the 80% prediction interval, median absolute log error, median MAPE and R^2
// on log market cap. The same metrics are computed leave-one-out over every comparable, so the
// blind set is not the only witness. A median-multiple rule scored on this same blind set
// (pinball 0.233, R^2 -0.16) is the baseline the curve must beat, and does: see the validation
// the program prints. The manifest names the input's sha256, so no look-ahead can be alleged:
// the snapshot's bytes are sealed, the blind set is drawn before the fit, and the fit's
// coefficients are printed in the dashboard.

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
}

export const MODEL: ModelConstants = {
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
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-4';

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
    curve_value_usd: number;
    curve_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
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
  curve_value_usd: number;
  curve_multiple: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
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

/** One metric set: pinball loss, interval coverage, log error, MAPE and R^2, all on log10 market cap. */
export interface MetricSet {
  n: number;
  sigma_log: number;
  pinball: number;
  coverage_80: number;
  med_abs_log_err: number;
  med_mape_pct: number;
  r2_log: number;
}

/** One blind protocol's published prediction: the model's implied value, and the actual market cap where one trades. */
export interface BlindPrediction {
  slug: string;
  predicted_usd: number;
  actual_usd: number | null;
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
  /** The median-multiple rule (one median market-cap/TVL per category) scored on the same blind set, by the same metric code: the baseline the curve must beat. */
  baseline: MetricSet;
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

/** Everything the dashboard needs: the board, the live set, the fitted curve and its proof. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  snapshot_sha256: string;
  snapshot_bytes: number;
  model: ModelConstants;
  model_version: string;
  curve: CurveFit;
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
export function fitCurve(train: SnapshotProtocol[], asOf: string, model: ModelConstants = MODEL): CurveFit {
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
function curveLogValue(p: SnapshotProtocol, fit: CurveFit): number {
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
export function curveValue(p: SnapshotProtocol, fit: CurveFit): { value: number; multiple: number } {
  const raw = Math.pow(10, curveLogValue(p, fit));
  const ratio = raw / p.tvl_usd;
  const clamped = Math.min(fit.ratio_max, Math.max(fit.ratio_min, ratio));
  return { value: p.tvl_usd * clamped, multiple: clamped };
}

/** The five multipliers and the implied value one protocol gets under the fitted curve. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  fit: CurveFit,
): { implied: number; curveValue: number; curveMultiple: number; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; age: number | null } {
  const m = multipliersOf(protocol, asOf, model);
  const curve = curveValue(protocol, fit);
  const implied = Math.max(1, Math.round(curve.value * m.mult));
  return { implied, curveValue: Math.round(curve.value), curveMultiple: curve.multiple, growthPct: m.growthPct, growthMult: m.growthMult, maturityMult: m.maturityMult, breadthMult: m.breadthMult, age: m.age };
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
 * interval, the median absolute log error, the median MAPE and R^2 on log market cap.
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

/** The whole validation: the blind test, the leave-one-out test, and every blind prediction. */
export function validate(
  snapshot: Snapshot,
  fit: CurveFit,
  train: SnapshotProtocol[],
  blindSet: Set<string>,
  model: ModelConstants = MODEL,
): Validation {
  const comps = snapshot.protocols.filter(isComparable);
  const blindComps = comps.filter((p) => blindSet.has(p.slug));
  const predict = (p: SnapshotProtocol): number => impliedValue(p, snapshot.as_of, model, fit).implied;
  const blind = metricSet(blindComps, predict, fit.sigma_log);
  // The median-multiple baseline on the same blind set, fitted on the train set alone.
  const baseline = metricSet(blindComps, medianBaselinePredict(train, snapshot.as_of, model), fit.sigma_log);
  // Leave-one-out: refit without each comparable in turn, predict it, score the same way.
  const looPred = new Map<string, number>();
  for (const held of comps) {
    const rest = comps.filter((p) => p.slug !== held.slug);
    const refit = fitCurve(rest, snapshot.as_of, model);
    looPred.set(held.slug, impliedValue(held, snapshot.as_of, model, refit).implied);
  }
  const loo = metricSet(
    comps,
    (p) => looPred.get(p.slug)!,
    fit.sigma_log,
  );
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
    baseline,
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
  fit: CurveFit,
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
    const v = impliedValue(p, snapshot.as_of, model, fit);
    return { p, ...v };
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
      curve_value_usd: s.curveValue,
      curve_multiple: round3(s.curveMultiple),
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      breadth_multiplier: round4(s.breadthMult),
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
    curve_value_usd: row.model.curve_value_usd,
    curve_multiple: row.model.curve_multiple,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
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
  const fit = fitCurve(train, snapshot.as_of, model);
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
    curve: fit,
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
 * then the curve value and the three multipliers that produced it, so a run's top rows can be
 * read at a glance without opening the board. The multipliers are shown to two decimals; the
 * value is a plain dollar figure.
 */
export function describeRow(row: BoardRow): string {
  const m = row.model;
  const money = `$${row.implied_value_usd.toLocaleString('en-US')}`;
  const mults = `curve $${m.curve_value_usd.toLocaleString('en-US')} (x${m.curve_multiple}) x growth ${m.growth_multiplier.toFixed(2)} x maturity ${m.maturity_multiplier.toFixed(2)} x breadth ${m.breadth_multiplier.toFixed(2)}`;
  const age = m.age_days === null ? 'age unknown' : `${m.age_days} days old`;
  const list = row.is_watchlist ? 'watchlist' : row.above_floor ? 'above the floor' : 'early';
  return `#${row.rank} ${row.name} (${row.slug}) ${money} [${mults}] ${age}, ${list}, farm $${row.farm_cost_usd}`;
}
