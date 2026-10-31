import type { ManagedItem } from "../core/state.ts"
import { truncate } from "./text.ts"
import { colors } from "./theme.ts"
import { windowSlice } from "./tree.ts"

type MainPanelProps = {
  items: ManagedItem[]
  selected: number
  focused: boolean
  height: number
  width: number
  home: string
  storageLabel: string
  pending: number
}

export function MainPanel({ items, selected, focused, height, width, home, storageLabel, pending }: MainPanelProps) {
  const inner = Math.max(0, height - 4)
  const view = windowSlice(items, selected, inner)
  const textWidth = Math.max(10, width - 4)

  return (
    <box
      title=" Managed "
      titleColor={colors.muted}
      style={{
        flexGrow: 1,
        height,
        border: true,
        borderColor: focused ? colors.borderFocused : colors.border,
        backgroundColor: colors.panel,
        flexDirection: "column",
      }}
    >
      <text
        fg={colors.muted}
        content={truncate(` repo: ${storageLabel}   ·   ${items.length} items   ·   ${pending} pending`, textWidth)}
      />
      {items.length === 0 ? (
        <text fg={colors.muted} content=" Nothing managed yet. Pick a file or directory on the left, then press space." />
      ) : (
        view.rows.map((item, offset) => {
          const index = view.start + offset
          const isSelected = index === selected
          const shown = item.path.startsWith(`${home}/`) ? `~/${item.path.slice(home.length + 1)}` : item.path
          const line = `${isSelected ? "> " : "  "}${shown}`
          return (
            <text
              key={item.path}
              fg={isSelected ? colors.bg : colors.text}
              bg={isSelected ? (focused ? colors.accent : colors.selection) : undefined}
              content={truncate(line, textWidth)}
            />
          )
        })
      )}
    </box>
  )
}
