# Token Engineering Harness (TEH)

Cut wasted LLM tokens in **Claude Code** and **Codex** — without cutting quality.

The top model (e.g. Fable) is your most expensive employee. TEH stops it from doing
intern work: implementation grinding, tree-walking, log-dumping, and 40-line status
essays. It stays where it earns its rate — planning, ambiguous reasoning, risk review —
while cheaper role agents execute written specs, and hooks quietly measure what your
sessions actually spend.

**What gets saved:** top-model time on mechanical work, oversized reports, full-log/
full-diff pastes, whole-tree reads, always-loaded config bloat, unused MCP schemas,
repeated research, speculative abstraction.
**What is never saved:** requirement understanding, security, authn/authz, DB/migrations,
billing, audit trails, tests, data-loss protection, final review. Savings come from
waste, not from rigor. An explicit user model/effort instruction always wins.

## How it works — five layers

| Layer | Mechanism | Form |
|---|---|---|
| Routing | decision table: which model/effort per task class | skill + 5 role agents per host |
| Delegation | plan (top) → task spec → implement (mid) → audit (top) | skill + `templates/task-spec.md` |
| Output | 5 report levels (MIN/STANDARD/DEBUG/DESIGN/FULL) | skill + templates |
| Context | budgets for always-loaded files, skills, MCP | skill + `teh audit-*` |
| Observation | per-session counters → monthly JSONL ledger | hooks + `teh status` / `teh ledger` |

Nothing is coercive by design: hooks **observe** (fail-open, exit 0); the one blocking
hook (command guard) is **opt-in**; the router is a table the planner consults, not a
rewrite layer. A previous-generation forced-routing experiment taught us that downshift
pressure on the top model degrades quality — TEH suggests, humans decide.

## Quick start

```bash
git clone <this repo> && cd token-engineering-harness
node --test tests/test_*.js        # 26 tests, no dependencies
node bin/teh install --dry-run     # review the exact plan
node bin/teh install               # backup -> copy -> marker blocks -> hooks
node bin/teh doctor                # health + drift check
```

Requires Node >= 18. No npm install, no network, ever.

## What `teh install` touches

| Target | Change | Undo |
|---|---|---|
| `~/.claude/skills/` | +6-7 skill dirs | `teh uninstall` |
| `~/.claude/agents/` | +5 role agents (planner/worker/scout/auditor/guardian) | manifest-tracked |
| `~/.claude/hooks/teh/` | observation hooks + opt-in guard | manifest-tracked |
| `~/.claude/settings.json` | hook entries (5 events) | backup + tracked removal |
| global `CLAUDE.md` / `AGENTS.md` | one short `BEGIN/END TOKEN ENGINEERING HARNESS` block | marker removal |
| `~/.codex/agents/` | +5 TOML agents (effort-tiered) | manifest-tracked |

Every touched file is backed up first to `~/.token-engineering-harness/backups/<ts>/`.
If the marker block would push a global file over its line budget (default 200),
install **aborts** without touching it. Two profiles, auto-detected: `standalone`
(everything) and `integrated` (defers to an existing output-thrift skill and uses
compact block text). Codex `config.toml` hooks are **never auto-edited** — its
trust-hash flow stays human-controlled (see `hooks/codex/README.md`).

## Commands

```
teh doctor | status | ledger [--month YYYY-MM]
teh audit-context | audit-mcp | audit-skills
teh install [--dry-run] [--profile P] [--enable-guard] | uninstall [--dry-run]
teh guard on|off|status
teh pack-github        # pre-publication secret/personal-trace scan
```

## Optional integrations

- **Ponytail** — if installed, follow its own mode selection; TEH ships `ponytail-lite`
  (a built-in YAGNI skill) so nothing needs installing.
- **RTK** — if you already use it for output tee/compression, keep it; the
  `shell-output-budget` skill is the tool-free equivalent.

TEH never installs third-party tools on your behalf.

## Safety

Local files only; no network; no secrets read; counters-only ledger (no contents);
blocking opt-in; everything reversible (`--dry-run` + backups + manifest + uninstall).
Details: [SECURITY.md](SECURITY.md). Publishing this repo or any fork remains a human
decision — `teh pack-github` only verifies cleanliness.

## License

MIT
