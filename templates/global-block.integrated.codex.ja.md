<!-- Integrated-profile block（~/.codex/AGENTS.md 用・日本語・7行）。
     global-block.integrated.ja.md（CLAUDE.md用）のミラー。差分はエージェント名のみ
     （Codexは同一モデル+effort階層のため teh_*.toml を参照する）。 -->

<!-- BEGIN TOKEN ENGINEERING HARNESS -->
### Token Engineering Harness
- 開発タスクは委譲型: 設計・監査=teh_planner/teh_auditor(high effort) / 実装=teh_worker(medium) / 探索=teh_scout(low)（~/.codex/agents/teh_*.toml）。判断表: `~/.claude/skills/model-effort-router/SKILL.md`
- 報告は Report Budget(MIN/STANDARD/DEBUG/DESIGN/FULL・既定STANDARD)。diff全文・ログ全文・実況を貼らない。数値と証跡パスは削らない: `~/.claude/skills/report-budget-controller/SKILL.md`
- リスク領域(セキュリティ/DB/認証/課金/監査/本番/データ損失)は節約対象外=最高effort監査必須。ユーザーの明示モデル/effort指示は常に最優先。
<!-- END TOKEN ENGINEERING HARNESS -->
