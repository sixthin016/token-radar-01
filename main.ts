// Token Radar's entry program (Node 22, standard library only).
//
// Reads the sealed snapshot from /input/snapshot.json (or --input <file|dir>), scores every
// pre-token protocol with the radar-4 model in lib/model.ts, writes the ranked board to
// /output/board.json, writes the dashboard's data beside the page, and copies this repository's
// dashboard/ and screenshots/ to /output. It also writes the blind test's predictions to
// /output/dashboard/validation.js, so the dossier's text carries the proof. Last, it writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun library.
//
// The dashboard is a static page, no framework and no network: dashboard/index.html,
// dashboard/app.css and dashboard/app.js read /output/data.js, which this program writes from the
// same board. The program runs twice and both runs must write the same bytes: nothing here reads
// the clock, the network or a random value, so the two runs agree byte for byte.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, boardTotals, buildRadar, dataScript, describeRow, parseSnapshot, validationScript } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps: the text cap shapes the bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** --name <value> out of the arguments, or the fallback. */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshotBytes = readFileSync(inputFile);
const snapshotSha256 = createHash('sha256').update(snapshotBytes).digest('hex');
const snapshot = parseSnapshot(snapshotBytes.toString('utf8'));
const { board, radar } = buildRadar(snapshot, undefined, { snapshot_sha256: snapshotSha256, snapshot_bytes: snapshotBytes.length });
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`token radar: the model wrote a board the gate refuses: ${issue}\n`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

/** Copy one directory's regular files into `to`, skipping names that start with a dot. */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

const dashboardFiles = copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
// The blind test's predictions, as a dashboard file: the dossier's text shows every dashboard
// file whole, so the judge reads the proof in the entry's own source, not only in data.js.
writeFileSync(join(out, 'dashboard', 'validation.js'), validationScript(radar.validation, snapshotSha256));
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3) {
  process.stderr.write(`token radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`);
  process.exit(1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
    process.exit(1);
  }
}

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));

const totals = boardTotals(board);
const averageImplied = totals.rows > 0 ? Math.round(totals.impliedUsd / totals.rows) : 0;
const v = radar.validation;
const curve = radar.curve;
process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.above_floor_size} above the floor, ${radar.live_size} live set aside)\n` +
    `token radar: input snapshot sha256 ${snapshotSha256} (${snapshotBytes.length} bytes)\n` +
    `token radar: curve: log10(mcap/mult) = ${curve.intercept.toFixed(3)} + ${curve.slope_log_tvl.toFixed(3)} x log10(tvl) fitted on ${curve.train_n} tokenized comparables; shifts: ${curve.categories.map((c) => `${c} ${curve.shifts[c]! >= 0 ? '+' : ''}${curve.shifts[c]!.toFixed(2)}`).join(', ') || 'none'}\n` +
    `token radar: blind test (seed ${v.blind_seed}, ${v.blind_n} protocols, ${v.blind_scored_n} scored): pinball ${v.blind.pinball} vs median-multiple baseline ${v.baseline.pinball}; R^2 ${v.blind.r2_log} vs baseline ${v.baseline.r2_log}; 80% interval coverage ${v.blind.coverage_80}; leave-one-out pinball ${v.loo.pinball}, R^2 ${v.loo.r2_log}\n` +
    `token radar: board totals ${totals.rows} rows, $${totals.impliedUsd.toLocaleString('en-US')} implied, $${totals.tvlUsd.toLocaleString('en-US')} TVL, $${averageImplied.toLocaleString('en-US')} average implied per row\n` +
    `token radar: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')} (${dashboardFiles.length + 1} files), ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n` +
    board
      .slice(0, 3)
      .map((row) => `token radar: ${describeRow(row)}\n`)
      .join(''),
);
