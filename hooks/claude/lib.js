'use strict';
// Shared helpers for TEH hooks. Fail-open by design: hooks must never break the
// host session, so callers wrap everything and exit 0 even on internal errors.
// ASCII only in this file (encoding-guard convention: no raw non-ASCII in JS).
const fs = require('fs');
const os = require('os');
const path = require('path');

const TEH_HOME = process.env.TEH_HOME || path.join(os.homedir(), '.token-engineering-harness');
const STATE_DIR = path.join(TEH_HOME, 'state');
const LEDGER_DIR = path.join(TEH_HOME, 'ledger');

function readStdinSync() {
  try { return fs.readFileSync(0, 'utf8'); } catch (e) { return ''; }
}

function parseJson(text) {
  try { return JSON.parse(text); } catch (e) { return null; }
}

function safeRead(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; }
}

function ensureDirs() {
  for (const d of [TEH_HOME, STATE_DIR, LEDGER_DIR]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

// config.json defaults: guard OFF (blocking is opt-in), 200-line global budget.
function loadConfig() {
  const cfg = parseJson(safeRead(path.join(TEH_HOME, 'config.json'))) || {};
  return Object.assign({ commandGuard: false, globalLineBudget: 200 }, cfg);
}

function statePath(sessionId) {
  const safe = String(sessionId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(STATE_DIR, 'session-' + safe + '.json');
}

function newState() {
  return {
    schema: 1,
    startedAt: new Date().toISOString(),
    bashCalls: 0,
    commandOutputBytes: 0,
    maxSingleOutputBytes: 0,
    filesRead: 0,
    edits: 0,
    subagents: 0,
  };
}

function loadState(sessionId) {
  return parseJson(safeRead(statePath(sessionId))) || newState();
}

function saveState(sessionId, st) {
  ensureDirs();
  fs.writeFileSync(statePath(sessionId), JSON.stringify(st));
}

function appendLedger(record) {
  ensureDirs();
  const ym = new Date().toISOString().slice(0, 7);
  fs.appendFileSync(path.join(LEDGER_DIR, ym + '.jsonl'), JSON.stringify(record) + '\n');
}

function argHost(argv) {
  const i = argv.indexOf('--host');
  return i >= 0 && argv[i + 1] ? argv[i + 1] : 'claude-code';
}

module.exports = {
  TEH_HOME, STATE_DIR, LEDGER_DIR,
  readStdinSync, parseJson, safeRead, ensureDirs, loadConfig,
  statePath, newState, loadState, saveState, appendLedger, argHost,
};
