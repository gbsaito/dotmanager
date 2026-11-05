import { describe, expect, test } from "bun:test"
import { clampIndex, managedRows, windowSlice } from "../src/ui/tree.ts"

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
  test("maps items to home-relative rows sorted by path", () => {
    const rows = managedRows(
      [
        { path: "/home/me/.zshrc" },
        { path: "/home/me/.config/nvim" },
      ],
      "/home/me",
      (path) => path.endsWith("nvim"),
    )
    expect(rows.map((row) => row.name)).toEqual(["~/.config/nvim", "~/.zshrc"])
    expect(rows[0]!.isDir).toBe(true)
    expect(rows[1]!.isDir).toBe(false)
  })
})

describe("clampIndex", () => {
  test("clamps and handles empty lists", () => {
    expect(clampIndex(9, 3)).toBe(2)
    expect(clampIndex(-1, 3)).toBe(0)
    expect(clampIndex(0, 0)).toBe(0)
  })
})
