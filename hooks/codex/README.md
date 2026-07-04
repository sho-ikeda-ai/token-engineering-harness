# TEH hooks for Codex (manual wiring, experimental)

Codex protects hook configuration with a **trust hash**: any change to hook entries in
`config.toml` requires interactive re-approval on next launch. For that reason TEH
**never edits `~/.codex/config.toml` automatically** — wiring is a deliberate, human step.

Status: **experimental.** The hook payload delivered by Codex has not been verified to
match the Claude Code shape on every version. The TEH hook scripts fail open (exit 0 on
any parse mismatch), so the worst case is "no metering", never a broken session.

## Manual steps

1. Deploy the shared hook scripts first (`teh install` puts them under
   `~/.claude/hooks/teh/`; both hosts share the same files and the same ledger).
2. Open `~/.codex/config.toml` and append the blocks from `config-snippet.toml`,
   replacing `%TEH_HOOK_DIR%` with the absolute deployed path.
3. Restart Codex and approve the new hooks when prompted (trust-hash flow).
4. Verify: run one short session, then check a new line appeared in
   `~/.token-engineering-harness/ledger/<YYYY-MM>.jsonl` with `"surface":"codex"`.
   If no line appears, the payload shape differs — file an issue; do not force it.

## What is wired

- `PostToolUse` → `post-tool-meter.js --host codex` (counters only)
- `Stop` → `session-end-ledger-writer.js --host codex` (Codex has no SessionEnd;
  Stop is the closest boundary — expect one record per run in exec mode)

The opt-in command guard is **not** offered for Codex: PreToolUse deny semantics
differ per version, and a mis-firing guard is worse than no guard.
