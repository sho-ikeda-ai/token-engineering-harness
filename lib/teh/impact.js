'use strict';
// teh impact: aggregate real Claude Code transcript token usage into a dashboard.
// Read-only scan of CLAUDE_DIR transcripts; writes only under TEH_HOME/impact/.
const fs = require('fs');
const path = require('path');
const P = require('./paths');

function parseLine(l) { try { return JSON.parse(l); } catch (e) { return null; } }

function familyOf(model) {
  const m = (model || '').toLowerCase();
  if (m.includes('fable')) return 'fable';
  if (m.includes('opus')) return 'opus';
  if (m.includes('sonnet')) return 'sonnet';
  if (m.includes('haiku')) return 'haiku';
  return 'other';
}

const FAMILIES = ['fable', 'opus', 'sonnet', 'haiku', 'other'];
const FAMILY_COLOR = {
  fable: '#3fb950',
  opus: '#a371f7',
  sonnet: '#58a6ff',
  haiku: '#d29922',
  other: '#8b949e',
};

function emptyDay() {
  const d = { outputTokens: 0, inputTokens: 0, cacheRead: 0, cacheCreation: 0, msgs: 0, families: {} };
  for (const f of FAMILIES) {
    d.families[f] = { outputTokens: 0, inputTokens: 0, cacheRead: 0, cacheCreation: 0, msgs: 0 };
  }
  return d;
}

function findTranscripts(claudeDir) {
  const projectsDir = path.join(claudeDir, 'projects');
  const files = [];
  let skippedFiles = 0;
  let dirs = [];
  try {
    dirs = fs.readdirSync(projectsDir);
  } catch (e) {
    return { files, skippedFiles };
  }
  for (const d of dirs) {
    const projDir = path.join(projectsDir, d);
    let entries = [];
    try {
      entries = fs.readdirSync(projDir);
    } catch (e) { skippedFiles += 1; continue; }
    for (const f of entries) {
      if (f.endsWith('.jsonl')) files.push(path.join(projDir, f));
    }
  }
  return { files, skippedFiles };
}

function emptyBucket() {
  const b = { outputTokens: 0, msgs: 0, families: {} };
  for (const f of FAMILIES) b.families[f] = 0;
  return b;
}

function aggregate(claudeDir, sinceMs, installMs) {
  const { files, skippedFiles } = findTranscripts(claudeDir);
  const days = {}; // 'YYYY-MM-DD' -> emptyDay()
  // record-level before/after split (day-level rounding would drop the install
  // day's post-install records into "before")
  const ba = { before: emptyBucket(), after: emptyBucket() };
  let skippedLines = 0;
  let parsedLines = 0;
  let skippedReadFiles = skippedFiles;

  for (const file of files) {
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch (e) { skippedReadFiles += 1; continue; }
    const lines = content.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      const r = parseLine(line);
      if (!r) { skippedLines += 1; continue; }
      if (r.type !== 'assistant' || !r.message || !r.message.usage || !r.timestamp) continue;
      const ts = Date.parse(r.timestamp);
      if (Number.isNaN(ts)) continue;
      if (sinceMs != null && ts < sinceMs) continue;
      const day = r.timestamp.slice(0, 10);
      if (!days[day]) days[day] = emptyDay();
      const u = r.message.usage;
      const fam = familyOf(r.message.model);
      const outT = u.output_tokens || 0;
      const inT = u.input_tokens || 0;
      const cRead = u.cache_read_input_tokens || 0;
      const cCreate = u.cache_creation_input_tokens || 0;

      days[day].outputTokens += outT;
      days[day].inputTokens += inT;
      days[day].cacheRead += cRead;
      days[day].cacheCreation += cCreate;
      days[day].msgs += 1;

      const fd = days[day].families[fam];
      fd.outputTokens += outT;
      fd.inputTokens += inT;
      fd.cacheRead += cRead;
      fd.cacheCreation += cCreate;
      fd.msgs += 1;

      const bucket = (installMs != null && ts >= installMs) ? ba.after : ba.before;
      bucket.outputTokens += outT;
      bucket.msgs += 1;
      bucket.families[fam] += outT;

      parsedLines += 1;
    }
  }

  return { days, ba, skippedReadFiles, skippedLines, parsedLines };
}

function deriveBeforeAfter(ba) {
  const withDerived = (b) => {
    const fableShare = b.outputTokens > 0 ? b.families.fable / b.outputTokens : 0;
    const outPerMsg = b.msgs > 0 ? b.outputTokens / b.msgs : 0;
    return Object.assign({}, b, { fableShare, outPerMsg });
  };
  return { before: withDerived(ba.before), after: withDerived(ba.after) };
}

function humanize(n) {
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
}

function pct(n) { return (n * 100).toFixed(1) + '%'; }

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- SVG chart builders -----------------------------------------------

function svgStackedBars(sortedDays, dayData, installDay, width, height) {
  const padL = 50, padR = 20, padT = 20, padB = 60;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const n = sortedDays.length || 1;
  const barW = Math.max(2, plotW / n - 2);
  const maxTotal = Math.max(1, ...sortedDays.map((d) => dayData[d].outputTokens));

  let bars = '';
  sortedDays.forEach((day, i) => {
    const x = padL + (i * plotW) / n;
    let yCursor = padT + plotH;
    for (const fam of FAMILIES) {
      const v = dayData[day].families[fam].outputTokens;
      if (!v) continue;
      const h = (v / maxTotal) * plotH;
      yCursor -= h;
      bars += '<rect x="' + x.toFixed(1) + '" y="' + yCursor.toFixed(1) + '" width="' + barW.toFixed(1)
        + '" height="' + h.toFixed(1) + '" fill="' + FAMILY_COLOR[fam] + '"><title>'
        + esc(day + ' ' + fam + ': ' + humanize(v)) + '</title></rect>';
    }
  });

  let labels = '';
  const labelEvery = Math.max(1, Math.ceil(n / 14));
  sortedDays.forEach((day, i) => {
    if (i % labelEvery !== 0) return;
    const x = padL + (i * plotW) / n + barW / 2;
    labels += '<text x="' + x.toFixed(1) + '" y="' + (padT + plotH + 14) + '" font-size="9" fill="#8b949e" '
      + 'text-anchor="end" transform="rotate(-45 ' + x.toFixed(1) + ' ' + (padT + plotH + 14) + ')">'
      + esc(day.slice(5)) + '</text>';
  });

  let marker = '';
  if (installDay) {
    const idx = sortedDays.indexOf(installDay);
    if (idx >= 0) {
      const x = padL + (idx * plotW) / n;
      marker = '<line x1="' + x.toFixed(1) + '" y1="' + padT + '" x2="' + x.toFixed(1) + '" y2="' + (padT + plotH)
        + '" stroke="#e6edf3" stroke-width="1.5" stroke-dasharray="4,3"/>'
        + '<text x="' + (x + 4).toFixed(1) + '" y="' + (padT + 12) + '" font-size="10" fill="#e6edf3">TEH install</text>';
    }
  }

  return '<svg viewBox="0 0 ' + width + ' ' + height + '" width="100%" height="' + height + '">'
    + '<rect x="0" y="0" width="' + width + '" height="' + height + '" fill="#0d1117"/>'
    + bars + labels + marker + '</svg>';
}

function svgLine(sortedDays, values, installDay, width, height, color, formatY) {
  const padL = 50, padR = 20, padT = 20, padB = 60;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const n = sortedDays.length || 1;
  const maxV = Math.max(1, ...values);

  const points = sortedDays.map((day, i) => {
    const x = padL + (n > 1 ? (i * plotW) / (n - 1) : 0);
    const y = padT + plotH - (values[i] / maxV) * plotH;
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');

  let labels = '';
  const labelEvery = Math.max(1, Math.ceil(n / 14));
  sortedDays.forEach((day, i) => {
    if (i % labelEvery !== 0) return;
    const x = padL + (n > 1 ? (i * plotW) / (n - 1) : 0);
    labels += '<text x="' + x.toFixed(1) + '" y="' + (padT + plotH + 14) + '" font-size="9" fill="#8b949e" '
      + 'text-anchor="end" transform="rotate(-45 ' + x.toFixed(1) + ' ' + (padT + plotH + 14) + ')">'
      + esc(day.slice(5)) + '</text>';
  });

  let marker = '';
  if (installDay) {
    const idx = sortedDays.indexOf(installDay);
    if (idx >= 0) {
      const x = padL + (n > 1 ? (idx * plotW) / (n - 1) : 0);
      marker = '<line x1="' + x.toFixed(1) + '" y1="' + padT + '" x2="' + x.toFixed(1) + '" y2="' + (padT + plotH)
        + '" stroke="#e6edf3" stroke-width="1.5" stroke-dasharray="4,3"/>'
        + '<text x="' + (x + 4).toFixed(1) + '" y="' + (padT + 12) + '" font-size="10" fill="#e6edf3">TEH install</text>';
    }
  }

  const dots = sortedDays.map((day, i) => {
    const x = padL + (n > 1 ? (i * plotW) / (n - 1) : 0);
    const y = padT + plotH - (values[i] / maxV) * plotH;
    return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2" fill="' + color + '">'
      + '<title>' + esc(day + ': ' + formatY(values[i])) + '</title></circle>';
  }).join('');

  return '<svg viewBox="0 0 ' + width + ' ' + height + '" width="100%" height="' + height + '">'
    + '<rect x="0" y="0" width="' + width + '" height="' + height + '" fill="#0d1117"/>'
    + '<polyline points="' + points + '" fill="none" stroke="' + color + '" stroke-width="2"/>'
    + dots + labels + marker + '</svg>';
}

function kpiCard(label, beforeVal, afterVal, afterLabel) {
  return '<div class="kpi">'
    + '<div class="kpi-label">' + esc(label) + '</div>'
    + '<div class="kpi-row"><span class="kpi-tag">before</span><span class="kpi-val">' + esc(beforeVal) + '</span></div>'
    + '<div class="kpi-row"><span class="kpi-tag">' + esc(afterLabel) + '</span><span class="kpi-val">' + esc(afterVal) + '</span></div>'
    + '</div>';
}

function buildHtml(data) {
  const sortedDays = Object.keys(data.days).sort();
  const installDay = data.installAt ? data.installAt.slice(0, 10) : null;
  const width = 900, height = 320;

  const stacked = svgStackedBars(sortedDays, data.days, installDay, width, height);
  const outPerMsgLine = svgLine(sortedDays, sortedDays.map((d) => {
    const day = data.days[d];
    return day.msgs > 0 ? day.outputTokens / day.msgs : 0;
  }), installDay, width, height, '#58a6ff', (v) => humanize(v) + '/msg');
  const fableShareLine = svgLine(sortedDays, sortedDays.map((d) => {
    const day = data.days[d];
    return day.outputTokens > 0 ? (day.families.fable.outputTokens / day.outputTokens) * 100 : 0;
  }), installDay, width, height, '#3fb950', (v) => v.toFixed(1) + '%');

  const afterSmallN = data.after.msgs < 5000;
  const afterLabel = afterSmallN ? 'observation period (small n)' : 'after';

  const kpis = [
    kpiCard('output tokens / msg', humanize(data.before.outPerMsg), humanize(data.after.outPerMsg), afterLabel),
    kpiCard('fable share', pct(data.before.fableShare), pct(data.after.fableShare), afterLabel),
    kpiCard('total output tokens', humanize(data.before.outputTokens), humanize(data.after.outputTokens), afterLabel),
    kpiCard('messages', String(data.before.msgs), String(data.after.msgs), afterLabel),
  ].join('\n');

  const legend = FAMILIES.map((f) => '<span class="legend-item"><span class="legend-swatch" '
    + 'style="background:' + FAMILY_COLOR[f] + '"></span>' + f + '</span>').join(' ');

  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
    + '<title>TEH Impact Dashboard</title>\n'
    + '<style>\n'
    + 'body{background:#0d1117;color:#e6edf3;font-family:-apple-system,Segoe UI,Arial,sans-serif;margin:0;padding:24px;}\n'
    + 'h1{font-size:18px;margin:0 0 4px;}\n'
    + '.sub{color:#8b949e;font-size:12px;margin-bottom:20px;}\n'
    + '.kpis{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:24px;}\n'
    + '.kpi{background:#161b22;border:1px solid #30363d;border-radius:6px;padding:12px 16px;min-width:160px;}\n'
    + '.kpi-label{font-size:12px;color:#8b949e;margin-bottom:6px;}\n'
    + '.kpi-row{display:flex;justify-content:space-between;font-size:13px;}\n'
    + '.kpi-tag{color:#8b949e;}\n'
    + '.kpi-val{color:#e6edf3;font-weight:600;}\n'
    + '.chart{background:#161b22;border:1px solid #30363d;border-radius:6px;padding:12px;margin-bottom:20px;}\n'
    + '.chart h2{font-size:13px;margin:0 0 8px;color:#e6edf3;}\n'
    + '.legend{margin-top:6px;font-size:11px;color:#8b949e;}\n'
    + '.legend-item{margin-right:12px;}\n'
    + '.legend-swatch{display:inline-block;width:9px;height:9px;margin-right:4px;border-radius:2px;}\n'
    + 'footer{color:#8b949e;font-size:11px;margin-top:16px;}\n'
    + '</style>\n</head>\n<body>\n'
    + '<h1>TEH Impact Dashboard</h1>\n'
    + '<div class="sub">generated ' + esc(data.generatedAt) + (data.installAt ? ' | TEH install ' + esc(data.installAt) : '') + '</div>\n'
    + '<div class="kpis">\n' + kpis + '\n</div>\n'
    + '<div class="chart"><h2>Daily output tokens by model family</h2>' + stacked
    + '<div class="legend">' + legend + '</div></div>\n'
    + '<div class="chart"><h2>Daily output tokens per message</h2>' + outPerMsgLine + '</div>\n'
    + '<div class="chart"><h2>Daily fable share (%)</h2>' + fableShareLine + '</div>\n'
    + '<footer>generated by teh impact &mdash; token counts from Claude Code transcripts; TEH install marked</footer>\n'
    + '</body>\n</html>\n';
}

function run(args) {
  const di = args.indexOf('--days');
  const days = di >= 0 ? parseInt(args[di + 1], 10) : 45;
  const ii = args.indexOf('--install');
  let installIso = ii >= 0 ? args[ii + 1] : null;

  if (!installIso) {
    const manifest = readManifest();
    // firstInstalledAt survives reinstalls; installedAt is the latest one
    if (manifest) installIso = manifest.firstInstalledAt || manifest.installedAt || null;
  }
  const installMs = installIso ? Date.parse(installIso) : null;

  const sinceMs = Date.now() - days * 24 * 3600 * 1000;
  const { days: dayMap, ba, skippedReadFiles, skippedLines, parsedLines } = aggregate(P.CLAUDE_DIR, sinceMs, installMs);
  const { before, after } = deriveBeforeAfter(ba);

  const data = {
    generatedAt: new Date().toISOString(),
    installAt: installIso || null,
    days: dayMap,
    before,
    after,
  };

  const outDir = path.join(P.TEH_HOME, 'impact');
  fs.mkdirSync(outDir, { recursive: true });
  const dataPath = path.join(outDir, 'impact-data.json');
  const htmlPath = path.join(outDir, 'impact.html');
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  fs.writeFileSync(htmlPath, buildHtml(data));

  printConsoleSummary(dayMap, before, after, installIso, skippedReadFiles, skippedLines, parsedLines);
  console.log('');
  console.log('wrote ' + dataPath);
  console.log('wrote ' + htmlPath);
}

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(P.manifestPath(), 'utf8'));
  } catch (e) { return null; }
}

function printConsoleSummary(dayMap, before, after, installIso, skippedReadFiles, skippedLines, parsedLines) {
  const sortedDays = Object.keys(dayMap).sort();
  const last7 = sortedDays.slice(-7);
  const L = [];
  L.push('teh impact - parsed ' + parsedLines + ' assistant records'
    + (skippedLines ? ', skipped ' + skippedLines + ' bad lines' : '')
    + (skippedReadFiles ? ', skipped ' + skippedReadFiles + ' unreadable files' : ''));
  L.push('');
  L.push('last 7 days:');
  L.push('  date        msgs   output    fable%');
  for (const day of last7) {
    const d = dayMap[day];
    const fableShare = d.outputTokens > 0 ? (d.families.fable.outputTokens / d.outputTokens) * 100 : 0;
    L.push('  ' + day + '  ' + String(d.msgs).padStart(4) + '   ' + humanize(d.outputTokens).padStart(7)
      + '   ' + fableShare.toFixed(1).padStart(5) + '%');
  }
  L.push('');
  if (installIso) {
    L.push('before/after split at ' + installIso + ':');
  } else {
    L.push('before/after split: no install timestamp found (pass --install or install TEH first)');
  }
  L.push('  before: msgs=' + before.msgs + ' output=' + humanize(before.outputTokens)
    + ' out/msg=' + humanize(before.outPerMsg) + ' fable-share=' + pct(before.fableShare));
  L.push('  after:  msgs=' + after.msgs + ' output=' + humanize(after.outputTokens)
    + ' out/msg=' + humanize(after.outPerMsg) + ' fable-share=' + pct(after.fableShare)
    + (after.msgs < 5000 ? '  (small n)' : ''));
  console.log(L.join('\n'));
}

module.exports = { run, familyOf, aggregate, deriveBeforeAfter, humanize, FAMILIES };
