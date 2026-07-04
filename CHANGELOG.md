# Changelog

## v0.1.0 (2026-07-04)

Initial release.

- 7 skills: model-effort-router, report-budget-controller, delegation-orchestrator,
  context-budget-auditor, shell-output-budget, ponytail-lite, token-budget-guardian
- 5 Claude Code agents + 5 Codex agents (planner / implementer / scout / auditor / guardian)
- Observation-first hooks for Claude Code (PostToolUse output metering, Stop ledger writer,
  SessionStart context report, PreCompact summary template) + opt-in command guard
- Codex hook examples (manual wiring, trust-hash respected)
- `teh` CLI: doctor / status / audit-context / audit-mcp / audit-skills /
  install / uninstall (both with --dry-run + backups) / ledger / pack-github
- Global instruction marker blocks for CLAUDE.md / AGENTS.md (a few lines each)
- Templates: task-spec, compact-summary, report-policy, global blocks
- Tests: node --test suite (no dependencies)
