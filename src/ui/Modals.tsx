import { colors } from "./theme.ts"
import { truncate } from "./text.ts"

export type ModalRow = { label: string; hint?: string }

type ModalProps = {
  title: string
  rows: ModalRow[]
  selected: number
  width: number
  height: number
}

/** Centered overlay dialog: dim backdrop + bordered list. */
export function Modal({ title, rows, selected, width, height }: ModalProps) {
  return (
    <box
      position="absolute"
      left={0}
      top={0}
      width={width}
      height={height}
      zIndex={10}
      backgroundColor="#0008"
      justifyContent="center"
      alignItems="center"
    >
      <box
        title={` ${title} `}
        titleColor={colors.accent}
        border
        borderColor={colors.accent}
        backgroundColor={colors.panel}
        flexDirection="column"
        padding={1}
        style={{ width: Math.min(70, Math.max(40, (width * 2) / 3)) }}
      >
        {rows.map((row, index) => (
          <text
            key={index}
            fg={index === selected ? colors.selectionText : row.hint === "planned" ? colors.muted : colors.text}
            bg={index === selected ? colors.selectionFocused : undefined}
            content={truncate(` ${row.label}`, Math.min(70, Math.max(40, (width * 2) / 3)) - 2)}
          />
        ))}
      </box>
    </box>
  )
}

export function opsModalRows(): ModalRow[] {
  return [
    { label: "s  sync (pull then push)" },
    { label: "p  push" },
    { label: "esc  close" },
  ]
}

export function paletteRows(): ModalRow[] {
  return [
    { label: "b  toggle backup" },
    { label: "t  change theme", hint: "planned" },
    { label: "r  change remote" },
    { label: "s  change storage location" },
  ]
}
