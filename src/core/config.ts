import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { expandHome } from "./util.ts"

export type Config = {
  version: 1
  /** Directory that holds the git-tracked dotfiles. */
  storage: string
  /** Git remote URL, e.g. `git@github.com:user/dotfiles.git`. */
  remote: string | null
  /** Copy originals into the backup directory before moving them. */
  backup: boolean
}

export type Paths = {
  configDir: string
  configPath: string
  statePath: string
  backupRoot: string
}

export function resolvePaths(home: string = homedir(), xdgConfigHome?: string): Paths {
  const configDir = join(xdgConfigHome ?? join(home, ".config"), "dotmanager")
  return {
    configDir,
    configPath: join(configDir, "config.json"),
    statePath: join(configDir, "state.json"),
    backupRoot: join(configDir, "backup"),
  }
}

export function defaultConfig(home: string = homedir()): Config {
  return { version: 1, storage: join(home, "dotfiles"), remote: null, backup: true }
}

export function loadConfig(paths: Paths, home: string = homedir()): Config {
  if (!existsSync(paths.configPath)) return defaultConfig(home)
  const raw = JSON.parse(readFileSync(paths.configPath, "utf8")) as Partial<Config>
  return {
    version: 1,
    storage: expandHome(raw.storage ?? join(home, "dotfiles"), home),
    remote: raw.remote ?? null,
    backup: raw.backup ?? true,
  }
}

export function saveConfig(paths: Paths, config: Config): void {
  mkdirSync(paths.configDir, { recursive: true })
  writeFileSync(paths.configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8")
}

/** Everything a filesystem or git operation needs. */
export type Ctx = {
  home: string
  paths: Paths
  storage: string
  /** In-memory copy of config.json; operations read backup/remote from here. */
  config: Config
}

export function createCtx(home: string = homedir(), paths: Paths = resolvePaths(home, process.env.XDG_CONFIG_HOME)): Ctx {
  const config = loadConfig(paths, home)
  return { home, paths, storage: config.storage, config }
}
