// Token Radar's model, radar-2: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds
// pre-token protocols below the watchlist floor: the early rows the radar exists to find. A protocol
// is pre-token when its record carries no token (no market cap, no CoinGecko id, no symbol). The
// snapshot's live-token protocols are kept apart and shown as the market's own values, never mixed
// into the ranked board.
//
// Implied value follows only from the snapshot's own figures. No protocol name is ever
// special-cased: the same function scores every row.
//
//   base      = tvl_usd x BASE_MULTIPLE                       (0.30)
//   growth    = clamp(change_7d, -80, 200) per cent
//   growthMult = 1 + growth x (0.006 when growth >= 0, 0.003 when growth < 0)
//               Launches are option-like: a fast-growing protocol is worth more than a shrinking
//               one of the same size, and the upside counts double the downside.
//   maturity  = a hump over age_days (time listed with no token):
//               under 90 days  -> 0.75 (too young to read)
//               90 to 365 days -> 0.75 rising to 1.00
//               1 to 3 years   -> 1.00 rising to 1.15 (prime: proven, still no token)
//               over 3 years   -> 1.15 falling back toward 1.05 (old enough that no token
//                                 starts to look like a choice, not a delay)
//               age unknown    -> 0.85
//   breadth   = 1 + min(chains - 1, 5) x 0.02                (1.00 to 1.10)
//               A protocol live on more chains has more surface to farm and more users to reward.
//   category  = a launch-precedent weight by the snapshot's own category field (see
//               CATEGORY_WEIGHT): categories whose protocols usually launch a token score above
//               1.00; categories that are mostly a token in another form score below it.
//   implied   = max(1, round(base x growthMult x maturity x breadth x category))
//
// Rankable means pre-token, not an exchange, not a versioned pool, and not a bridged, wrapped or
// staked product of a token that already trades (Bridge, Canonical Bridge, Liquid Staking, Liquid
// Restaking, Restaked BTC): the same exclusion the watchlist rule applies, extended below the floor,
// because such a product's token already trades in another form.

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
  base_multiple: number;
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
}

export const MODEL: ModelConstants = {
  base_multiple: 0.3,
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
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/**
 * Launch-precedent weight by the snapshot's category field. Categories whose protocols usually
 * launch a token of their own score above 1.00; categories that are mostly a token in another form
 * score below it. The table is a model parameter: every protocol in a category gets the same weight,
 * and no name is ever looked up.
 */
export const CATEGORY_WEIGHT: Record<string, number> = {
  Lending: 1.12,
  Dexs: 1.1,
  Derivatives: 1.1,
  CDP: 1.08,
  'Risk Curators': 1.08,
  'Uncollateralized Lending': 1.08,
  Yield: 1.06,
  'Yield Aggregator': 1.06,
  'Onchain Capital Allocator': 1.06,
  'Leveraged Farming': 1.06,
  'Interest Rate Derivatives': 1.06,
  RWA: 1.04,
  'Liquidity Manager': 1.04,
  'Basis Trading': 1.02,
  Chain: 1.0,
  Farm: 1.0,
  CeDeFi: 1.0,
  'Staking Pool': 0.98,
  'Anchor BTC': 0.95,
  'Decentralized BTC': 0.95,
  'Dual-Token Stablecoin': 0.95,
};

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
  implied_value_usd: number;
  model: {
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    category_multiplier: number;
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
  implied_value_usd: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  category_multiplier: number;
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

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  category_weights: Record<string, number>;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
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

/** The launch-precedent weight for a category: 1.00 when the model names no weight for it. */
export function categoryMultiplier(category: string | null): number {
  if (category === null) return 1;
  return CATEGORY_WEIGHT[category] ?? 1;
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

/** The five multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
): { implied: number; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; categoryMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = growthMultiplier(growthPct, model);
  const maturityMult = maturityMultiplier(age, model);
  const breadthMult = breadthMultiplier(protocol.chains.length, model);
  const categoryMult = categoryMultiplier(protocol.category);
  const base = protocol.tvl_usd * model.base_multiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * breadthMult * categoryMult));
  return { implied, growthPct, growthMult, maturityMult, breadthMult, categoryMult, age };
}

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

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
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

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model);
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
    implied_value_usd: s.implied,
    model: {
      base_multiple: model.base_multiple,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      breadth_multiplier: round4(s.breadthMult),
      category_multiplier: round4(s.categoryMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
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
 * A farm step, built from its action, its cost and its time. The seven steps of a plan share
 * this shape: an action to take, what it costs, and how long it takes.
 */
function planStep(text: string, cost: string, time: string): FarmStep {
  return { text, cost, time };
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names.
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
      `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
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
    implied_value_usd: row.implied_value_usd,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    category_multiplier: row.model.category_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    category_weights: CATEGORY_WEIGHT,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

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
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}

/**
 * One board row as a single readable line for the run log: its rank, name and implied value,
 * then the five multipliers that produced it, so a run's top rows can be read at a glance
 * without opening the board. The multipliers are shown to two decimals; the value is a plain
 * dollar figure.
 */
export function describeRow(row: BoardRow): string {
  const m = row.model;
  const money = `$${row.implied_value_usd.toLocaleString('en-US')}`;
  const mults = `base ${m.base_multiple} x growth ${m.growth_multiplier.toFixed(2)} x maturity ${m.maturity_multiplier.toFixed(2)} x breadth ${m.breadth_multiplier.toFixed(2)} x category ${m.category_multiplier.toFixed(2)}`;
  const age = m.age_days === null ? 'age unknown' : `${m.age_days} days old`;
  const list = row.is_watchlist ? 'watchlist' : 'early';
  return `#${row.rank} ${row.name} (${row.slug}) ${money} [${mults}] ${age}, ${list}`;
}
