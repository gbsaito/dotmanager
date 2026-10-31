import { describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { truncate } from "../src/ui/text.ts"
import { clampIndex, listTree, managedRows, windowSlice } from "../src/ui/tree.ts"

describe("listTree", () => {
  test("lists directories first and only descends into expanded ones", () => {
    const root = mkdtempSync(join(tmpdir(), "dotmanager-tree-"))
    mkdirSync(join(root, "zdir"))
    mkdirSync(join(root, "adir"))
    writeFileSync(join(root, ".bashrc"), "")
    writeFileSync(join(root, "adir", "nested"), "")

    const collapsed = listTree(root, new Set())
    expect(collapsed.map((row) => row.name)).toEqual(["adir", "zdir", ".bashrc"])
    expect(collapsed.map((row) => row.depth)).toEqual([0, 0, 0])

    const expanded = listTree(root, new Set([join(root, "adir")]))
    expect(expanded.map((row) => `${row.depth}:${row.name}`)).toEqual([
      "0:adir",
      "1:nested",
      "0:zdir",
      "0:.bashrc",
    ])
  })

  test("survives unreadable directories", () => {
    expect(listTree("/definitely/not/here", new Set())).toEqual([])
  })
})

describe("managedRows", () => {
  test("groups managed items into their real path hierarchy", () => {
    const home = mkdtempSync(join(tmpdir(), "dotmanager-managed-"))
    const config = join(home, ".config")
    const fastfetch = join(config, "fastfetch")
    const local = join(home, ".local")
    const share = join(local, "share")
    const wireplumber = join(share, "wireplumber")
    mkdirSync(fastfetch, { recursive: true })
    writeFileSync(join(fastfetch, "config.jsonc"), "")
    mkdirSync(wireplumber, { recursive: true })
    writeFileSync(join(home, ".zshrc"), "")

    const items = [{ path: fastfetch }, { path: wireplumber }, { path: join(home, ".zshrc") }]

    const collapsed = managedRows(items, home, new Set())
    expect(collapsed.map((row) => `${row.depth}:${row.name}:${row.managed ? "managed" : "group"}`)).toEqual([
      `0:.config:group`,
      `1:fastfetch:managed`,
      `0:.local:group`,
      `1:share:group`,
      `2:wireplumber:managed`,
      `0:.zshrc:managed`,
    ])

    const expanded = managedRows(items, home, new Set([fastfetch]))
    expect(expanded.map((row) => `${row.depth}:${row.name}`)).toEqual([
      "0:.config",
      "1:fastfetch",
      "2:config.jsonc",
      "0:.local",
      "1:share",
      "2:wireplumber",
      "0:.zshrc",
    ])

    const collapsedConfig = managedRows(items, home, new Set(), new Set([config]))
    expect(collapsedConfig.map((row) => `${row.depth}:${row.name}`)).toEqual([
      "0:.config",
      "0:.local",
      "1:share",
      "2:wireplumber",
      "0:.zshrc",
    ])
    expect(collapsedConfig[0]?.open).toBe(false)
  })

  test("still lists managed paths that are missing from disk", () => {
    const home = "/home/example"
    const missing = join(home, ".config", "gone")
    const rows = managedRows([{ path: missing }], home, new Set())
    expect(rows.map((row) => `${row.name}:${row.managed}`)).toEqual([".config:false", "gone:true"])
  })

  test("keeps paths outside home as a single row", () => {
    const home = "/home/example"
    const external = "/srv/thing"
    const rows = managedRows([{ path: external }], home, new Set())
    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toBe(external)
    expect(rows[0]?.managed).toBe(true)
  })
})

describe("windowSlice", () => {  test("keeps the selection inside a fixed window", () => {
    const rows = Array.from({ length: 10 }, (_, i) => i)
    expect(windowSlice(rows, 0, 3)).toEqual({ rows: [0, 1, 2], start: 0 })
    expect(windowSlice(rows, 5, 3)).toEqual({ rows: [4, 5, 6], start: 4 })
    expect(windowSlice(rows, 9, 3)).toEqual({ rows: [7, 8, 9], start: 7 })
    expect(windowSlice(rows, 2, 20).start).toBe(0)
    expect(windowSlice(rows, 2, 0)).toEqual({ rows: [], start: 0 })
  })

  test("clampIndex keeps indexes in range", () => {
    expect(clampIndex(-3, 5)).toBe(0)
    expect(clampIndex(9, 5)).toBe(4)
    expect(clampIndex(0, 0)).toBe(0)
  })
})

describe("truncate", () => {
  test("shortens long lines", () => {
    expect(truncate("hello", 10)).toBe("hello")
    expect(truncate("hello", 4)).toBe("hel…")
    expect(truncate("hello", 0)).toBe("")
  })
})
