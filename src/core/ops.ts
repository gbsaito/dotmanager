import { accessSync, cpSync, constants, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import type { Ctx } from "./config.ts"
import { commitAll, ensureRepo, git, isRepo } from "./git.ts"
import { findItem, recordAction, type ManagedItem, type State } from "./state.ts"
import { displayPath, expandHome, repoRelativePath } from "./util.ts"

export type OpOutcome =
  | { ok: true; message: string; item?: ManagedItem }
  | { ok: false; error: string }

function stamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-")
}

/** Manifest committed in the repo root so another machine can rebuild the links. */
export const MANIFEST_NAME = "dotmanager.json"

const EXTERNAL_PREFIX = "_external/"

export function writeManifest(storage: string, repoPaths: string[]): void {
  const items = [...new Set(repoPaths)].sort()
  writeFileSync(join(storage, MANIFEST_NAME), `${JSON.stringify({ version: 1, items }, null, 2)}\n`, "utf8")
}

export function readManifest(storage: string): string[] | null {
  const path = join(storage, MANIFEST_NAME)
  if (!existsSync(path)) return null
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as { items?: unknown }
    return Array.isArray(raw.items) ? raw.items.filter((entry): entry is string => typeof entry === "string") : null
  } catch {
    return null
  }
}

/** Where a repo path belongs on this machine. */
export function homePathForRepoPath(repoPath: string, home: string): string {
  const normalized = repoPath.split("\\").join("/")
  if (normalized.startsWith(EXTERNAL_PREFIX)) return `/${normalized.slice(EXTERNAL_PREFIX.length)}`
  return join(home, normalized)
}

function movePath(from: string, to: string): void {
  mkdirSync(dirname(to), { recursive: true })
  try {
    renameSync(from, to)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error
    cpSync(from, to, { recursive: true, preserveTimestamps: true })
    rmSync(from, { recursive: true, force: true })
  }
}

function makeSymlink(target: string, linkPath: string): void {
  mkdirSync(dirname(linkPath), { recursive: true })
  symlinkSync(target, linkPath, lstatSync(target).isDirectory() ? "dir" : "file")
}

function isSymlinkPath(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink()
  } catch {
    return false
  }
}

/** True when `path` lives inside a git work tree (its own .git or an ancestor's). */
function insideGitRepo(path: string, storage: string): boolean {
  const isGitRoot = (dir: string): boolean => existsSync(join(dir, ".git"))
  if (isGitRoot(path)) return true
  // Our own storage repo is always off limits.
  try {
    return git(storage, ["-C", dirname(path), "rev-parse", "--show-toplevel"]).ok
  } catch {
    return false
  }
}

/**
 * Add `inputPath` to managed: back up (optional), move into the repo, symlink
 * back and commit. Any failure rolls the filesystem back to the original layout.
 */
export function add(ctx: Ctx, state: State, inputPath: string, now: Date = new Date()): OpOutcome {
  const absolute = expandHome(inputPath, ctx.home)
  const shown = displayPath(absolute, ctx.home)

  if (!existsSync(absolute) && !isSymlinkPath(absolute)) return { ok: false, error: `${shown} does not exist` }
  const stat = lstatSync(absolute)
  if (stat.isSymbolicLink()) return { ok: false, error: `${shown} is already a symlink; refusing to add it` }
  if (findItem(state, absolute)) return { ok: false, error: `${shown} is already managed` }
  if (insideGitRepo(absolute, ctx.storage)) return { ok: false, error: `${shown} is a git repository; refusing to add it` }

  let rel: string
  try {
    rel = repoRelativePath(absolute, ctx.home)
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
  const repoPath = join(ctx.storage, rel)
  if (existsSync(repoPath)) return { ok: false, error: `repo already contains ${rel}; resolve the conflict first` }

  const prepared = ensureRepo(ctx.storage)
  if (!prepared.ok) return { ok: false, error: prepared.stderr || "git init failed" }

  try {
    accessSync(stat.isDirectory() ? absolute : dirname(absolute), constants.W_OK)
  } catch {
    return { ok: false, error: `permission denied: ${shown} is not writable by the current user` }
  }

  let backupPath: string | null = null
  if (ctx.config.backup) {
    backupPath = join(ctx.paths.backupRoot, stamp(now), rel)
    try {
      mkdirSync(dirname(backupPath), { recursive: true })
      cpSync(absolute, backupPath, { recursive: true, preserveTimestamps: true, verbatimSymlinks: true })
    } catch (error) {
      return { ok: false, error: `backup failed: ${(error as Error).message}` }
    }
  }

  let moved = false
  let linked = false
  try {
    movePath(absolute, repoPath)
    moved = true
    makeSymlink(repoPath, absolute)
    linked = true

    writeManifest(ctx.storage, [...state.items.map((entry) => entry.repoPath), rel])
    const commit = commitAll(ctx.storage, `add: ${rel}`)
    if (!commit.ok) throw new Error(commit.error)

    const item: ManagedItem = { path: absolute, repoPath: rel, addedAt: now.toISOString(), backupPath }
    state.items.push(item)
    state.pending.push({ kind: "add", path: absolute, at: now.toISOString(), commit: commit.commit })
    recordAction(state, "info", `Added ${shown}`)
    return { ok: true, message: `Added ${shown}`, item }
  } catch (error) {
    if (linked) {
      try {
        unlinkSync(absolute)
      } catch {
        // Best effort; reported below.
      }
    }
    if (moved && existsSync(repoPath) && !existsSync(absolute)) {
      try {
        movePath(repoPath, absolute)
      } catch {
        // Best effort; reported below.
      }
    }
    if (!existsSync(absolute) && backupPath && existsSync(backupPath)) {
      try {
        cpSync(backupPath, absolute, { recursive: true, preserveTimestamps: true })
      } catch {
        // Best effort; reported below.
      }
    }
    if (isRepo(ctx.storage)) git(ctx.storage, ["reset"])
    return { ok: false, error: `add failed: ${(error as Error).message}` }
  }
}

/**
 * Forget a managed item: remove the symlink, restore the original contents
 * (from the backup when available, otherwise from the repo copy) and commit.
 */
export function forget(ctx: Ctx, state: State, absolutePath: string, now: Date = new Date()): OpOutcome {
  const item = findItem(state, absolutePath)
  const shown = displayPath(absolutePath, ctx.home)
  if (!item) return { ok: false, error: `${shown} is not managed` }

  const repoPath = join(ctx.storage, item.repoPath)
  let linked = false
  let restored: "backup" | "repo" | null = null

  if (existsSync(absolutePath) || isSymlinkPath(absolutePath)) {
    const stat = lstatSync(absolutePath)
    if (!stat.isSymbolicLink()) return { ok: false, error: `refusing: ${shown} is no longer a symlink (changed outside dotmanager)` }
    const pointsTo = readlinkSync(absolutePath)
    if (pointsTo !== repoPath) return { ok: false, error: `refusing: ${shown} points to ${pointsTo}, not ${repoPath}` }
    unlinkSync(absolutePath)
    linked = true
  }

  try {
    if (item.backupPath && existsSync(item.backupPath)) {
      cpSync(item.backupPath, absolutePath, { recursive: true, preserveTimestamps: true })
      restored = "backup"
    } else if (existsSync(repoPath)) {
      movePath(repoPath, absolutePath)
      restored = "repo"
    } else {
      throw new Error("no backup and no repo copy to restore")
    }

    if (existsSync(repoPath)) rmSync(repoPath, { recursive: true, force: true })
    writeManifest(ctx.storage, state.items.filter((entry) => entry.path !== absolutePath).map((entry) => entry.repoPath))
    const commit = commitAll(ctx.storage, `forget: ${item.repoPath}`)
    if (!commit.ok) throw new Error(commit.error)

    state.items = state.items.filter((entry) => entry.path !== absolutePath)
    state.pending.push({ kind: "forget", path: absolutePath, at: now.toISOString(), commit: commit.commit })
    recordAction(state, "info", `Forgot ${shown}`)
    return { ok: true, message: `Forgot ${shown}` }
  } catch (error) {
    if (restored) {
      try {
        if (restored === "repo" && existsSync(absolutePath)) movePath(absolutePath, repoPath)
        else if (restored === "backup") rmSync(absolutePath, { recursive: true, force: true })
      } catch {
        // Best effort; the error below still reports the failure.
      }
    }
    if (linked && !existsSync(absolutePath) && existsSync(repoPath)) {
      try {
        makeSymlink(repoPath, absolutePath)
      } catch {
        // Best effort; the error below still reports the failure.
      }
    }
    return { ok: false, error: `forget failed: ${(error as Error).message}` }
  }
}

/**
 * Remove every symlink and copy the content back to its original location,
 * clearing the managed list locally — but the repo keeps its copies and the
 * manifest, so a later sync (apply) re-links and re-manages everything.
 */
export function restore(ctx: Ctx, state: State): OpOutcome {
  const failures: string[] = []
  const removed: string[] = []
  for (const item of [...state.items]) {
    const repoPath = join(ctx.storage, item.repoPath)
    const shown = displayPath(item.path, ctx.home)
    const source = existsSync(repoPath) ? repoPath : item.backupPath && existsSync(item.backupPath) ? item.backupPath : null
    if (!source) {
      failures.push(`${shown}: no repo or backup copy`)
      continue
    }
    try {
      if (existsSync(item.path) || isSymlinkPath(item.path)) {
        const stat = lstatSync(item.path)
        if (!stat.isSymbolicLink()) continue // already real content; just unmanage it
        if (readlinkSync(item.path) !== repoPath) {
          failures.push(`${shown}: points to ${readlinkSync(item.path)}, not ${repoPath}`)
          continue
        }
        unlinkSync(item.path)
      }
      cpSync(source, item.path, { recursive: true, preserveTimestamps: true })
      removed.push(item.path)
    } catch (error) {
      failures.push(`${shown}: ${(error as Error).message}`)
    }
  }
  state.items = state.items.filter((entry) => !removed.includes(entry.path))
  const note = failures.length > 0 ? `, ${failures.length} skipped` : ""
  recordAction(state, "info", `Removed ${removed.length} symlinks`)
  return { ok: true, message: `Removed ${removed.length} symlink(s)${note} — press S to relink` }
}

/**
 * Rebuild symlinks from the repo manifest (after a pull on a new machine).
 * Per spec: when a real file/directory already exists at the target and
 * differs from the repo copy, back it up first.
 */
export function apply(ctx: Ctx, state: State, now: Date = new Date()): OpOutcome & { restored: number; skipped: string[] } {
  if (!isRepo(ctx.storage)) return { ok: false, error: "storage is not a git repository yet", restored: 0, skipped: [] }

  const repoPaths = readManifest(ctx.storage) ?? state.items.map((entry) => entry.repoPath)
  if (repoPaths.length === 0) {
    return { ok: false, error: "nothing to restore: the repo has no dotmanager.json manifest", restored: 0, skipped: [] }
  }

  const restored: ManagedItem[] = []
  const skipped: string[] = []

  for (const repoPath of repoPaths) {
    const repoCopy = join(ctx.storage, repoPath)
    if (!existsSync(repoCopy)) {
      skipped.push(repoPath)
      continue
    }
    const target = homePathForRepoPath(repoPath, ctx.home)
    const shown = displayPath(target, ctx.home)

    let backupPath: string | null = null
    try {
      const stat = existsSync(target) || isSymlinkPath(target) ? lstatSync(target) : null
      if (stat?.isSymbolicLink()) {
        unlinkSync(target)
      } else if (stat) {
        // Real content exists: back it up (if enabled) unless it already
        // matches the repo copy, in which case replacing it loses nothing.
        if (!ctx.config.backup && !sameContent(target, repoCopy)) {
          skipped.push(`${shown}: differs from the repo copy and backups are off`)
          continue
        }
        backupPath = join(ctx.paths.backupRoot, stamp(now), repoPath)
        mkdirSync(dirname(backupPath), { recursive: true })
        cpSync(target, backupPath, { recursive: true, preserveTimestamps: true, verbatimSymlinks: true })
        rmSync(target, { recursive: true, force: true })
      }
      makeSymlink(repoCopy, target)
      restored.push({ path: target, repoPath, addedAt: now.toISOString(), backupPath })
    } catch (error) {
      skipped.push(`${shown}: ${(error as Error).message}`)
    }
  }

  if (restored.length === 0) {
    return { ok: false, error: `nothing restored${skipped.length > 0 ? ` (${skipped.join(", ")})` : ""}`, restored: 0, skipped }
  }

  const restoredPaths = new Set(restored.map((item) => item.path))
  state.items = [...state.items.filter((item) => !restoredPaths.has(item.path)), ...restored]

  const skippedNote = skipped.length > 0 ? `, skipped ${skipped.length}` : ""
  return { ok: true, message: `Restored ${restored.length} items${skippedNote}`, restored: restored.length, skipped }
}

/** Cheap equality check used to skip pointless backups during apply. */
function sameContent(target: string, repoCopy: string): boolean {
  try {
    const info = lstatSync(target)
    const copy = lstatSync(repoCopy)
    if (info.isDirectory() !== copy.isDirectory() || info.size !== copy.size) return false
    if (info.isDirectory()) return false // ponytail: dir trees conservatively unequal; add tree-walk when needed
    return readFileSync(target).equals(readFileSync(repoCopy))
  } catch {
    return false
  }
}
