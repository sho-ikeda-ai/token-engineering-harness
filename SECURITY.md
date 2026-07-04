# Security Policy

## Design principles

This project modifies AI-assistant configuration on your machine. It is built to be
safe-by-default:

- **No network access.** No component (CLI, hooks, skills, agents) makes any network
  request. Everything operates on local files only.
- **No secrets handling.** Nothing reads credentials, tokens, or key files. The ledger
  records only counts and sizes (bytes, lines, file counts), never file contents.
- **Reversible by construction.** Every change made by `teh install` is:
  - preceded by a timestamped backup under `~/.token-engineering-harness/backups/`,
  - wrapped in `BEGIN/END TOKEN ENGINEERING HARNESS` markers (text files) or recorded
    in an install manifest (JSON edits, copied files),
  - removable with `teh uninstall` (also supports `--dry-run`).
- **No destructive operations.** The CLI never deletes user files; uninstall removes only
  files it installed (verified against the manifest) and restores marker regions.
- **Blocking is opt-in.** Default hooks only observe and record. The command-guard hook
  (which can deny wasteful commands with a suggested alternative) must be explicitly
  enabled and can always be bypassed by the user.
- **No `curl | bash`.** Installation is: clone the repo, run `node bin/teh install --dry-run`,
  review the plan, then run without `--dry-run`.

## Scope of changes

`teh install` touches only:

| Target | Change | Reversal |
|---|---|---|
| `~/.claude/skills/` | copies skill directories | manifest-tracked delete |
| `~/.claude/agents/` | copies agent .md files | manifest-tracked delete |
| `~/.claude/hooks/teh/` | copies hook scripts | manifest-tracked delete |
| `~/.claude/settings.json` | adds hook entries (JSON) | backup + manifest-tracked removal |
| global `CLAUDE.md` / `AGENTS.md` | adds a short marker block | marker-region removal |
| `~/.codex/agents/` | copies agent .toml files | manifest-tracked delete |
| `~/.token-engineering-harness/` | creates backups/ledger dirs | plain delete |

It never edits: permissions/deny lists, credentials, MCP server definitions,
`config.toml` hook arrays (Codex hook wiring is manual by design — its trust-hash
mechanism should stay under human control).

## Reporting a vulnerability

Open a GitHub issue with the label `security`, or contact the repository owner.
Please do not include exploit details in public issues; ask for a private channel first.
