'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const F = require('../lib/teh/fsutil');

const BLOCK = [
  '<!-- BEGIN TOKEN ENGINEERING HARNESS -->',
  '### Policy',
  '- rule one',
  '<!-- END TOKEN ENGINEERING HARNESS -->',
].join('\n');

test('extractMarkerBlock pulls only the marked region', () => {
  const tpl = '# comment above\n\n' + BLOCK + '\ntrailing\n';
  assert.strictEqual(F.extractMarkerBlock(tpl), BLOCK);
});

test('upsert appends once and is idempotent', () => {
  const base = '# My file\n\ncontent line\n';
  const once = F.upsertMarkerBlock(base, BLOCK);
  assert.ok(F.hasMarkerBlock(once));
  const twice = F.upsertMarkerBlock(once, BLOCK);
  assert.strictEqual(once, twice, 'second upsert must not duplicate');
  assert.strictEqual(once.match(/BEGIN TOKEN ENGINEERING HARNESS/g).length, 1);
});

test('upsert replaces an existing block in place', () => {
  const base = 'top\n\n' + BLOCK + '\n\nbottom\n';
  const v2 = BLOCK.replace('rule one', 'rule two');
  const out = F.upsertMarkerBlock(base, v2);
  assert.ok(out.includes('rule two') && !out.includes('rule one'));
  assert.ok(out.startsWith('top') && out.includes('bottom'));
});

test('remove deletes the block and its separator, keeps everything else', () => {
  const base = '# My file\n\ncontent line\n';
  const withBlock = F.upsertMarkerBlock(base, BLOCK);
  const removed = F.removeMarkerBlock(withBlock);
  assert.ok(!F.hasMarkerBlock(removed));
  assert.ok(removed.includes('content line'));
  assert.ok(!removed.includes('rule one'));
});

test('remove on a file without block is a no-op', () => {
  const base = 'nothing here\n';
  assert.strictEqual(F.removeMarkerBlock(base), base);
});

test('detectIndent picks up 4-space and tab styles', () => {
  assert.strictEqual(F.detectIndent('{\n    "a": 1\n}'), '    ');
  assert.strictEqual(F.detectIndent('{\n\t"a": 1\n}'), '\t');
  assert.strictEqual(F.detectIndent('{}'), '  ');
});

test('crlf files keep crlf after upsert', () => {
  const base = '# My file\r\n\r\ncontent\r\n';
  const out = F.upsertMarkerBlock(base, BLOCK);
  assert.ok(out.includes('\r\n'));
  assert.ok(F.hasMarkerBlock(out));
});
