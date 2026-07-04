'use strict';
// teh pack-github: pre-publication scan. Verifies the repo carries no secrets and
// no personal-environment traces, lists local-only files to exclude, and prints
// the export command. Never publishes anything itself.
const fs = require('fs');
const path = require('path');
const P = require('./paths');
const F = require('./fsutil');

// Local-only files: work ledgers and localized personal-profile blocks may name
// people/paths; they stay out of the public artifact.
const EXCLUDE_PATTERNS = [
  /^docs[\\/]WORKPLAN_.*\.md$/,
  /^docs[\\/]HANDOFF\.md$/,
  /^\.git[\\/]/,
  /^node_modules[\\/]/,
];

// Secret shapes. Key-ish assignments require a long quoted value so that
// documentation mentioning the words stays clean.
const SECRET_RULES = [
  { name: 'github-token', re: /gh[pousr]_[A-Za-z0-9]{20,}/ },
  { name: 'github-pat', re: /github_pat_[A-Za-z0-9_]{20,}/ },
  { name: 'aws-key-id', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'private-key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'slack-token', re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'key-assignment', re: /(api[_-]?key|secret|password|token)["']?\s*[:=]\s*["'][A-Za-z0-9+\/_\-]{16,}["']/i },
];

// Personal-environment traces (this machine). Patterns are built from string
// fragments + \uXXXX escapes so (a) this file stays ASCII-only (encoding-guard
// convention) and (b) the patterns never match their own source.
// gdrive-dir = the local GDrive folder's Japanese name; owner-name = the
// owner's family name in kanji plus the romanized given name.
const TRACE_RULES = [
  { name: 'windows-user-path', re: new RegExp('Users[\\\\/]+' + 'PC' + '_User') },
  { name: 'gdrive-dir', re: new RegExp('\u30de\u30a4\u30c9\u30e9\u30a4\u30d6') },
  { name: 'owner-name', re: new RegExp('\u6c60\u7530|' + 'shou' + 'ichi', 'i') },
];

function excluded(rel) {
  return EXCLUDE_PATTERNS.some((re) => re.test(rel));
}

function scan() {
  const root = P.REPO_ROOT;
  const violations = [];
  const excludedFiles = [];
  for (const f of F.listFilesRecursive(root)) {
    const rel = path.relative(root, f);
    if (excluded(rel)) {
      if (!rel.startsWith('.git') && !rel.startsWith('node_modules')) excludedFiles.push(rel);
      continue;
    }
    let text;
    try { text = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
    const lines = text.split(/\r?\n/);
    for (const rule of [...SECRET_RULES, ...TRACE_RULES]) {
      for (let i = 0; i < lines.length; i += 1) {
        if (rule.re.test(lines[i])) {
          violations.push({ file: rel, line: i + 1, rule: rule.name });
        }
      }
    }
  }
  return { violations, excludedFiles };
}

function run() {
  const { violations, excludedFiles } = scan();
  const L = [];
  L.push('pack-github scan of ' + P.REPO_ROOT);
  L.push('excluded from publication (' + excludedFiles.length + '): '
    + (excludedFiles.join(', ') || 'none'));
  if (violations.length) {
    L.push('VIOLATIONS (' + violations.length + '):');
    for (const v of violations.slice(0, 30)) L.push('  ' + v.file + ':' + v.line + '  [' + v.rule + ']');
    if (violations.length > 30) L.push('  ... ' + (violations.length - 30) + ' more');
    L.push('fix or exclude these before publishing.');
    process.exitCode = 1;
  } else {
    L.push('scan: CLEAN (no secrets, no personal traces outside excluded files)');
    L.push('export example (run manually after user approval):');
    L.push('  git archive --format=zip -o dist/teh.zip HEAD '
      + excludedFiles.map((f) => '":(exclude)' + f.replace(/\\/g, '/') + '"').join(' '));
    L.push('publishing itself (repo creation / push) stays a human decision.');
  }
  console.log(L.join('\n'));
}

module.exports = { run, scan, SECRET_RULES, TRACE_RULES };
