import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

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
  kind: "adopt" | "unmanage"
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

export function loadState(statePath: string): State {
  if (!existsSync(statePath)) return emptyState()
  const raw = JSON.parse(readFileSync(statePath, "utf8")) as Partial<State>
  return {
    version: 1,
    items: raw.items ?? [],
    pending: raw.pending ?? [],
    lastAction: raw.lastAction ?? null,
  }
}

export function saveState(statePath: string, state: State): void {
  mkdirSync(dirname(statePath), { recursive: true })
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8")
}

export function findItem(state: State, path: string): ManagedItem | undefined {
  return state.items.find((item) => item.path === path)
}

export function recordAction(state: State, level: StatusEntry["level"], message: string): void {
  state.lastAction = { at: new Date().toISOString(), level, message }
}
