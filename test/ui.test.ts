import { describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { truncate } from "../src/ui/text.ts"
import { clampIndex, listTree, windowSlice } from "../src/ui/tree.ts"

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

describe("windowSlice", () => {
  test("keeps the selection inside a fixed window", () => {
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
