'use strict';
// teh ledger: aggregate the JSONL proxy-metric records. Read-only.
const fs = require('fs');
const path = require('path');
const P = require('./paths');

function parseLine(l) { try { return JSON.parse(l); } catch (e) { return null; } }

function run(args) {
  const mi = args.indexOf('--month');
  const month = mi >= 0 ? args[mi + 1] : null;
  if (!fs.existsSync(P.ledgerDir())) { console.log('no ledger yet: ' + P.ledgerDir()); return; }
  const files = fs.readdirSync(P.ledgerDir())
    .filter((f) => f.endsWith('.jsonl'))
    .filter((f) => !month || f.startsWith(month));
  if (!files.length) { console.log('no ledger files' + (month ? ' for ' + month : '')); return; }

  const agg = {
    sessions: 0, recovered: 0, bashCalls: 0, outBytes: 0, maxOut: 0,
    filesRead: 0, edits: 0, subagents: 0, observations: {}, bySurface: {},
  };
  for (const f of files) {
    for (const line of fs.readFileSync(path.join(P.ledgerDir(), f), 'utf8').trim().split('\n')) {
      const r = parseLine(line);
      if (!r) continue;
      if (r.kind === 'session') {
        agg.sessions += 1;
        if (r.recovered) agg.recovered += 1;
        agg.bashCalls += r.bashCalls || 0;
        agg.outBytes += r.commandOutputBytes || 0;
        if ((r.maxSingleOutputBytes || 0) > agg.maxOut) agg.maxOut = r.maxSingleOutputBytes;
        agg.filesRead += r.filesRead || 0;
        agg.edits += r.edits || 0;
        agg.subagents += r.subagents || 0;
        const s = r.surface || '?';
        agg.bySurface[s] = (agg.bySurface[s] || 0) + 1;
      } else if (r.kind === 'observation') {
        const k = r.signal || 'other';
        agg.observations[k] = (agg.observations[k] || 0) + 1;
      }
    }
  }
  const mb = (n) => (n / 1048576).toFixed(2) + 'MB';
  const L = [];
  L.push('ledger ' + (month || files.map((f) => f.replace('.jsonl', '')).join(',')));
  L.push('sessions: ' + agg.sessions + ' (' + Object.entries(agg.bySurface)
    .map(([k, v]) => k + ':' + v).join(', ') + (agg.recovered ? ', recovered:' + agg.recovered : '') + ')');
  L.push('command output: total ' + mb(agg.outBytes) + ', max single ' + mb(agg.maxOut)
    + ', bash calls ' + agg.bashCalls);
  L.push('file reads: ' + agg.filesRead + '   edits: ' + agg.edits + '   subagent uses: ' + agg.subagents);
  if (agg.sessions) {
    L.push('per session avg: out ' + mb(agg.outBytes / agg.sessions)
      + ', reads ' + Math.round(agg.filesRead / agg.sessions)
      + ', edits ' + Math.round(agg.edits / agg.sessions));
  }
  const obs = Object.entries(agg.observations);
  if (obs.length) L.push('observations: ' + obs.map(([k, v]) => k + ':' + v).join(', '));
  console.log(L.join('\n'));
}

module.exports = { run };
