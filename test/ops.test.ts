import { describe, expect, test } from "bun:test"
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { defaultConfig, resolvePaths, type Ctx } from "../src/core/config.ts"
import { getRemote, isRepo, push, setRemote, sync } from "../src/core/git.ts"
import { adopt, apply, unmanage, writeManifest } from "../src/core/ops.ts"
import { emptyState } from "../src/core/state.ts"
import { displayPath, repoRelativePath } from "../src/core/util.ts"

function makeCtx(options: { backup?: boolean } = {}): Ctx {
  const root = mkdtempSync(join(tmpdir(), "dotmanager-test-"))
  const home = join(root, "home")
  mkdirSync(home, { recursive: true })
  const paths = resolvePaths(home, join(root, "xdg"))
  const config = { ...defaultConfig(home), backup: options.backup ?? true }
  return { home, paths, storage: join(home, "dotfiles"), config }
}

describe("path mapping", () => {
  test("mirrors home-relative paths and marks external ones", () => {
    expect(repoRelativePath("/home/me/.config/foo", "/home/me")).toBe(".config/foo")
    expect(repoRelativePath("/etc/hosts", "/home/me")).toBe("_external/etc/hosts")
    expect(displayPath("/home/me/.config/foo", "/home/me")).toBe("~/.config/foo")
  })
})

describe("adopt", () => {
  test("backs up, moves, symlinks and commits", () => {
    const ctx = makeCtx()
    const state = emptyState()
    const original = join(ctx.home, ".config", "fastfetch", "config.jsonc")
    mkdirSync(join(ctx.home, ".config", "fastfetch"), { recursive: true })
    writeFileSync(original, "hello")

    const result = adopt(ctx, state, original, new Date("2026-01-02T03:04:05.000Z"))
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const item = state.items[0]!
    expect(item.path).toBe(original)
    expect(item.repoPath).toBe(join(".config", "fastfetch", "config.jsonc"))
    expect(state.pending).toHaveLength(1)
    expect(state.pending[0]!.kind).toBe("adopt")
    expect(state.lastAction?.message).toContain("Adopted")

    // Source is now a symlink into the repo.
    expect(lstatSync(original).isSymbolicLink()).toBe(true)
    expect(readlinkSync(original)).toBe(join(ctx.storage, item.repoPath))
    expect(readFileSync(original, "utf8")).toBe("hello")

    // Original content was backed up before the move.
    expect(item.backupPath).toBeTruthy()
    expect(readFileSync(item.backupPath!, "utf8")).toBe("hello")

    // Repo exists and contains the committed file.
    expect(isRepo(ctx.storage)).toBe(true)
    const committed = Bun.spawnSync(["git", "ls-files"], { cwd: ctx.storage }).stdout.toString()
    expect(committed).toContain(join(".config", "fastfetch", "config.jsonc"))
  })

  test("adopts whole directories", () => {
    const ctx = makeCtx()
    const state = emptyState()
    const dir = join(ctx.home, ".config", "nvim")
    mkdirSync(join(dir, "lua"), { recursive: true })
    writeFileSync(join(dir, "init.lua"), "vim.o.number = true")

    expect(adopt(ctx, state, dir).ok).toBe(true)
    expect(lstatSync(dir).isSymbolicLink()).toBe(true)
    expect(readFileSync(join(dir, "init.lua"), "utf8")).toBe("vim.o.number = true")
  })

  test("adopts read-only directories by widening the mode first", () => {
    const ctx = makeCtx()
    const state = emptyState()
    const dir = join(ctx.home, ".config", "autostart")
    mkdirSync(join(dir, "services"), { recursive: true })
    writeFileSync(join(dir, "services", "x.desktop"), "x")
    chmodSync(dir, 0o555)

    expect(adopt(ctx, state, dir).ok).toBe(true)
    expect(lstatSync(dir).isSymbolicLink()).toBe(true)
    expect(readFileSync(join(dir, "services", "x.desktop"), "utf8")).toBe("x")
  })

  test("adopts files inside read-only directories", () => {
    const ctx = makeCtx()
    const state = emptyState()
    const dir = join(ctx.home, ".config", "fastfetch")
    mkdirSync(dir, { recursive: true })
    const file = join(dir, "config.json")
    writeFileSync(file, "{}\n")
    chmodSync(dir, 0o555)

    expect(adopt(ctx, state, file).ok).toBe(true)
    expect(lstatSync(file).isSymbolicLink()).toBe(true)
  })

  test("skips backups when disabled", () => {
    const ctx = makeCtx({ backup: false })
    const state = emptyState()
    const file = join(ctx.home, ".bashrc")
    writeFileSync(file, "export A=1")

    expect(adopt(ctx, state, file).ok).toBe(true)
    expect(state.items[0]!.backupPath).toBeNull()
    expect(existsSync(file)).toBe(true)
  })

  test("rejects missing paths, symlinks, duplicates and repo conflicts", () => {
    const ctx = makeCtx()
    const state = emptyState()
    const missing = join(ctx.home, "nope")
    expect(adopt(ctx, state, missing).ok).toBe(false)

    const file = join(ctx.home, ".zshrc")
    writeFileSync(file, "x")
    expect(adopt(ctx, state, file).ok).toBe(true)
    expect(adopt(ctx, state, file).ok).toBe(false)

    const other = join(ctx.home, ".config", "fastfetch", "config.jsonc")
    mkdirSync(join(ctx.home, ".config", "fastfetch"), { recursive: true })
    writeFileSync(other, "source")
    mkdirSync(join(ctx.storage, ".config", "fastfetch"), { recursive: true })
    writeFileSync(join(ctx.storage, ".config", "fastfetch", "config.jsonc"), "conflict")
    const conflict = adopt(ctx, state, other)
    expect(conflict.ok).toBe(false)
    if (!conflict.ok) expect(conflict.error).toContain("already contains")
    expect(readFileSync(other, "utf8")).toBe("source")
  })
})

describe("unmanage", () => {
  test("restores the backup and removes the repo copy", () => {
    const ctx = makeCtx()
    const state = emptyState()
    const dir = join(ctx.home, ".config", "kitty")
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "kitty.conf"), "font_size 12")

    expect(adopt(ctx, state, dir).ok).toBe(true)
    writeFileSync(join(dir, "kitty.conf"), "font_size 20 // edited through the symlink")

    const result = unmanage(ctx, state, dir)
    expect(result.ok).toBe(true)
    expect(lstatSync(dir).isSymbolicLink()).toBe(false)
    // Backup is the pre-adopt original per the spec.
    expect(readFileSync(join(dir, "kitty.conf"), "utf8")).toBe("font_size 12")
    expect(state.items).toHaveLength(0)
    expect(state.pending.at(-1)?.kind).toBe("unmanage")
    expect(existsSync(join(ctx.storage, ".config", "kitty", "kitty.conf"))).toBe(false)
  })

  test("restores from the repo when no backup exists", () => {
    const ctx = makeCtx({ backup: false })
    const state = emptyState()
    const file = join(ctx.home, ".tmux.conf")
    writeFileSync(file, "set -g mouse on")

    expect(adopt(ctx, state, file).ok).toBe(true)
    expect(unmanage(ctx, state, file).ok).toBe(true)
    expect(lstatSync(file).isSymbolicLink()).toBe(false)
    expect(readFileSync(file, "utf8")).toBe("set -g mouse on")
  })

  test("refuses when the path was replaced by a real file", () => {
    const ctx = makeCtx()
    const state = emptyState()
    const file = join(ctx.home, ".npmrc")
    writeFileSync(file, "a=1")
    expect(adopt(ctx, state, file).ok).toBe(true)

    // Replace the symlink with an unrelated file.
    Bun.spawnSync(["rm", file])
    writeFileSync(file, "b=2")

    const result = unmanage(ctx, state, file)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain("no longer a symlink")
    expect(readFileSync(file, "utf8")).toBe("b=2")
  })
})

describe("git storage", () => {
  test("configures a remote", () => {
    const ctx = makeCtx()
    const state = emptyState()
    const file = join(ctx.home, ".gitconfig")
    writeFileSync(file, "[user]\n\tname = Test\n")

    expect(adopt(ctx, state, file).ok).toBe(true)
    const url = "git@github.com:someone/dotfiles.git"
    expect(setRemote(ctx.storage, url).ok).toBe(true)
    expect(getRemote(ctx.storage)).toBe(url)
    expect(setRemote(ctx.storage, "https://example.com/dotfiles.git").ok).toBe(true)
    expect(getRemote(ctx.storage)).toBe("https://example.com/dotfiles.git")
  })

  test("pushes and pulls against a local bare remote", () => {
    const ctx = makeCtx()
    const state = emptyState()
    const remoteDir = mkdtempSync(join(tmpdir(), "dotmanager-remote-"))
    const bare = join(remoteDir, "dotfiles.git")
    const initBare = Bun.spawnSync(["git", "init", "--bare", "--initial-branch=main", bare])
    expect(initBare.exitCode).toBe(0)

    const file = join(ctx.home, ".vimrc")
    writeFileSync(file, "set number")
    expect(adopt(ctx, state, file).ok).toBe(true)
    expect(setRemote(ctx.storage, bare).ok).toBe(true)

    const pushed = push(ctx.storage)
    expect(pushed.ok).toBe(true)

    const cloneDir = join(remoteDir, "clone")
    expect(Bun.spawnSync(["git", "clone", bare, cloneDir]).exitCode).toBe(0)
    expect(readFileSync(join(cloneDir, ".vimrc"), "utf8")).toBe("set number")

    const second = join(ctx.home, ".inputrc")
    writeFileSync(second, "set editing-mode vi")
    expect(adopt(ctx, state, second).ok).toBe(true)
    expect(sync(ctx.storage).ok).toBe(true)
    expect(readFileSync(join(cloneDir, ".vimrc"), "utf8")).toBe("set number")
  })
})

describe("apply", () => {
  test("rebuilds managed symlinks from the repo manifest", () => {
    const ctx = makeCtx()
    expect(Bun.spawnSync(["git", "init", "--initial-branch=main", ctx.storage]).exitCode).toBe(0)
    const state = emptyState()
    const repoPath = join(".config", "fastfetch")
    writeManifest(ctx.storage, [repoPath])
    expect(existsSync(join(ctx.storage, repoPath))).toBe(false)

    const dir = join(ctx.home, ".config", "fastfetch")
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "config.jsonc"), "{ colors.primary: blue }")
    mkdirSync(join(ctx.storage, ".config", "fastfetch"), { recursive: true })
    writeFileSync(join(ctx.storage, repoPath, "config.jsonc"), "{ colors.primary: blue }")

    const result = apply(ctx, state)
    if (!result.ok) console.log("APPLY-ERR", result)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.restored).toBe(1)

    const item = state.items[0]!
    expect(item.repoPath).toBe(repoPath)
    expect(lstatSync(dir).isSymbolicLink()).toBe(true)
    expect(readlinkSync(dir)).toBe(join(ctx.storage, repoPath))
    expect(readFileSync(join(dir, "config.jsonc"), "utf8")).toBe("{ colors.primary: blue }")
  })

  test("backs up real content before linking it back", () => {
    const ctx = makeCtx()
    expect(Bun.spawnSync(["git", "init", "--initial-branch=main", ctx.storage]).exitCode).toBe(0)
    const state = emptyState()
    const repoPath = join(".config", "btop")
    writeManifest(ctx.storage, [repoPath])
    mkdirSync(join(ctx.storage, ".config", "btop"), { recursive: true })
    writeFileSync(join(ctx.storage, repoPath, "btop.conf"), "old-theme")

    const dir = join(ctx.home, ".config", "btop")
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "btop.conf"), "machine-specific")

    const result = apply(ctx, state)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const item = state.items.find((entry) => entry.repoPath === repoPath)!
    expect(item.backupPath).toBeTruthy()
    expect(readFileSync(join(item.backupPath!, "btop.conf"), "utf8")).toBe("machine-specific")
    expect(readFileSync(join(dir, "btop.conf"), "utf8")).toBe("old-theme")
  })

  test("skips entries when backups are disabled", () => {
    const ctx = makeCtx({ backup: false })
    expect(Bun.spawnSync(["git", "init", "--initial-branch=main", ctx.storage]).exitCode).toBe(0)
    const state = emptyState()
    const repoPath = join(".config", "kovidgoyal")
    writeManifest(ctx.storage, [repoPath])
    mkdirSync(join(ctx.storage, ".config", "kovidgoyal"), { recursive: true })
    writeFileSync(join(ctx.storage, repoPath, "kitty.conf"), "kitty-theme")

    const dir = join(ctx.home, ".config", "kovidgoyal")
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "kitty.conf"), "user-locals")

    const result = apply(ctx, state)
    expect(result.ok).toBe(false)
    expect(result.ok ? "" : result.error).toContain("nothing restored")
  })

  test("refuses to restore without a manifest or managed items", () => {
    const ctx = makeCtx()
    const state = emptyState()
    expect(apply(ctx, state).ok).toBe(false)
  })
})
