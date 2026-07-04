#!/usr/bin/env node
'use strict';
// TEH PreCompact hook: steers the compactor toward continuation-critical facts.
// Fires only on compaction, so it costs nothing per turn. Always exits 0.
try {
  process.stdout.write([
    'Structure the compact summary exactly as: Goal / Current status / Files changed',
    '(path: one phrase) / Decisions (+1-line rationale) / Tests (command -> numbers) /',
    'Open issues (evidence paths) / Next action / Do-not-carry-forward.',
    'Drop: superseded attempts, full logs (keep their file paths), resolved dead ends.',
    'Keep verbatim: money, dates, contract terms, unresolved error messages.',
  ].join(' ') + '\n');
} catch (e) { /* fail-open */ }
process.exit(0);
