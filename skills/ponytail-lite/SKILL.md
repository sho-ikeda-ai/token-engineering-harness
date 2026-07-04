---
name: ponytail-lite
description: |
  YAGNI enforcement: prefer not building, prefer existing code/stdlib/current deps,
  smallest defensible diff, no speculative abstraction. Safety, validation, and tests are
  exempt from minimalism. トリガー: 過剰実装チェック, YAGNI, 最小差分で, シンプルに実装.
---

# Ponytail-lite (YAGNI layer)

**Defer clause:** if the full Ponytail tool is installed and active in this environment,
follow its mode selection (lite by default; full for implementation phases; ultra only on
explicit request; off/lite for design, DB, auth, billing, audit work) and skip this file.
This skill is the built-in substitute — nothing is installed on your behalf.

## The ladder (try each rung before writing new code)

1. **Nothing** — is the requirement already met, or does the problem disappear on
   inspection? Say so instead of building.
2. **Existing code** — a helper/pattern in this repo already does it (search first).
3. **Platform/stdlib** — a native feature covers it (no wrapper needed).
4. **Existing dependency** — something already in the lockfile does it.
5. **Few lines inline** — a small local change, no new module.
6. **New module** — only now, sized to today's requirement.
7. **New dependency** — last resort; needs explicit justification (and, where local
   rules require, user approval).

## Minimal-diff rules

- Size the solution to the stated requirement, not to imagined future ones. No config
  surfaces, plugin systems, generics, or "flexibility" nobody asked for.
- Don't refactor neighbors in passing; note the opportunity, stay in scope.
- Three similar lines don't need an abstraction. The third *duplication of a concept*
  might — abstract on the concept, not the line count.
- Delete code you replaced. Dead paths cost every future reader tokens.
- New files need a reason a existing file couldn't host the code.

## Exempt from minimalism (never "simplified" away)

Input validation, authn/authz checks, error handling on external boundaries, tests for
changed behavior, accessibility, data-loss protections, audit/log trails required by the
domain. Minimalism trims speculation, not safety. If a "simplification" would remove any
of these, it's a regression, not a cleanup.

## Smell checklist (run on your own diff before hand-off)

- A layer that only forwards calls / config nothing reads / interface with one impl?
- More lines of scaffolding than of behavior change?
- New dependency for something ≤30 lines of stdlib code?
- "Manager", "Factory", "Abstract" in a name introduced for one concrete case?

Any yes → collapse it before review.
