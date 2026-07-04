# AGENTS.md — token-engineering-harness

Inherits the machine-global rules (`~/.codex/AGENTS.md` / `~/.claude/CLAUDE.md`).
Local rules below may be stricter but never weaken the global HARD GUARDS
(Gmail draft-only, git boundary check, no metered APIs, Truth-First reporting).

## Purpose

- Token Engineering Harness (TEH): reusable skills/agents/hooks/CLI that cut wasted
  LLM tokens in Claude Code & Codex without lowering output quality.

## Commands

- test: `node --test tests/`
- doctor: `node bin/teh doctor`
- install (preview): `node bin/teh install --dry-run`

## Conventions

- Node only, zero runtime dependencies; no network calls anywhere.
- Hooks observe by default; anything that blocks is opt-in.
- No raw Japanese inside JS regex/string literals in hooks (encoding-guard); use
  \uXXXX escapes or external UTF-8 JSON.
- This repo is the single source; `teh install` copies into `~/.claude` / `~/.codex`.
  Never hand-edit the deployed copies (doctor detects drift).

## References

- HANDOFF: `docs/HANDOFF.md` / Architecture: `docs/architecture.md` / Ledger: `docs/WORKPLAN_token-engineering-harness.md`
