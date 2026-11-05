import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname } from "node:path"
import { displayPath, expandHome } from "./util.ts"

export type ManagedItem = {
  /** Absolute path at the original location (a symlink into the repo). */
  path: string
  /** Path relative to the storage repo. */
  repoPath: string
  addedAt: string
  /** Backup copy of the original contents, when backups were enabled. */
  backupPath: string | null
}

export type PendingOp = {
  kind: "add" | "forget"
  path: string
  at: string
  /** Local commit that produced this operation. */
  commit: string
}

export type StatusEntry = {
  at: string
  level: "info" | "error"
  message: string
}

export type State = {
  version: 1
  items: ManagedItem[]
  /** Locally committed operations not pushed to the remote yet. */
  pending: PendingOp[]
  lastAction: StatusEntry | null
}

export function emptyState(): State {
  return { version: 1, items: [], pending: [], lastAction: null }
}

export function loadState(statePath: string, home: string = homedir()): State {
  if (!existsSync(statePath)) return emptyState()
  const raw = JSON.parse(readFileSync(statePath, "utf8")) as Partial<State>
  return {
    version: 1,
    // Paths are stored home-relative (`~/...`) for cross-user portability;
    // legacy absolute files expand unchanged.
    items: (raw.items ?? []).map((item) => ({
      ...item,
      path: expandHome(item.path, home),
      backupPath: item.backupPath ? expandHome(item.backupPath, home) : null,
    })),
    pending: (raw.pending ?? []).map((op) => ({ ...op, path: expandHome(op.path, home) })),
    lastAction: raw.lastAction ?? null,
  }
}

export function saveState(statePath: string, state: State, home: string = homedir()): void {
  // Serialize with `~/...` so the state file never hardcodes a username.
  const portable = {
    ...state,
    items: state.items.map((item) => ({
      ...item,
      path: item.path.startsWith("~") ? item.path : displayPath(item.path, home),
      backupPath: item.backupPath && !item.backupPath.startsWith("~") ? displayPath(item.backupPath, home) : item.backupPath,
    })),
    pending: state.pending.map((op) => ({ ...op, path: op.path.startsWith("~") ? op.path : displayPath(op.path, home) })),
  }
  mkdirSync(dirname(statePath), { recursive: true })
  writeFileSync(statePath, `${JSON.stringify(portable, null, 2)}\n`, "utf8")
}

export function findItem(state: State, path: string): ManagedItem | undefined {
  return state.items.find((item) => item.path === path)
}

export function recordAction(state: State, level: StatusEntry["level"], message: string): void {
  state.lastAction = { at: new Date().toISOString(), level, message }
}
