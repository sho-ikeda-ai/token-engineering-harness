# Architecture

TEH's goal: **spend top-model tokens only where they buy quality** — planning, ambiguous
reasoning, risk review — and push everything else down to cheaper models, smaller outputs,
and smaller contexts. Quality is never traded for savings; savings come from waste.

## The five layers

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Routing      model-effort-router skill + role agents     │  which model/effort
│ 2. Delegation   delegation-orchestrator + task-spec         │  who does the work
│ 3. Output       report-budget-controller (5 report levels)  │  how much is said
│ 4. Context      context-budget-auditor + shell-output-budget│  how much is read
│ 5. Observation  hooks (metering) + ledger + guardian + CLI  │  what actually happened
└─────────────────────────────────────────────────────────────┘
```

Layer 1-4 are **behavioral** (skills + agents: they change what the assistant chooses to do).
Layer 5 is **mechanical** (hooks + CLI: it measures, records, and surfaces waste).

## Non-coercion principle

A prior model-routing experiment failed by injecting downshift pressure on every prompt
(miscalibrated thresholds → the top model was avoided even when it was the right tool).
TEH therefore never forces routing:

- The router is a **decision table the planner consults**, not a hook that rewrites requests.
- The guardian and statusline **surface facts and suggest**; they never switch models.
- An explicit user instruction about model/effort **always** overrides every TEH rule.
- High-risk work (security, DB/migrations, auth, billing, audit trails, prod impact,
  data loss) is exempt from all savings rules: top model + full verification.

## Standard flow (delegation)

```
user request
   │
   ▼
Fable planner (top model, high effort, read-only)
   │  classifies task → tiny / normal / risky
   │  tiny  → answer directly, REPORT_MIN
   │  risky → plan + implement under top model, full audit
   │  normal ↓
   │  writes .ai/task-specs/<ts>-<slug>.md   (short, concrete, no source dumps)
   ▼
Sonnet implementation worker (write-enabled, medium effort)
   │  smallest defensible diff, runs specified tests
   ▼
Fable auditor (read-only, high effort)
   │  reviews diff + test results + risk flags; proposes fixes (worker applies)
   ▼
concise report (report-budget level, default STANDARD)
```

Scout (cheap, read-only) can be called by any stage to locate files/patterns.
The parent session stays on the top model; roles run as subagents with their own
`model:`/`effort:` frontmatter — no parent /model flipping.

## Two deployment modes

1. **Standalone (public repo)** — everything self-contained; `shell-output-budget`
   included; global blocks reference only TEH files.
2. **Integrated (this machine)** — installed alongside an existing rule ecosystem:
   - `shell-output-budget` is NOT deployed (a local `token-saver` skill already owns
     that ground; one source of truth).
   - Global marker blocks are a few lines (200-line budget on global instruction files).
   - Codex gets agents + AGENTS.md block only (its skill loader has a hard context
     budget that is already saturated).
   Mode is selected by `teh install --profile standalone|integrated` (auto-detected,
   overridable).

## Deployment model

The repo is the single source of truth. `teh install`:

1. writes a timestamped backup of every file it will touch to
   `~/.token-engineering-harness/backups/<ts>/`
2. copies skills/agents/hooks into place (recorded in `install-manifest.json`)
3. inserts marker blocks into global CLAUDE.md / AGENTS.md (idempotent: replaces its
   own block if present, never touches anything outside the markers)
4. adds hook entries to `~/.claude/settings.json` (JSON edit, manifest-recorded)
5. `teh uninstall` reverses 2-4 from the manifest; `--dry-run` previews both directions.

Deployed copies are never hand-edited; `teh doctor` hashes them against the repo and
reports drift.

## Ledger

Append-only JSONL at `~/.token-engineering-harness/ledger/YYYY-MM.jsonl`, one record per
session-stop, written by the Stop hook from counters accumulated by the PostToolUse hook
(bytes of command output, files read, edits, subagent uses). Proxy metrics only — no
message contents, no file contents. `teh ledger` prints aggregates; the guardian skill
reads recent records to ground its suggestions in observed waste, and `teh status` shows
the current session snapshot.

## Safety envelope

No network. No secrets. No deletes outside the manifest. Blocking hooks opt-in.
Codex `config.toml` hook arrays are never auto-edited (trust-hash mechanism stays under
human control) — examples + manual steps instead. See SECURITY.md.
