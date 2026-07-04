'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { SECRET_RULES, TRACE_RULES, scan } = require('../lib/teh/packgithub');

function hit(rules, name, sample) {
  const r = rules.find((x) => x.name === name);
  assert.ok(r, 'rule exists: ' + name);
  return r.re.test(sample);
}

test('secret rules catch the classic shapes', () => {
  assert.ok(hit(SECRET_RULES, 'github-token', 'ghp_' + 'a'.repeat(36)));
  assert.ok(hit(SECRET_RULES, 'aws-key-id', 'AKIA' + 'B'.repeat(16)));
  assert.ok(hit(SECRET_RULES, 'private-key', '-----BEGIN RSA ' + 'PRIVATE KEY-----'));
  assert.ok(hit(SECRET_RULES, 'key-assignment', 'api_key = "' + 'x'.repeat(20) + '"'));
});

test('secret rules ignore documentation-level mentions', () => {
  for (const s of ['the api key is stored elsewhere', 'password: <ask the user>',
    'token counting matters', '"command": "node hook.js --token-budget"']) {
    assert.ok(!SECRET_RULES.some((r) => r.re.test(s)), 'false positive on: ' + s);
  }
});

test('trace rules catch personal-environment strings built at runtime', () => {
  // build samples from escapes/fragments so this test file stays clean itself
  const user = 'Users\\' + 'PC' + '_User';
  const gdrive = String.fromCharCode(0x30de,0x30a4,0x30c9,0x30e9,0x30a4,0x30d6);
  const owner = String.fromCharCode(0x6c60,0x7530);
  assert.ok(hit(TRACE_RULES, 'windows-user-path', 'C:\\' + user + '\\.claude'));
  assert.ok(hit(TRACE_RULES, 'gdrive-dir', 'path/' + gdrive + '/x'));
  assert.ok(hit(TRACE_RULES, 'owner-name', owner + ' says hi'));
  assert.ok(!TRACE_RULES.some((r) => r.re.test('C:/Users/alice/.claude')),
    'other users are not traces');
});

test('the repo itself scans clean (excluding local-only files)', () => {
  const { violations } = scan();
  assert.deepStrictEqual(violations, [],
    'repo must stay publishable: ' + JSON.stringify(violations.slice(0, 5)));
});
