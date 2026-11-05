import { homedir } from "node:os"
import { isAbsolute, join, relative, resolve } from "node:path"

/** Expand a leading `~` (or `~/...`) against `home`. */
export function expandHome(path: string, home: string = homedir()): string {
  if (path === "~") return home
  if (path.startsWith("~/")) return join(home, path.slice(2))
  return resolve(path)
}

/** True when `child` is `parent` itself or lives inside it. */
export function isWithin(child: string, parent: string): boolean {
  const rel = relative(resolve(parent), resolve(child))
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))
}

/**
 * Map an absolute path to its location inside the dotfiles repo.
 *
 * Paths under `$HOME` mirror their home-relative layout (`.config/fastfetch`).
 * Paths outside `$HOME` land under `_external/` so the repo remains portable.
 */
export function repoRelativePath(absolutePath: string, home: string): string {
  const abs = resolve(absolutePath)
  if (isWithin(abs, home)) {
    const rel = relative(home, abs)
    if (rel !== "") return rel
    throw new Error("cannot manage $HOME itself")
  }
  return join("_external", abs.replace(/^\/+/, ""))
}

/** Render a path with `~` substituted for the home directory. */
export function displayPath(absolutePath: string, home: string = homedir()): string {
  if (isWithin(absolutePath, home)) {
    const rel = relative(home, absolutePath)
    return rel === "" ? "~" : `~/${rel}`
  }
  return absolutePath
}
