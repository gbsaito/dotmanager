import type { Colors } from "./theme.ts"

export type StatusLine = {
  text: string
  tone: "muted" | "info" | "error"
}

export function pendingSummary(pendingCount: number): StatusLine {
  if (pendingCount === 0) return { text: "No pending operations", tone: "muted" }
  const noun = pendingCount === 1 ? "operation" : "operations"
  return { text: `${pendingCount} ${noun} pending push`, tone: "info" }
}

export function toneColor(tone: StatusLine["tone"], colors: Colors): string {
  if (tone === "error") return colors.error
  if (tone === "info") return colors.accent
  return colors.muted
}
