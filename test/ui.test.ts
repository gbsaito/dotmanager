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
  test("maps items to grouped home-relative rows", () => {
    const home = mkdtempSync(join(tmpdir(), "dotmanager-home-"))
    mkdirSync(join(home, ".config", "nvim"), { recursive: true })
    writeFileSync(join(home, ".config", "nvim", "init.lua"), "")

    const rows = managedRows([{ path: join(home, ".config", "nvim") }], home, new Set<string>(), new Set<string>())
    expect(rows.length).toBe(3)
    expect(rows[0]!.name).toBe(".config")
    expect(rows[0]!.managed).toBe(false)
    expect(rows[0]!.open).toBe(true)
    expect(rows[1]!.name).toBe("nvim")
    expect(rows[1]!.managed).toBe(true)
    expect(rows[1]!.open).toBe(true)
    expect(rows[2]!.name).toBe("init.lua")
    expect(rows[2]!.depth).toBe(2)

    const closed = managedRows([{ path: join(home, ".config", "nvim") }], home, new Set<string>(), new Set([join(home, ".config", "nvim")]))
    expect(closed.length).toBe(2)
    expect(closed[1]!.name).toBe("nvim")
    expect(closed[1]!.open).toBe(false)
  })
})

describe("clampIndex", () => {
  test("clamps and handles empty lists", () => {
    expect(clampIndex(9, 3)).toBe(2)
    expect(clampIndex(-1, 3)).toBe(0)
    expect(clampIndex(0, 0)).toBe(0)
  })
})
