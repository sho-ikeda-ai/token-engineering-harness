# Safety model

Full policy: [SECURITY.md](../SECURITY.md). Operating summary:

- **No network, no secrets, no contents.** Every component works on local files; the
  ledger stores counts and sizes only.
- **Observe-first hooks.** Default hooks exit 0 unconditionally (fail-open). The only
  blocking behavior — the command guard — requires `{"commandGuard": true}` and denies
  only a short list of unambiguous waste (with the cheaper alternative in the message).
- **Reversible installs.** Timestamped backups, marker-delimited text edits, JSON edits
  recorded in a manifest, `uninstall --dry-run` to preview reversal.
- **Budget abort.** If inserting the global block would exceed the instruction-file
  line budget, install aborts untouched — a token-saving tool must not bloat the very
  files it polices.
- **Never touched:** permission/deny lists, credentials, MCP definitions, Codex
  `config.toml` hook arrays (trust hash stays human-controlled).
- **Quality floor.** Savings rules exempt security, authz, DB/migrations, billing,
  audit trails, tests, data-loss protection. The auditor role exists precisely so
  cheap-model output never ships unreviewed.
