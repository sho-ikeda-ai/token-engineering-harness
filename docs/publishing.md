# Publishing checklist

Publishing (repo creation, push, release) is always a human decision. Before it:

1. `node --test tests/test_*.js` — all green.
2. `node bin/teh pack-github` — must print CLEAN. It scans every tracked file for
   secret shapes (tokens, key assignments, private keys) and personal-environment
   traces, and lists local-only files (work ledgers like `docs/WORKPLAN_*.md`,
   `docs/HANDOFF.md`) to exclude from the artifact. Content wrapped in
   `<!-- LOCAL-ONLY:START --> ... <!-- LOCAL-ONLY:END -->` (e.g. a machine-local
   cross-agent messaging note that other automation may add to this repo's
   CLAUDE.md) is ignored by the scan but must be stripped for real before the
   publish branch is updated: `node scripts/strip-local-only.js CLAUDE.md`.
3. Review `README.md` + `SECURITY.md` for accuracy against the code you are shipping.
4. Export with the `git archive` command pack-github prints (excludes included), or
   push the branch after removing local-only files.
5. License is MIT; keep the copyright line intact.

Red lines: no `curl | bash` install instructions; no telemetry; no bundled third-party
binaries; version bumps update CHANGELOG.md.
