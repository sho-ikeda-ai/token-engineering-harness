---
name: model-effort-router
description: |
  Pick the cheapest model+effort that safely completes a task; route implementation to
  subagents instead of switching the parent model. Top model stays for planning, ambiguity,
  architecture, risk, and final review. トリガー: モデル選定, ルーティング, どのモデルで,
  実装をSonnetに, effort選択.
---

# Model / Effort Router

Rule zero: **an explicit user instruction about model or effort always wins.** This skill
is a default, not a gate. Never inject downshift pressure on work the user assigned to a
specific model. Quality floors beat savings everywhere.

## Decision table

| Task class | Model | Effort |
|---|---|---|
| Initial design, ambiguous specs, cross-cutting refactor, architecture | top (Fable) | high / xhigh |
| Security, authn/authz, DB schema & migrations, billing, audit logs, prod incidents, data-loss risk, pre-release & pre-publish review | top (Fable) | high / xhigh — **never downgraded** |
| Implementation plan, impact analysis, task-spec writing, option comparison | top (Fable) | high |
| Implementation from a written spec, feature work, bug fixes, tests, scripts, hooks/skills authoring, doc updates | mid (Sonnet) | medium |
| Tiny fixes: typos, lint, renames, small test repairs, file moves | mid (Sonnet) | low |
| Read-only scouting, grep-result triage, summarizing, formatting, changelog drafts, log compression | cheap (Haiku or Sonnet-low) | low |

Codex hosts have one model family: express the same tiers with `model_reasoning_effort`
(planner/auditor=high, worker=medium, scout=low).

## How to route (Claude Code)

Do **not** flip the parent session's model. The parent stays on the top model as
planner/auditor; work moves to role subagents that carry their own `model:`/`effort:`
frontmatter:

- `token-planner-fable` — plan + task spec (read-only)
- `implementation-worker-sonnet` — the only write-enabled role
- `codebase-scout-cheap` — locate files/symbols/patterns (read-only)
- `audit-reviewer-fable` — diff/test/risk review (read-only)

Flow and hand-off format: see the `delegation-orchestrator` skill.

## When NOT to delegate

- **Tiny tasks** (< ~15 min, 1-3 files, obvious change): delegation overhead costs more
  than it saves. Do it directly, report at REPORT_MIN.
- **Risk-flagged tasks** (second row above): top model end-to-end. Savings rules do not
  apply to safety.
- **Specs that would exceed ~60 lines**: the task is too entangled to hand off — split it
  first, or keep it with the planner.

## Effort selection

Default `medium`. Drop to `low` only for mechanical work with unambiguous success criteria.
Raise to `high` when: the search space is wide, requirements conflict, failure is expensive,
or the output is a decision (not an artifact). `xhigh`/`max` is for genuinely hard reasoning
(architecture trade-offs, incident forensics, final audits) — not a default.

## Anti-patterns (all observed in the wild)

- Top model grinding through a 40-file mechanical migration a worker could do from a
  10-line spec.
- Repeated `/model` flipping in the parent session (cache-hostile, context-hostile).
- Delegating an ambiguous design decision to a cheap model because "it's just a draft".
- Uncapped subagent fan-out; more than ~4 concurrent workers is a smell — batch instead.
- Downgrading effort on a task whose failure cost is asymmetric (migrations, auth).
