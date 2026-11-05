import type { Config } from "../core/config.ts"
import type { StatusEntry } from "../core/state.ts"
import { colors, HELP_HINT } from "./theme.ts"
import { truncate } from "./text.ts"

export type PromptState = {
  label: string
  placeholder: string
  value: string
}

export type ModalState =
  | { kind: "ops" }
  | { kind: "push"; changes: string[] }
  | { kind: "palette" }
  | null

type FooterProps = {
  config: Config
  pending: number
  lastAction: StatusEntry | null
  message: { text: string; level: "info" | "error" } | null
  focusFlag: string
  prompt: PromptState | null
  onPromptInput: (value: string) => void
  onPromptSubmit: (value: string) => void
}

export function Footer({ config, pending, lastAction, message, focusFlag, prompt, onPromptInput, onPromptSubmit }: FooterProps) {
  const line = ` ${config.remote ? `⇣${config.remote}` : "no remote"} · ${pending} pending · ${config.backup ? "backups ON" : "backups OFF"} · ${focusFlag} · ${lastAction ? `last: ${lastAction.message}` : "ready"}`

  return (
    <box
      style={{
        height: 3,
        border: true,
        borderColor: prompt ? colors.accent : colors.border,
        backgroundColor: colors.panel,
        flexDirection: "row",
      }}
    >
      {prompt ? (
        <box style={{ flexDirection: "row", width: "100%" }}>
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
            fg={message ? (message.level === "error" ? colors.error : colors.success) : pending > 0 ? colors.accent : colors.muted}
            content={truncate(message ? ` ${message.text}` : truncate(line, 150), 150)}
            flexGrow={1}
          />
          <text fg={colors.muted} content={` ${HELP_HINT} `} />
        </>
      )}
    </box>
  )
}
