# dotmanager - plan

Reference spec: `~/Main/Drafts/dotmanager.md`. Phase breakdown: `PHASEPLAN.md`.

## Objective

A terminal UI that turns loose config files and directories into a
git-tracked dotfiles repository: it backs up the original, moves the content
into the repo, symlinks it back to where applications expect it, and lets the
user push the result to a remote when they choose.

Storage defaults to `~/dotfiles`; metadata lives in
`~/.config/dotmanager`. Git is driven through the `git` CLI so the user's
existing SSH keys, credential helpers and config keep working. State and
configuration are JSON files so they are easy to inspect and edit by hand.

## Architecture

```
src/
  index.tsx        Renderer bootstrap and root mount
  core/
    config.ts      config.json load/save, path resolution, runtime context
    state.ts       state.json load/save, managed items, pending operations
    git.ts         git CLI wrapper (init, commit, remote, push, pull, sync)
    ops.ts         adopt and unmanage workflows with rollback
    util.ts        ~ expansion, home-relative mapping, display paths
  ui/
    App.tsx        layout, keyboard handling, action dispatch
    Sidebar.tsx    file tree of $HOME
    MainPanel.tsx  managed items
    StatusPanel.tsx status, messages and input prompts
    tree.ts        tree listing and window helpers
    theme.ts       palette and key hint text
    text.ts        truncation helper
```

### Files on disk

- `~/.config/dotmanager/config.json` - storage path, remote URL, backup toggle.
- `~/.config/dotmanager/state.json` - managed items, pending operations and the
  last action shown in the status panel.
- `~/.config/dotmanager/backup/<timestamp>/...` - pre-adopt copies of the
  original content, mirrored by home-relative path.
- `~/dotfiles` - the git repository (configurable).

### Adopt

1. Validate the source: it must exist, must not be a symlink, must not already
   be managed, and the repo must not already contain the target path.
2. Copy the source into the backup directory (unless backups are disabled).
3. Move the source into the repo, mirroring its path relative to `$HOME`;
   paths outside `$HOME` go under `_external/`.
4. Symlink the original location to the repo copy.
5. `git add -A` and commit `adopt: <repo path>`.
6. Record the item and a pending operation in the state file.

A failure at any step rolls the filesystem back to its original layout.

### Unmanage

1. Verify the path is a symlink pointing at the tracked repo copy; refuse if the
   user replaced it with a real file.
2. Remove the symlink.
3. Restore the pre-adopt backup, or move the repo content back when no backup
   exists.
4. Commit `unmanage: <repo path>` and record the pending operation.

## Interface

Layout A: file explorer on the left, managed list on the right, status bar
below. The focused panel has a highlighted border and selected row.

| Key       | Action                                            |
| --------- | ------------------------------------------------- |
| tab       | switch focus between files and managed items      |
| j / down  | move selection down                               |
| k / up    | move selection up                                 |
| h / left  | collapse the selected directory                   |
| l / right | expand the selected directory                     |
| space     | adopt the selected path, or unmanage selected item |
| enter     | expand a directory, adopt a file, or unmanage     |
| a         | adopt a typed path                                |
| R         | set the git remote URL                            |
| s         | pull then push                                    |
| p         | push                                              |
| u         | pull                                              |
| b         | toggle automatic backups                          |
| r         | reload state from disk                            |
| q         | quit                                              |

## Decisions taken in phase 1

- **Atomicity**: operations run in-process and stop at the first error. Adopt
  rolls back the symlink and move; unmanage re-links the repo copy if the
  restore fails. The state file is written only after git succeeds, so a
  crashed run leaves files recoverable from the repo or backup.
- **Conflicts**: adopting a path that already exists in the repo is refused
  before anything moves. Symlink sources are refused as well.
- **Toggle semantics**: toggling a managed item off restores the pre-adopt
  backup, so edits made through the symlink are discarded, matching the
  "revert the last commit" intent of the spec.
- **Git strategy**: shell out to `git`; no JS git library in phase 1.
- **Commit scope**: one commit per adopt or unmanage. Push and pull remain
  explicit user actions, and the status panel keeps counting pending
  operations until a push succeeds.
- **Secrets**: not addressed yet; listed for phase 3.

## Out of scope until later phases

Package management, profiles/common files, encryption, themes, mouse support,
conflict resolution UI, and multi-machine merge strategy.
