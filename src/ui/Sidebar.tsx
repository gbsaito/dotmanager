import { colors } from "./theme.ts"
import { leftClick } from "./mouse.ts"
import { truncate } from "./text.ts"
import { windowSlice, type TreeRow } from "./tree.ts"
import type { MouseEvent } from "@opentui/core"

type SidebarProps = {
  rows: TreeRow[]
  selected: number
  focused: boolean
  width: number
  height: number
  managed: Set<string>
  expanded: Set<string>
  foldersFirst: boolean
  onMouseScroll?: (event: MouseEvent) => void
  onRowClick?: (index: number, row: TreeRow) => void
}

export function Sidebar({ rows, selected, focused, width, height, managed, expanded, foldersFirst, onMouseScroll, onRowClick }: SidebarProps) {
  const inner = Math.max(0, height - 2)
  const view = windowSlice(rows, selected, inner)
  const textWidth = Math.max(8, width - 4)

  return (
    <box
      title=" Files ~ "
      titleColor={focused ? colors.borderFocused : colors.muted}
      onMouseScroll={onMouseScroll}
      style={{
        width,
        height,
        border: true,
        borderColor: focused ? colors.borderFocused : colors.border,
        backgroundColor: colors.panel,
        flexDirection: "column",
      }}
    >
      {rows.length === 0 ? (
        <text fg={colors.muted} content=" (empty directory)" />
      ) : (
        view.rows.map((row, offset) => {
          const index = view.start + offset
          const isSelected = index === selected
          const marker = managed.has(row.path) ? "●" : " "
          const icon = row.isDir ? "" : " "
          const line = `${marker}${icon} ${"  ".repeat(row.depth)}${row.name}`
          const color = managed.has(row.path) ? colors.managed : row.isDir ? colors.folder : colors.text
          return (
            <text
              key={`${row.path}:${index}`}
              fg={isSelected ? colors.selectionText : color}
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
