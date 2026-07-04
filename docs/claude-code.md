# Claude Code integration

## Role agents (`agents/claude/`, deployed to `~/.claude/agents/`)

| Agent | model / effort | writes? | job |
|---|---|---|---|
| token-planner-fable | fable / high | no | plan + task spec |
| implementation-worker-sonnet | sonnet / medium | **yes** | execute spec, run tests |
| codebase-scout-cheap | haiku / low | no | locate files/symbols |
| audit-reviewer-fable | fable / high | no | diff/test/risk review |
| token-budget-guardian | sonnet / low | no | waste audit |

Only the worker holds Edit/Write — enforced by frontmatter `tools:` and verified by
`tests/test_policy.js`. The parent session never flips `/model`; it delegates.

## Hooks (deployed to `~/.claude/hooks/teh/`, wired in `settings.json`)

| Event | Script | Behavior |
|---|---|---|
| PostToolUse (Bash/Read/Edit/Write/Agent/Task) | post-tool-meter.js | count bytes/reads/edits; silent |
| SessionStart (startup) | session-start-context-report.js | sweep stale state → ledger; print ONE line only if over budget |
| SessionEnd | session-end-ledger-writer.js | flush counters → monthly JSONL |
| PreCompact | pre-compact-template.js | inject summary structure |
| PreToolUse (Bash) | pre-tool-command-guard.js | inert unless `commandGuard: true`; then deny+suggest (exit 2) |

All hooks fail open: a hook bug can never block a session. Claude Code's PreToolUse has
no "warn but allow" channel, which is why the guard is deny-or-silent and opt-in.

## Skills

Deployed to `~/.claude/skills/`; loaded on demand by description match. The integrated
profile skips `shell-output-budget` when a local thrift skill (e.g. token-saver) exists.
