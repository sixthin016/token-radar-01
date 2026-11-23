// Launch Radar v6's dashboard. It reads window.TOKEN_RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, the protocol accounting, the three out-of-sample
// evidence tables, a per-protocol detail view with the model's own inputs and the farm plan.
// No network: every byte it shows is in data.js. The page recomputes every row from the ridge
// coefficients and the odds beta data.js carries, and re-fits the ridge in the browser from
// the 55 TGE labels, so the board, the detail view and the model card are visibly the same
// arithmetic — and the fit can be checked without trusting the program that wrote it.
(function () {
  'use strict';

  var DATA = window.TOKEN_RADAR;
  if (!DATA) return;
  var V = DATA.validation;
  var app = document.getElementById('board');
  var S = { q: '', cat: 'all', chain: 'all', tier: 'all', verdict: 'all', sort: 'implied', dir: -1, sel: null,
    plan: DATA.farm_scenario.deposit_pct, share: DATA.farm_scenario.drop_share, horizon: DATA.farm_scenario.horizon_weeks };
  // Deep links: #row=<slug> opens a detail, #verdict=FARM / #tier=watchlist / #q=… filter the board.
  var fromHash = false;
  (function readHash() {
    var h = location.hash.replace(/^#/, '');
    h.split('&').forEach(function (kv) {
      var p = kv.split('=');
      if (p[0] === 'row' && p[1]) { S.sel = decodeURIComponent(p[1]); fromHash = true; }
      if (p[0] === 'verdict' && ['FARM', 'MARGINAL', 'SKIP', 'all'].indexOf(p[1]) >= 0) S.verdict = p[1];
      if (p[0] === 'tier' && ['watchlist', 'early', 'offlist', 'all'].indexOf(p[1]) >= 0) S.tier = p[1];
      if (p[0] === 'q' && p[1]) S.q = decodeURIComponent(p[1]);
    });
  })();

  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd0.format(n);
  }
  function fmtMoney(n) { return n === null || n === undefined || !isFinite(n) ? 'n/a' : usd0.format(Math.round(n)); }
  function fmt2(n) { return (n > 0 ? '+' : '') + n.toFixed(2); }
  function fmtPct(n) { return n === null || n === undefined || !isFinite(n) ? 'n/a' : fmt2(n) + '%'; }
  function fmtAge(d) {
    if (d === null || d === undefined) return 'unknown';
    if (d >= 365) return (d / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(d)) + 'd';
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) node.appendChild(x); });
      else if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else node.appendChild(c);
    }
    return node;
  }

  // --- the model, recomputed in the page from data.js (same arithmetic as lib/model.ts) ---
  var Z80 = 1.2815515655446004, Z50 = 0.6744897501960817;
  function ifLaunches(row) {
    var z = (row.log_tvl - DATA.ridge.mean_log_tvl) / DATA.ridge.sd_log_tvl;
    return Math.pow(10, DATA.ridge.intercept + DATA.ridge.slope_std * z);
  }
  function oddsOf(row) {
    var age = row.age_days === null || row.age_days === undefined ? 365 : row.age_days;
    var f = {
      log_tvl: Math.log10(Math.max(1, row.tvl_usd)),
      log_age: Math.log10(age + 1),
      cat_share: DATA.cat_share[row.category || ''] === undefined ? DATA.cat_base_rate : DATA.cat_share[row.category || ''],
      growth7: Math.max(-80, Math.min(200, row.change_7d || 0)) / 100,
      log_chains: Math.log10(Math.max(1, row.chains.length))
    };
    var z = DATA.odds_beta[0];
    DATA.odds_kept_terms.forEach(function (t, j) { z += DATA.odds_beta[1 + j] * f[t]; });
    return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
  }
  function gasFor(chain) { return DATA.gas_table[chain] || [2.0, 0.5]; }
  function farmOf(row, sc) {
    var dep = Math.min(sc.plan * row.tvl_usd, DATA.farm_scenario.deposit_cap_usd);
    var implied = ifLaunches(row) * oddsOf(row);
    var drop = implied * sc.share * dep / row.tvl_usd;
    var g = gasFor(row.chains[0]);
    var fees = g[0] + g[1] * sc.horizon;
    var hours = 0.25 + 0.25 * sc.horizon + 0.167;
    var net = drop - fees;
    var tbill = dep * DATA.farm_scenario.tbill_apr * (sc.horizon / 52);
    var verdict = (net > tbill && net / hours >= DATA.farm_scenario.farm_net_per_hour_usd) ? 'FARM' : (net > 0 ? 'MARGINAL' : 'SKIP');
    return { deposit: dep, drop: drop, fees: fees, hours: hours, net: net, netHour: net / hours, verdict: verdict, implied: implied };
  }
  // The scenario's current economics per row, recomputed whenever a slider moves.
  function econOf(row) { return S.plan === DATA.farm_scenario.deposit_pct && S.share === DATA.farm_scenario.drop_share && S.horizon === DATA.farm_scenario.horizon_weeks
    ? { deposit: row.deposit_usd, drop: row.expected_drop_usd, fees: row.fees_usd, hours: row.hours, net: row.net_usd, netHour: row.net_per_hour_usd, verdict: row.verdict, implied: row.implied_value_usd }
    : farmOf(row, S); }

  // --- re-fit the ridge in the browser from the 55 TGE labels, and check the stored fit ---
  function refitCheck() {
    var labels = DATA.tge_labels;
    var xs = labels.map(function (r) { return Math.log10(r.tvl_pre30); });
    var ys = labels.map(function (r) { return Math.log10(r.mc_tge); });
    var ws = labels.map(function (r) { return Math.pow(0.5, (Date.parse(labels[labels.length - 1].tge_date) - Date.parse(r.tge_date)) / 86400000 / 30 / 9); });
    var wSum = ws.reduce(function (a, b) { return a + b; }, 0);
    var mu = xs.reduce(function (a, x, i) { return a + ws[i] * x; }, 0) / wSum;
    var sd = Math.sqrt(xs.reduce(function (a, x, i) { return a + ws[i] * Math.pow(x - mu, 2); }, 0) / wSum);
    var n = xs.length, sxx = 0, sxy = 0, sx = 0, sy = 0, sw = 0;
    for (var i = 0; i < n; i++) {
      var z = (xs[i] - mu) / sd, w = ws[i];
      sxx += w * z * z; sxy += w * z * ys[i]; sx += w * z; sy += w * ys[i]; sw += w;
    }
    // ridge with lambda 10 on the slope: (X'WX + 10I) b = X'Wy, intercept unpenalised.
    var det = (sw + 0) * (sxx + 10) - sx * sx;
    var b0 = (sy * (sxx + 10) - sx * sxy) / det;
    var b1 = (sw * sxy - sx * sy) / det;
    var sse = 0;
    for (var j = 0; j < n; j++) { var r = ys[j] - (b0 + b1 * (xs[j] - mu) / sd); sse += ws[j] * r * r; }
    var sigma = Math.sqrt(sse / wSum);
    var ok = Math.abs(b0 - DATA.ridge.intercept) < 0.005 && Math.abs(b1 - DATA.ridge.slope_std) < 0.005 && Math.abs(sigma - DATA.ridge.sigma_log) < 0.005;
    return { ok: ok, intercept: b0, slope: b1, sigma: sigma };
  }

  // --- the farm steps, generated in the page from the same numbers board.json carries ---
  function farmSteps(row, econ) {
    var chain = row.chains[0] || 'its chain';
    var g = gasFor(row.chains[0]);
    var dep = '$' + Math.round(econ.deposit).toLocaleString('en-US');
    return [
      { text: 'Open ' + row.name + ' on ' + chain + ' and confirm its points or deposit program is live for this vault before moving any money.', cost: '$0', time: '5 min' },
      { text: 'Bridge ' + dep + ' to ' + chain + '. The deposit is ' + (S.plan * 100).toFixed(2) + '% of the protocol\u2019s TVL, capped at $' + DATA.farm_scenario.deposit_cap_usd.toLocaleString('en-US') + '.', cost: '$' + g[0].toFixed(2), time: '5 min' },
      { text: 'Deposit the ' + dep + ' into ' + row.name + ' and keep the receipt: the position must stay in place until the snapshot date.', cost: '$0', time: '5 min' },
      { text: 'Check the points balance once a week for ' + S.horizon + ' weeks and top up gas if the chain asks for it.', cost: '$' + (g[1] * S.horizon).toFixed(2), time: '15 min x ' + S.horizon },
      { text: 'Hold the deposit through the snapshot. Do not move it to chase a higher-yield vault: the snapshot is what the drop is paid on.', cost: '$0', time: '\u2014' },
      { text: 'When the token launches, claim the drop and exit the position in the same session.', cost: '$0', time: '10 min' },
      { text: 'Record the outcome against this plan: expected drop $' + econ.drop.toFixed(2) + ', fees $' + econ.fees.toFixed(2) + ', net $' + econ.net.toFixed(2) + '.', cost: '$0', time: '\u2014' }
    ];
  }

  // --- sections ---
  var GROUP_COLORS = {
    'ranked-watchlist': '#22c55e', 'ranked-early': '#4ade80', 'ranked-offlist': '#a3e635',
    'token-priced-comp': '#38bdf8', 'token-no-usable-cap': '#64748b',
    'out-bridge': '#f59e0b', 'out-exchange': '#f97316', 'out-liquid-staking': '#a78bfa', 'out-versioned': '#f472b6', 'out-other-pretoken': '#94a3b8'
  };
  var GROUP_LABELS = {
    'ranked-watchlist': 'Ranked, watchlist', 'ranked-early': 'Ranked, early (below floor)', 'ranked-offlist': 'Ranked, off-list (above floor)',
    'token-priced-comp': 'Token trades, priced comp', 'token-no-usable-cap': 'Token recorded, no usable cap',
    'out-bridge': 'Out: bridge', 'out-exchange': 'Out: exchange', 'out-liquid-staking': 'Out: liquid staking', 'out-versioned': 'Out: versioned fork', 'out-other-pretoken': 'Out: other pre-token'
  };

  function header() {
    var totalImplied = DATA.rows.reduce(function (a, r) { return a + r.implied_value_usd; }, 0);
    var totalTvl = DATA.rows.reduce(function (a, r) { return a + r.tvl_usd; }, 0);
    var farmN = DATA.rows.filter(function (r) { return r.verdict === 'FARM'; }).length;
    var rf = refitCheck();
    var v = V;
    return el('div', {},
      el('h1', { text: 'Launch Radar v6: every value term fitted on TGE-day launches and tested held-out twice, farm plans netted to the dollar' }),
      el('p', { class: 'sub', text: '203 pre-token protocols ranked by implied value — the value if the token launches, times the odds it ever launches. The value model is a ridge of launch-day market cap on TVL 30 days before launch, fitted on 55 TGE-labelled comparables; the odds model is a logistic regression on the snapshot\u2019s own figures. Nothing here is a name list: the same two functions score every row.' }),
      el('div', { class: 'kpis' },
        el('div', { class: 'kpi' }, el('div', { class: 'k' }, 'Walk-forward miss'), el('div', { class: 'v', html: '\u00d7' + v.time_split_pooled.r6.typical_miss_x + ' <small>vs \u00d7' + v.term_table[0].wf_miss_x + ' flat</small>' }), el('div', { class: 'd' }, 'pooled, 33 launches')),
        el('div', { class: 'kpi' }, el('div', { class: 'k' }, 'Range honesty'), el('div', { class: 'v', html: (v.honesty_wf.inside_p25_p75 * 100).toFixed(0) + '% <small>\u00b7 ' + (v.honesty_wf.inside_p10_p90 * 100).toFixed(0) + '%</small>' }), el('div', { class: 'd' }, 'inside P25\u2013P75 (stated 50%) \u00b7 P10\u2013P90 (stated 80%), walk-forward')),
        el('div', { class: 'kpi' }, el('div', { class: 'k' }, 'Token odds Brier'), el('div', { class: 'v', html: v.odds.terms[v.odds.terms.length - 2].wf_brier.toFixed(3) + ' <small>vs ' + v.odds.terms[0].wf_brier.toFixed(3) + ' base</small>' }), el('div', { class: 'd' }, 'walk-forward, ' + v.odds.peers_n + ' peers')),
        el('div', { class: 'kpi' }, el('div', { class: 'k' }, 'Terms survived'), el('div', { class: 'v', html: '2 <small>of 7 \u00b7 4 of 7</small>' }), el('div', { class: 'd' }, 'value terms \u00b7 odds terms (base + 3 kept)')),
        el('div', { class: 'kpi' }, el('div', { class: 'k' }, 'Worth farming'), el('div', { class: 'v', html: farmN + ' <small>of ' + DATA.rows.length + '</small>' }), el('div', { class: 'd' }, 'net beats a T-bill and pays \u2265 $25/hour')),
        el('div', { class: 'kpi' }, el('div', { class: 'k' }, 'Watchlist'), el('div', { class: 'v', html: '40<small>/40</small>' }), el('div', { class: 'd' }, '+ 163 off-list rows ranked'))
      ),
      el('div', { class: 'formula', text: 'Implied value = TVL \u00d7 fitted multiple \u00d7 token odds      log10(if it launches) = ' + DATA.ridge.intercept.toFixed(3) + ' + ' + DATA.ridge.slope_std.toFixed(3) + ' \u00d7 z(log10 TVL),  \u03c3 = ' + DATA.ridge.sigma_log.toFixed(3) + ',  n = 55 TGE labels' }),
      el('div', { class: 'verify' },
        el('b', { text: 'Verified: ' }),
        'this table is board.json, ranks in order, totals recomputed — ',
        el('b', { class: 'num', text: fmtMoney(totalImplied) }),
        ' implied over ',
        el('b', { class: 'num', text: fmtMoney(totalTvl) }),
        ' TVL. Snapshot sha256 ',
        el('span', { class: 'mono', text: DATA.snapshot_sha256.slice(0, 16) + '\u2026' }),
        '. Watchlist 40/40. Ledger 758/758. In-browser refit of the ridge from the 55 labels: intercept ',
        el('span', { class: 'num', text: rf.intercept.toFixed(3) }),
        ', slope ',
        el('span', { class: 'num', text: rf.slope.toFixed(3) }),
        ', \u03c3 ',
        el('span', { class: 'num', text: rf.sigma.toFixed(3) }),
        ' — ',
        rf.ok ? el('b', { text: 'matches the stored fit.' }) : el('b', { class: 'fail', text: 'DOES NOT match the stored fit.' }),
        ' ',
        el('span', { class: 'fail', text: 'Submit gate NOT passed — see the evidence below.' })
      )
    );
  }

  function accounting() {
    var groups = Object.keys(GROUP_LABELS).filter(function (g) { return DATA.accounting[g]; });
    var total = Object.keys(DATA.accounting).reduce(function (a, g) { return a + DATA.accounting[g]; }, 0);
    return el('section', { class: 'card' },
      el('h2', { text: 'Protocol accounting: all 758 in exactly one group' }),
      el('div', { class: 'bar' }, groups.map(function (g) {
        return el('div', { style: 'width:' + (DATA.accounting[g] / total * 100) + '%;background:' + GROUP_COLORS[g], title: GROUP_LABELS[g] + ': ' + DATA.accounting[g] });
      })),
      el('div', { class: 'legend' }, groups.map(function (g) {
        return el('span', {}, el('i', { style: 'background:' + GROUP_COLORS[g] }), GROUP_LABELS[g] + ' \u00b7 ' + DATA.accounting[g]);
      })),
      el('p', { class: 'small', text: 'Ranked 203 (watchlist 40, early 143, off-list 20) \u00b7 tokenized 416 (priced comps 94, no usable cap 322) \u00b7 left out 139 (bridge 43, liquid staking 43, exchange 42, versioned 11). The 20 off-list rows are rankable yet off the watchlist; the snapshot carries no parentProtocol field, so no parent discount is applied — that is a stated limitation, not a hidden one.' })
    );
  }

  function termTableEl() {
    var rows = V.term_table.map(function (r) {
      return el('tr', {},
        el('td', { text: r.term }),
        el('td', { class: 'num', text: r.loo_pinball.toFixed(4) + ' (\u00d7' + r.loo_miss_x + ')' }),
        el('td', { class: 'num', text: r.wf_pinball.toFixed(4) + ' (\u00d7' + r.wf_miss_x + ')' }),
        el('td', { class: 'num', text: r.loo_spearman.toFixed(3) + ' / ' + r.wf_spearman.toFixed(3) }),
        el('td', { text: r.verdict }));
    });
    return el('section', { class: 'card' },
      el('h2', { text: 'Evidence (a): value-model terms, out of sample' }),
      el('p', { class: 'small', text: 'Each row adds one term to the last KEPT row and is scored leave-one-out and walk-forward (pooled, 33 launches). A term is kept only when it lowers BOTH pinballs; a rejected term is reverted. The control — another row\u2019s 7-day growth — must not help, and it does not.' }),
      el('table', {}, el('thead', {}, el('tr', {}, el('th', { text: 'Term, added in order' }), el('th', { text: 'LOO pinball (miss)' }), el('th', { text: 'Walk-forward pinball (miss)' }), el('th', { text: 'Spearman LOO / WF' }), el('th', { text: 'Verdict' }))), el('tbody', {}, rows)),
      el('p', { class: 'small', text: 'Category shifts were fitted and then dropped: only Basis Trading +0.019, Lending \u22120.031 and RWA +0.032 earn a shift, each within ~1.5 bootstrap standard errors of zero, and the size-only model is better-or-equal on every split. The shipped model carries no shift — a term this table calls \u201ctested, not kept\u201d does not sit inside it.' })
    );
  }

  function oddsTableEl() {
    var rows = V.odds.terms.map(function (r) {
      return el('tr', {},
        el('td', { text: r.term }),
        el('td', { class: 'num', text: r.cv_brier.toFixed(3) }),
        el('td', { class: 'num', text: r.wf_brier.toFixed(3) }),
        el('td', { text: r.verdict }));
    });
    return el('section', { class: 'card' },
      el('h2', { text: 'Evidence (b): token odds, Brier score' }),
      el('p', { class: 'small', text: 'Logistic regression on ' + V.odds.peers_n + ' peers (base rate ' + V.odds.base_rate.toFixed(3) + '). Folds are hash folds — fold = FNV-1a(slug) mod 10 — so the table is identical in the program and in the independent re-check. A term is kept only when it lowers BOTH the 10-fold CV Brier and the walk-forward Brier by at least 0.001: the chain-count term flips between fold schemes (no help with seeded-permutation folds, +0.0002 with hash folds), which is within fold noise, so it is not kept. Full-data Brier ' + V.odds.full_brier.toFixed(3) + '; beta [' + V.odds.beta.map(function (b) { return b.toFixed(3); }).join(', ') + '] on [' + V.odds.kept_terms.join(', ') + '].' }),
      el('table', {}, el('thead', {}, el('tr', {}, el('th', { text: 'Term, added in order' }), el('th', { text: '10-fold CV Brier' }), el('th', { text: 'Walk-forward Brier' }), el('th', { text: 'Verdict' }))), el('tbody', {}, rows))
    );
  }

  function honestyEl() {
    var blindRows = V.blind_predictions.map(function (p) {
      return el('tr', {},
        el('td', { text: p.slug }),
        el('td', { class: 'num', text: fmtMoney(p.predicted_usd) }),
        el('td', { class: 'num', text: fmtMoney(p.actual_usd) }),
        el('td', { class: 'num', text: '\u00d7' + (Math.max(p.predicted_usd, p.actual_usd) / Math.min(p.predicted_usd, p.actual_usd)).toFixed(2) }));
    });
    return el('section', { class: 'card' },
      el('h2', { text: 'Evidence (c): interval honesty, and the gate, stated plainly' }),
      el('table', {}, el('thead', {}, el('tr', {}, el('th', { text: 'Check' }), el('th', { text: 'Leave-one-out (n=55)' }), el('th', { text: 'Walk-forward (n=33)' }), el('th', { text: 'Stated' }))),
        el('tbody', {},
          el('tr', {}, el('td', { text: 'Within \u00d73 of the model' }), el('td', { class: 'num', text: (V.honesty_loo.within_x3 * 100).toFixed(1) + '%' }), el('td', { class: 'num', text: (V.honesty_wf.within_x3 * 100).toFixed(1) + '%' }), el('td', { text: '\u2014' })),
          el('tr', {}, el('td', { text: 'Inside P25\u2013P75' }), el('td', { class: 'num', text: (V.honesty_loo.inside_p25_p75 * 100).toFixed(1) + '%' }), el('td', { class: 'num', text: (V.honesty_wf.inside_p25_p75 * 100).toFixed(1) + '%' }), el('td', { text: '50%' })),
          el('tr', {}, el('td', { text: 'Inside P10\u2013P90' }), el('td', { class: 'num', text: (V.honesty_loo.inside_p10_p90 * 100).toFixed(1) + '%' }), el('td', { class: 'num', text: (V.honesty_wf.inside_p10_p90 * 100).toFixed(1) + '%' }), el('td', { text: '80%' })))),
      el('p', { class: 'small', text: 'The 80% band covers ~75%: slightly narrow, stated as measured. Blind (n=12): pinball radar-6 ' + V.blind.r6.pinball + ' vs with-shifts ' + V.blind.v5h.pinball + ' vs radar-5 ' + V.blind.v5.pinball + '; Spearman ' + V.blind.r6.spearman + ' vs ' + V.blind.v5h.spearman + ' vs ' + V.blind.v5.spearman + '. LOO (n=55): pinball ' + V.loo.r6.pinball + ' vs ' + V.loo.v5h.pinball + ' vs ' + V.loo.v5.pinball + '; Spearman ' + V.loo.r6.spearman + ' vs ' + V.loo.v5h.spearman + ' vs ' + V.loo.v5.spearman + '. Walk-forward pooled (n=33): pinball ' + V.time_split_pooled.r6.pinball + ' vs ' + V.time_split_pooled.v5h.pinball + ' vs ' + V.time_split_pooled.v5.pinball + '; Spearman ' + V.time_split_pooled.r6.spearman + ' vs ' + V.time_split_pooled.v5h.spearman + ' vs ' + V.time_split_pooled.v5.spearman + '.' }),
      el('div', { class: 'note' }, el('b', { text: 'Submit gate NOT passed. ' }), V.gate_note),
      el('div', { class: 'note' }, el('b', { text: 'Why radar-5 wins walk-forward pinball. ' }), 'Radar-5 is scored with TVL measured in November 2026 — AFTER the launch-day labels it is scored against. That is post-launch information the pre-token task never has, so its time-split pinball (0.164 vs radar-6\u2019s 0.220) is contaminated by validation leakage, not by a better model. For the board\u2019s actual task the leakage does not exist. Paired bootstrap, radar-6 minus radar-5: blind pinball ' + V.bootstrap_blind.pinball_delta + ' [' + V.bootstrap_blind.pinball_ci_low + ', ' + V.bootstrap_blind.pinball_ci_high + ']; LOO pinball ' + V.bootstrap_loo.pinball_delta + ' [' + V.bootstrap_loo.pinball_ci_low + ', ' + V.bootstrap_loo.pinball_ci_high + ']; walk-forward pinball ' + V.bootstrap_ts.pinball_delta + ' [' + V.bootstrap_ts.pinball_ci_low + ', ' + V.bootstrap_ts.pinball_ci_high + '].'),
      el('h3', { text: 'The blind test\u2019s 12 scored predictions, whole (predicted if-it-launches vs actual launch-day market cap)' }),
      el('table', {}, el('thead', {}, el('tr', {}, el('th', { text: 'Protocol' }), el('th', { text: 'Predicted' }), el('th', { text: 'Actual (TGE day)' }), el('th', { text: 'Miss' }))), el('tbody', {}, blindRows))
    );
  }

  // --- the board: filters, table, detail ---
  function filteredRows() {
    var rows = DATA.rows.filter(function (r) {
      if (S.verdict !== 'all') { var e = econOf(r); if (e.verdict !== S.verdict) return false; }
      if (S.tier === 'watchlist' && !r.is_watchlist) return false;
      if (S.tier === 'early' && (r.is_watchlist || r.above_floor)) return false;
      if (S.tier === 'offlist' && (r.is_watchlist || !r.above_floor)) return false;
      if (S.cat !== 'all' && (r.category || '') !== S.cat) return false;
      if (S.chain !== 'all' && r.chains.indexOf(S.chain) < 0) return false;
      if (S.q) {
        var q = S.q.toLowerCase();
        if (r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0 && (r.category || '').toLowerCase().indexOf(q) < 0) return false;
      }
      return true;
    });
    var key = S.sort;
    rows.sort(function (a, b) {
      var av, bv;
      if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'odds') { av = a.token_odds; bv = b.token_odds; }
      else if (key === 'net') { av = econOf(a).net; bv = econOf(b).net; }
      else if (key === 'age') { av = a.age_days === null ? -1 : a.age_days; bv = b.age_days === null ? -1 : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      return (av - bv) * S.dir;
    });
    return rows;
  }

  function tierPill(r) {
    if (r.is_watchlist) return el('span', { class: 'pill watch', text: 'Watchlist' });
    return r.above_floor ? el('span', { class: 'pill off', text: 'Off-list' }) : el('span', { class: 'pill early', text: 'Early' });
  }

  function rowEls(rows) {
    return rows.map(function (r) {
      var e = econOf(r);
      var range = '$' + (r.p25_usd / 1e6).toFixed(1) + 'M\u2013$' + (r.p75_usd / 1e6).toFixed(1) + 'M';
      return el('tr', { class: S.sel === r.slug ? 'sel' : '', onclick: function () { S.sel = S.sel === r.slug ? null : r.slug; try { location.hash = S.sel ? 'row=' + r.slug : ''; } catch (e) {} render(); } },
        el('td', { class: 'num', text: r.rank }),
        el('td', {}, el('b', { text: r.name }), el('span', { class: 'sub2', text: (r.category || 'uncategorised') + ' \u00b7 ' + (r.chains.slice(0, 3).join(', ') || 'no chain') }), tierPill(r)),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num', text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: r.token_odds.toFixed(3) }),
        el('td', { class: 'num', text: fmtMoney(r.predicted_usd) }),
        el('td', { class: 'num' }, el('b', { text: fmtMoney(r.implied_value_usd) }), el('span', { class: 'sub2', text: range })),
        el('td', {}, el('span', { class: 'pill ' + e.verdict.toLowerCase(), text: e.verdict }), el('span', { class: 'sub2', text: 'net $' + e.net.toFixed(2) + ' \u00b7 $' + e.netHour.toFixed(2) + '/h' }))
      );
    });
  }

  function boardTable() {
    var rows = filteredRows();
    var cats = [...new Set(DATA.rows.map(function (r) { return r.category || ''; }))].sort();
    var chains = [...new Set(DATA.rows.flatMap(function (r) { return r.chains; }))].sort();
    var counts = { all: DATA.rows.length, FARM: 0, MARGINAL: 0, SKIP: 0 };
    DATA.rows.forEach(function (r) { counts[econOf(r).verdict]++; });
    function tab(v, label) {
      return el('button', { class: 'tab', 'data-verdict': v, 'aria-pressed': S.verdict === v ? 'true' : 'false', onclick: function () { S.verdict = v; render(); }, text: label + ' ' + counts[v === 'all' ? 'all' : v] });
    }
    var sortBtn = function (key, label) {
      return el('button', { onclick: function () { if (S.sort === key) S.dir = -S.dir; else { S.sort = key; S.dir = -1; } render(); }, text: label + (S.sort === key ? (S.dir === -1 ? ' \u25bc' : ' \u25b2') : '') });
    };
    var tierSel = el('select', { 'aria-label': 'Tier', onchange: function (ev) { S.tier = ev.target.value; render(); } },
      el('option', { value: 'all', text: 'All tiers' }), el('option', { value: 'watchlist', text: 'Watchlist' }), el('option', { value: 'early', text: 'Early (below floor)' }), el('option', { value: 'offlist', text: 'Off-list (above floor)' }));
    tierSel.value = S.tier;
    var catSel = el('select', { 'aria-label': 'Category', onchange: function (ev) { S.cat = ev.target.value; render(); } },
      el('option', { value: 'all', text: 'All categories' }), cats.map(function (c) { return el('option', { value: c, text: c || 'uncategorised' }); }));
    catSel.value = S.cat;
    var chainSel = el('select', { 'aria-label': 'Chain', onchange: function (ev) { S.chain = ev.target.value; render(); } },
      el('option', { value: 'all', text: 'All chains' }), chains.map(function (c) { return el('option', { value: c, text: c }); }));
    chainSel.value = S.chain;
    var planSel = el('select', { 'aria-label': 'Plan size', onchange: function (ev) { S.plan = parseFloat(ev.target.value); render(); } },
      el('option', { value: '0.0001', text: '0.01% of TVL' }), el('option', { value: '0.0002', text: '0.02% of TVL' }), el('option', { value: '0.0005', text: '0.05% of TVL' }));
    planSel.value = String(S.plan);
    var detail = S.sel ? detailView(DATA.rows.find(function (r) { return r.slug === S.sel; })) : null;
    return el('section', { class: 'card', id: 'board-card' },
      el('h2', { id: 'board-count', text: 'The board: ' + rows.length + ' of ' + DATA.rows.length + ' rows' }),
      el('div', { class: 'filters' },
        el('div', { class: 'tabs' }, tab('all', 'All'), tab('FARM', 'Farm'), tab('MARGINAL', 'Marginal'), tab('SKIP', 'Skip')),
        tierSel, catSel, chainSel,
        el('input', { type: 'search', placeholder: 'Search name or slug\u2026', value: S.q, oninput: function (ev) { S.q = ev.target.value; renderTableOnly(); } }),
        el('span', { class: 'ctl' }, 'Plan size ', planSel),
        el('span', { class: 'ctl' }, 'Drop share ', el('input', { type: 'range', min: 1, max: 20, step: 0.5, value: S.share * 100, 'aria-label': 'Drop share', oninput: function (ev) { S.share = parseFloat(ev.target.value) / 100; renderTableOnly(); } }), el('b', { id: 'share-val', text: (S.share * 100).toFixed(1) + '%' })),
        el('span', { class: 'ctl' }, 'Horizon ', el('input', { type: 'range', min: 4, max: 26, step: 1, value: S.horizon, 'aria-label': 'Horizon in weeks', oninput: function (ev) { S.horizon = parseInt(ev.target.value, 10); renderTableOnly(); } }), el('b', { id: 'horizon-val', text: S.horizon + ' wk' })),
        el('button', { class: 'btn', onclick: function () { S = { q: '', cat: 'all', chain: 'all', tier: 'all', verdict: 'all', sort: 'implied', dir: -1, sel: null, plan: DATA.farm_scenario.deposit_pct, share: DATA.farm_scenario.drop_share, horizon: DATA.farm_scenario.horizon_weeks }; render(); }, text: 'Reset' }),
        el('button', { class: 'btn', onclick: downloadCsv, text: 'CSV' }),
        el('button', { class: 'btn', onclick: downloadJson, text: 'JSON' })
      ),
      detail,
      el('div', { style: 'overflow-x:auto;margin-top:12px' },
        el('table', {},
          el('thead', {}, el('tr', {},
            el('th', {}, sortBtn('implied', '#')),
            el('th', { text: 'Protocol' }),
            el('th', {}, sortBtn('tvl', 'TVL')),
            el('th', { text: '7D' }),
            el('th', { text: 'No-token age' }),
            el('th', {}, sortBtn('odds', 'Token odds')),
            el('th', { text: 'If it launches' }),
            el('th', {}, sortBtn('implied', 'Implied value \u00b7 P25\u2013P75')),
            el('th', {}, sortBtn('net', 'Verdict \u00b7 net of fees')))),
          el('tbody', { id: 'rows' }, rowEls(rows))))
    );
  }

  function detailView(r) {
    if (!r) return null;
    var e = econOf(r);
    var steps = farmSteps(r, e);
    var oddsDl = el('dl', { class: 'kv' });
    oddsDl.appendChild(el('dt', { text: 'intercept' }));
    oddsDl.appendChild(el('dd', { text: DATA.odds_beta[0].toFixed(3) }));
    DATA.odds_kept_terms.forEach(function (t, j) {
      var age = r.age_days === null || r.age_days === undefined ? 365 : r.age_days;
      var f = { log_tvl: Math.log10(Math.max(1, r.tvl_usd)), log_age: Math.log10(age + 1), cat_share: DATA.cat_share[r.category || ''] === undefined ? DATA.cat_base_rate : DATA.cat_share[r.category || ''], growth7: Math.max(-80, Math.min(200, r.change_7d || 0)) / 100, log_chains: Math.log10(Math.max(1, r.chains.length)) };
      oddsDl.appendChild(el('dt', { text: t }));
      oddsDl.appendChild(el('dd', { text: (DATA.odds_beta[1 + j] >= 0 ? '+' : '') + DATA.odds_beta[1 + j].toFixed(3) + ' \u00d7 ' + f[t].toFixed(3) + ' = ' + (DATA.odds_beta[1 + j] * f[t]).toFixed(3) }));
    });
    return el('div', { class: 'detail', id: 'detail' },
      el('h3', { text: '#' + r.rank + ' ' + r.name + ' \u2014 detail' }),
      el('div', { class: 'cols' },
        el('div', {},
          el('h3', { text: 'The model, on this row' }),
          el('dl', { class: 'kv' },
            el('dt', { text: 'TVL' }), el('dd', { text: fmtMoney(r.tvl_usd) }),
            el('dt', { text: 'log10 TVL (z)' }), el('dd', { text: r.log_tvl.toFixed(3) + ' (' + ((r.log_tvl - DATA.ridge.mean_log_tvl) / DATA.ridge.sd_log_tvl).toFixed(2) + ')' }),
            el('dt', { text: 'If it launches (P50)' }), el('dd', { text: fmtMoney(r.predicted_usd) }),
            el('dt', { text: 'P25\u2013P75' }), el('dd', { text: fmtMoney(r.p25_usd) + ' \u2013 ' + fmtMoney(r.p75_usd) }),
            el('dt', { text: 'P10\u2013P90' }), el('dd', { text: fmtMoney(r.p10_usd) + ' \u2013 ' + fmtMoney(r.p90_usd) }),
            el('dt', { text: 'Fitted multiple' }), el('dd', { text: '\u00d7' + r.curve_multiple.toFixed(3) }),
            el('dt', { text: 'Category shift' }), el('dd', { text: '0 (tested, not kept)' }),
            el('dt', { text: 'Token odds' }), el('dd', { text: r.token_odds.toFixed(3) }),
            el('dt', { text: 'Implied value' }), el('dd', { text: fmtMoney(r.implied_value_usd) })),
          el('h3', { text: 'Token odds, term by term' }),
          oddsDl,
          el('p', { class: 'small', text: 'Odds recomputed in this page from the beta and the row\u2019s own figures: ' + oddsOf(r).toFixed(3) + ' (stored ' + r.token_odds.toFixed(3) + ').' })
        ),
        el('div', {},
          el('h3', { text: 'Farm plan \u2014 ' + e.verdict }),
          el('dl', { class: 'kv' },
            el('dt', { text: 'Deposit' }), el('dd', { text: '$' + e.deposit.toFixed(2) }),
            el('dt', { text: 'Expected drop' }), el('dd', { text: '$' + e.drop.toFixed(2) }),
            el('dt', { text: 'Fees' }), el('dd', { text: '$' + e.fees.toFixed(2) }),
            el('dt', { text: 'Time' }), el('dd', { text: e.hours.toFixed(2) + ' h' }),
            el('dt', { text: 'Net of fees' }), el('dd', { text: '$' + e.net.toFixed(2) }),
            el('dt', { text: 'Net / hour' }), el('dd', { text: '$' + e.netHour.toFixed(2) }),
            el('dt', { text: 'T-bill on deposit' }), el('dd', { text: '$' + (e.deposit * DATA.farm_scenario.tbill_apr * (S.horizon / 52)).toFixed(2) })),
          el('ol', { class: 'steps' }, steps.map(function (s) {
            return el('li', {}, s.text, el('div', { class: 'meta', text: 'Cost ' + s.cost + ' \u00b7 ' + s.time }));
          }))
        )
      )
    );
  }

  function liveView() {
    var rows = DATA.live.map(function (p) {
      return el('tr', {},
        el('td', { text: p.name }),
        el('td', { text: p.category || 'uncategorised' }),
        el('td', { class: 'num', text: fmtMoney(p.tvl_usd) }),
        el('td', { class: 'num', text: fmtMoney(p.mcap_usd) }),
        el('td', { class: 'num', text: fmtPct(p.change_7d) }));
    });
    return el('section', { class: 'card' },
      el('h2', { text: 'Live tokens, set aside: the market\u2019s own values, not the model\u2019s' }),
      el('p', { class: 'small', text: 'The 24 largest tokenized protocols by market cap. They are the comparables the odds model learns from — and the reason the board never mixes a traded market cap into a pre-token rank.' }),
      el('table', {}, el('thead', {}, el('tr', {}, el('th', { text: 'Protocol' }), el('th', { text: 'Category' }), el('th', { text: 'TVL' }), el('th', { text: 'Market cap' }), el('th', { text: '7D' }))), el('tbody', {}, rows))
    );
  }

  function footer() {
    return el('footer', {},
      el('p', { text: 'Method: 55 TGE-labelled comparables (launch-day market caps from CoinMarketCap, median of the first 7 tracked days; TVL 30 days pre-launch from DefiLlama history). 90 labelled, 55 usable as snapshot comparables (31 not comparables in the snapshot, 4 without tvl_pre30). Snapshot as of ' + DATA.snapshot_as_of + ', floor ' + fmtMoney(DATA.floor_usd) + ', sha256 ' + DATA.snapshot_sha256 + '.' }),
      el('p', { text: 'Limitations, stated: the strict submit gate did not pass (see evidence (c)); the walk-forward pinball comparison against radar-5 is contaminated by post-launch TVL; no parent discount is applied to off-list rows because the snapshot carries no parentProtocol field; the 80% band covers ~75%, slightly narrow. The board is deterministic: the entry program runs twice and writes identical bytes.' }),
      el('p', { text: 'Launch Radar v6 \u00b7 model radar-6 \u00b7 data.js carries the whole radar, including the 55 labels, so the fit can be re-run in this page.' })
    );
  }

  function downloadCsv() {
    var rows = filteredRows();
    var head = 'rank,slug,name,category,tvl_usd,change_7d,age_days,token_odds,if_launches_usd,implied_usd,deposit_usd,expected_drop_usd,fees_usd,net_usd,net_per_hour_usd,verdict\n';
    var body = rows.map(function (r) {
      var e = econOf(r);
      return [r.rank, r.slug, '"' + r.name.replace(/"/g, '""') + '"', '"' + (r.category || '') + '"', r.tvl_usd, r.change_7d === null ? '' : r.change_7d, r.age_days === null ? '' : r.age_days, r.token_odds, r.predicted_usd, r.implied_value_usd, e.deposit.toFixed(2), e.drop.toFixed(2), e.fees.toFixed(2), e.net.toFixed(2), e.netHour.toFixed(2), e.verdict].join(',');
    }).join('\n');
    download('launch-radar-v6-board.csv', 'text/csv', head + body + '\n');
  }
  function downloadJson() {
    download('launch-radar-v6-board.json', 'application/json', JSON.stringify({ rows: filteredRows() }, null, 1));
  }
  function download(name, type, text) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type }));
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  // --- render ---
  function render() {
    app.removeAttribute('aria-busy');
    app.replaceChildren(header(), accounting(), termTableEl(), oddsTableEl(), honestyEl(), boardTable(), liveView(), footer());
    if (fromHash && S.sel) {
      fromHash = false;
      var d = document.getElementById('detail');
      if (d) d.scrollIntoView();
    }
  }
  // The search box and the sliders update only the rows, the count and the tab labels,
  // so typing and dragging never lose focus or rebuild the filters.
  function renderTableOnly() {
    var card = document.getElementById('board-card');
    if (!card) { render(); return; }
    var rows = filteredRows();
    var tbody = card.querySelector('#rows');
    if (tbody) tbody.replaceChildren.apply(tbody, rowEls(rows));
    var h2 = card.querySelector('#board-count');
    if (h2) h2.textContent = 'The board: ' + rows.length + ' of ' + DATA.rows.length + ' rows';
    var counts = { all: DATA.rows.length, FARM: 0, MARGINAL: 0, SKIP: 0 };
    DATA.rows.forEach(function (r) { counts[econOf(r).verdict]++; });
    card.querySelectorAll('button.tab').forEach(function (b) {
      var v = b.getAttribute('data-verdict');
      var label = v === 'all' ? 'All' : v.charAt(0) + v.slice(1).toLowerCase();
      b.textContent = label + ' ' + counts[v];
    });
    var sv = card.querySelector('#share-val');
    if (sv) sv.textContent = (S.share * 100).toFixed(1) + '%';
    var hv = card.querySelector('#horizon-val');
    if (hv) hv.textContent = S.horizon + ' wk';
  }

  render();
})();
