'use strict';
// End-to-end install/uninstall against a sandbox home. Runs bin/teh as a child
// process with CLAUDE_DIR/CODEX_DIR/TEH_HOME redirected, so nothing real is touched.
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TEH_BIN = path.join(__dirname, '..', 'bin', 'teh');

function sandbox(withTokenSaver) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teh-inst-'));
  const claude = path.join(root, 'claude');
  const codex = path.join(root, 'codex');
  fs.mkdirSync(path.join(claude, 'skills'), { recursive: true });
  fs.mkdirSync(codex, { recursive: true });
  fs.writeFileSync(path.join(claude, 'CLAUDE.md'), '# global rules\n\nexisting line\n');
  fs.writeFileSync(path.join(codex, 'AGENTS.md'), '# codex rules\n\nexisting line\n');
  fs.writeFileSync(path.join(claude, 'settings.json'), JSON.stringify({
    permissions: { deny: ['Bash(rm -rf *)'] },
    hooks: { Stop: [{ hooks: [{ type: 'command', command: 'node existing-stop.js' }] }] },
  }, null, 2));
  if (withTokenSaver) {
    fs.mkdirSync(path.join(claude, 'skills', 'token-saver'), { recursive: true });
    fs.writeFileSync(path.join(claude, 'skills', 'token-saver', 'SKILL.md'), '# ts\n');
  }
  return {
    root,
    claude,
    codex,
    env: Object.assign({}, process.env, {
      CLAUDE_DIR: claude,
      CODEX_DIR: codex,
      TEH_HOME: path.join(root, 'teh-home'),
    }),
  };
}

function teh(sb, ...args) {
  return spawnSync('node', [TEH_BIN, ...args], { env: sb.env, encoding: 'utf8' });
}

test('dry-run changes nothing', () => {
  const sb = sandbox(false);
  const before = fs.readFileSync(path.join(sb.claude, 'CLAUDE.md'), 'utf8');
  const r = teh(sb, 'install', '--dry-run');
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.ok(r.stdout.includes('dry-run'));
  assert.strictEqual(fs.readFileSync(path.join(sb.claude, 'CLAUDE.md'), 'utf8'), before);
  assert.ok(!fs.existsSync(path.join(sb.env.TEH_HOME, 'install-manifest.json')));
});

test('standalone install deploys 7 skills, blocks, hooks; uninstall restores', () => {
  const sb = sandbox(false);
  const r = teh(sb, 'install');
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.ok(r.stdout.includes('profile: standalone'));
  assert.ok(r.stdout.includes('verify: OK'));

  const skills = fs.readdirSync(path.join(sb.claude, 'skills')).filter((d) =>
    fs.existsSync(path.join(sb.claude, 'skills', d, 'SKILL.md')));
  assert.strictEqual(skills.length, 7, 'standalone deploys all 7 skills');

  const cm = fs.readFileSync(path.join(sb.claude, 'CLAUDE.md'), 'utf8');
  assert.ok(cm.includes('BEGIN TOKEN ENGINEERING HARNESS'));
  assert.ok(cm.includes('existing line'), 'pre-existing content preserved');

  const settings = JSON.parse(fs.readFileSync(path.join(sb.claude, 'settings.json'), 'utf8'));
  assert.ok(settings.hooks.PostToolUse && settings.hooks.SessionStart
    && settings.hooks.SessionEnd && settings.hooks.PreCompact && settings.hooks.PreToolUse);
  assert.strictEqual(settings.hooks.Stop.length, 1, 'existing Stop hook untouched');
  assert.deepStrictEqual(settings.permissions, { deny: ['Bash(rm -rf *)'] });

  assert.ok(fs.existsSync(path.join(sb.codex, 'agents', 'teh_worker.toml')));

  // reinstall is idempotent (no duplicate hook entries)
  const r2 = teh(sb, 'install');
  assert.strictEqual(r2.status, 0);
  const s2 = JSON.parse(fs.readFileSync(path.join(sb.claude, 'settings.json'), 'utf8'));
  assert.strictEqual(s2.hooks.PostToolUse.length, 1, 'no duplicates on reinstall');

  // uninstall
  const r3 = teh(sb, 'uninstall');
  assert.strictEqual(r3.status, 0, r3.stdout + r3.stderr);
  const cmAfter = fs.readFileSync(path.join(sb.claude, 'CLAUDE.md'), 'utf8');
  assert.ok(!cmAfter.includes('TOKEN ENGINEERING HARNESS'));
  assert.ok(cmAfter.includes('existing line'));
  const s3 = JSON.parse(fs.readFileSync(path.join(sb.claude, 'settings.json'), 'utf8'));
  assert.ok(!s3.hooks.PostToolUse, 'TEH hook events removed');
  assert.strictEqual(s3.hooks.Stop.length, 1, 'existing Stop hook survived uninstall');
  assert.ok(!fs.existsSync(path.join(sb.claude, 'skills', 'ponytail-lite')), 'skill dirs pruned');
  assert.ok(!fs.existsSync(path.join(sb.env.TEH_HOME, 'install-manifest.json')), 'manifest retired');
});

test('integrated profile skips shell-output-budget', () => {
  const sb = sandbox(true); // token-saver present
  const r = teh(sb, 'install');
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.ok(r.stdout.includes('profile: integrated'));
  assert.ok(!fs.existsSync(path.join(sb.claude, 'skills', 'shell-output-budget')),
    'shell-output-budget must not deploy when token-saver owns that ground');
  assert.ok(fs.existsSync(path.join(sb.claude, 'skills', 'model-effort-router')));
});

test('install aborts when the insert would break the line budget', () => {
  const sb = sandbox(false);
  fs.writeFileSync(path.join(sb.claude, 'CLAUDE.md'),
    Array.from({ length: 199 }, (_, i) => 'line ' + i).join('\n') + '\n');
  const r = teh(sb, 'install');
  assert.strictEqual(r.status, 1, 'must refuse');
  assert.ok(r.stdout.includes('ABORT'));
  const cm = fs.readFileSync(path.join(sb.claude, 'CLAUDE.md'), 'utf8');
  assert.ok(!cm.includes('TOKEN ENGINEERING HARNESS'), 'file untouched on abort');
});

test('uninstall without manifest is a safe no-op', () => {
  const sb = sandbox(false);
  const r = teh(sb, 'uninstall');
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.includes('not installed'));
});
