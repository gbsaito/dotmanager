import { readdirSync } from "node:fs"
import { join } from "node:path"
import { displayPath } from "../core/util.ts"

export type TreeRow = {
  path: string
  name: string
  depth: number
  isDir: boolean
  isSymlink: boolean
}

const MAX_ROWS = 2000

/**
 * Depth-first listing of `root` descending only into expanded directories.
 * Directories first, so dotfiles stay easy to find.
 */
export function listTree(root: string, expanded: Set<string>): TreeRow[] {
  const rows: TreeRow[] = []

  const walk = (dir: string, depth: number): void => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return // Unreadable directories are skipped.
    }
    entries.sort((a, b) => {
      const dirDelta = Number(b.isDirectory()) - Number(a.isDirectory())
      return dirDelta !== 0 ? dirDelta : a.name.localeCompare(b.name)
    })

    for (const entry of entries) {
      if (rows.length >= MAX_ROWS) return
      const isSymlink = entry.isSymbolicLink()
      const isDir = !isSymlink && entry.isDirectory()
      const path = join(dir, entry.name)
      rows.push({ path, name: entry.name, depth, isDir, isSymlink })
      if (isDir && expanded.has(path)) walk(path, depth + 1)
    }
  }

  walk(root, 0)
  return rows
}

export type ManagedRow = TreeRow

/** One row per managed item, shown as its home-relative path. */
export function managedRows(items: { path: string }[], home: string, isDir: (path: string) => boolean): ManagedRow[] {
  return [...items]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((item) => ({
      path: item.path,
      name: displayPath(item.path, home),
      depth: 0,
      isDir: isDir(item.path),
      isSymlink: true,
    }))
}

/** Slice a list so `index` stays visible inside a fixed-size window. */
export function windowSlice<T>(rows: T[], index: number, size: number): { rows: T[]; start: number } {
  if (size <= 0) return { rows: [], start: 0 }
  if (rows.length <= size) return { rows, start: 0 }
  const start = Math.max(0, Math.min(index - Math.floor(size / 2), rows.length - size))
  return { rows: rows.slice(start, start + size), start }
}

export function clampIndex(index: number, count: number): number {
  if (count === 0) return 0
  return Math.max(0, Math.min(index, count - 1))
}
