# Report budget

Source of truth: `skills/report-budget-controller/SKILL.md`; quick card:
`templates/report-policy.md`.

Five levels — MIN (3-8 lines) / STANDARD (8-15) / DEBUG (8-15) / DESIGN (as needed,
no filler) / FULL (on request or safety-critical). Default STANDARD; when torn between
two, pick the smaller.

Non-negotiables at every level:

- Numbers stay attached to claims ("34/34 pass", never "tests pass").
- Failures and partials are disclosed beside successes — brevity never buries them.
- No full logs (quote failing lines + file path), no full diffs (`--stat` shapes),
  no play-by-play, no preamble.
- Money, dates, contract terms: quoted exactly, regardless of level.

The point: **shorten the report, never the work.** A report level caps prose, not
verification. If honest disclosure needs five more lines, spend them.
