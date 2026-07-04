---
name: delegation-orchestrator
description: |
  Plan with the top model, implement with a cheaper worker from a written task spec,
  audit the diff with the top model, report concisely. トリガー: 委譲して, 実装を委譲,
  ワーカーに任せて, Task Spec, 計画→実装→監査.
---

# Delegation Orchestrator

The top model is the **owner**: it understands, decides, specifies, and audits.
Workers **execute** a written spec. Nothing ambiguous is ever delegated downward.

## Flow

1. **Plan (top model, read-only).** Understand the requirement; scout files (delegate the
   scan to a cheap scout when it exceeds a handful of files); classify: tiny → do it
   yourself; risky (security/DB/auth/billing/audit/prod/data-loss) → stay on top model
   end-to-end; else ↓
2. **Spec.** Write `.ai/task-specs/<YYYYMMDD-HHMMSS>-<slug>.md` from
   `templates/task-spec.md`. Keep it under ~60 lines: goal (1-3 lines), non-goals, likely
   files, required changes (concrete), constraints, tests to run, acceptance criteria,
   risk flags, report level. No source dumps — reference `path:line`. If the spec won't
   fit, split the task and spec the first slice.
3. **Implement (worker).** Invoke the implementation worker (subagent with write access),
   passing the spec path. Worker rules: follow the spec exactly, smallest defensible diff,
   no new dependencies unless the spec allows, no architectural improvisation — if the
   spec is wrong or blocked, stop and return the question instead of guessing. Run the
   listed tests; return changed files + test output summary (failures verbatim, successes
   as counts).
4. **Audit (top model, read-only).** Review `git diff --stat` then targeted per-file
   diffs. Checklist: spec satisfied / no scope creep / no silent contract changes /
   tests listed actually ran and pass / risk-flag areas untouched or properly handled /
   nothing valuable deleted. Findings → back to the worker as spec deltas (max 2
   fix cycles, then stop and surface to the user).
5. **Report** at the spec's report level (see `report-budget-controller`).

## What each stage may consume

- Planner reads: the files the change touches + their direct callers. Not the tree.
- Worker reads: spec + listed files. It asks the scout for anything missing.
- Auditor reads: the diff + tests output + risk-relevant neighbors. Not the tree.

## Guard rails

- Specs and audits live in files; chat carries the summary.
- A worker's "done" is a claim, not a fact: the audit step exists because cheap-model
  self-reports are the least reliable token in this pipeline. Never skip the audit to
  save tokens.
- Parallel workers only on genuinely independent slices (no shared files); cap fan-out
  at ~4 and merge sequentially.
- If the user is mid-conversation and the task is small, all of this collapses to
  "just do it" — the orchestrator is for work with real surface area, not a tax on
  every request.
