'use strict';
// Central path resolution. Every location is overridable via env vars so tests
// (and unusual setups) can point TEH at sandboxes instead of the real home.
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOME = os.homedir();
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const CLAUDE_DIR = process.env.CLAUDE_DIR || path.join(HOME, '.claude');
const CODEX_DIR = process.env.CODEX_DIR || path.join(HOME, '.codex');
const TEH_HOME = process.env.TEH_HOME || path.join(HOME, '.token-engineering-harness');

// Global instruction files may be symlinks (e.g. CLAUDE.md -> a config-sync copy).
// Always edit the real file so sync tooling sees the change.
function realOrSelf(p) {
  try { return fs.realpathSync(p); } catch (e) { return p; }
}

module.exports = {
  HOME,
  REPO_ROOT,
  CLAUDE_DIR,
  CODEX_DIR,
  TEH_HOME,
  claudeSettings: () => path.join(CLAUDE_DIR, 'settings.json'),
  claudeGlobalMd: () => realOrSelf(path.join(CLAUDE_DIR, 'CLAUDE.md')),
  codexGlobalMd: () => realOrSelf(path.join(CODEX_DIR, 'AGENTS.md')),
  claudeSkillsDir: () => path.join(CLAUDE_DIR, 'skills'),
  claudeAgentsDir: () => path.join(CLAUDE_DIR, 'agents'),
  claudeHooksDir: () => path.join(CLAUDE_DIR, 'hooks', 'teh'),
  codexAgentsDir: () => path.join(CODEX_DIR, 'agents'),
  manifestPath: () => path.join(TEH_HOME, 'install-manifest.json'),
  configPath: () => path.join(TEH_HOME, 'config.json'),
  backupsDir: () => path.join(TEH_HOME, 'backups'),
  ledgerDir: () => path.join(TEH_HOME, 'ledger'),
  stateDir: () => path.join(TEH_HOME, 'state'),
  realOrSelf,
};
