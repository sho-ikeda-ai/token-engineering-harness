'use strict';
// teh install / uninstall - the only code that changes files outside this repo.
// Order: plan -> (dry-run prints plan and stops) -> backup -> apply -> verify
// -> manifest. Uninstall reverses strictly from the manifest. Both support
// --dry-run. Global instruction files are guarded by a line budget: if the
// insert would push a file over budget, install ABORTS before touching it.
const fs = require('fs');
const path = require('path');
const P = require('./paths');
const F = require('./fsutil');

const VERSION = '0.1.2';
const LINE_BUDGET = 200;

const SKILLS_ALL = [
  'model-effort-router',
  'report-budget-controller',
  'delegation-orchestrator',
  'context-budget-auditor',
  'shell-output-budget',
  'ponytail-lite',
  'token-budget-guardian',
];
const CLAUDE_AGENTS = [
  'token-planner-fable.md',
  'implementation-worker-sonnet.md',
  'codebase-scout-cheap.md',
  'audit-reviewer-fable.md',
  'token-budget-guardian.md',
];
const CODEX_AGENTS = [
  'teh_planner.toml',
  'teh_worker.toml',
  'teh_scout.toml',
  'teh_auditor.toml',
  'teh_guardian.toml',
];
const GLOBAL_BLOCKS = {
  integrated: {
    claude: 'templates/global-block.integrated.ja.md',
    codex: 'templates/global-block.integrated.codex.ja.md',
  },
  standalone: {
    claude: 'templates/CLAUDE.global.md',
    codex: 'templates/AGENTS.global.md',
  },
};

// integrated = an existing output-thrift ecosystem is present (token-saver skill):
// skip shell-output-budget (one source of truth) and use the compact ja blocks.
function detectProfile() {
  return fs.existsSync(path.join(P.claudeSkillsDir(), 'token-saver'))
    ? 'integrated' : 'standalone';
}

function buildPlan(profile) {
  const skills = profile === 'integrated'
    ? SKILLS_ALL.filter((s) => s !== 'shell-output-budget')
    : SKILLS_ALL;
  const copies = [];
  for (const s of skills) {
    copies.push({
      src: path.join(P.REPO_ROOT, 'skills', s),
      dstDir: path.join(P.claudeSkillsDir(), s),
      label: 'skill: ' + s,
    });
  }
  for (const a of CLAUDE_AGENTS) {
    copies.push({
      src: path.join(P.REPO_ROOT, 'agents', 'claude', a),
      dstDir: P.claudeAgentsDir(),
      label: 'claude agent: ' + a,
    });
  }
  copies.push({
    src: path.join(P.REPO_ROOT, 'hooks', 'claude'),
    dstDir: P.claudeHooksDir(),
    label: 'hooks: -> ' + P.claudeHooksDir(),
  });
  const codexOk = fs.existsSync(P.CODEX_DIR);
  if (codexOk) {
    for (const a of CODEX_AGENTS) {
      copies.push({
        src: path.join(P.REPO_ROOT, 'agents', 'codex', a),
        dstDir: P.codexAgentsDir(),
        label: 'codex agent: ' + a,
      });
    }
  }
  const blocks = GLOBAL_BLOCKS[profile];
  const markerEdits = [{
    file: P.claudeGlobalMd(),
    blockSrc: path.join(P.REPO_ROOT, blocks.claude),
    host: 'claude',
  }];
  if (codexOk) {
    markerEdits.push({
      file: P.codexGlobalMd(),
      blockSrc: path.join(P.REPO_ROOT, blocks.codex),
      host: 'codex',
    });
  }
  return {
    profile,
    copies,
    markerEdits,
    settings: { file: P.claudeSettings() },
    hookDirDeployed: P.claudeHooksDir(),
    codexOk,
  };
}

// Predicted line count after the marker upsert (existing block replaced, not doubled).
function predictMarkerLines(plan) {
  return plan.markerEdits.map((me) => {
    const existing = fs.existsSync(me.file) ? fs.readFileSync(me.file, 'utf8') : '';
    const block = F.extractMarkerBlock(fs.readFileSync(me.blockSrc, 'utf8')) || '';
    const after = F.upsertMarkerBlock(existing, block).split(/\r?\n/).length;
    return { file: me.file, before: existing ? existing.split(/\r?\n/).length : 0, after };
  });
}

function entryUsesDir(entry, hookDir) {
  const norm = (s) => String(s).replace(/\\/g, '/').toLowerCase();
  return norm(JSON.stringify(entry)).includes(norm(hookDir));
}

function materialize(entry, hookDir) {
  const dir = hookDir.replace(/\\/g, '/');
  return JSON.parse(JSON.stringify(entry).split('%TEH_HOOK_DIR%').join(dir));
}

function installSettingsHooks(settingsFile, hookDir) {
  const original = fs.existsSync(settingsFile) ? fs.readFileSync(settingsFile, 'utf8') : '';
  const settings = original ? JSON.parse(original) : {};
  const snippet = F.readJson(
    path.join(P.REPO_ROOT, 'hooks', 'claude', 'settings-snippet.json'), { hooks: {} });
  settings.hooks = settings.hooks || {};
  const events = [];
  for (const [event, entries] of Object.entries(snippet.hooks)) {
    const arr = Array.isArray(settings.hooks[event]) ? settings.hooks[event] : [];
    const kept = arr.filter((en) => !entryUsesDir(en, hookDir)); // idempotent reinstall
    for (const en of entries) kept.push(materialize(en, hookDir));
    settings.hooks[event] = kept;
    events.push(event);
  }
  F.writeJsonPreserving(settingsFile, settings, original);
  return events;
}

function removeSettingsHooks(settingsFile, hookDir) {
  if (!fs.existsSync(settingsFile)) return [];
  const original = fs.readFileSync(settingsFile, 'utf8');
  const settings = JSON.parse(original);
  if (!settings.hooks) return [];
  const removed = [];
  for (const event of Object.keys(settings.hooks)) {
    const arr = settings.hooks[event];
    if (!Array.isArray(arr)) continue;
    const kept = arr.filter((en) => !entryUsesDir(en, hookDir));
    if (kept.length !== arr.length) removed.push(event);
    if (kept.length) settings.hooks[event] = kept;
    else delete settings.hooks[event];
  }
  F.writeJsonPreserving(settingsFile, settings, original);
  return removed;
}

function verify(manifest) {
  const problems = [];
  for (const f of manifest.copied) {
    if (!fs.existsSync(f)) problems.push('missing copied file: ' + f);
  }
  for (const f of manifest.markerEdits) {
    if (!F.hasMarkerBlock(fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '')) {
      problems.push('marker block absent: ' + f);
    }
  }
  if (manifest.settingsFile) {
    try { JSON.parse(fs.readFileSync(manifest.settingsFile, 'utf8')); }
    catch (e) { problems.push('settings.json unparsable: ' + e.message); }
  }
  return problems;
}

function apply(plan, enableGuard) {
  const backupDir = path.join(P.backupsDir(), F.ts());
  F.ensureDir(backupDir);
  for (const me of plan.markerEdits) F.backupFile(me.file, backupDir);
  F.backupFile(plan.settings.file, backupDir);

  const copied = [];
  for (const c of plan.copies) copied.push(...F.copyInto(c.src, c.dstDir, backupDir));

  const markerEdits = [];
  for (const me of plan.markerEdits) {
    const block = F.extractMarkerBlock(fs.readFileSync(me.blockSrc, 'utf8'));
    if (!block) throw new Error('no marker block in template: ' + me.blockSrc);
    const existing = fs.existsSync(me.file) ? fs.readFileSync(me.file, 'utf8') : '';
    fs.writeFileSync(me.file, F.upsertMarkerBlock(existing, block));
    markerEdits.push(me.file);
  }

  const events = installSettingsHooks(plan.settings.file, plan.hookDirDeployed);

  F.ensureDir(P.ledgerDir());
  F.ensureDir(P.stateDir());
  const cfg = F.readJson(P.configPath(), {});
  if (cfg.commandGuard === undefined) cfg.commandGuard = false;
  if (enableGuard) cfg.commandGuard = true;
  if (cfg.globalLineBudget === undefined) cfg.globalLineBudget = LINE_BUDGET;
  fs.writeFileSync(P.configPath(), JSON.stringify(cfg, null, 2) + '\n');

  const prev = F.readJson(P.manifestPath(), null);
  const nowIso = new Date().toISOString();
  const manifest = {
    version: VERSION,
    installedAt: nowIso,
    // survives reinstalls - impact before/after splits on the FIRST install
    firstInstalledAt: (prev && (prev.firstInstalledAt || prev.installedAt)) || nowIso,
    profile: plan.profile,
    repo: P.REPO_ROOT,
    backupDir,
    copied,
    markerEdits,
    settingsFile: plan.settings.file,
    settingsEvents: events,
    hookDir: plan.hookDirDeployed,
  };
  fs.writeFileSync(P.manifestPath(), JSON.stringify(manifest, null, 2) + '\n');
  return { manifest, backupDir, problems: verify(manifest) };
}

function formatPlan(plan, pred, opts) {
  const L = [];
  L.push('teh install plan  (profile: ' + plan.profile
    + (opts.enableGuard ? ', command guard: ON' : ', command guard: off (opt-in)') + ')');
  for (const c of plan.copies) L.push('  copy   ' + c.label);
  for (let i = 0; i < plan.markerEdits.length; i += 1) {
    const me = plan.markerEdits[i];
    const p = pred[i];
    L.push('  marker ' + me.file + '  (' + p.before + ' -> ' + p.after + ' lines, budget ' + LINE_BUDGET + ')');
  }
  L.push('  hooks  ' + plan.settings.file + '  (PostToolUse/SessionStart/SessionEnd/PreCompact/PreToolUse entries)');
  if (!plan.codexOk) L.push('  note   codex dir not found - codex agents/block skipped');
  L.push('  backup -> ' + path.join(P.backupsDir(), '<timestamp>') + '   undo: teh uninstall');
  return L.join('\n');
}

function run(args) {
  const dry = args.includes('--dry-run');
  const enableGuard = args.includes('--enable-guard');
  const pi = args.indexOf('--profile');
  const profile = pi >= 0 ? args[pi + 1] : detectProfile();
  if (!GLOBAL_BLOCKS[profile]) {
    console.log('unknown profile: ' + profile + ' (use integrated|standalone)');
    process.exitCode = 1;
    return;
  }
  const plan = buildPlan(profile);
  const pred = predictMarkerLines(plan);
  console.log(formatPlan(plan, pred, { enableGuard }));
  const over = pred.filter((p) => p.after > LINE_BUDGET);
  if (over.length) {
    console.log('ABORT: over the ' + LINE_BUDGET + '-line budget after insert: '
      + over.map((o) => o.file + ' -> ' + o.after).join(', '));
    console.log('Trim first (teh audit-context), then re-run.');
    process.exitCode = 1;
    return;
  }
  if (dry) { console.log('(dry-run: nothing changed)'); return; }
  const res = apply(plan, enableGuard);
  console.log('installed. backup: ' + res.backupDir);
  if (res.problems.length) {
    console.log('VERIFY PROBLEMS:');
    for (const p of res.problems) console.log('  - ' + p);
    process.exitCode = 1;
  } else {
    console.log('verify: OK (' + res.manifest.copied.length + ' files, '
      + res.manifest.markerEdits.length + ' marker blocks, '
      + res.manifest.settingsEvents.length + ' hook events)');
  }
}

function pruneEmptyDirs(file, stopDir) {
  let d = path.dirname(file);
  while (d.length > stopDir.length && d.startsWith(stopDir)) {
    try {
      if (fs.readdirSync(d).length) break;
      fs.rmdirSync(d);
    } catch (e) { break; }
    d = path.dirname(d);
  }
}

function uninstall(args) {
  const dry = args.includes('--dry-run');
  const manifest = F.readJson(P.manifestPath(), null);
  if (!manifest) {
    console.log('not installed (no manifest at ' + P.manifestPath() + ')');
    return;
  }
  console.log('teh uninstall plan (installed ' + manifest.installedAt + ', profile ' + manifest.profile + ')');
  console.log('  delete ' + manifest.copied.length + ' copied files');
  for (const f of manifest.markerEdits) console.log('  remove marker block from ' + f);
  console.log('  remove TEH hook entries from ' + manifest.settingsFile);
  console.log('  keep   ledger/backups under ' + P.TEH_HOME);
  if (dry) { console.log('(dry-run: nothing changed)'); return; }

  const backupDir = path.join(P.backupsDir(), F.ts() + '-uninstall');
  F.ensureDir(backupDir);
  for (const f of manifest.markerEdits) F.backupFile(f, backupDir);
  F.backupFile(manifest.settingsFile, backupDir);

  let deleted = 0;
  for (const f of manifest.copied) {
    if (fs.existsSync(f)) { fs.unlinkSync(f); deleted += 1; }
    pruneEmptyDirs(f, path.dirname(path.dirname(f)));
  }
  for (const f of manifest.markerEdits) {
    if (!fs.existsSync(f)) continue;
    fs.writeFileSync(f, F.removeMarkerBlock(fs.readFileSync(f, 'utf8')));
  }
  const removedEvents = removeSettingsHooks(manifest.settingsFile, manifest.hookDir);
  fs.renameSync(P.manifestPath(),
    P.manifestPath().replace(/\.json$/, '.uninstalled-' + F.ts() + '.json'));
  console.log('uninstalled: ' + deleted + ' files removed, marker blocks cleared, '
    + 'hook events removed: ' + (removedEvents.join(',') || 'none')
    + '. backup: ' + backupDir);
}

module.exports = {
  VERSION, LINE_BUDGET, SKILLS_ALL, CLAUDE_AGENTS, CODEX_AGENTS,
  detectProfile, buildPlan, predictMarkerLines, apply, verify,
  installSettingsHooks, removeSettingsHooks,
  run, uninstall,
};
