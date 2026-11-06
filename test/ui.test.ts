import { describe, expect, test } from "bun:test"
import { clampIndex, managedRows, windowSlice } from "../src/ui/tree.ts"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

describe("windowSlice", () => {
  test("keeps the selection visible", () => {
    const rows = Array.from({ length: 20 }, (_, i) => i)
    const head = windowSlice(rows, 0, 5)
    expect(head.rows).toEqual([0, 1, 2, 3, 4])
    const tail = windowSlice(rows, 19, 5)
    expect(tail.rows).toEqual([15, 16, 17, 18, 19])
    const middle = windowSlice(rows, 10, 5)
    expect(middle.rows).toEqual([8, 9, 10, 11, 12])
    expect(windowSlice(rows, 3, 0).rows).toEqual([])
  })
})

describe("managedRows", () => {
  test("maps items to grouped home-relative rows, closed unless expanded", () => {
    const home = mkdtempSync(join(tmpdir(), "dotmanager-home-"))
    const nvim = join(home, ".config", "nvim")
    mkdirSync(nvim, { recursive: true })
    writeFileSync(join(nvim, "init.lua"), "")

    // Default: everything closed (groups, managed dirs and their contents below).
    const rows = managedRows([{ path: nvim }], home, new Set<string>())
    expect(rows.length).toBe(1)
    expect(rows[0]!.name).toBe(".config")
    expect(rows[0]!.managed).toBe(false)
    expect(rows[0]!.open).toBe(false)

    // Opening the group reveals child rows (still closed).
    const group = managedRows([{ path: nvim }], home, new Set([join(home, ".config")]))
    expect(group.length).toBe(2)
    expect(group[1]!.name).toBe("nvim")
    expect(group[1]!.open).toBe(false)

    // Opening the managed dir reveals its contents.
    const open = managedRows([{ path: nvim }], home, new Set([join(home, ".config"), nvim]))
    expect(open.length).toBe(3)
    expect(open[2]!.name).toBe("init.lua")
    expect(open[2]!.depth).toBe(2)
    expect(open[1]!.open).toBe(true)
  })
})

describe("clampIndex", () => {
  test("clamps and handles empty lists", () => {
    expect(clampIndex(9, 3)).toBe(2)
    expect(clampIndex(-1, 3)).toBe(0)
    expect(clampIndex(0, 0)).toBe(0)
  })
})
