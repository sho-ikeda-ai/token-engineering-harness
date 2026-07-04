'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HOOKS = path.join(__dirname, '..', 'hooks', 'claude');

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'teh-hooks-'));
}

function runHook(name, payload, tehHome, extraArgs) {
  return spawnSync('node', [path.join(HOOKS, name), ...(extraArgs || [])], {
    input: JSON.stringify(payload),
    env: Object.assign({}, process.env, { TEH_HOME: tehHome }),
    encoding: 'utf8',
  });
}

test('meter accumulates and end-writer flushes to ledger', () => {
  const tmp = mkTmp();
  let r = runHook('post-tool-meter.js', {
    session_id: 's1', tool_name: 'Bash', tool_response: { stdout: 'x'.repeat(100) },
  }, tmp);
  assert.strictEqual(r.status, 0);
  r = runHook('post-tool-meter.js', { session_id: 's1', tool_name: 'Read' }, tmp);
  assert.strictEqual(r.status, 0);

  const stateFile = path.join(tmp, 'state', 'session-s1.json');
  const st = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  assert.strictEqual(st.bashCalls, 1);
  assert.strictEqual(st.filesRead, 1);
  assert.ok(st.commandOutputBytes > 100);

  r = runHook('session-end-ledger-writer.js', { session_id: 's1', cwd: '/tmp/projX' }, tmp);
  assert.strictEqual(r.status, 0);
  assert.ok(!fs.existsSync(stateFile), 'state cleared after flush');
  const ledgerDir = path.join(tmp, 'ledger');
  const files = fs.readdirSync(ledgerDir);
  assert.strictEqual(files.length, 1);
  const rec = JSON.parse(fs.readFileSync(path.join(ledgerDir, files[0]), 'utf8').trim());
  assert.strictEqual(rec.kind, 'session');
  assert.strictEqual(rec.project, 'projX');
  assert.strictEqual(rec.bashCalls, 1);
});

test('hooks are fail-open on garbage stdin', () => {
  const tmp = mkTmp();
  for (const h of ['post-tool-meter.js', 'session-end-ledger-writer.js',
    'session-start-context-report.js', 'pre-tool-command-guard.js']) {
    const r = spawnSync('node', [path.join(HOOKS, h)], {
      input: 'NOT JSON {{{',
      env: Object.assign({}, process.env, { TEH_HOME: tmp }),
      encoding: 'utf8',
    });
    assert.strictEqual(r.status, 0, h + ' must exit 0 on garbage');
  }
});

test('command guard: off by default, denies only when opted in', () => {
  const tmp = mkTmp();
  const payload = { tool_name: 'Bash', tool_input: { command: 'git diff' } };
  let r = runHook('pre-tool-command-guard.js', payload, tmp);
  assert.strictEqual(r.status, 0, 'guard must be inert without opt-in');

  fs.writeFileSync(path.join(tmp, 'config.json'), '{"commandGuard": true}');
  r = runHook('pre-tool-command-guard.js', payload, tmp);
  assert.strictEqual(r.status, 2, 'unbounded git diff denied when opted in');
  assert.ok(r.stderr.includes('git diff --stat'), 'suggests the alternative');

  r = runHook('pre-tool-command-guard.js',
    { tool_name: 'Bash', tool_input: { command: 'git diff --stat' } }, tmp);
  assert.strictEqual(r.status, 0, 'bounded variant passes');

  r = runHook('pre-tool-command-guard.js',
    { tool_name: 'Bash', tool_input: { command: 'ls -laR .' } }, tmp);
  assert.strictEqual(r.status, 2, 'recursive ls denied');

  r = runHook('pre-tool-command-guard.js',
    { tool_name: 'Bash', tool_input: { command: 'ls -la' } }, tmp);
  assert.strictEqual(r.status, 0, 'plain ls passes');
});

test('session-start: silent when healthy, sweeps stale state', () => {
  const tmp = mkTmp();
  // plant a stale state file (mtime 7h ago)
  const stateDir = path.join(tmp, 'state');
  fs.mkdirSync(stateDir, { recursive: true });
  const stale = path.join(stateDir, 'session-old.json');
  fs.writeFileSync(stale, JSON.stringify({ schema: 1, bashCalls: 3, commandOutputBytes: 9, maxSingleOutputBytes: 9, filesRead: 1, edits: 0, subagents: 0, startedAt: 'x' }));
  const old = new Date(Date.now() - 7 * 3600 * 1000);
  fs.utimesSync(stale, old, old);

  const r = runHook('session-start-context-report.js', {}, tmp);
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout.trim(), '', 'healthy env prints nothing');
  assert.ok(!fs.existsSync(stale), 'stale state swept');
  const files = fs.readdirSync(path.join(tmp, 'ledger'));
  assert.strictEqual(files.length, 1, 'stale counters recovered into ledger');
  const rec = JSON.parse(fs.readFileSync(path.join(tmp, 'ledger', files[0]), 'utf8').trim());
  assert.strictEqual(rec.recovered, true);
});

test('pre-compact prints the summary structure', () => {
  const r = spawnSync('node', [path.join(HOOKS, 'pre-compact-template.js')], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.includes('Do-not-carry-forward'));
});
