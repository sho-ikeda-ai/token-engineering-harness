---
name: shell-output-budget
description: |
  Compress command/file output at the source: bounded output, locate-then-ranged-read,
  failures-only, spool big logs. Shrink the display, never the work. トリガー: 出力を絞って,
  ログ圧縮, shell出力節約.
---

# Shell Output Budget

**Defer clause:** if this environment already has a local output-thrift policy (e.g. a
`token-saver` skill), that policy is the source of truth — apply it and skip this file.
This skill is the standalone equivalent for environments that lack one.

Principle: full coverage of the work, minimal footprint in context. Never call skipped
work "saved tokens".

## Four rules

1. **No unbounded output.** Every command gets a compact flag or `| head -N` / `| tail -N`
   (default N=40).
2. **Locate → ranged read.** List names first, pick the target, read only the needed line
   range. Full-file `cat` is the last resort (exception: small first-time files, ~<150
   lines — one read is cheaper than three ranged ones).
3. **Failures only.** Tests/builds/linters: show failing lines + tail summary. Success is
   an exit code, not a wall of green.
4. **Spool big output.** Redirect to a temp file once; dig with `tail`/`grep`. Never rerun
   an expensive command just to see more of its output.

```bash
LOG="${TMP:-/tmp}/teh-$$.log"; <cmd> >"$LOG" 2>&1; echo "exit=$?"
tail -40 "$LOG"; grep -nE "FAIL|ERROR|error\[" "$LOG" | head -20
```

## Substitutions

| Instead of | Use |
|---|---|
| `git status` / `git log` | `git status -sb` / `git log --oneline -20` |
| `git diff` (everything) | `git diff --stat`, then `git diff -U2 -- <path>` |
| `ls -R`, `tree` | targeted glob: `rg --files -g '<pat>' \| head -50` |
| `grep pat` (full lines everywhere) | `rg -l pat` → then `rg -n -C2 --max-count 5 pat <file>` |
| `pytest -vv` / `npm test` raw | quiet flags, spooled, failures extracted |
| `cat data.json` | `jq '<keys>'` / head + schema sample |
| verbose installs | `npm i --no-audit --no-fund --loglevel=error`, `pip install -q` |

## Safety clauses (what thrift may never do)

- Always show the exit code. A short display is not a shorter verification.
- Before claiming success, grep the spool for FAIL/ERROR — an off-screen failure is
  still a failure and must be reported.
- Money, dates, contract terms, legal text: read the actual lines, never quote from a
  truncated view.
- When the user asks for full output, give full output.
