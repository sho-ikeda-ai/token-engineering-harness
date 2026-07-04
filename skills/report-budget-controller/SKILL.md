---
name: report-budget-controller
description: |
  Size chat reports to the task: REPORT_MIN/STANDARD/DEBUG/DESIGN/FULL. No full logs,
  no full diffs, no play-by-play. Verification facts (numbers, evidence paths) are never
  cut. トリガー: 報告を短く, 簡潔に報告, レポートレベル, REPORT_MIN.
---

# Report Budget Controller

Shorten the **report**, never the **work**. A report level caps prose, not verification.
Every level, including MIN, must still carry: what changed, test/check result with real
numbers, and where the evidence lives (paths). Cutting those is falsification, not brevity.

## Levels and defaults

| Level | Default for | Size |
|---|---|---|
| REPORT_MIN | typos, small fixes, 1-3 files, one test repaired | 3-8 lines |
| REPORT_STANDARD | normal implementation, several files | 8-15 lines |
| REPORT_DEBUG | failure/root-cause work | 8-15 lines |
| REPORT_DESIGN | architecture, security, DB, auth, billing, audit decisions | as needed, no filler |
| REPORT_FULL | only when explicitly requested, or safety-critical review | detailed; long parts go to files |

When unsure between two levels, pick the smaller one — the user can always ask for more.
An explicit "詳しく/in detail/for review" request overrides everything → FULL.

## Templates

REPORT_MIN:
```
完了しました。
変更: <file>: <one phrase>
テスト: <command>: <pass/fail + count>
注意: <risk or 特になし>
```

REPORT_STANDARD adds: 実施 (1-3 bullets), 変更ファイル list, 残リスク.
REPORT_DEBUG: 原因 / 対応 / 変更ファイル / 確認 (command: result) / 残り.
REPORT_DESIGN: 方針(conclusion first) / 理由(2-4) / リスク / 次. Repo-specific facts only —
no textbook prose.

## Hard rules (all levels)

- No full command logs. Failures: quote the failing lines (≤10) + the log's file path.
- No full diffs. Use `git diff --stat` shape summaries; per-file one-phrase descriptions.
- No progress play-by-play ("now I will...", "let me...") — one status line per direction
  change is enough while working; the final message carries everything that matters.
- No preamble ("Great question", restating the request) and no closing essays.
- Before a tool call: at most ONE short sentence of intent. Never narrate the steps
  you are about to take — the calls themselves show that.
- No unsolicited supplements: usage tips, file sizes, how-to notes, alternatives —
  only when asked. Deliver the thing, not the manual.
- Long detail that genuinely matters → write to a file, link it, summarize in ≤3 lines.

## Truth compatibility (non-negotiable)

- Positive claims keep their numbers and citations at every level ("tests: 34/34 pass",
  not "tests pass").
- Partial results, skipped checks, and failures are stated in the same message as any
  success claim — brevity never buries them. If disclosure needs 5 extra lines, spend them.
- Never let a level cap force vagueness on money, dates, or contract terms; quote those
  exactly.
