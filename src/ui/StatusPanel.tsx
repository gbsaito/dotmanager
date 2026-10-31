import type { Config } from "../core/config.ts"
import type { StatusEntry } from "../core/state.ts"
import { pendingSummary, toneColor } from "./status.ts"
import { truncate } from "./text.ts"
import { colors, HELP_HINT } from "./theme.ts"

export type PromptState = {
  kind: "remote" | "path"
  value: string
}

type StatusPanelProps = {
  config: Config
  storageLabel: string
  repoReady: boolean
  lastAction: StatusEntry | null
  message: { text: string; level: "info" | "error" } | null
  pending: number
  focusLabel: string
  selectionLabel: string
  prompt: PromptState | null
  height: number
  width: number
  onPromptInput: (value: string) => void
  onPromptSubmit: (value: string) => void
}

export function StatusPanel(props: StatusPanelProps) {
  const { config, storageLabel, repoReady, lastAction, message, pending, focusLabel, selectionLabel, prompt, height, width } = props
  const textWidth = Math.max(20, width - 4)

  return (
    <box
      title=" Status "
      titleColor={colors.muted}
      style={{
        height,
        border: true,
        borderColor: prompt ? colors.accent : colors.border,
        backgroundColor: colors.panel,
        flexDirection: "column",
      }}
    >
      {prompt ? (
        <>
          <text
            fg={colors.accent}
            content={
              prompt.kind === "remote"
                ? " Git remote URL (e.g. git@github.com:you/dotfiles.git)"
                : " Path to adopt (file or directory, ~ allowed)"
            }
          />
          <box style={{ height: 1, flexDirection: "row" }}>
            <text fg={colors.muted} content="> " />
            <input
              focused
              width={Math.max(10, width - 8)}
              placeholder={prompt.kind === "remote" ? "git@github.com:you/dotfiles.git" : "~/.config/foo"}
              value={prompt.value}
              onInput={props.onPromptInput}
              onSubmit={() => props.onPromptSubmit(prompt.value)}
            />
          </box>
          <text fg={colors.muted} content=" enter confirm · esc cancel" />
        </>
      ) : (
        <>
          <text
            fg={colors.text}
            content={truncate(
              ` storage: ${storageLabel}  ·  remote: ${config.remote ?? "none"}  ·  backups: ${config.backup ? "ON" : "OFF"}  ·  repo: ${repoReady ? "ready" : "not initialized"}`,
              textWidth,
            )}
          />
          <text
            fg={colors.muted}
            content={truncate(
              lastAction
                ? ` last: ${lastAction.message} (${lastAction.at.slice(11, 19)})`
                : " last: no actions yet",
              textWidth,
            )}
          />
          <text fg={toneColor(pendingSummary(pending).tone, colors)} content={truncate(` ${pendingSummary(pending).text}`, textWidth)} />
          <text
            fg={message?.level === "error" ? colors.error : colors.success}
            content={truncate(message ? ` ${message.text}` : " ", textWidth)}
          />
          <text fg={colors.muted} content={truncate(` focus: ${focusLabel}  ·  ${selectionLabel}`, textWidth)} />
          <text fg={colors.muted} content=" " />
          <text fg={colors.muted} content={truncate(` ${HELP_HINT}`, textWidth)} />
        </>
      )}
    </box>
  )
}
