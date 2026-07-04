<!-- Standalone-profile block for a global CLAUDE.md (English, self-contained).
     `teh install --profile standalone` inserts everything between the markers.
     Integrated environments use global-block.integrated.ja.md instead. -->

<!-- BEGIN TOKEN ENGINEERING HARNESS -->
### Token Engineering Policy
- Use the cheapest capable model+effort; delegate instead of switching the parent model:
  top model = planning, ambiguity, architecture, risk, final review; worker (sonnet) =
  implementation from a written spec; cheap scout = search/summaries. Decision table:
  `skills/model-effort-router/SKILL.md`. An explicit user model/effort instruction always wins.
- Reports follow the Report Budget (MIN/STANDARD/DEBUG/DESIGN/FULL; default STANDARD).
  Never paste full logs, full diffs, or progress play-by-play; numbers and evidence paths
  are never cut (`skills/report-budget-controller/SKILL.md`).
- Shrink output at the source: `git diff --stat` first, failures-only test output, spool
  big logs (`skills/shell-output-budget/SKILL.md`). Read only relevant files.
- YAGNI: prefer existing code / stdlib / current deps / minimal diff
  (`skills/ponytail-lite/SKILL.md`).
- Savings never apply to: security, authn/authz, DB/migrations, billing, audit trails,
  prod impact, data-loss risk, tests, requirement clarity — top-model review is mandatory there.
- At task boundaries in long sessions, suggest /clear or /compact
  (`templates/compact-summary.md`).
<!-- END TOKEN ENGINEERING HARNESS -->
