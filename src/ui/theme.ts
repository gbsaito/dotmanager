/** Palette used across the TUI (theme support is a later phase). */
export type Colors = {
  bg: string
  panel: string
  border: string
  borderFocused: string
  text: string
  muted: string
  accent: string
  success: string
  error: string
  selection: string
  selectionFocused: string
}

export const colors: Colors = {
  bg: "#1e1e2e",
  panel: "#181825",
  border: "#45475a",
  borderFocused: "#89b4fa",
  text: "#cdd6f4",
  muted: "#6c7086",
  accent: "#89b4fa",
  success: "#a6e3a1",
  error: "#f38ba8",
  selection: "#313244",
  selectionFocused: "#45475a",
}

export const HELP_HINT =
  "tab focus · space adopt/unmanage · s sync · p push · u pull · R remote · a add path · b backup · r reload · q quit"
