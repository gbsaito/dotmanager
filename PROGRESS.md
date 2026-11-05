# Dotmanager (v2) - progress

Last updated: 2026-11-05

## Current task

Waiting on the user's manual test of the core flow: `a`/`A` add, navigate/expand,
`x` forget, `S` sync, `P` push modal, `space` operations modal. The command
palette (`:`) is intentionally NOT implemented yet per user instruction.

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
bun test          # 17 pass
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
