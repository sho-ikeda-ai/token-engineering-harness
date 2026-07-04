#!/usr/bin/env node
'use strict';
// TEH SessionEnd (Claude Code) / Stop (Codex, via --host codex) hook:
// writes one session record to the monthly ledger and clears the state file.
// Counters only - no message contents, no file contents. Always exits 0.
const fs = require('fs');
const path = require('path');
const lib = require('./lib');

try {
  const data = lib.parseJson(lib.readStdinSync()) || {};
  const host = lib.argHost(process.argv);
  const sid = data.session_id || data.sessionId
    || (host === 'codex' ? 'codex-' + new Date().toISOString().slice(0, 10) : null);
  if (sid) {
    const p = lib.statePath(sid);
    const st = lib.parseJson(lib.safeRead(p));
    if (st) {
      lib.appendLedger({
        ts: new Date().toISOString(),
        kind: 'session',
        surface: host,
        project: data.cwd ? path.basename(data.cwd) : null,
        sessionId: sid,
        startedAt: st.startedAt,
        bashCalls: st.bashCalls,
        commandOutputBytes: st.commandOutputBytes,
        maxSingleOutputBytes: st.maxSingleOutputBytes,
        filesRead: st.filesRead,
        edits: st.edits,
        subagents: st.subagents,
      });
      try { fs.unlinkSync(p); } catch (e) { /* already gone */ }
    }
  }
} catch (e) { /* fail-open */ }
process.exit(0);
