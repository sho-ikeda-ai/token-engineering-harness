#!/usr/bin/env node
'use strict';
// TEH PreToolUse command guard - OPT-IN. Inactive (exit 0, no read of tool input)
// unless ~/.token-engineering-harness/config.json contains {"commandGuard": true}.
// When active, denies a SHORT list of unambiguously wasteful commands with a
// cheaper alternative, using the local convention: stderr message + exit 2.
// Anything ambiguous passes. Guard bugs must never block work (fail-open).
const lib = require('./lib');

const RULES = [
  {
    re: /(^|[;&|]\s*)ls\s+-[a-zA-Z]*R[a-zA-Z]*(\s|$)/,
    why: 'ls -R walks the entire tree',
    use: "rg --files -g '<pattern>' | head -50",
  },
  {
    re: /(^|[;&|]\s*)git\s+diff\s*$/,
    why: 'unbounded full diff',
    use: 'git diff --stat   (then: git diff -U2 -- <path>)',
  },
  {
    re: /(^|[;&|]\s*)git\s+log\s*$/,
    why: 'unbounded git log',
    use: 'git log --oneline -20',
  },
  {
    re: /(^|[;&|]\s*)tree\b(?![^\n]*-L\s*\d)/,
    why: 'unbounded tree listing',
    use: 'tree -L 2   or   rg --files | head -50',
  },
  {
    re: /(^|[;&|]\s*)pytest\b[^\n]*\s-vv\b/,
    why: 'verbose test output floods context',
    use: 'pytest -q, spooled to a file, then show failures only',
  },
];

try {
  const cfg = lib.loadConfig();
  if (cfg.commandGuard === true) {
    const data = lib.parseJson(lib.readStdinSync());
    const cmd = (data && data.tool_name === 'Bash' && data.tool_input
      && typeof data.tool_input.command === 'string') ? data.tool_input.command : '';
    if (cmd) {
      for (const r of RULES) {
        if (r.re.test(cmd)) {
          process.stderr.write([
            '[TEH command guard] denied: ' + r.why + '.',
            'Use instead: ' + r.use,
            '(This guard is opt-in; disable via {"commandGuard": false} in ~/.token-engineering-harness/config.json)',
          ].join('\n') + '\n');
          process.exit(2);
        }
      }
    }
  }
} catch (e) { /* fail-open: never block on our own bugs */ }
process.exit(0);
