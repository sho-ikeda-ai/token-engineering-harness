#!/usr/bin/env node
'use strict';
// TEH PostToolUse meter: accumulates per-session output/read/edit counters.
// Observation only - never blocks, never prints, always exits 0.
const lib = require('./lib');

function byteLen(x) {
  if (x == null) return 0;
  const s = typeof x === 'string' ? x : JSON.stringify(x);
  return Buffer.byteLength(s, 'utf8');
}

try {
  const data = lib.parseJson(lib.readStdinSync());
  const sid = data && (data.session_id || data.sessionId);
  if (sid) {
    const st = lib.loadState(sid);
    const tool = data.tool_name || data.toolName || '';
    if (tool === 'Bash') {
      st.bashCalls += 1;
      const out = byteLen(data.tool_response || data.toolResponse);
      st.commandOutputBytes += out;
      if (out > st.maxSingleOutputBytes) st.maxSingleOutputBytes = out;
    } else if (tool === 'Read') {
      st.filesRead += 1;
    } else if (tool === 'Edit' || tool === 'Write') {
      st.edits += 1;
    } else if (tool === 'Agent' || tool === 'Task') {
      st.subagents += 1;
    }
    lib.saveState(sid, st);
  }
} catch (e) { /* fail-open */ }
process.exit(0);
