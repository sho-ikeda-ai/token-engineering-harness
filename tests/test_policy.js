'use strict';
// Policy invariants over the shipped artifacts: role separation (only the worker
// writes), frontmatter completeness, size budgets, marker-block presence.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function frontmatter(file) {
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(m, 'frontmatter missing in ' + file);
  const fm = {};
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) { key = kv[1]; fm[key] = kv[2]; } else if (key) { fm[key] += ' ' + line.trim(); }
  }
  return fm;
}

const SKILLS = ['model-effort-router', 'report-budget-controller', 'delegation-orchestrator',
  'context-budget-auditor', 'shell-output-budget', 'ponytail-lite', 'token-budget-guardian'];

test('all 7 skills exist with tight frontmatter and bounded bodies', () => {
  for (const s of SKILLS) {
    const f = path.join(ROOT, 'skills', s, 'SKILL.md');
    assert.ok(fs.existsSync(f), 'missing skill: ' + s);
    const fm = frontmatter(f);
    assert.strictEqual(fm.name, s, 'name mismatch in ' + s);
    assert.ok(fm.description && fm.description.length > 10, 'description missing in ' + s);
    const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/).length;
    assert.ok(lines <= 150, s + ' SKILL.md is ' + lines + ' lines (>150)');
  }
});

const CLAUDE_AGENTS = {
  'token-planner-fable.md': { model: 'fable', writes: false },
  'implementation-worker-sonnet.md': { model: 'sonnet', writes: true },
  'codebase-scout-cheap.md': { model: 'haiku', writes: false },
  'audit-reviewer-fable.md': { model: 'fable', writes: false },
  'token-budget-guardian.md': { model: 'sonnet', writes: false },
};

test('claude agents: role separation - only the worker can write', () => {
  for (const [file, expect] of Object.entries(CLAUDE_AGENTS)) {
    const f = path.join(ROOT, 'agents', 'claude', file);
    const fm = frontmatter(f);
    assert.ok(fm.name && fm.description && fm.model && fm.effort, 'incomplete frontmatter: ' + file);
    assert.strictEqual(fm.model, expect.model, file + ' model');
    const tools = (fm.tools || '').split(',').map((t) => t.trim());
    const canWrite = tools.includes('Edit') || tools.includes('Write');
    assert.strictEqual(canWrite, expect.writes,
      file + ': write access must be ' + expect.writes + ' (tools: ' + fm.tools + ')');
    if (!expect.writes) {
      assert.ok(!(fm.permissionMode || '').includes('bypass'), file + ' must not bypass');
    }
  }
});

const CODEX_AGENTS = {
  'teh_planner.toml': { effort: 'high', sandbox: 'read-only' },
  'teh_worker.toml': { effort: 'medium', sandbox: 'workspace-write' },
  'teh_scout.toml': { effort: 'low', sandbox: 'read-only' },
  'teh_auditor.toml': { effort: 'high', sandbox: 'read-only' },
  'teh_guardian.toml': { effort: 'low', sandbox: 'read-only' },
};

test('codex agents: effort tiers and sandbox separation', () => {
  for (const [file, expect] of Object.entries(CODEX_AGENTS)) {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'codex', file), 'utf8');
    const get = (k) => (text.match(new RegExp('^' + k + '\\s*=\\s*"([^"]+)"', 'm')) || [])[1];
    assert.ok(get('name') && get('description'), file + ' needs name+description');
    assert.strictEqual(get('model_reasoning_effort'), expect.effort, file + ' effort');
    assert.strictEqual(get('sandbox_mode'), expect.sandbox, file + ' sandbox');
    assert.ok(text.includes('developer_instructions'), file + ' needs instructions');
  }
});

test('global block templates contain exactly one marker pair', () => {
  for (const t of ['CLAUDE.global.md', 'AGENTS.global.md',
    'global-block.integrated.ja.md', 'global-block.integrated.codex.ja.md']) {
    const text = fs.readFileSync(path.join(ROOT, 'templates', t), 'utf8');
    assert.strictEqual((text.match(/BEGIN TOKEN ENGINEERING HARNESS/g) || []).length, 1, t);
    assert.strictEqual((text.match(/END TOKEN ENGINEERING HARNESS/g) || []).length, 1, t);
    const begin = text.indexOf('BEGIN TOKEN');
    const end = text.indexOf('END TOKEN');
    assert.ok(begin < end, t + ': BEGIN must precede END');
  }
});

test('hooks and lib stay ASCII-only (encoding-guard convention)', () => {
  const dirs = [path.join(ROOT, 'hooks', 'claude'), path.join(ROOT, 'lib', 'teh')];
  for (const d of dirs) {
    for (const f of fs.readdirSync(d)) {
      if (!f.endsWith('.js')) continue;
      const text = fs.readFileSync(path.join(d, f), 'utf8');
      const bad = [...text].filter((c) => c.codePointAt(0) > 127);
      assert.strictEqual(bad.length, 0,
        path.join(d, f) + ' contains non-ASCII: ' + bad.slice(0, 5).join(''));
    }
  }
});
