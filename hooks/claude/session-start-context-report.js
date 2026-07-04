#!/usr/bin/env node
'use strict';
// TEH SessionStart hook. Two duties:
// 1) sweep stale session-state files (dead sessions) into the ledger, so no
//    counters are lost when SessionEnd never fired;
// 2) check always-loaded file budgets and print ONE line only when over budget.
//    A token-saving tool must not tax every session start with output, so the
//    healthy path prints nothing. Always exits 0.
const fs = require('fs');
const os = require('os');
const path = require('path');
const lib = require('./lib');

const STALE_MS = 6 * 3600 * 1000; // >6h without updates = dead session

try {
  if (fs.existsSync(lib.STATE_DIR)) {
    const now = Date.now();
    for (const f of fs.readdirSync(lib.STATE_DIR)) {
      const p = path.join(lib.STATE_DIR, f);
      try {
        if (now - fs.statSync(p).mtimeMs > STALE_MS) {
          const st = lib.parseJson(lib.safeRead(p));
          if (st) {
            lib.appendLedger(Object.assign(
              { ts: new Date().toISOString(), kind: 'session', surface: 'claude-code', recovered: true },
              st
            ));
          }
          fs.unlinkSync(p);
        }
      } catch (e) { /* skip one, keep sweeping */ }
    }
  }

  const budget = lib.loadConfig().globalLineBudget || 200;
  const targets = [
    path.join(os.homedir(), '.claude', 'CLAUDE.md'),
    path.join(os.homedir(), '.codex', 'AGENTS.md'),
  ];
  const over = [];
  for (const t of targets) {
    try {
      const real = fs.realpathSync(t); // follow symlinked instruction files
      const lines = lib.safeRead(real).split('\n').length;
      if (lines > budget) over.push(path.basename(path.dirname(t)) + '/' + path.basename(t) + ' ' + lines + '/' + budget);
    } catch (e) { /* missing file is fine */ }
  }
  if (over.length) {
    process.stdout.write('[TEH] over line budget: ' + over.join(', ') + ' - run "teh audit-context" for trim candidates\n');
  }
} catch (e) { /* fail-open */ }
process.exit(0);
