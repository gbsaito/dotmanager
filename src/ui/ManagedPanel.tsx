import type { MouseEvent } from "@opentui/core"
import { colors } from "./theme.ts"
import { leftClick } from "./mouse.ts"
import { truncate } from "./text.ts"
import { windowSlice, type ManagedRow } from "./tree.ts"

type ManagedPanelProps = {
  rows: ManagedRow[]
  itemCount: number
  selected: number
  focused: boolean
  height: number
  width: number
  storageLabel: string
  pending: number
  onMouseScroll?: (event: MouseEvent) => void
  onRowClick?: (index: number, row: ManagedRow) => void
}

export function ManagedPanel({ rows, itemCount, selected, focused, height, width, storageLabel, pending, onMouseScroll, onRowClick }: ManagedPanelProps) {
  const inner = Math.max(0, height - 3)
  const view = windowSlice(rows, selected, inner)
  const textWidth = Math.max(10, width - 4)

  return (
    <box
      title=" Managed "
      titleColor={focused ? colors.borderFocused : colors.muted}
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
      <text fg={colors.muted} content={truncate(` ${storageLabel} · ${itemCount} items · ${pending} pending`, textWidth)} />
      {rows.length === 0 ? (
        <text fg={colors.muted} content=" Nothing managed yet. Pick a file on the left, then press a." />
      ) : (
        view.rows.map((row, offset) => {
          const index = view.start + offset
          const isSelected = index === selected
          const suffix = row.isSymlink && !row.managed ? " →" : ""
          const line = `${"  ".repeat(row.depth)}${row.name}${suffix}`
          return (
            <text
              key={`${row.path}:${index}`}
              fg={isSelected ? colors.selectionText : row.isDir ? colors.managed : colors.text}
              bg={isSelected ? (focused ? colors.selectionFocused : colors.selection) : undefined}
              content={truncate(line, textWidth)}
              onMouseDown={
                onRowClick
                  ? (event) => {
                      if (leftClick(event)) onRowClick(index, row)
                    }
                  : undefined
              }
            />
          )
        })
      )}
    </box>
  )
}
