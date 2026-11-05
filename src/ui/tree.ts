import { lstatSync, readdirSync, statSync, type Dirent } from "node:fs"
import { join } from "node:path"
import { displayPath } from "../core/util.ts"

export type TreeRow = {
  path: string
  name: string
  depth: number
  isDir: boolean
  isSymlink: boolean
}

export type ManagedRow = TreeRow & { managed: boolean; toggle: boolean; open: boolean }

const MAX_ROWS = 2000

export function listTree(root: string, expanded: Set<string>): TreeRow[] {
  const rows: TreeRow[] = []

  const walk = (dir: string, depth: number): void => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    // dotfiles (hidden) first, then normal folders, then normal files
    const tier = (e: Dirent) => (e.name.startsWith(".") ? 0 : e.isDirectory() ? 1 : 2)
    entries.sort((a, b) => tier(a) - tier(b) || a.name.localeCompare(b.name))

    for (const entry of entries) {
      if (rows.length >= MAX_ROWS) return
      const path = join(dir, entry.name)
      const isSymlink = entry.isSymbolicLink()
      const isDir = !isSymlink && entry.isDirectory()
      rows.push({ path, name: entry.name, depth, isDir, isSymlink })
      if (isDir && expanded.has(path)) walk(path, depth + 1)
    }
  }

  walk(root, 0)
  return rows
}

type Node = {
  name: string
  path: string
  depth: number
  managed: boolean
  children: Map<string, Node>
}

function statInfo(path: string): { isDir: boolean; isSymlink: boolean } {
  try {
    const info = lstatSync(path)
    if (!info.isSymbolicLink()) return { isDir: info.isDirectory(), isSymlink: false }
    try {
      return { isDir: statSync(path).isDirectory(), isSymlink: true }
    } catch {
      return { isDir: false, isSymlink: true }
    }
  } catch {
    return { isDir: false, isSymlink: false }
  }
}

/** Segments of `path` relative to `home`, or null when it lives outside. */
function relativeSegments(path: string, home: string): string[] | null {
  if (!path.startsWith(`${home}/`)) return null
  return path.slice(home.length + 1).split("/").filter(Boolean)
}

/**
 * Managed panel rows: managed items grouped by real paths, so
 * `~/.config/fastfetch` shows as `.config > fastfetch`, `~/.local/share/wireplumber`
 * as `.local > share > wireplumber`. Path scaffolding rows start expanded so the
 * managed items are visible right away; managed directories expand into contents.
 */
export function managedRows(
  items: { path: string }[],
  home: string,
  expanded: Set<string>,
  collapsed: Set<string> = new Set(),
): ManagedRow[] {
  const roots = new Map<string, Node>()

  const insert = (segments: string[], parentPath: string, depth: number, siblings: Map<string, Node>): Node => {
    const [name, ...rest] = segments as [string, ...string[]]
    const path = join(parentPath, name)

    let node = siblings.get(name)
    if (!node) {
      node = { name, path, depth, managed: false, children: new Map() }
      siblings.set(name, node)
    }

    if (rest.length === 0) {
      node.managed = true
      return node
    }
    return insert(rest, path, depth + 1, node.children)
  }

  for (const item of items) {
    const segments = relativeSegments(item.path, home)
    if (!segments || segments.length === 0) {
      roots.set(item.path, { name: item.path, path: item.path, depth: 0, managed: true, children: new Map() })
      continue
    }
    insert(segments, home, 0, roots)
  }

  return flatten(roots, expanded, collapsed)
}

function flatten(roots: Map<string, Node>, expanded: Set<string>, collapsed: Set<string>): ManagedRow[] {
  const rows: ManagedRow[] = []

  const sorted = (nodes: Map<string, Node>): Node[] =>
    [...nodes.values()].sort((a, b) => {
      const dirDelta = Number(b.children.size > 0) - Number(a.children.size > 0)
      return dirDelta !== 0 ? dirDelta : a.name.localeCompare(b.name)
    })

  const push = (node: Node): void => {
    if (rows.length >= MAX_ROWS) return
    const info = statInfo(node.path)
    const isGroup = !node.managed
    const isDir = node.managed ? info.isDir : true
    const open = isGroup ? !collapsed.has(node.path) : expanded.has(node.path)

    rows.push({
      path: node.path,
      name: node.name,
      depth: node.depth,
      isDir,
      isSymlink: node.managed && info.isSymlink,
      managed: node.managed,
      toggle: isGroup ? node.children.size > 0 : isDir,
      open,
    })

    if (node.managed) {
      if (info.isDir && open) {
        for (const child of listTree(node.path, expanded)) {
          if (rows.length >= MAX_ROWS) break
          rows.push({ ...child, depth: node.depth + 1, managed: false, toggle: child.isDir, open: expanded.has(child.path) })
        }
      }
      return
    }

    if (!open) return
    for (const child of sorted(node.children)) push(child)
  }

  for (const root of sorted(roots)) push(root)
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
