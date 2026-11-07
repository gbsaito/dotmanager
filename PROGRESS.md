# Dotmanager (v2) - progress

Last updated: 2026-11-07

## Current task

Recovery after the user deleted `~/.config/dotmanager/{state,config}.json` to
clear "operations pending" (the managed list lived in state.json):
- `dotmanager.json` in ~/dotfiles was EMPTY — toggle-war `forget` commits were
  pushed, wiping the manifest on origin too. `apply` (S sync) restores from
  that manifest, so sync had nothing to restore. (Earlier no-remote theory was
  WRONG — config.json still existed; the gate was the empty manifest.)
- Repo content for `.config/yt-dlp`, `.config/wireplumber` (home = dangling
  symlink), `.config/urlink`, `.local/bin/mic-gain` (home = real file) was
  re-restored from the forget-commit parents; the other 21/25 repo copies never
  moved. Manifest rebuilt to 25 items, pushed (`origin/main`).
- App code: `S` sync now runs `apply` even when no remote is configured
  (local restore) and reports `apply` failures instead of masking them. Binary
  rebuilt (457db...).
- User presses `S` in the fresh binary: apply relinks, managed section returns
  (25 items). `operations pending` cleared by the state.json deletion as asked.
- Lesson: include `dotmanager.json`/state rebuild guidance in the README hazard
  for deleting state.json.

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
