import type { Config } from "../core/config.ts"
import type { StatusEntry } from "../core/state.ts"
import { colors, HELP_HINT, SHORT_HINT } from "./theme.ts"
import { truncate } from "./text.ts"

export type PromptState = {
  label: string
  placeholder: string
  value: string
}

export type ModalState =
  | { kind: "push"; changes: string[] }
  | { kind: "palette" }
  | null

type FooterProps = {
  config: Config
  pending: number
  lastAction: StatusEntry | null
  message: { text: string; level: "info" | "error" } | null
  focusFlag: string
  width: number
  prompt: PromptState | null
  onPromptInput: (value: string) => void
  onPromptSubmit: (value: string) => void
}

export function Footer({ config, pending, lastAction, message, focusFlag, width, prompt, onPromptInput, onPromptSubmit }: FooterProps) {
  const line = ` ${config.remote ? `⇣${config.remote}` : "no remote"} · ${pending} pending · ${config.backup ? "backups ON" : "backups OFF"} · ${focusFlag} · ${lastAction ? `last: ${lastAction.message}` : "ready"}`
  const hint = width >= 84 ? HELP_HINT : SHORT_HINT
  return (
    <box
      title=" Status "
      titleColor={prompt ? colors.accent : colors.muted}
      border
      borderColor={prompt ? colors.accent : colors.border}
      backgroundColor={colors.panel}
      flexDirection="column"
      style={{ height: 4 }}
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
          <text
            fg={message ? (message.level === "error" ? colors.error : colors.accent) : colors.accent}
            content={truncate(message ? ` ${message.text}` : line, Math.max(10, width - 4))}
            flexShrink={0}
          />
          <text fg={colors.muted} content={` ${truncate(hint, Math.max(10, width - 4))}`} />
        </>
      )}
    </box>
  )
}
