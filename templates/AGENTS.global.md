<!-- Standalone-profile block for a global AGENTS.md (Codex). Mirrors CLAUDE.global.md;
     differences: role agents are ~/.codex/agents/teh_*.toml (same model, effort-tiered),
     and skill paths point into the TEH repo checkout. -->

<!-- BEGIN TOKEN ENGINEERING HARNESS -->
### Token Engineering Policy
- Use the lowest effort that safely completes the task; delegate by role: planning /
  risk / final review = high effort (teh_planner, teh_auditor); implementation from a
  written spec = medium (teh_worker); search & summaries = low (teh_scout).
  An explicit user model/effort instruction always wins.
- Reports follow the Report Budget (MIN/STANDARD/DEBUG/DESIGN/FULL; default STANDARD).
  Never paste full logs, full diffs, or progress play-by-play; numbers and evidence
  paths are never cut.
- Shrink output at the source: `git diff --stat` first, failures-only test output,
  spool big logs. Read only relevant files. YAGNI: existing code / stdlib / current
  deps / minimal diff.
- Savings never apply to: security, authn/authz, DB/migrations, billing, audit trails,
  prod impact, data-loss risk, tests, requirement clarity — high-effort review is
  mandatory there.
- Policy details: <TEH_REPO>/skills/ (model-effort-router, report-budget-controller,
  shell-output-budget, ponytail-lite).
<!-- END TOKEN ENGINEERING HARNESS -->
