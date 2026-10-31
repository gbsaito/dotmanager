import { existsSync, mkdirSync, readdirSync } from "node:fs"
import { basename, dirname, join } from "node:path"

export type GitResult = { ok: boolean; stdout: string; stderr: string }

function run(cwd: string, args: string[]): GitResult {
  const proc = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" })
  return {
    ok: proc.exitCode === 0,
    stdout: proc.stdout.toString().trim(),
    stderr: proc.stderr.toString().trim(),
  }
}

export function git(storage: string, args: string[]): GitResult {
  return run(storage, args)
}

export function isRepo(storage: string): boolean {
  return existsSync(join(storage, ".git"))
}

/**
 * Create the storage repo when missing and make sure git has an identity so
 * local commits never fail on a fresh machine.
 */
export function ensureRepo(storage: string): GitResult {
  mkdirSync(storage, { recursive: true })
  if (!isRepo(storage)) {
    const init = run(storage, ["init", "-b", "main"])
    if (!init.ok) return init
  }
  if (!run(storage, ["config", "user.email"]).stdout) {
    run(storage, ["config", "user.email", "dotmanager@localhost"])
  }
  if (!run(storage, ["config", "user.name"]).stdout) {
    run(storage, ["config", "user.name", "dotmanager"])
  }
  return { ok: true, stdout: "", stderr: "" }
}

/** Stage everything and commit. Returns the new commit hash. */
export function commitAll(storage: string, message: string): { ok: true; commit: string } | { ok: false; error: string } {
  const add = run(storage, ["add", "-A"])
  if (!add.ok) return { ok: false, error: add.stderr || "git add failed" }
  const commit = run(storage, ["commit", "-m", message])
  if (!commit.ok) {
    // Nothing to commit is not an error for our callers.
    if (/nothing to commit|no changes added/i.test(commit.stdout + commit.stderr)) {
      return { ok: true, commit: headCommit(storage) }
    }
    return { ok: false, error: commit.stderr || commit.stdout || "git commit failed" }
  }
  return { ok: true, commit: headCommit(storage) }
}

export function headCommit(storage: string): string {
  return run(storage, ["rev-parse", "HEAD"]).stdout
}

export function hasChanges(storage: string): boolean {
  const status = run(storage, ["status", "--porcelain"])
  return status.stdout.length > 0
}

export function getRemote(storage: string): string | null {
  const res = run(storage, ["remote", "get-url", "origin"])
  return res.ok && res.stdout ? res.stdout : null
}

export function setRemote(storage: string, url: string): GitResult {
  const current = getRemote(storage)
  const args = current ? ["remote", "set-url", "origin", url] : ["remote", "add", "origin", url]
  return run(storage, args)
}

export function pull(storage: string): GitResult {
  const branch = run(storage, ["branch", "--show-current"]).stdout || "main"
  return run(storage, ["pull", "--rebase", "origin", branch])
}

/** True once the repo has at least one commit. */
export function hasCommits(storage: string): boolean {
  return run(storage, ["rev-parse", "--verify", "HEAD"]).ok
}

export function cloneInto(storage: string, url: string): GitResult {
  if (existsSync(storage) && readdirSync(storage).length > 0) {
    return { ok: false, stdout: "", stderr: `${storage} already exists and is not empty; move it aside before cloning` }
  }
  return run(dirname(storage), ["clone", url, basename(storage)])
}

/**
 * Point the storage repo at `url`. A fresh machine clones the remote; an
 * existing repo just swaps the remote and, when it has no commits yet, pulls
 * the remote branch into it.
 */
export function connectRemote(storage: string, url: string): GitResult {
  if (isRepo(storage)) {
    const set = setRemote(storage, url)
    if (!set.ok) return set
    if (hasCommits(storage)) return { ok: true, stdout: "", stderr: "" }
    return pull(storage)
  }
  if (existsSync(storage) && readdirSync(storage).length > 0) {
    return { ok: false, stdout: "", stderr: `${storage} already exists and is not a git repository; move it aside first` }
  }
  return cloneInto(storage, url)
}

export function push(storage: string): GitResult {
  const branch = run(storage, ["branch", "--show-current"]).stdout || "main"
  return run(storage, ["push", "-u", "origin", branch])
}

export function sync(storage: string): GitResult {
  const pulled = pull(storage)
  if (!pulled.ok) return pulled
  return push(storage)
}

export function lastCommitMessage(storage: string): string {
  return run(storage, ["log", "-1", "--pretty=%s"]).stdout
}
