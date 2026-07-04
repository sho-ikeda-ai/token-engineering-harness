'use strict';
// teh guard on|off|status - toggles the opt-in command guard flag in config.json.
const fs = require('fs');
const P = require('./paths');
const F = require('./fsutil');

function run(args) {
  const sub = args[0] || 'status';
  const cfg = F.readJson(P.configPath(), { commandGuard: false, globalLineBudget: 200 });
  if (sub === 'on' || sub === 'off') {
    cfg.commandGuard = sub === 'on';
    F.ensureDir(P.TEH_HOME);
    fs.writeFileSync(P.configPath(), JSON.stringify(cfg, null, 2) + '\n');
  } else if (sub !== 'status') {
    console.log('usage: teh guard on|off|status');
    process.exitCode = 1;
    return;
  }
  console.log('command guard: ' + (cfg.commandGuard ? 'ON' : 'off')
    + '  (' + P.configPath() + ')');
}

module.exports = { run };
