# dotmanager phase plan

Source of truth: `~/Main/Drafts/dotmanager.md` (consolidated spec).

## Phase 1 - Core foundations (no extras)

Goal: a booting TUI with the core adopt/unmanage workflow and git-backed
storage. No package management, profiles, encryption, or themes yet.

Features (Core tier of the spec + interface):

- [x] TUI foundation: `@opentui/react` app boots, renders sidebar + main +
      status panels, exits cleanly.
- [x] Adopt workflow (core): backup (toggle, default ON) -> move -> symlink ->
      commit; pending operation recorded in status.
- [x] Unmanage workflow (core): remove link, restore content.
- [x] Git storage (core): local repo (`~/dotfiles`) + GitHub remote setup;
      custom files/dirs at any depth. Push/pull/sync are wired to the remote
      and pending operations clear after a successful push.

## Phase 2 - Extras

Everything the spec lists under Extra, only after Phase 1 is approved:

- Package management.
- Profiles plus common (shared) files.
- Optional encryption.
- Themes.

## Phase 3 - Open decisions / polish

Resolve open decision items from the spec (atomicity, conflicts, toggle
semantics, git strategy, commit scope, profiles, encryption, secrets) as they
become blocking.
