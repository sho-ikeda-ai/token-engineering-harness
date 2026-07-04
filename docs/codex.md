# Codex integration

Codex hosts typically run one model family, so TEH expresses role tiers through
`model_reasoning_effort` instead of model switching.

## Agents (`agents/codex/teh_*.toml`, deployed to `~/.codex/agents/`)

| Agent | effort | sandbox |
|---|---|---|
| teh_planner | high | read-only |
| teh_worker | medium | **workspace-write** |
| teh_scout | low | read-only |
| teh_auditor | high | read-only |
| teh_guardian | low | read-only |

`model` is intentionally omitted — agents inherit the host default, so the files stay
valid whatever model the environment runs. Add a `model = "..."` line per agent if you
want to pin one.

## Global block

`teh install` inserts the marker block into `~/.codex/AGENTS.md` (mirrors the Claude
block; same budget rules).

## Hooks — manual, by design

Codex protects hook wiring with a trust hash; TEH never edits `config.toml`.
Follow `hooks/codex/README.md`: copy `config-snippet.toml` blocks in by hand, restart,
approve. The scripts are shared with Claude Code (`--host codex` flag) and fail open if
the payload shape differs. Status: experimental until you see a `"surface":"codex"`
line in the ledger.

## Skills

TEH deploys no skills to Codex (its skill loader has a hard context budget). The
AGENTS.md block points to the Claude-side skill files, which Codex can read as plain
files when it needs the detail.
