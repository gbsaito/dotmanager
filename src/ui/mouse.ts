import type { ScrollInfo } from "@opentui/core"

/** Map a vertical wheel event onto list navigation; other events are ignored. */
export function scrollDelta(event: { scroll?: ScrollInfo } | null | undefined): number {
  const direction = event?.scroll?.direction
  if (direction === "down") return 1
  if (direction === "up") return -1
  return 0
}

/** True for a left-button press on the renderable. */
export function leftClick(event: { type?: string; button?: number } | null | undefined): boolean {
  return !!event && event.type === "down" && event.button === 0
}
