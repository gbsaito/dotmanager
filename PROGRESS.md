# Dotmanager (v2) - progress

Last updated: 2026-11-07

## Current task

Done, awaiting user test: `u` now reverts the last pending op **and drops it**
from `state.pending` — the revert itself leaves no pending entry, so the
"operations pending" counter decreases with every undo instead of climbing
(toggle pairs are gone; earlier session had grown 6 add/forget pairs).
`state.pending` is capped at the 25 newest entries on save (undo-history
buffer). `r` -> restore (remove all symlinks, restore originals) and `space`
(add selection without expanding dirs) landed earlier today.

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

## 2026-11-06
- Added install.sh (curl | bash installs latest release; gh or GITHUB_TOKEN, private-repo aware) and release.sh (build + tag + publish asset). Published v1.0.0 (dotmanager-linux-x64). Install: `curl -fsSL https://raw.githubusercontent.com/gbsaito/dotmanager/main/install.sh | bash`
