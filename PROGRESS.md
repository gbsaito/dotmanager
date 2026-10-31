# dotmanager - progress

Last updated: 2026-10-31

## Current task

The managed panel is now a directory tree grouped by real paths (`.config >
fastfetch`, `.local > share > wireplumber`), with the same navigation as the
files sidebar. It is waiting for the user's manual test. No phase 2 work has
started.

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
  - managed panel as a directory tree grouped by real paths: managed items are
    nested under their path segments (`.config > fastfetch`,
    `.local > share > wireplumber`), scaffolding groups start expanded and can
    be collapsed, and managed directories expand into their contents. Rows are
    plain indented names without marker or arrow glyphs, directories in green
    and files in white;
  - status panel with storage, remote, backup mode, last action, pending count,
    messages and key hints;
  - prompts for a custom path and for the git remote URL;
  - keyboard bindings: tab, j/k, arrows, h/l, space, enter, a, R, s, p, u, b,
    r, q. In the managed panel `h`/`l` and `enter` expand or collapse a group
    or directory, while `space` still unmanages the selected managed item.
- Tests: 19 tests covering path mapping, adopt (files, directories, no backup,
  conflict and duplicate rejection), unmanage (backup restore, repo restore,
  refusal when the symlink was replaced), git remote/push/sync against a local
  bare repository, tree listing for both panels, window slicing and truncation.
- Verified the TUI boots and exits cleanly in a pseudo-terminal, and that
  adopting and unmanaging a file through the interface updates the filesystem
  and state as expected.

## Verification

Commands:

```
bun test          # 19 pass
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
