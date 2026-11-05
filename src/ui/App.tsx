import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import type { MouseEvent } from "@opentui/core"
import { useMemo, useState } from "react"
import { createCtx, saveConfig, type Config } from "../core/config.ts"
import { ensureRepo, git, push, setRemote, sync } from "../core/git.ts"
import { add, apply, forget } from "../core/ops.ts"
import { loadState, recordAction, saveState, type State } from "../core/state.ts"
import { displayPath } from "../core/util.ts"
import { scrollDelta } from "./mouse.ts"
import { Footer, type ModalState, type PromptState } from "./Footer.tsx"
import { ManagedPanel } from "./ManagedPanel.tsx"
import { Modal, opsModalRows, paletteRows } from "./Modals.tsx"
import { Sidebar } from "./Sidebar.tsx"
import { clampIndex, listTree, managedRows } from "./tree.ts"
import { colors } from "./theme.ts"

type Focus = "files" | "managed"
type Message = { text: string; level: "info" | "error" }

export function App() {
  const renderer = useRenderer()
  const { width, height } = useTerminalDimensions()
  const ctx = useMemo(() => createCtx(), [])

  const [config, setConfig] = useState<Config>(ctx.config)
  const [state, setState] = useState<State>(() => loadState(ctx.paths.statePath))
  const [focus, setFocus] = useState<Focus>("files")
  const [sidebarIndex, setSidebarIndex] = useState(0)
  const [mainIndex, setMainIndex] = useState(0)
  const [expanded, setExpanded] = useState(() => new Set<string>())
  const [prompt, setPrompt] = useState<PromptState | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [paletteIndex, setPaletteIndex] = useState(0)
  const [message, setMessage] = useState<Message | null>(null)

  const rows = useMemo(() => listTree(ctx.home, expanded), [ctx.home, expanded])
  const managedPaths = useMemo(() => new Set(state.items.map((item) => item.path)), [state.items])
  const isDirPath = (path: string): boolean => rows.some((row) => row.path === path && row.isDir)
  const tree = useMemo(() => managedRows(state.items, ctx.home, isDirPath), [state.items, ctx.home, rows])

  const sIdx = clampIndex(sidebarIndex, rows.length)
  const mIdx = clampIndex(mainIndex, tree.length)
  const selectedRow = rows[sIdx]
  const selectedManaged = tree[mIdx]

  const sidebarWidth = Math.min(48, Math.max(22, Math.floor(width * 0.35)))
  const mainHeight = Math.max(4, height - 3)
  const fail = (text: string) => setMessage({ text, level: "error" })
  const succeed = (text: string) => setMessage({ text, level: "info" })

  const commitState = (next: State) => {
    saveState(ctx.paths.statePath, next)
    setState(next)
  }

  const addPath = (path: string) => {
    const fresh = loadState(ctx.paths.statePath)
    const outcome = add(ctx, fresh, path)
    commitState(fresh)
    outcome.ok ? succeed(outcome.message) : fail(outcome.error)
  }

  const forgetPath = (path: string) => {
    const fresh = loadState(ctx.paths.statePath)
    const outcome = forget(ctx, fresh, path)
    commitState(fresh)
    if (outcome.ok) succeed(outcome.message)
    else fail(outcome.error)
  }

  const moveSelection = (delta: number) => {
    setMessage(null)
    if (focus === "files") setSidebarIndex(clampIndex(sIdx + delta, rows.length))
    else setMainIndex(clampIndex(mIdx + delta, tree.length))
  }

  const activate = (row: { path: string; isDir: boolean }, panel: Focus) => {
    setMessage(null)
    setFocus(panel)
    if (panel === "files") {
      setSidebarIndex(rows.findIndex((entry) => entry.path === row.path))
      if (row.isDir) {
        setExpanded((previous) => {
          const next = new Set(previous)
          next.has(row.path) ? next.delete(row.path) : next.add(row.path)
          return next
        })
        return
      }
      addPath(row.path)
    } else forgetPath(row.path)
  }

  const toggleBackup = () => {
    const next = { ...config, backup: !config.backup }
    setConfig(next)
    saveConfig(ctx.paths, next)
    succeed(`Backups ${next.backup ? "enabled" : "disabled"}`)
  }

  const runSync = (kind: "sync" | "push") => {
    const prepared = ensureRepo(ctx.storage)
    if (!prepared.ok) return fail(prepared.stderr || "git init failed")
    if (!config.remote) return fail("no remote configured — open the palette (:) and set one")
    const remote = setRemote(ctx.storage, config.remote)
    if (!remote.ok) return fail(remote.stderr || "could not configure the remote")

    const result = kind === "sync" ? sync(ctx.storage) : push(ctx.storage)
    if (!result.ok) return fail(result.stderr || `git ${kind} failed`)

    const fresh = loadState(ctx.paths.statePath)
    if (kind === "sync") apply(ctx, fresh) // keep local state in step with the pulled repo
    fresh.pending = []
    recordAction(fresh, "info", kind === "sync" ? "Synced with remote" : "Pushed to remote")
    commitState(fresh)
    succeed(kind === "sync" ? "Synced with remote" : "Pushed to remote")
  }

  const pendingChanges = (): string[] => {
    const committed = state.pending.map((entry) => `${entry.kind}: ${displayPath(entry.path, ctx.home)}`)
    const dirty = git(ctx.storage, ["status", "--porcelain"]).stdout
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => line.trimEnd())
    return [...committed, ...dirty]
  }

  const changeConfig = (patch: Partial<Config>, note: string) => {
    const next = { ...config, ...patch }
    setConfig(next)
    saveConfig(ctx.paths, next)
    succeed(note)
  }

  const runPaletteCommand = (index: number) => {
    setModal(null)
    if (index === 0) return toggleBackup()
    if (index === 1) return succeed("theme picker: planned")
    if (index === 2) return setPrompt({ label: " Git remote URL", placeholder: "git@github.com:you/dotfiles.git", value: config.remote ?? "" })
    return setPrompt({ label: " Storage path (repo dir)", placeholder: "~/dotfiles", value: config.storage })
  }

  const submitPrompt = (value: string) => {
    const label = prompt?.label ?? ""
    const trimmed = value.trim()
    setPrompt(null)
    if (!trimmed) return fail("cancelled")
    if (label.startsWith(" Git remote")) {
      changeConfig({ remote: trimmed }, `Remote set to ${trimmed}`)
    } else {
      changeConfig({ storage: trimmed }, `Storage set to ${trimmed}`)
    }
    return undefined
  }

  const openPrompt = (payload: PromptState) => {
    setPrompt(payload)
    setMessage(null)
  }

  useKeyboard((key) => {
    // Input prompts swallow everything but escape/submit.
    if (prompt) {
      if (key.name === "escape") {
        setPrompt(null)
        setMessage(null)
      }
      return
    }

    if (key.name === "q" || (key.name === "c" && key.ctrl)) {
      renderer.stop()
      renderer.destroy()
      return
    }

    if (modal) {
      if (key.name === "escape") return setModal(null)
      if (modal.kind === "ops") {
        if (key.name === "s") {
          setModal(null)
          runSync("sync")
        } else if (key.name === "p") {
          setModal({ kind: "push", changes: pendingChanges() })
        }
        return
      }
      if (modal.kind === "push") {
        if (key.name === "return") {
          setModal(null)
          runSync("push")
        }
        return
      }
      // palette
      if (key.name === "j" || key.name === "down") return setPaletteIndex(clampIndex(paletteIndex + 1, 3))
      if (key.name === "k" || key.name === "up") return setPaletteIndex(clampIndex(paletteIndex - 1, 3))
      if (key.name === "return") return runPaletteCommand(paletteIndex)
      return
    }

    // Terminals report shift+x as either "X" (raw) or "x"+shift (kitty).
    if (key.name === "S" || (key.name.toLowerCase() === "s" && key.shift)) {
      runSync("sync")
      return
    }
    if (key.name === "P" || (key.name.toLowerCase() === "p" && key.shift)) {
      setModal({ kind: "push", changes: pendingChanges() })
      return
    }
    if (key.name === "A" || (key.name.toLowerCase() === "a" && key.shift)) {
      openPrompt({ label: " Path to add (file or directory, ~ allowed)", placeholder: "~/.config/foo", value: "" })
      return
    }

    switch (key.name) {
      case "tab":
        setFocus(focus === "files" ? "managed" : "files")
        setMessage(null)
        break
      case "up":
      case "k":
        moveSelection(-1)
        break
      case "down":
      case "j":
        moveSelection(1)
        break
      case "left":
      case "h":
        if (focus === "files" && selectedRow?.isDir && expanded.has(selectedRow.path)) setExpanded(toggleIn(expanded, selectedRow.path))
        break
      case "right":
      case "l":
        if (focus === "files" && selectedRow?.isDir && !expanded.has(selectedRow.path)) setExpanded(toggleIn(expanded, selectedRow.path))
        break
      case "space":
        setModal({ kind: "ops" })
        break
      case "return":
      case "enter":
        if (focus === "files" && selectedRow) activate(selectedRow, "files")
        else if (focus === "managed" && selectedManaged) activate(selectedManaged, "managed")
        break
      case "a":
        if (focus === "files" && selectedRow) addPath(selectedRow.path)
        break
      case "x":
        if (focus === "managed" && selectedManaged) forgetPath(selectedManaged.path)
        else if (focus === "files" && selectedRow && managedPaths.has(selectedRow.path)) forgetPath(selectedRow.path)
        else fail("nothing to forget")
        break
      case ":":
        setModal({ kind: "palette" })
        break
      default:
        break
    }
  })

  const modalNode = !modal ? null : modal.kind === "ops" ? (
    <Modal title=" Operations " rows={opsModalRows()} selected={0} width={width} height={height} />
  ) : modal.kind === "push" ? (
    <Modal
      title={` Push — ${modal.changes.length} change(s) `}
      rows={(modal.changes.length === 0 ? [{ label: "(nothing new; push anyway)" }] : modal.changes.map((change) => ({ label: change }))).concat([{ label: "enter  push · esc  cancel" }])}
      selected={0}
      width={width}
      height={height}
    />
  ) : (
    <Modal title=" Command palette " rows={paletteRows()} selected={paletteIndex} width={width} height={height} />
  )

  return (
    <box style={{ flexDirection: "column", width: "100%", height: "100%", backgroundColor: colors.bg }}>
      <box style={{ flexDirection: "row", height: mainHeight, flexShrink: 0 }}>
        <Sidebar
          rows={rows}
          selected={sIdx}
          focused={focus === "files"}
          width={sidebarWidth}
          height={mainHeight}
          managed={managedPaths}
          expanded={expanded}
          onMouseScroll={(event) => {
            if (prompt || modal || focus !== "files") return
            const delta = scrollDelta(event)
            if (delta !== 0) moveSelection(delta)
          }}
          onRowClick={(index2, row) => {
            if (prompt || modal) return
            setSidebarIndex(clampIndex(index2, rows.length))
            activate(row, "files")
          }}
        />
        <ManagedPanel
          rows={tree}
          itemCount={state.items.length}
          selected={mIdx}
          focused={focus === "managed"}
          height={mainHeight}
          width={Math.max(10, width - sidebarWidth)}
          storageLabel={displayPath(ctx.storage, ctx.home)}
          pending={state.pending.length}
          onMouseScroll={(event) => {
            if (prompt || modal || focus !== "managed") return
            const delta = scrollDelta(event)
            if (delta !== 0) moveSelection(delta)
          }}
          onRowClick={(index2, row) => {
            if (prompt || modal) return
            setMainIndex(clampIndex(index2, tree.length))
            forgetPath(row.path)
          }}
        />
      </box>
      <Footer
        config={config}
        pending={state.pending.length}
        lastAction={state.lastAction}
        message={message}
        focusFlag={`focus ${focus.toUpperCase()}`}
        prompt={prompt}
        onPromptInput={(value) => setPrompt((current) => (current ? { ...current, value } : current))}
        onPromptSubmit={(value) => submitPrompt(value)}
      />
      {modalNode}
    </box>
  )
}

function toggleIn(set: Set<string>, path: string): Set<string> {
  const next = new Set(set)
  if (next.has(path)) next.delete(path)
  else next.add(path)
  return next
}
