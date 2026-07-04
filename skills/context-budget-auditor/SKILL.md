---
name: context-budget-auditor
description: |
  Audit always-loaded context: global CLAUDE.md/AGENTS.md size, repo instruction files,
  skill count/descriptions, MCP servers, memory size. Propose moves to skills and disable
  candidates — never auto-remove. トリガー: コンテキスト監査, CLAUDE.md肥大, MCP棚卸し,
  常時ロード削減.
---

# Context Budget Auditor

Every line in an always-loaded file is paid on **every** session. The audit finds what
is loaded but not earning its keep, and proposes (never executes) the move down the
loading hierarchy: always-loaded → skill (loaded on use) → docs (loaded on demand) → gone.

## Budgets (defaults; local governance rules override)

| File | Budget | Rationale |
|---|---|---|
| global CLAUDE.md / AGENTS.md | ≤ 200 lines each | shared across every session |
| per-repo AGENTS.md | ≤ 30 lines | repo facts only; CLAUDE.md = `@AGENTS.md` import |
| skill frontmatter description | ≤ 4 lines | descriptions load even when skills don't |
| MCP servers enabled per surface | what's actually used | each server ships tool schemas into context |

## Procedure

1. **Measure.** `node bin/teh audit-context` (line counts + marker checks + oversized-file
   list), `teh audit-mcp` (configured vs plausibly-used servers), `teh audit-skills`
   (skill count, description sizes, giant SKILL.md files).
2. **Classify each oversized block:**
   - procedure/checklist used in specific workflows → move to a skill
   - reference material, history, design rationale → move to docs/, link it
   - rule already enforced by a hook or audit script → delete the prose, keep the pointer
   - duplicated between global and repo files → keep one, reference from the other
   - genuinely needed every session → keep, but compress wording
3. **Report** as REPORT_STANDARD: current numbers vs budget, top offenders with line
   ranges, concrete move proposals. Removals and MCP disables are always proposals for
   the user — this skill has no authority to change configs.

## Session hygiene

- Task finished, new topic next → suggest `/clear` (fresh context beats a long tail).
- Context > ~70% mid-task → suggest `/compact` at the next natural boundary, using
  `templates/compact-summary.md` (keep: goal, current state, changed files, decisions,
  open issues, next action; drop: old attempts, full logs, resolved dead-ends).
- The same investigation appearing twice in one session → write findings to a file
  immediately; the file survives compaction, the chat doesn't.

## What NOT to trim

Safety rules, hard guards, verification requirements, and anything whose absence changes
behavior dangerously. When in doubt whether a rule is live, propose demotion to the user
with evidence of non-use (e.g. no hits in recent transcripts) — don't judge it dead alone.
