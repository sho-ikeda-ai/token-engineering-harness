'use strict';
// File utilities: timestamped backups, marker-block editing, JSON round-trips
// that preserve indentation style, recursive copy with a manifest trail.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const BEGIN_MARK = 'BEGIN TOKEN ENGINEERING HARNESS';
const END_MARK = 'END TOKEN ENGINEERING HARNESS';

function ts() {
  return new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
}

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function sha256(file) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  } catch (e) { return null; }
}

// Backup preserving enough of the origin to restore by hand: the file lands in
// backupDir with its path flattened (C__dev_x_y.ext), collision-safe.
function backupFile(src, backupDir) {
  if (!fs.existsSync(src)) return null;
  ensureDir(backupDir);
  const flat = src.replace(/[\\/:]+/g, '_');
  let dst = path.join(backupDir, flat);
  let n = 1;
  while (fs.existsSync(dst)) dst = path.join(backupDir, flat + '.' + (n += 1));
  fs.copyFileSync(src, dst);
  return dst;
}

function listFilesRecursive(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFilesRecursive(p));
    else out.push(p);
  }
  return out;
}

// Copy src file/dir into dstDir; returns absolute destination file paths.
function copyInto(src, dstDir, backupDir) {
  const copied = [];
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    for (const f of listFilesRecursive(src)) {
      const rel = path.relative(src, f);
      const dst = path.join(dstDir, rel);
      ensureDir(path.dirname(dst));
      if (backupDir && fs.existsSync(dst)) backupFile(dst, backupDir);
      fs.copyFileSync(f, dst);
      copied.push(dst);
    }
  } else {
    ensureDir(dstDir);
    const dst = path.join(dstDir, path.basename(src));
    if (backupDir && fs.existsSync(dst)) backupFile(dst, backupDir);
    fs.copyFileSync(src, dst);
    copied.push(dst);
  }
  return copied;
}

// --- marker blocks ---------------------------------------------------------

function extractMarkerBlock(templateText) {
  const lines = templateText.split(/\r?\n/);
  const b = lines.findIndex((l) => l.includes(BEGIN_MARK));
  const e = lines.findIndex((l) => l.includes(END_MARK));
  if (b < 0 || e < b) return null;
  return lines.slice(b, e + 1).join('\n');
}

function hasMarkerBlock(text) {
  return text.includes(BEGIN_MARK) && text.includes(END_MARK);
}

// Insert or replace the TEH block. Idempotent: same input block -> same output.
function upsertMarkerBlock(text, block) {
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const b = lines.findIndex((l) => l.includes(BEGIN_MARK));
  const e = lines.findIndex((l) => l.includes(END_MARK));
  const blockLines = block.split(/\r?\n/);
  let out;
  if (b >= 0 && e >= b) {
    out = lines.slice(0, b).concat(blockLines, lines.slice(e + 1));
  } else {
    out = lines.slice();
    while (out.length && out[out.length - 1].trim() === '') out.pop();
    out = out.concat(['', ...blockLines, '']);
  }
  return out.join(nl);
}

function removeMarkerBlock(text) {
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const b = lines.findIndex((l) => l.includes(BEGIN_MARK));
  const e = lines.findIndex((l) => l.includes(END_MARK));
  if (b < 0 || e < b) return text;
  let start = b;
  if (start > 0 && lines[start - 1].trim() === '') start -= 1; // our separator line
  return lines.slice(0, start).concat(lines.slice(e + 1)).join(nl);
}

// --- JSON round-trip -------------------------------------------------------

function detectIndent(jsonText) {
  const m = jsonText.match(/^[^\r\n]*\r?\n([ \t]+)/);
  return m ? m[1] : '  ';
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}

function writeJsonPreserving(file, obj, originalText) {
  const indent = originalText ? detectIndent(originalText) : '  ';
  const nl = originalText && originalText.includes('\r\n') ? '\r\n' : '\n';
  const body = JSON.stringify(obj, null, indent).replace(/\n/g, nl);
  fs.writeFileSync(file, body + nl);
}

module.exports = {
  BEGIN_MARK, END_MARK,
  ts, ensureDir, sha256, backupFile, listFilesRecursive, copyInto,
  extractMarkerBlock, hasMarkerBlock, upsertMarkerBlock, removeMarkerBlock,
  detectIndent, readJson, writeJsonPreserving,
};
