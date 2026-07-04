'use strict';
// teh status: live session counters + recent ledger tail + guard state. Read-only.
const fs = require('fs');
const path = require('path');
const P = require('./paths');
const F = require('./fsutil');

function fmtBytes(n) {
  if (n >= 1048576) return (n / 1048576).toFixed(1) + 'MB';
  if (n >= 1024) return (n / 1024).toFixed(1) + 'KB';
  return n + 'B';
}

function run() {
  const rows = [];
  const cfg = F.readJson(P.configPath(), {});
  rows.push('command guard: ' + (cfg.commandGuard === true ? 'ON' : 'off'));

  const now = Date.now();
  if (fs.existsSync(P.stateDir())) {
    const live = [];
    for (const f of fs.readdirSync(P.stateDir())) {
      const p = path.join(P.stateDir(), f);
      try {
        if (now - fs.statSync(p).mtimeMs < 6 * 3600 * 1000) {
          const st = F.readJson(p, null);
          if (st) {
            live.push('  ' + f.replace(/^session-|\.json$/g, '').slice(0, 12)
              + ': bash=' + st.bashCalls + ' out=' + fmtBytes(st.commandOutputBytes)
              + ' (max ' + fmtBytes(st.maxSingleOutputBytes) + ') reads=' + st.filesRead
              + ' edits=' + st.edits + ' subagents=' + st.subagents);
          }
        }
      } catch (e) { /* skip */ }
    }
    rows.push('active sessions (<6h): ' + (live.length || 'none'));
    rows.push(...live);
  } else {
    rows.push('active sessions: state dir not created yet (hooks not installed or never fired)');
  }

  const ym = new Date().toISOString().slice(0, 7);
  const lf = path.join(P.ledgerDir(), ym + '.jsonl');
  if (fs.existsSync(lf)) {
    const lines = fs.readFileSync(lf, 'utf8').trim().split('\n');
    rows.push('ledger ' + ym + ': ' + lines.length + ' records; last:');
    for (const line of lines.slice(-3)) {
      const r = parseLine(line);
      if (r) {
        rows.push('  ' + (r.ts || '').slice(5, 16) + ' ' + (r.surface || '?')
          + ' ' + (r.project || '-') + ' out=' + fmtBytes(r.commandOutputBytes || 0)
          + ' reads=' + (r.filesRead || 0) + (r.recovered ? ' (recovered)' : ''));
      }
    }
  } else {
    rows.push('ledger ' + ym + ': no records yet');
  }
  console.log(rows.join('\n'));
}

function parseLine(line) {
  try { return JSON.parse(line); } catch (e) { return null; }
}

module.exports = { run };
