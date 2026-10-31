import { colors } from "./theme.ts"
import { truncate } from "./text.ts"
import { windowSlice, type TreeRow } from "./tree.ts"
import type { MouseEvent } from "@opentui/core"

type SidebarProps = {
  rows: TreeRow[]
  selected: number
  focused: boolean
  width: number
  height: number
  rootLabel: string
  managed: Set<string>
  expanded: Set<string>
  onMouseScroll?: (event: MouseEvent) => void
}

export function Sidebar({ rows, selected, focused, width, height, rootLabel, managed, expanded, onMouseScroll }: SidebarProps) {
  const inner = Math.max(0, height - 3)
  const view = windowSlice(rows, selected, inner)
  const textWidth = Math.max(8, width - 3)

  return (
    <box
      title={` Files ${rootLabel} `}
      titleColor={colors.muted}
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
          const arrow = row.isDir ? (expanded.has(row.path) ? "▾ " : "▸ ") : "  "
          const marker = managed.has(row.path) ? "●" : " "
          const suffix = row.isSymlink ? " →" : ""
          const folder = row.isDir ? "" : ""
          const line = `${marker}${arrow}${"  ".repeat(row.depth)}${folder}${row.name}${suffix}`
          const color = managed.has(row.path)
            ? colors.success
            : row.isDir
              ? colors.accent
              : row.isSymlink
                ? colors.muted
                : colors.text
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
