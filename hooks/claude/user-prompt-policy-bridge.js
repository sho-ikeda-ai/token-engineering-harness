#!/usr/bin/env node
'use strict';
// TEH UserPromptSubmit bridge: injects a ONE-TIME policy line per session so the
// token policy reaches sessions that started before the global instruction files
// carried the TEH block (and any session predating an upgrade). Later prompts in
// the same session stay silent (flag file; swept with stale state after ~6h, so
// very long sessions get at most an occasional reminder). Fail-open, ASCII only.
const fs = require('fs');
const path = require('path');
const lib = require('./lib');

const POLICY = '[TEH policy] Delegate implementation work to the '
  + 'implementation-worker-sonnet subagent (write a short task spec first); use '
  + 'codebase-scout-cheap for searches; keep reports <=15 lines with numbers + '
  + 'evidence paths; never paste full logs/diffs; max ONE short sentence before '
  + 'a tool call (no step narration); no unsolicited tips or supplements - '
  + 'deliver the thing, not the manual. Savings never apply to '
  + 'security/DB/auth/billing/audit/prod/data-loss work - top model + full '
  + 'verification there. An explicit user model/effort instruction always wins. '
  + 'Details: ~/.claude/skills/model-effort-router/SKILL.md';

try {
  const data = lib.parseJson(lib.readStdinSync());
  const sid = data && (data.session_id || data.sessionId);
  if (sid) {
    lib.ensureDirs();
    const flag = path.join(lib.STATE_DIR,
      'bridge-' + String(sid).replace(/[^a-zA-Z0-9_-]/g, '_') + '.flag');
    if (!fs.existsSync(flag)) {
      fs.writeFileSync(flag, new Date().toISOString());
      process.stdout.write(POLICY + '\n');
    }
  }
} catch (e) { /* fail-open */ }
process.exit(0);
