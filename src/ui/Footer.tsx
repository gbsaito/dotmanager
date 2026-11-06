import type { Config } from "../core/config.ts"
import type { StatusEntry } from "../core/state.ts"
import { colors } from "./theme.ts"
import { truncate } from "./text.ts"
import { displayPath } from "../core/util.ts"

export type PromptState = {
  label: string
  placeholder: string
  value: string
}

export type ModalState =
  | { kind: "push"; changes: string[] }
  | { kind: "palette" }
  | { kind: "help" }
  | null

type FooterProps = {
  config: Config
  pending: number
  lastAction: StatusEntry | null
  message: { text: string; level: "info" | "error" } | null
  width: number
  prompt: PromptState | null
  onPromptInput: (value: string) => void
  onPromptSubmit: (value: string) => void
}

export function Footer({ config, pending, lastAction, message, width, prompt, onPromptInput, onPromptSubmit }: FooterProps) {
  const line = (s: string) => truncate(s, Math.max(10, width - 4))
  const last = message ? message.text : lastAction ? `${lastAction.message} (${lastAction.at.slice(11, 19)})` : "—"
  const lastColor = message?.level === "error" ? colors.error : colors.muted

  return (
    <box
      title=" Status "
      titleColor={prompt ? colors.accent : colors.muted}
      border
      borderColor={prompt ? colors.accent : colors.border}
      backgroundColor={colors.panel}
      flexDirection="column"
      style={{ height: 5 }}
    >
      {prompt ? (
        <box style={{ flexDirection: "row", height: 1 }}>
          <text fg={colors.accent} content={prompt.label} />
          <input
            focused
            flexGrow={1}
            placeholder={prompt.placeholder}
            value={prompt.value}
            onInput={onPromptInput}
            onSubmit={() => onPromptSubmit(prompt.value)}
          />
        </box>
      ) : (
        <>
          <text fg={colors.text} content={line(` storage: ${displayPath(config.storage)} · remote: ${config.remote ?? "none"} · backups: ${config.backup ? "ON" : "OFF"}`)} />
          <text fg={colors.accent} content={line(` ${pending} operations pending`)} />
          <text fg={lastColor} content={line(` last: ${last}`)} />
        </>
      )}
    </box>
  )
}
