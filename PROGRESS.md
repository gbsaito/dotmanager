# Dotmanager (v2) - progress

Last updated: 2026-11-07

## Current task

`r` semantics changed to match user expectation: restore is now **temporary** —
unlinks every symlink and *copies* the repo copy to the original location;
items stay managed, manifest/pending/repo untouched, so `S` immediately
relinks everything ("Restored N items") with no merge/overwrite prompts. To
permanently unmanage, use `x` per item. Confirm modal text + help updated;
new regression test (restore → apply cycle); 20 tests pass; binary rebuilt
(ba8ac73). Awaiting user test of restore -> sync.

## Done

- Project scaffold: bun + typescript + opentui, tests, typecheck, git history.
- Core modules ported from the old dotmanager with spec deltas:
  - validation now also refuses git repositories (`insideGitRepo` via
    `git rev-parse --show-toplevel` or a `.git` directory at the path);
  - `add`/`forget` with full rollback (relevant branches covered);
  - `apply` (sync restore) backs up only content that differs from the repo
    copy; identical content is relinked without backup;
  - repo manifest `dotmanager.json` for cross-machine restore.
- TUI: two panes (files explorer / managed) + footer status bar rendered and
  verified in a pty; folders blue, files white, managed items marked with ●.
- Keybinds wired: tab, j/k/h/l, enter, a, A, x, S, P, space (ops modal),
  : palette shell (rows listed; commands deferred), q.
- Space opens the operations modal (s sync / p push, esc closes).
- P opens the push modal listing pending operations and dirty repo paths,
  enter confirms the push, esc cancels.
- Palette navigation works (j/k, enter); palette commands are deferred.
- Bugs fixed during pty testing: keys leaking into the main handler while a
  prompt/dialog was open (stale render closures — now mirrored in refs),
  palette index races (functional setState), footer truncation at 80 cols,
  missing "path" branch in prompt submit, `ctx.config` not updated on config
  save, `q` now ignored while a dialog is open (esc closes first).
- `dotmanager` launcher on PATH (`~/.local/bin/dotmanager`).

## Verification

```
bun test          # 19 pass
bun run typecheck # clean
 Pty checks: boot + quit, A-prompt add, tab + x forget (file restored,
 content intact), S sync failure message without a remote, tree navigation
 add (jj/l/j/l/j/a), ops modal, push modal rendering with pending change.
```

## Next moves

1. User manual test of the full flow (see current task).
2. Then: theme picker.
3. Planned-last features (encryption, diffs) only after the user asks.
4. Migration: push the new migration commits to the old remote (or start fresh
   for v2) — old remote already holds them (`ahead 24`).

Launcher discipline: `~/.local/bin/dotmanager` symlinks to the compiled
binary — after source changes run `bun run build` and
`mv dotmanager dotmanager-linux-x64`, else the app silently runs old logic.
## 2026-11-07 (later)
- Stale binary (Nov 6 build) caused the "undo still increases pending" report; rebuilt `dotmanager-linux-x64` from source.
- Added install.sh (curl | bash installs latest release; gh or GITHUB_TOKEN, private-repo aware) and release.sh (build + tag + publish asset). Published v1.0.0 (dotmanager-linux-x64). Install: `curl -fsSL https://raw.githubusercontent.com/gbsaito/dotmanager/main/install.sh | bash`
