# Dotmanager (v2) - plan

Reference spec: `~/Main/Notes/Dotmanager.md` (tasks tracked in its Todo/Done section).
Baseline: rewrite of `~/Documents/dotmanager` — core logic ported, TUI rebuilt
around the new keybind spec.

## Objective

TUI (opentui + bun + typescript) that manages dotfiles from a git repository:
picks files under `~/` in a file explorer, moves them into the repo
(`~/dotfiles` by default) and symlinks them back. Syncs with a git remote,
backing up anything that differs. Storage defaults to `~/dotfiles`; metadata in
`~/.config/dotmanager`.

## Architecture

```
src/
  index.tsx        Renderer bootstrap
  core/
    config.ts      config.json load/save, ctx
    state.ts       state.json, managed items, pending ops
    git.ts         git CLI wrapper (init, commit, remote, push, pull, sync, clone)
    ops.ts         add (adopt), forget (unmanage), apply (restore), manifest
    util.ts        ~ expansion, repo-relative mapping, display paths
  ui/
    App.tsx        layout, keyboard dispatch
    Sidebar.tsx    file explorer of $HOME (folders blue , files white)
    ManagedPanel.tsx  managed items list
    Footer.tsx     status bar + input prompts
    Modals.tsx     overlay dialogs (operations, push, palette)
    tree.ts        tree listing, windowing
    theme.ts, text.ts, mouse.ts
```

## Keybinds (spec)

| Key | Action |
| --- | ------ |
| a | add selected file to managed |
| A | add by path (prompt) |
| x | forget selected managed item |
| S | sync (pull then push) |
| P | push (modal lists all changes) |
| space | operations modal: s sync, p push |
| : | command palette (backup, theme, remote, storage) |
| tab | switch panes; j/k/h/l navigate; enter expand dir; q quit |

## Validation (add)

Must exist, must not be a symlink, must not already be managed, must not be a
git repository, repo must not already contain the target path. Any failure rolls
the filesystem back and the state file is only persisted after git succeeds.

## Decisions

- Git is driven through the `git` CLI (user keys/credentials keep working).
- Repo manifest `dotmanager.json` records managed repo paths so a new machine
  can rebuild symlinks after a pull (apply).
- Backups (toggle with palette `b`) land in `~/.config/dotmanager/backup/<ts>/`.
- Sync/apply backs up real content that differs from the repo copy; content
  identical to the repo copy is skipped without a backup.

## Not yet (user-ordered: after core features)

Command palette implementation is deferred at user request; theme picker,
encryption and diffs stay planned until the user asks.

Known limitations: push needs the remote branch to accept the initial push;
backups grow without pruning; the sidebar caps at 2000 rows.
