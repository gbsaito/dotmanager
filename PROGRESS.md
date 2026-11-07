# Dotmanager (v2) - progress

Last updated: 2026-11-07

## Current task

Done: `space` adds the selected row (file *or* directory, from the files pane)
straight to managed without toggling expansion — unlike `enter`, which opens
dirs. In the managed pane it reports "nothing to add". Awaiting user test.

Also done earlier: `undo` (`u`) reverts the last entry in `state.pending`
(operations pending) instead of session-only history, so it works after a
restart and stops when the pending count hits zero. `r` -> restore removes all
symlinks and moves the repo copies back to their original locations (per-item
`forget`, ops stay in pending awaiting push).

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
