@AGENTS.md

<!-- Claude Code reads CLAUDE.md, not AGENTS.md; the import above keeps one
     source of truth per repo (official recommended pattern on Windows, where
     symlinks need admin rights). Add Claude-specific notes below only when
     behavior must differ from AGENTS.md. -->

<!-- LOCAL-ONLY:START (machine-specific cross-agent messaging note; stripped from
     the public branch by scripts/strip-local-only.js before publish - see
     docs/publishing.md. Do not add personal paths/names to this file outside
     this block.) -->
## 連絡箱(agent-mail) — 担当間の連絡(2026-07-05 エルメスエージェント基盤)

- セッション開始時に自分宛を確認: `node C:\Users\PC_User\.claude\automation\scripts\agent-mail.js list --to teh --status new` → 内容は `read <id>`、処理後 `done <id>`
- 他担当への依頼・共有・引き継ぎ、および**池田さんに伝える価値のある発見・提案・完了報告**は投函:
  `node C:\Users\PC_User\.claude\automation\scripts\agent-mail.js post --from teh --to <宛先id> --type info|request|handoff|alert --subject "..." --body "..."`
- **to hermes に投函すると、エルメスエージェントが30分以内にSlackで池田さんへ届ける**(能動的な報告・提案はこの経路を使う)
- 宛先id一覧: C:\dev\hermes-base\delegate\allowlist.json の cwd_to_agent
<!-- LOCAL-ONLY:END -->
