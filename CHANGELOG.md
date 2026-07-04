# Changelog

## v0.1.2 (2026-07-04)

- New: `teh impact` — aggregates real token usage from Claude Code transcripts into
  a before/after dashboard (impact.html: KPI cards + 3 charts, install-date marker)
  and `teh impact --png` (wide 1600x900 + vertical story 1080x1920 for X/GitHub/Shorts).
  Small-sample periods are labeled "observation period" on both the HTML and images.
- New: `scripts/strip-local-only.js` + `<!-- LOCAL-ONLY:START/END -->` marker
  convention — lets machine-specific notes (e.g. a cross-agent messaging hook a
  local automation adds to every repo's CLAUDE.md) live in the repo without
  breaking `pack-github`'s public-clean guarantee.
- Fix: report-budget-controller now forbids step-by-step narration before tool
  calls and unsolicited supplements (usage tips, file sizes) unless asked.

## v0.1.1 (2026-07-04)

- New: UserPromptSubmit policy bridge — injects the token policy ONCE per session,
  so sessions already in flight (started before install/upgrade) pick up the policy
  on their next prompt instead of waiting for a restart.

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
