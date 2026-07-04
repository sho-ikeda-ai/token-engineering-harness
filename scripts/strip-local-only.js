#!/usr/bin/env node
'use strict';
// Removes <!-- LOCAL-ONLY:START --> ... <!-- LOCAL-ONLY:END --> blocks from a
// file in place. Used before publishing so machine-specific notes (e.g. a
// cross-agent messaging hook injected into every C:\dev repo's CLAUDE.md)
// never reach the public branch. See lib/teh/packgithub.js for the scanner
// side of this convention and docs/publishing.md for when to run this.
const fs = require('fs');
const path = require('path');
const { stripLocalOnlyBlocks } = require('../lib/teh/packgithub');

function main(argv) {
  const files = argv.slice(2);
  if (!files.length) {
    console.log('usage: node scripts/strip-local-only.js <file> [file...]');
    process.exitCode = 1;
    return;
  }
  for (const rel of files) {
    const p = path.resolve(rel);
    const before = fs.readFileSync(p, 'utf8');
    const after = stripLocalOnlyBlocks(before);
    if (after !== before) {
      fs.writeFileSync(p, after);
      console.log('stripped: ' + rel);
    } else {
      console.log('no local-only block: ' + rel);
    }
  }
}

main(process.argv);
