'use strict';
// Read-only audits: always-loaded file sizes, MCP server counts, skill inventory.
// Findings + candidates only - nothing here ever changes a config.
const fs = require('fs');
const path = require('path');
const P = require('./paths');
const F = require('./fsutil');

function lineCount(file) {
  const t = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  return t === null ? null : t.split(/\r?\n/).length;
}

function auditContext() {
  const budget = (F.readJson(P.configPath(), {}).globalLineBudget) || 200;
  const rows = [];
  for (const [label, file] of [
    ['claude global', P.claudeGlobalMd()],
    ['codex global', P.codexGlobalMd()],
  ]) {
    const n = lineCount(file);
    if (n === null) { rows.push(label + ': (missing) ' + file); continue; }
    const mark = n > budget ? '  OVER BUDGET' : '';
    const teh = F.hasMarkerBlock(fs.readFileSync(file, 'utf8')) ? ' [TEH block]' : ' [no TEH block]';
    rows.push(label + ': ' + n + '/' + budget + ' lines' + teh + mark + '  ' + file);
  }
  for (const name of ['AGENTS.md', 'CLAUDE.md']) {
    const f = path.join(process.cwd(), name);
    const n = lineCount(f);
    if (n !== null && n > 30 && name === 'AGENTS.md') {
      rows.push('repo ' + name + ': ' + n + ' lines (repo budget 30) - move detail to docs/ or skills');
    } else if (n !== null) {
      rows.push('repo ' + name + ': ' + n + ' lines');
    }
  }
  console.log(rows.join('\n'));
  console.log('\nover-budget fix order: dedupe > mechanize (hook/audit) > move to skill > move to docs');
}

function tomlSectionCount(file, prefix) {
  if (!fs.existsSync(file)) return null;
  const re = new RegExp('^\\[' + prefix.replace('.', '\\.') + '\\.', 'gm');
  const m = fs.readFileSync(file, 'utf8').match(re);
  return m ? m.length : 0;
}

function auditMcp() {
  const rows = [];
  const cj = path.join(P.HOME, '.claude.json');
  const cfg = F.readJson(cj, null);
  if (cfg) {
    const top = cfg.mcpServers ? Object.keys(cfg.mcpServers) : [];
    if (top.length) rows.push('claude global mcpServers (' + top.length + '): ' + top.join(', '));
    if (cfg.projects) {
      for (const [proj, pc] of Object.entries(cfg.projects)) {
        const keys = pc && pc.mcpServers ? Object.keys(pc.mcpServers) : [];
        if (keys.length) rows.push('claude project ' + proj + ' (' + keys.length + '): ' + keys.join(', '));
      }
    }
    if (!rows.length) rows.push('claude: no locally-configured MCP servers found in ' + cj);
  } else {
    rows.push('claude: ' + cj + ' not found/parsable');
  }
  const n = tomlSectionCount(path.join(P.CODEX_DIR, 'config.toml'), 'mcp_servers');
  rows.push(n === null ? 'codex: config.toml not found' : 'codex mcp_servers sections: ' + n);
  console.log(rows.join('\n'));
  console.log('\nnote: usage frequency is not tracked here; disabling is a human call.'
    + ' Every enabled server ships tool schemas into context.');
}

function auditSkills() {
  const dir = P.claudeSkillsDir();
  if (!fs.existsSync(dir)) { console.log('no skills dir: ' + dir); return; }
  const rows = [];
  let count = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const sk = path.join(dir, e.name, 'SKILL.md');
    if (!fs.existsSync(sk)) continue;
    count += 1;
    const text = fs.readFileSync(sk, 'utf8');
    const lines = text.split(/\r?\n/).length;
    const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const descLines = fm ? (fm[1].match(/^description:[\s\S]*?(?=^\w|\s*$)/m) || [''])[0]
      .split(/\r?\n/).filter((l) => l.trim()).length : 0;
    const flags = [];
    if (lines > 150) flags.push('body>150');
    if (descLines > 5) flags.push('desc>' + descLines + 'l');
    rows.push('  ' + e.name + ': ' + lines + 'l' + (flags.length ? '  [' + flags.join(',') + ']' : ''));
  }
  console.log('skills in ' + dir + ': ' + count);
  console.log(rows.sort().join('\n'));
  console.log('\nflags: body>150 = candidates for splitting reference material out;'
    + ' desc>Nl = frontmatter descriptions load every session, keep them tight.');
}

module.exports = { auditContext, auditMcp, auditSkills, lineCount };
