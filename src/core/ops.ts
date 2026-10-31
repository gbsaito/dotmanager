import { accessSync, chmodSync, cpSync, constants, existsSync, lstatSync, mkdirSync, readlinkSync, renameSync, rmSync, symlinkSync, unlinkSync } from "node:fs"
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

/** Move with a copy+delete fallback for cross-device setups. */
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
  const type = lstatSync(target).isDirectory() ? "dir" : "file"
  symlinkSync(target, linkPath, type)
}

/**
 * Adopt `inputPath`: back up (optional), move into the repo, symlink back and
 * commit. Any failure is rolled back to the original layout.
 */
export function adopt(
  ctx: Ctx,
  state: State,
  inputPath: string,
  now: Date = new Date(),
): OpOutcome {
  const absolute = expandHome(inputPath, ctx.home)
  const shown = displayPath(absolute, ctx.home)

  if (!existsSync(absolute) && !isDanglingSymlink(absolute)) {
    return { ok: false, error: `${shown} does not exist` }
  }
  const stat = lstatSync(absolute)
  if (stat.isSymbolicLink()) {
    return { ok: false, error: `${shown} is already a symlink; refusing to adopt it` }
  }
  if (findItem(state, absolute)) {
    return { ok: false, error: `${shown} is already managed` }
  }

  let rel: string
  try {
    rel = repoRelativePath(absolute, ctx.home)
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
  const repoPath = join(ctx.storage, rel)
  if (existsSync(repoPath)) {
    return { ok: false, error: `repo already contains ${rel}; resolve the conflict first` }
  }

  const prepared = ensureRepo(ctx.storage)
  if (!prepared.ok) return { ok: false, error: prepared.stderr || "git init failed" }

  let backupPath: string | null = null
  let patchedPath: string | null = null
  let patchedMode: number | null = null
  if (ctx.config.backup) {
    backupPath = join(ctx.paths.backupRoot, stamp(now), rel)
    try {
      mkdirSync(dirname(backupPath), { recursive: true })
      cpSync(absolute, backupPath, { recursive: true, preserveTimestamps: true, verbatimSymlinks: true })
    } catch (error) {
      return { ok: false, error: `backup failed: ${(error as Error).message}` }
    }
  }

  const widenBeforeMove = (target: string, isDir: boolean): void => {
    const dir = isDir ? target : dirname(target)
    const dirInfo = lstatSync(dir)
    const dirPerms = dirInfo.mode & 0o777
    if ((dirPerms & 0o200) !== 0) return
    chmodSync(dir, dirPerms | 0o200)
    patchedPath = dir
    patchedMode = dirPerms
  }
  widenBeforeMove(absolute, stat.isDirectory())
  const moveGate = stat.isDirectory() ? absolute : dirname(absolute)
  try {
    accessSync(moveGate, constants.W_OK)
  } catch {
    const owner = lstatSync(moveGate).uid
    return {
      ok: false,
      error: `permission denied: ${displayPath(absolute, ctx.home)} is not writable by the current user (dir owned by ${owner}); fix ownership or run dotmanager with elevated privileges to adopt it`,
    }
  }

  let moved = false
  let linked = false
  try {
    movePath(absolute, repoPath)
    moved = true
    makeSymlink(repoPath, absolute)
    linked = true

    const commit = commitAll(ctx.storage, `adopt: ${rel}`)
    if (!commit.ok) throw new Error(commit.error)

    const item: ManagedItem = {
      path: absolute,
      repoPath: rel,
      addedAt: now.toISOString(),
      backupPath,
    }
    state.items.push(item)
    state.pending.push({ kind: "adopt", path: absolute, at: now.toISOString(), commit: commit.commit })
    recordAction(state, "info", `Adopted ${shown}`)
    return { ok: true, message: `Adopted ${shown}`, item }
  } catch (error) {
    const notes: string[] = []
    if (patchedPath !== null && patchedMode !== null) {
      try {
        chmodSync(patchedPath, patchedMode)
      } catch {
        notes.push("could not restore directory permissions")
      }
    }
    if (linked) {
      try {
        unlinkSync(absolute)
      } catch {
        notes.push("could not remove failed symlink")
      }
    }
    if (moved && existsSync(repoPath) && !existsSync(absolute)) {
      try {
        movePath(repoPath, absolute)
      } catch {
        notes.push("could not move content back from repo")
      }
    }
    if (!existsSync(absolute) && backupPath && existsSync(backupPath)) {
      try {
        cpSync(backupPath, absolute, { recursive: true, preserveTimestamps: true })
      } catch {
        notes.push("could not restore backup")
      }
    }
    if (isRepo(ctx.storage)) git(ctx.storage, ["reset"])
    const suffix = notes.length > 0 ? ` (${notes.join("; ")})` : ""
    return { ok: false, error: `adopt failed: ${(error as Error).message}${suffix}` }
  }
}

/**
 * Unmanage an item: remove the symlink, restore the original contents (from
 * the backup when available, otherwise from the repo copy) and commit.
 */
export function unmanage(
  ctx: Ctx,
  state: State,
  absolutePath: string,
  now: Date = new Date(),
): OpOutcome {
  const item = findItem(state, absolutePath)
  const shown = displayPath(absolutePath, ctx.home)
  if (!item) return { ok: false, error: `${shown} is not managed` }

  const repoPath = join(ctx.storage, item.repoPath)
  let linked = false
  let restored: "backup" | "repo" | null = null

  if (existsSync(absolutePath) || isDanglingSymlink(absolutePath)) {
    const stat = lstatSync(absolutePath)
    if (!stat.isSymbolicLink()) {
      return { ok: false, error: `refusing: ${shown} is no longer a symlink (changed outside dotmanager)` }
    }
    const pointsTo = readlinkSync(absolutePath)
    if (pointsTo !== repoPath) {
      return { ok: false, error: `refusing: ${shown} points to ${pointsTo}, not ${repoPath}` }
    }
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
    const commit = commitAll(ctx.storage, `unmanage: ${item.repoPath}`)
    if (!commit.ok) throw new Error(commit.error)

    state.items = state.items.filter((entry) => entry.path !== absolutePath)
    state.pending.push({ kind: "unmanage", path: absolutePath, at: now.toISOString(), commit: commit.commit })
    recordAction(state, "info", `Unmanaged ${shown}`)
    return { ok: true, message: `Unmanaged ${shown}` }
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
    return { ok: false, error: `unmanage failed: ${(error as Error).message}` }
  }
}

function isDanglingSymlink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink()
  } catch {
    return false
  }
}
