import { describe, expect, test } from "bun:test"
import { leftClick, scrollDelta } from "../src/ui/mouse.ts"

describe("scrollDelta", () => {
  test("wheel down moves the selection down", () => {
    expect(scrollDelta({ scroll: { direction: "down", delta: 1 } })).toBe(1)
  })

  test("wheel up moves the selection up", () => {
    expect(scrollDelta({ scroll: { direction: "up", delta: 1 } })).toBe(-1)
  })

  test("scrolls without a usable direction are ignored", () => {
    expect(scrollDelta(null)).toBe(0)
    expect(scrollDelta({})).toBe(0)
    expect(scrollDelta({ scroll: { direction: "left", delta: 1 } })).toBe(0)
    expect(scrollDelta({ scroll: { direction: "right", delta: 1 } })).toBe(0)
  })
})

describe("leftClick", () => {
  test("left presses count as clicks", () => {
    expect(leftClick({ type: "down", button: 0 })).toBe(true)
  })

  test("nothing counts but a left press", () => {
    expect(leftClick(null)).toBe(false)
    expect(leftClick({ type: "up", button: 0 })).toBe(false)
    expect(leftClick({ type: "down", button: 2 })).toBe(false)
    expect(leftClick({ type: "scroll", button: 0 })).toBe(false)
  })
})
