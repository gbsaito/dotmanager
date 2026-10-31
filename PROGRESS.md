# dotmanager - progress

Last updated: 2026-10-31

## Current task

Phase 1 (core foundations) implementation is complete and waiting for the
user's manual test. No phase 2 work has started.

## Done

- Project scaffold with Bun, TypeScript, React and `@opentui/react`.
- Core modules:
  - config load/save with `~/dotfiles` default and `~` expansion;
  - JSON state file with managed items, pending operations and last action;
  - git wrapper using the `git` CLI: init, identity fallback, commit, remote,
    push, pull, sync;
  - adopt workflow: validate, back up, move, symlink, commit, record, rollback
    on failure;
  - unmanage workflow: validate the symlink, restore the backup or repo copy,
    commit, record, re-link on failure.
- TUI:
  - file explorer for `$HOME` with expand/collapse and managed markers;
  - managed panel with selection;
  - status panel with storage, remote, backup mode, last action, pending count,
    messages and key hints;
  - prompts for a custom path and for the git remote URL;
  - keyboard bindings: tab, j/k, arrows, h/l, space, enter, a, R, s, p, u, b,
    r, q.
- Tests: 15 tests covering path mapping, adopt (files, directories, no backup,
  conflict and duplicate rejection), unmanage (backup restore, repo restore,
  refusal when the symlink was replaced) and git remote/push/sync against a
  local bare repository.
- Verified the TUI boots and exits cleanly in a pseudo-terminal, and that
  adopting and unmanaging a file through the interface updates the filesystem
  and state as expected.

## Verification

Commands:

```
bun test          # 15 pass
bun run typecheck # clean
bun run start     # interactive TUI
bun run build     # compiled single-file binary at ./dotmanager
```

## Next moves

1. User tests phase 1 manually: adopt/unmanage a real config, set a remote,
   push.
2. On approval, start phase 2 in `PHASEPLAN.md`: package management, profiles
   and common files, encryption, themes.
3. Phase 3 items still open: conflict-resolution UI, secrets guard, commit
   amend strategy, multi-machine pull conflicts, keymap presets.

## Known limitations

- `push` requires the remote branch to exist or accept the initial push; a
  remote whose default branch is not `main` needs a manual first push.
- Backups grow without pruning; an old-backup cleanup command is not built yet.
- The sidebar lists everything under `$HOME` and caps at 2000 rows; no search
  or filter yet.
- Unmanage discards edits made through the symlink after adoption (restores the
  pre-adopt backup).
