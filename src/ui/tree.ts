import { readdirSync } from "node:fs"
import { join } from "node:path"

export type TreeRow = {
  path: string
  name: string
  depth: number
  isDir: boolean
  isSymlink: boolean
}

const MAX_ROWS = 2000

/**
 * Depth-first listing of `root` with only expanded directories descended into.
 * Directories come first so dotfiles stay easy to find.
 */
export function listTree(root: string, expanded: Set<string>): TreeRow[] {
  const rows: TreeRow[] = []

  const walk = (dir: string, depth: number): void => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    entries.sort((a, b) => {
      const dirDelta = Number(b.isDirectory()) - Number(a.isDirectory())
      return dirDelta !== 0 ? dirDelta : a.name.localeCompare(b.name)
    })

    for (const entry of entries) {
      if (rows.length >= MAX_ROWS) return
      const path = join(dir, entry.name)
      const isSymlink = entry.isSymbolicLink()
      const isDir = entry.isDirectory()
      rows.push({ path, name: entry.name, depth, isDir, isSymlink })
      if (isDir && expanded.has(path)) walk(path, depth + 1)
    }
  }

  walk(root, 0)
  return rows
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
