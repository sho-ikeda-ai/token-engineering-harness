# Model routing

Source of truth: `skills/model-effort-router/SKILL.md` (decision table) and
`skills/delegation-orchestrator/SKILL.md` (the plan → spec → implement → audit loop).

## Design rationale

- **Suggest, never force.** A forced-routing hook with miscalibrated thresholds will
  push work off the top model even when it is the right tool — observed in a
  predecessor system, and the reason TEH's router lives in skills (consulted by the
  planner) instead of hooks (applied to every prompt).
- **Delegation over switching.** Flipping the parent session's model thrashes cache and
  context. Role subagents carry their own `model:`/`effort:`; the parent stays put.
- **Risk floor.** Security / authz / DB / migrations / billing / audit / prod /
  data-loss: top model, high effort, full verification — exempt from every savings rule.
- **User override.** An explicit model/effort instruction from the user beats the table,
  always.

## Tier summary

top+high = decide; mid+medium = build from spec; cheap+low = find/summarize.
Full table with task classes and anti-patterns: the skill file.
