'use strict';
// Environment + installation health. Read-only. Reports drift between the repo
// (source of truth) and the deployed copies.
const fs = require('fs');
const path = require('path');
const P = require('./paths');
const F = require('./fsutil');
const I = require('./install');

function copyPairs(plan) {
  const pairs = [];
  for (const c of plan.copies) {
    const st = fs.existsSync(c.src) ? fs.statSync(c.src) : null;
    if (!st) continue;
    if (st.isDirectory()) {
      for (const f of F.listFilesRecursive(c.src)) {
        pairs.push([f, path.join(c.dstDir, path.relative(c.src, f))]);
      }
    } else {
      pairs.push([c.src, path.join(c.dstDir, path.basename(c.src))]);
    }
  }
  return pairs;
}

function run() {
  const rows = [];
  rows.push('node: ' + process.version);
  rows.push('repo: ' + P.REPO_ROOT);
  rows.push('claude dir: ' + (fs.existsSync(P.CLAUDE_DIR) ? 'ok' : 'MISSING') + '  ' + P.CLAUDE_DIR);
  rows.push('codex dir:  ' + (fs.existsSync(P.CODEX_DIR) ? 'ok' : 'missing (codex features skip)') + '  ' + P.CODEX_DIR);

  const manifest = F.readJson(P.manifestPath(), null);
  if (!manifest) {
    rows.push('install: NOT INSTALLED (run: teh install --dry-run)');
    console.log(rows.join('\n'));
    return;
  }
  rows.push('install: ' + manifest.installedAt + '  profile=' + manifest.profile
    + '  v' + manifest.version);

  // drift: repo vs deployed
  const plan = I.buildPlan(manifest.profile);
  let missing = 0; let drifted = 0;
  const driftList = [];
  for (const [src, dst] of copyPairs(plan)) {
    if (!fs.existsSync(dst)) { missing += 1; driftList.push('missing: ' + dst); continue; }
    if (F.sha256(src) !== F.sha256(dst)) { drifted += 1; driftList.push('drift:   ' + dst); }
  }
  rows.push('deployed files: ' + (missing === 0 && drifted === 0
    ? 'in sync with repo'
    : missing + ' missing, ' + drifted + ' drifted (fix: teh install)'));
  for (const d of driftList.slice(0, 10)) rows.push('  ' + d);
  if (driftList.length > 10) rows.push('  ... ' + (driftList.length - 10) + ' more');

  // marker blocks
  for (const f of manifest.markerEdits) {
    const ok = fs.existsSync(f) && F.hasMarkerBlock(fs.readFileSync(f, 'utf8'));
    rows.push('marker block: ' + (ok ? 'ok' : 'ABSENT') + '  ' + f);
  }

  // settings hooks
  const settings = F.readJson(manifest.settingsFile, null);
  if (settings && settings.hooks) {
    const events = [];
    for (const [ev, arr] of Object.entries(settings.hooks)) {
      if (Array.isArray(arr) && arr.some((en) =>
        JSON.stringify(en).replace(/\\\\/g, '/').toLowerCase()
          .includes(manifest.hookDir.replace(/\\/g, '/').toLowerCase()))) events.push(ev);
    }
    rows.push('settings hooks: ' + (events.length ? events.join(', ') : 'NONE REGISTERED'));
  } else {
    rows.push('settings hooks: settings.json missing or unparsable');
  }

  const cfg = F.readJson(P.configPath(), {});
  rows.push('command guard: ' + (cfg.commandGuard === true ? 'ON' : 'off (opt-in)'));
  const ledgers = fs.existsSync(P.ledgerDir())
    ? fs.readdirSync(P.ledgerDir()).filter((f) => f.endsWith('.jsonl')) : [];
  rows.push('ledger months: ' + (ledgers.length ? ledgers.join(', ') : 'none yet'));
  console.log(rows.join('\n'));
}

module.exports = { run, copyPairs };
