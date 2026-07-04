'use strict';
// teh impact: unit tests on aggregation internals + end-to-end CLI run against
// a sandbox CLAUDE_DIR/TEH_HOME, following the sandbox pattern in test_install.js.
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TEH_BIN = path.join(__dirname, '..', 'bin', 'teh');
const impact = require('../lib/teh/impact');

function rec(model, timestamp, outputTokens, inputTokens, cacheRead, cacheCreation) {
  return JSON.stringify({
    type: 'assistant',
    timestamp,
    message: {
      model,
      usage: {
        output_tokens: outputTokens,
        input_tokens: inputTokens,
        cache_read_input_tokens: cacheRead,
        cache_creation_input_tokens: cacheCreation,
      },
    },
  });
}

function sandboxClaudeDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teh-impact-'));
  const claude = path.join(root, 'claude');
  const projDir = path.join(claude, 'projects', 'p1');
  fs.mkdirSync(projDir, { recursive: true });
  const lines = [
    rec('claude-sonnet-5', '2026-07-01T01:00:00.000Z', 1000, 500, 100, 50),
    rec('claude-fable-5', '2026-07-01T02:00:00.000Z', 2000, 700, 200, 60),
    'not valid json{{{',
    rec('claude-sonnet-5', '2026-07-03T03:00:00.000Z', 500, 300, 50, 20),
    rec('claude-fable-5', '2026-07-03T04:00:00.000Z', 4000, 900, 300, 90),
  ];
  fs.writeFileSync(path.join(projDir, 's.jsonl'), lines.join('\n') + '\n');
  return { root, claude };
}

test('familyOf maps model substrings', () => {
  assert.strictEqual(impact.familyOf('claude-fable-5'), 'fable');
  assert.strictEqual(impact.familyOf('claude-opus-4'), 'opus');
  assert.strictEqual(impact.familyOf('claude-sonnet-5'), 'sonnet');
  assert.strictEqual(impact.familyOf('claude-haiku-4'), 'haiku');
  assert.strictEqual(impact.familyOf('claude-unknown-x'), 'other');
  assert.strictEqual(impact.familyOf(undefined), 'other');
});

test('aggregate parses valid lines, skips bad lines, buckets by day+family', () => {
  const { claude } = sandboxClaudeDir();
  const { days, skippedLines, parsedLines } = impact.aggregate(claude, null);

  assert.strictEqual(parsedLines, 4, 'four valid assistant records');
  assert.strictEqual(skippedLines, 1, 'one garbage line skipped');

  const day1 = days['2026-07-01'];
  assert.ok(day1, 'day 1 bucket exists');
  assert.strictEqual(day1.msgs, 2);
  assert.strictEqual(day1.outputTokens, 3000);
  assert.strictEqual(day1.families.sonnet.outputTokens, 1000);
  assert.strictEqual(day1.families.fable.outputTokens, 2000);
  assert.strictEqual(day1.families.sonnet.inputTokens, 500);
  assert.strictEqual(day1.families.fable.cacheRead, 200);
  assert.strictEqual(day1.families.fable.cacheCreation, 60);

  const day3 = days['2026-07-03'];
  assert.strictEqual(day3.msgs, 2);
  assert.strictEqual(day3.outputTokens, 4500);
  assert.strictEqual(day3.families.fable.outputTokens, 4000);
  assert.strictEqual(day3.families.sonnet.outputTokens, 500);
});

test('before/after splits at the install timestamp and computes fableShare', () => {
  const { claude } = sandboxClaudeDir();
  const installMs = Date.parse('2026-07-02T00:00:00.000Z');
  const { ba } = impact.aggregate(claude, null, installMs);
  const { before, after } = impact.deriveBeforeAfter(ba);

  assert.strictEqual(before.msgs, 2);
  assert.strictEqual(before.outputTokens, 3000);
  assert.strictEqual(before.families.fable, 2000);
  assert.strictEqual(before.fableShare, 2000 / 3000);
  assert.strictEqual(before.outPerMsg, 1500);

  assert.strictEqual(after.msgs, 2);
  assert.strictEqual(after.outputTokens, 4500);
  assert.strictEqual(after.families.fable, 4000);
  assert.strictEqual(after.fableShare, 4000 / 4500);
  assert.strictEqual(after.outPerMsg, 2250);
});

test('split is record-level, not day-level (mid-day install regression)', () => {
  const { claude } = sandboxClaudeDir();
  // install lands BETWEEN the two 2026-07-03 records (03:00 and 04:00)
  const installMs = Date.parse('2026-07-03T03:30:00.000Z');
  const { ba } = impact.aggregate(claude, null, installMs);
  const { before, after } = impact.deriveBeforeAfter(ba);

  assert.strictEqual(before.msgs, 3, 'records before 03:30 stay in before');
  assert.strictEqual(before.outputTokens, 3500);
  assert.strictEqual(after.msgs, 1, 'the 04:00 record lands in after');
  assert.strictEqual(after.outputTokens, 4000);
  assert.strictEqual(after.families.fable, 4000);
});

test('humanize formats large numbers compactly', () => {
  assert.strictEqual(impact.humanize(1200000), '1.2M');
  assert.strictEqual(impact.humanize(500), '500');
  assert.strictEqual(impact.humanize(2500), '2.5K');
});

test('bin/teh impact runs end-to-end and writes impact-data.json + impact.html', () => {
  const { root, claude } = sandboxClaudeDir();
  const tehHome = path.join(root, 'teh-home');
  const env = Object.assign({}, process.env, {
    CLAUDE_DIR: claude,
    TEH_HOME: tehHome,
  });

  const r = spawnSync('node', [TEH_BIN, 'impact', '--days', '365', '--install', '2026-07-02T00:00:00.000Z'],
    { env, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);

  const dataPath = path.join(tehHome, 'impact', 'impact-data.json');
  const htmlPath = path.join(tehHome, 'impact', 'impact.html');
  assert.ok(fs.existsSync(dataPath), 'impact-data.json written');
  assert.ok(fs.existsSync(htmlPath), 'impact.html written');

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  assert.strictEqual(data.installAt, '2026-07-02T00:00:00.000Z');
  assert.strictEqual(data.before.outputTokens, 3000);
  assert.strictEqual(data.after.outputTokens, 4500);

  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.ok(html.includes('<svg'), 'html contains inline svg');
  assert.ok(!html.includes('<script src'), 'no external script tags');
  assert.ok(!html.toLowerCase().includes('cdn'), 'no cdn references');
});
