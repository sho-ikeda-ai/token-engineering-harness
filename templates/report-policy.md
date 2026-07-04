# Report Policy — quick reference

| Level | When | Shape | Lines |
|---|---|---|---|
| REPORT_MIN | typo/small fix, 1-3 files | 完了 / 変更 / テスト / 注意 | 3-8 |
| REPORT_STANDARD | normal implementation | + 実施 / 変更ファイル / 残リスク | 8-15 |
| REPORT_DEBUG | failures, root cause | 原因 / 対応 / 変更 / 確認 / 残り | 8-15 |
| REPORT_DESIGN | architecture & risk decisions | 方針 / 理由 / リスク / 次 | as needed |
| REPORT_FULL | explicit request, safety-critical | detailed; bulk into files | — |

Always, at every level:
- numbers with claims ("34/34 pass", not "tests pass"); evidence paths for anything big
- failures/partials disclosed next to successes — never buried by brevity
- no full logs, no full diffs, no play-by-play, no preamble
- user asks for detail → FULL wins immediately
