import { truncate } from "./text.ts"
import { colors } from "./theme.ts"
import { windowSlice, type ManagedRow } from "./tree.ts"
import type { MouseEvent } from "@opentui/core"

type MainPanelProps = {
  rows: ManagedRow[]
  itemCount: number
  selected: number
  focused: boolean
  height: number
  width: number
  storageLabel: string
  pending: number
  onMouseScroll?: (event: MouseEvent) => void
}

export function MainPanel({ rows, itemCount, selected, focused, height, width, storageLabel, pending, onMouseScroll }: MainPanelProps) {
  const inner = Math.max(0, height - 4)
  const view = windowSlice(rows, selected, inner)
  const textWidth = Math.max(10, width - 4)

  return (
    <box
      title=" Managed "
      titleColor={colors.muted}
      onMouseScroll={onMouseScroll}
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
        content={truncate(` repo: ${storageLabel}   ·   ${itemCount} items   ·   ${pending} pending`, textWidth)}
      />
      {rows.length === 0 ? (
        <text fg={colors.muted} content=" Nothing managed yet. Pick a file or directory on the left, then press space." />
      ) : (
        view.rows.map((row, offset) => {
          const index = view.start + offset
          const isSelected = index === selected
          const suffix = row.isSymlink && !row.managed ? " →" : ""
          const line = `${"  ".repeat(row.depth)}${row.name}${suffix}`
          const color = row.isDir ? colors.success : colors.text
          return (
            <text
              key={`${row.path}:${index}`}
              fg={isSelected ? colors.selectionText : color}
              bg={isSelected ? (focused ? colors.selectionFocused : colors.selection) : undefined}
              content={truncate(line, textWidth)}
            />
          )
        })
      )}
    </box>
  )
}
