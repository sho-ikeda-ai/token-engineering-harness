<!-- Integrated-profile block（この環境の CLAUDE.md/AGENTS.md 用・日本語・7行）。
     200行予算内に収めるため最小。詳細はスキル側に置く（配置決定木§1-3準拠）。
     ミラー原則: 両ファイルに同一趣旨で挿入。パスのみホスト差を許容。
     shell出力節約は既存 token-saver が正本のためここでは触れない。 -->

<!-- BEGIN TOKEN ENGINEERING HARNESS -->
### Token Engineering Harness
- 開発タスクは委譲型: Fable=要件理解・設計・Task Spec・diff監査 / 実装=implementation-worker-sonnet / 探索=codebase-scout-cheap。判断表: `~/.claude/skills/model-effort-router/SKILL.md`
- 報告は Report Budget(MIN/STANDARD/DEBUG/DESIGN/FULL・既定STANDARD)。diff全文・ログ全文・実況を貼らない。数値と証跡パスは削らない: `~/.claude/skills/report-budget-controller/SKILL.md`
- リスク領域(セキュリティ/DB/認証/課金/監査/本番/データ損失)は節約対象外=Fable監査必須。ユーザーの明示モデル/effort指示は常に最優先。
<!-- END TOKEN ENGINEERING HARNESS -->
