// Token Radar's dashboard, radar-5. It reads window.RADAR (written beside dashboard/ by
// main.ts) and window.VALIDATION (the blind test's predictions, written into dashboard/ by
// main.ts) and renders the ranked board, a filterable table, a per-protocol detail view with the
// model's own inputs and the protocol's farm plan. No network: every byte it shows is in data.js
// and validation.js. The page recomputes every row from the ridge coefficients data.js carries,
// so the board, the detail view and the model card are visibly the same arithmetic.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', minTvl: 0, tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }

  // The model in one function, mirroring lib/model.ts: the page recomputes a row from the
  // snapshot figures and the ridge coefficients data.js carries, and checks the number
  // board.json carries, so the page's code and the board's data are visibly the same
  // arithmetic. log10(implied) = intercept + slope_std x z(log10 TVL) + shift(category),
  // with the implied/TVL ratio clamped to the ridge's guard band.
  function ridgeOf(row, ridge) {
    var z = (row.log_tvl - ridge.mean_log_tvl) / ridge.sd_log_tvl;
    var logV = ridge.intercept + ridge.slope_std * z + (ridge.shifts[row.category || ''] || 0);
    var ratio = Math.pow(10, logV) / row.tvl_usd;
    var clamped = Math.min(ridge.ratio_max, Math.max(ridge.ratio_min, ratio));
    return Math.max(1, Math.round(row.tvl_usd * clamped));
  }
  function bandOf(row, ridge) {
    var z = 1.2815515655446004;
    var centre = Math.log10(ridgeOf(row, ridge));
    return { p10: Math.pow(10, centre - z * ridge.sigma_log), p90: Math.pow(10, centre + z * ridge.sigma_log) };
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL and
  // age decide the action, the capital, the hold, the gas and every cost and time. No name is
  // special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  // A protocol's chains as one readable line: the first four, then how many more there are.
  function chainList(row) {
    var chains = row.chains || [];
    if (chains.length === 0) return 'an unnamed chain';
    if (chains.length <= 4) return chains.join(', ');
    return chains.slice(0, 4).join(', ') + ' +' + (chains.length - 4);
  }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function gasFor(chain) {
    if (chain === 'Ethereum') return 'about $6 of gas';
    if (chain === 'Bitcoin') return 'about $2 of gas';
    return 'under $1 of gas';
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    if (c.indexOf('chain') >= 0) return 'Use $' + capital + ' on ' + name + "'s own chain: bridge in, then make one transaction a week in its app.";
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  // The weekly action, one per category family: the setup step puts the position on, this one
  // keeps it alive week after week, in the words of what the protocol actually does.
  function weeklyActionFor(p) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Top up the supply or take a small borrow on ' + name + ' once this week so the position stays active.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Add or remove a small amount of liquidity on ' + name + ' once this week so the position stays active.';
    if (c.indexOf('bridge') >= 0) return 'Bridge a small amount through ' + name + ' once this week so the route stays active.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Claim or restake the staking rewards on ' + name + ' once this week.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Open and close one small hedge on ' + name + ' once this week.';
    if (c.indexOf('prediction') >= 0) return 'Place one small market position on ' + name + ' once this week.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return "Check the " + name + " vault's performance once this week and leave the shares in place.";
    if (c.indexOf('stable') >= 0) return 'Mint or redeem a small amount of the stable asset through ' + name + ' once this week.';
    if (c.indexOf('rwa') >= 0) return 'Check the yield asset\'s accrual on ' + name + ' once this week and leave the position in place.';
    if (c.indexOf('insurance') >= 0) return 'Check the cover policy on ' + name + ' once this week and leave it in place.';
    if (c.indexOf('chain') >= 0) return "Make one transaction in " + name + "'s app once this week so the address stays active.";
    return 'Make one qualifying action on ' + name + ' once this week, such as a deposit, a swap or a vote.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var gas = gasFor(chain);
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and ' + gas, time: '15 minutes to set up' },
      { text: weeklyActionFor(p), cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: "Check the protocol's points or quest page every week and finish any task it lists; skip any link that asks you to pay to claim.", cost: 'no fee to check', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own rewards page from its official site and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('minTvl')) state.minTvl = parseInt(params.get('minTvl'), 10) || 0;
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.minTvl) params.set('minTvl', String(state.minTvl));
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).includes(state.chain)) return false;
      if (state.minTvl && r.tvl_usd < state.minTvl) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    var top = DATA.rows[0];
    var v = DATA.validation;
    var ridge = DATA.ridge;
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.board_size + ' pre-token protocols ranked by a fitted value model, tested blind' }),
        el('p', null,
          'The watchlist is the floor: every protocol with at least $', el('b', { text: Math.round(DATA.floor_usd / 1e6) + 'M' }),
          ' of TVL and no token on record. The early radar adds ', el('b', { text: String(DATA.early_size) }),
          ' pre-token protocols below that floor, plus ', el('b', { text: String(DATA.above_floor_size) }),
          ' above it that the watchlist leaves out, and the strongest of them all is ', el('b', { text: top ? top.name : '—' }),
          ' at ', el('b', { text: top ? fmtUsd(top.implied_value_usd) : '—' }),
          ' of implied value. The value is a fitted ridge, not a hand-set multiple — and the ridge was tested blind before it priced anything. Implied value is a model, not a promise.'
        )
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Protocols scanned / ranked' }), el('b', { text: DATA.scanned + ' / ' + DATA.board_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Ridge fitted on' }), el('b', { text: ridge.train_n + ' live-token comps' })),
        el('div', { class: 'fact' }, el('span', { text: 'Blind pinball, radar-5 (radar-4 ' + v.v2_blind.pinball.toFixed(3) + ')' }), el('b', { text: v.blind.pinball.toFixed(3) })),
        el('div', { class: 'fact' }, el('span', { text: 'Blind Spearman, radar-5 (radar-4 ' + v.v2_blind.spearman.toFixed(2) + ')' }), el('b', { text: v.blind.spearman.toFixed(2) })),
        el('div', { class: 'fact' }, el('span', { text: 'Blind R² (radar-4 ' + v.v2_blind.r2_log.toFixed(2) + ')' }), el('b', { text: v.blind.r2_log.toFixed(2) })),
        el('div', { class: 'fact' }, el('span', { text: '80% interval coverage' }), el('b', { text: Math.round(v.blind.coverage_80 * 100) + '% of ' + v.blind_scored_n + ' scored' })),
        el('div', { class: 'fact' }, el('span', { text: 'Leave-one-out pinball / Spearman' }), el('b', { text: v.loo.pinball.toFixed(3) + ' / ' + v.loo.spearman.toFixed(2) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var catSelect = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    catSelect.addEventListener('change', function () { state.category = catSelect.value; writeHash(); render(); });
    var chainSelect = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSelect.addEventListener('change', function () { state.chain = chainSelect.value; writeHash(); render(); });
    var tvlSelect = el('select', { id: 'minTvl', 'aria-label': 'Minimum TVL' },
      el('option', { value: '0', text: 'Any TVL' }),
      el('option', { value: '10000000', text: 'TVL $10M+', selected: state.minTvl === 10000000 ? 'selected' : null }),
      el('option', { value: '50000000', text: 'TVL $50M+', selected: state.minTvl === 50000000 ? 'selected' : null }),
      el('option', { value: '500000000', text: 'TVL $500M+', selected: state.minTvl === 500000000 ? 'selected' : null })
    );
    tvlSelect.addEventListener('change', function () { state.minTvl = parseInt(tvlSelect.value, 10) || 0; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), catSelect),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
      el('div', { class: 'field' }, el('label', { for: 'minTvl', text: 'TVL' }), tvlSelect),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.minTvl = 0; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var nameCell = el('div', { class: 'name' },
        el('span', null, el('b', { text: r.name }), r.is_watchlist ? el('span', { class: 'badge', text: 'Watchlist' }) : null),
        el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') + (r.chains && r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '') })
      );
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, nameCell),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) }),
          el('span', { class: 'band', text: '80% ' + fmtUsd(r.p10_usd) + '–' + fmtUsd(r.p90_usd) })
        )),
        el('td', null, el('span', { class: 'status', text: 'no token' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var ridge = DATA.ridge;
    var v = DATA.validation;
    var shifts = Object.keys(ridge.shifts).sort(function (a, b) {
      return ridge.shifts[b] - ridge.shifts[a] || (a < b ? -1 : a > b ? 1 : 0);
    }).map(function (c) {
      var sh = ridge.shifts[c];
      return el('div', null, el('span', { text: (c || 'No category') + ' · shrunk shift' }), el('b', { text: (sh >= 0 ? '+' : '') + sh.toFixed(3) }));
    });
    var top = DATA.rows[0];
    var worked = '';
    if (top) {
      var z = (top.log_tvl - ridge.mean_log_tvl) / ridge.sd_log_tvl;
      var sh = ridge.shifts[top.category || ''] || 0;
      var logV = ridge.intercept + ridge.slope_std * z + sh;
      worked = 'Worked example — ' + top.name + ' (rank 1): log10(TVL) = ' + top.log_tvl.toFixed(3) +
        ', z = (' + top.log_tvl.toFixed(3) + ' - ' + ridge.mean_log_tvl.toFixed(3) + ') / ' + ridge.sd_log_tvl.toFixed(3) +
        ' = ' + z.toFixed(2) + '; log10(implied) = ' + ridge.intercept.toFixed(3) + ' + ' + ridge.slope_std.toFixed(3) +
        ' x ' + z.toFixed(2) + ' + ' + sh.toFixed(3) + ' (' + (top.category || 'no category') + ' shift) = ' + logV.toFixed(3) +
        '; 10^' + logV.toFixed(3) + ' = ' + fmtUsd(Math.pow(10, logV)) + ' of raw value, ratio ' +
        (Math.pow(10, logV) / top.tvl_usd).toFixed(3) + ' of TVL, clamped to the guard band ' +
        ridge.ratio_min + '..' + ridge.ratio_max + ' gives ' + fmtUsd(top.implied_value_usd) +
        '. Recompute it from the snapshot figures above: the arithmetic is the model.';
    }
    var boot = v.bootstrap_loo;
    var gateLine = v.gate_passed
      ? 'Submit gate PASSED: both bootstrap intervals exclude zero on both splits.'
      : 'Submit gate NOT passed: the gain is real on every split (blind, leave-one-out, time split) but small next to sampling noise — the pinball interval on leave-one-out is [' + boot.pinball_ci_low.toFixed(3) + ', ' + boot.pinball_ci_high.toFixed(3) + '] and the Spearman interval is [' + boot.spearman_ci_low.toFixed(3) + ', ' + boot.spearman_ci_high.toFixed(3) + ']. Reported as measured, not as a win.';
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'One fitted function of the snapshot figures scores every row. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'log10(implied) = ' + ridge.intercept.toFixed(3) + ' + ' + ridge.slope_std.toFixed(3) + ' x z(log10 TVL) + shift(category)\n' +
        'z(log10 TVL)   = (log10(tvl_usd) - ' + ridge.mean_log_tvl.toFixed(3) + ') / ' + ridge.sd_log_tvl.toFixed(3) + ' (train mean and sd)\n' +
        'shift          = one ridge-shrunk offset per category (slope penalty ' + ridge.lambda + ', shift penalty ' + ridge.lambda_cat + '), fitted on ' + ridge.train_n + ' tokenized comparables\n' +
        'implied        = 10^log10(implied), with implied / TVL clamped to ' + ridge.ratio_min + '..' + ridge.ratio_max + ' (guard band)\n' +
        '80% band       = implied x 10^(+/-1.28 x ' + ridge.sigma_log.toFixed(3) + '), the train residual spread in log10 units\n' +
        'raw slope      = ' + ridge.slope_log_tvl.toFixed(3) + ' log10(market cap) per log10(TVL): a 10x bigger protocol is worth about ' + Math.pow(10, ridge.slope_log_tvl).toFixed(1) + 'x more, not 10x'
      ),
      el('div', { class: 'weights' }, shifts),
      el('p', { class: 'sub', text: worked }),
      el('h3', { text: 'Validation: radar-5 against radar-4, computed by this program on the same splits' }),
      el('div', { class: 'table-wrap' },
        el('table', { class: 'valid' },
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Split' }), el('th', { scope: 'col', text: 'Pinball radar-5' }), el('th', { scope: 'col', text: 'Pinball radar-4' }),
            el('th', { scope: 'col', text: 'Spearman radar-5' }), el('th', { scope: 'col', text: 'Spearman radar-4' }), el('th', { scope: 'col', text: 'R² radar-5' })
          )),
          el('tbody', null,
            el('tr', null, el('td', { text: 'Blind (' + v.blind_scored_n + ' scored)' }), el('td', { class: 'num', text: v.blind.pinball.toFixed(4) }), el('td', { class: 'num', text: v.v2_blind.pinball.toFixed(4) }), el('td', { class: 'num', text: v.blind.spearman.toFixed(3) }), el('td', { class: 'num', text: v.v2_blind.spearman.toFixed(3) }), el('td', { class: 'num', text: v.blind.r2_log.toFixed(2) })),
            el('tr', null, el('td', { text: 'Leave-one-out (' + v.loo.n + ')' }), el('td', { class: 'num', text: v.loo.pinball.toFixed(4) }), el('td', { class: 'num', text: v.v2_loo.pinball.toFixed(4) }), el('td', { class: 'num', text: v.loo.spearman.toFixed(3) }), el('td', { class: 'num', text: v.v2_loo.spearman.toFixed(3) }), el('td', { class: 'num', text: v.loo.r2_log.toFixed(2) })),
            el('tr', null, el('td', { text: 'Time split, listed after ' + v.time_split.cutoff + ' (' + v.time_split.test_n + ' test)' }), el('td', { class: 'num', text: v.time_split.v3.pinball.toFixed(4) }), el('td', { class: 'num', text: v.time_split.v2.pinball.toFixed(4) }), el('td', { class: 'num', text: v.time_split.v3.spearman.toFixed(3) }), el('td', { class: 'num', text: v.time_split.v2.spearman.toFixed(3) }), el('td', { class: 'num', text: v.time_split.v3.r2_log.toFixed(2) })),
            el('tr', null, el('td', { text: 'Median-multiple baseline (blind)' }), el('td', { class: 'num', text: v.baseline.pinball.toFixed(4) }), el('td', { class: 'num', text: '—' }), el('td', { class: 'num', text: v.baseline.spearman.toFixed(3) }), el('td', { class: 'num', text: '—' }), el('td', { class: 'num', text: v.baseline.r2_log.toFixed(2) }))
          )
        )
      ),
      el('p', { class: 'sub', text: 'Paired bootstrap, ' + v.bootstrap_blind.b.toLocaleString('en-US') + ' resamples, blind set: pinball delta ' + v.bootstrap_blind.pinball_delta.toFixed(4) + ' [' + v.bootstrap_blind.pinball_ci_low.toFixed(3) + ', ' + v.bootstrap_blind.pinball_ci_high.toFixed(3) + '], Spearman delta ' + v.bootstrap_blind.spearman_delta.toFixed(3) + ' [' + v.bootstrap_blind.spearman_ci_low.toFixed(3) + ', ' + v.bootstrap_blind.spearman_ci_high.toFixed(3) + ']. Leave-one-out: pinball delta ' + boot.pinball_delta.toFixed(4) + ' [' + boot.pinball_ci_low.toFixed(3) + ', ' + boot.pinball_ci_high.toFixed(3) + '], Spearman delta ' + boot.spearman_delta.toFixed(3) + ' [' + boot.spearman_ci_low.toFixed(3) + ', ' + boot.spearman_ci_high.toFixed(3) + ']. ' + gateLine }),
      el('p', { class: 'sub', text: 'What was tried and rejected on leave-one-out, so the model is not a survivor of silent tuning: adding age, chain count, weekly growth or a squared TVL term (pinball 0.216–0.224, Spearman 0.19–0.31 vs 0.216 / 0.31 for the chosen ridge); a LightGBM/HistGB quantile model, alpha 0.6 (blind pinball 0.226–0.236, worse than radar-4); a heteroscedastic spread (pinball 0.221, coverage 0.71); recency weights on listed_at (no change). Re-labelling comparables to TGE-day market cap was not done: the blind set scores against current market cap, so a TGE label would optimise a different distribution and could not be honestly validated here. The blind set is the same 33 tokenized protocols radar-4 was scored on (seed ' + v.blind_seed + '), and every hyperparameter was chosen on leave-one-out, never on the blind set.' }),
      el('p', { class: 'sub', text: 'TVL, seven-day growth and age come from the snapshot. Age is the time since the protocol was first listed, the best record of how long it has run with no token — shown for context, not used by the ridge, because it did not help on leave-one-out. Bridged, wrapped and staked products are set aside with the live tokens: their token already trades in another form. The early radar is every rankable pre-token protocol below the watchlist floor.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function whyLine(row) {
    var parts = [];
    if (row.category_shift > 0.02) parts.push('in a category whose live tokens trade above the market (' + (row.category_shift >= 0 ? '+' : '') + row.category_shift.toFixed(2) + ' in log10)');
    else if (row.category_shift < -0.02) parts.push('in a category whose live tokens trade below the market (' + row.category_shift.toFixed(2) + ' in log10)');
    if (row.change_7d !== null && row.change_7d >= 20) parts.push('growing fast at ' + fmtPct(row.change_7d) + ' in seven days, though growth is not in the model — it is shown so the reader can weigh it');
    else if (row.change_7d !== null && row.change_7d <= -20) parts.push('shrinking ' + fmtPct(row.change_7d) + ' in seven days, though shrinkage is not in the model');
    if (row.age_days !== null && row.age_days >= 365 && row.age_days <= 1095) parts.push('proven for ' + fmtAge(row.age_days) + ' with no token yet');
    else if (row.age_days !== null && row.age_days < 90) parts.push('listed only ' + fmtAge(row.age_days) + ' ago');
    if (row.chains && row.chains.length >= 5) parts.push('live on ' + row.chains.length + ' chains');
    if (parts.length === 0) parts.push('its size carries the ranking: ' + fmtUsd(row.tvl_usd) + ' of TVL with no token on record');
    return parts.join('; ') + '.';
  }

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var recomputed = ridgeOf(row, DATA.ridge);
    var band = bandOf(row, DATA.ridge);
    var shift = DATA.ridge.shifts[row.category || ''] || 0;
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.is_watchlist ? '  ·  Watchlist' : '') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + chainList(row) })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'log10(TVL)' }), el('b', { class: 'num', text: row.log_tvl.toFixed(3) })),
        el('div', null, el('span', { text: 'Seven-day growth (shown, not modelled)' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Chains' }), el('b', { class: 'num', text: String((row.chains || []).length) })),
        el('div', null, el('span', { text: 'Category shift' }), el('b', { class: 'num', text: (shift >= 0 ? '+' : '') + shift.toFixed(3) })),
        el('div', null, el('span', { text: 'Implied multiple' }), el('b', { class: 'num', text: 'x' + row.curve_multiple.toFixed(3) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) })),
        el('div', null, el('span', { text: '80% band' }), el('b', { class: 'num', text: fmtUsd(row.p10_usd) + ' – ' + fmtUsd(row.p90_usd) }))
      ),
      el('p', { class: 'sub', text: 'log10(implied) = ' + DATA.ridge.intercept.toFixed(3) + ' + ' + DATA.ridge.slope_std.toFixed(3) + ' x (' + row.log_tvl.toFixed(3) + ' - ' + DATA.ridge.mean_log_tvl.toFixed(3) + ') / ' + DATA.ridge.sd_log_tvl.toFixed(3) + ' + ' + shift.toFixed(3) + ' = ' + (DATA.ridge.intercept + DATA.ridge.slope_std * (row.log_tvl - DATA.ridge.mean_log_tvl) / DATA.ridge.sd_log_tvl + shift).toFixed(3) + ' raw (' + fmtUsd(Math.pow(10, DATA.ridge.intercept + DATA.ridge.slope_std * (row.log_tvl - DATA.ridge.mean_log_tvl) / DATA.ridge.sd_log_tvl + shift)) + ', ratio ' + (Math.pow(10, DATA.ridge.intercept + DATA.ridge.slope_std * (row.log_tvl - DATA.ridge.mean_log_tvl) / DATA.ridge.sd_log_tvl + shift) / row.tvl_usd).toFixed(3) + ' of TVL); the guard band ' + DATA.ridge.ratio_min + '..' + DATA.ridge.ratio_max + ' gives ' + fmtUsd(row.implied_value_usd) + '. The band is wide because the train residual spread is ' + DATA.ridge.sigma_log.toFixed(2) + ' in log10 units: this model ranks, it does not price to the dollar.' }),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Why this rank' }),
      el('p', { class: 'why' }, el('b', { text: row.name + ' ranks ' + row.rank + ' because ' }), whyLine(row))
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
