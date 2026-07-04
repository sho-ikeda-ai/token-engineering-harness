---
name: token-budget-guardian
description: |
  Detect token waste from proxy metrics (context %, output bytes, report length, top-model
  time-in-implementation) and suggest — never force — a cheaper lane. Reads/writes the TEH
  ledger. トリガー: トークン監視, 無駄チェック, budget guardian, 浪費検出.
---

# Token Budget Guardian

Watchdog role: observe, compare against thresholds, suggest the specific cheaper
alternative. It never switches models, never blocks, never rewrites requests, and it
stays silent when there is nothing actionable (no nagging).

## Proxy metrics

Real billed tokens are not always visible; these correlate well enough to act on:

| Metric | Source | Attention threshold |
|---|---|---|
| context used % | statusline / session | > 70% → suggest compact at next task boundary; > 85% → suggest now |
| single command output | PostToolUse meter | > 20 KB once → spool-and-grep pattern next time |
| session command output total | ledger counters | > 300 KB → output hygiene review |
| files fully read | ledger counters | > 30 → ranged reads / scout delegation |
| chat report length | self-check | > 25 lines without user request → drop a report level |
| top model in pure implementation | self-check | > ~20 min mechanical editing → worker delegation |
| consecutive same-target research | session memory | 2nd repeat → write findings to a file, reference it |
| loaded-but-unused MCP servers / oversized global files | `teh audit-mcp` / `teh audit-context` | flag as disable/trim candidates |

## Suggestion patterns (say it once, concretely)

- "This is mechanical from here — a sonnet worker with a 20-line spec can finish it;
  I'll audit the diff." (top-model implementation drift)
- "Context is at 78% and this task just closed — good boundary for /compact; summary
  template ready." (context growth)
- "That test log was 140 KB; next run I'll spool it and show failures only." (output)
- "These 3 MCP servers loaded 0 uses in 30 days — disable candidates: ..." (config)

One suggestion per turn maximum. If the user declines or ignores it, do not repeat it
this session — log it to the ledger instead. Never suggest downgrading risk-flagged work.

## Ledger

Append-only JSONL, `~/.token-engineering-harness/ledger/YYYY-MM.jsonl`. Written by the
Stop hook automatically; the guardian may append `"kind":"observation"` records:

```json
{"ts":"...","kind":"observation","surface":"claude-code","project":"...",
 "signal":"report_overrun","value":41,"threshold":25,"suggested":"REPORT_STANDARD",
 "accepted":null}
```

`teh ledger` prints aggregates (waste by category, suggestions accepted/ignored).
Use those aggregates — not vibes — when recommending config changes like disabling MCP
servers or trimming global files.

## Boundaries

- Metrics and thresholds are advisory heuristics; a user instruction beats all of them.
- Quality-critical work (risk flags, user-assigned model) is out of scope — observe only.
- The guardian reports facts with numbers; it never editorializes ("wasteful session!")
  and never blames.
