import type { ScrollInfo } from "@opentui/core"

export type ScrollIntent = "up" | "down" | null

/**
 * Map a mouse scroll event onto a list navigation step. The OpenTUI parser
 * reports wheel events as `scroll` with a direction (`up`/`down`) and a delta;
 * only vertical scrolling drives list navigation, so horizontal scrolls and
 * events without direction info are ignored.
 */
export function scrollDelta(event: { scroll?: ScrollInfo } | null | undefined): number {
  const direction = event?.scroll?.direction
  if (direction === "down") return 1
  if (direction === "up") return -1
  return 0
}

/**
 * True for a left-button press on the renderable that owns the handler:
 * the OpenTUI parser reports presses as "down" events, and only the left
 * button (0) counts as a click.
 */
export function leftClick(event: { type?: string; button?: number } | null | undefined): boolean {
  if (!event || event.button !== 0) return false
  return event.type === "down"
}
