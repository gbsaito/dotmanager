import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { useMemo, useState } from "react"
import { createCtx, saveConfig, type Config } from "../core/config.ts"
import { ensureRepo, isRepo, pull, push, setRemote, sync } from "../core/git.ts"
import { adopt, unmanage } from "../core/ops.ts"
import { loadState, recordAction, saveState, type State } from "../core/state.ts"
import { displayPath } from "../core/util.ts"
import { MainPanel } from "./MainPanel.tsx"
import { StatusPanel, type PromptState } from "./StatusPanel.tsx"
import { Sidebar } from "./Sidebar.tsx"
import { clampIndex, listTree, managedRows } from "./tree.ts"

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
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [prompt, setPrompt] = useState<PromptState | null>(null)
  const [message, setMessage] = useState<Message | null>(null)

  const rows = useMemo(() => listTree(ctx.home, expanded), [ctx.home, expanded])
  const managedPaths = useMemo(() => new Set(state.items.map((item) => item.path)), [state.items])
  const managedTree = useMemo(() => managedRows(state.items, expanded), [state.items, expanded])

  const sIdx = clampIndex(sidebarIndex, rows.length)
  const mIdx = clampIndex(mainIndex, managedTree.length)
  const selectedRow = rows[sIdx]
  const selectedManaged = managedTree[mIdx]

  const statusHeight = Math.min(9, Math.max(5, height - 5))
  const mainHeight = Math.max(4, height - statusHeight)
  const sidebarWidth = Math.min(48, Math.max(22, Math.floor(width * 0.35)))

  const fail = (text: string) => setMessage({ text, level: "error" })
  const succeed = (text: string) => setMessage({ text, level: "info" })

  const commitState = (next: State) => {
    saveState(ctx.paths.statePath, next)
    setState(next)
  }

  const adoptPath = (path: string) => {
    const fresh = loadState(ctx.paths.statePath)
    const outcome = adopt(ctx, fresh, path)
    commitState(fresh)
    if (outcome.ok) succeed(outcome.message)
    else fail(outcome.error)
  }

  const unmanagePath = (path: string) => {
    const fresh = loadState(ctx.paths.statePath)
    const outcome = unmanage(ctx, fresh, path)
    commitState(fresh)
    if (outcome.ok) {
      succeed(outcome.message)
      setMainIndex((current) => clampIndex(current, fresh.items.length))
    } else {
      fail(outcome.error)
    }
  }

  const toggleExpanded = (path: string) => {
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const moveSelection = (delta: number) => {
    setMessage(null)
    if (focus === "files") setSidebarIndex(clampIndex(sIdx + delta, rows.length))
    else setMainIndex(clampIndex(mIdx + delta, managedTree.length))
  }

  const activate = (enter: boolean) => {
    setMessage(null)
    if (focus === "files") {
      if (!selectedRow) return
      // Space is the spec's toggle: a managed path unmanages, anything else adopts.
      if (managedPaths.has(selectedRow.path)) {
        unmanagePath(selectedRow.path)
      } else if (enter && selectedRow.isDir) {
        toggleExpanded(selectedRow.path)
      } else {
        adoptPath(selectedRow.path)
      }
    } else if (selectedManaged) {
      // Enter mirrors the sidebar: directories expand, space is the toggle.
      if (enter && selectedManaged.isDir) toggleExpanded(selectedManaged.path)
      else if (selectedManaged.isRoot) unmanagePath(selectedManaged.path)
    }
  }

  const toggleBackup = () => {
    const next = { ...ctx.config, backup: !ctx.config.backup }
    ctx.config = next
    setConfig(next)
    saveConfig(ctx.paths, next)
    succeed(`Backups ${next.backup ? "enabled" : "disabled"}`)
  }

  const runGit = (kind: "sync" | "push" | "pull") => {
    const prepared = ensureRepo(ctx.storage)
    if (!prepared.ok) return fail(prepared.stderr || "git init failed")
    if (!ctx.config.remote) return fail("no remote configured — press R to set one")
    const remote = setRemote(ctx.storage, ctx.config.remote)
    if (!remote.ok) return fail(remote.stderr || "could not configure the remote")

    const result = kind === "sync" ? sync(ctx.storage) : kind === "push" ? push(ctx.storage) : pull(ctx.storage)
    if (!result.ok) return fail(result.stderr || `git ${kind} failed`)

    const fresh = loadState(ctx.paths.statePath)
    if (kind !== "pull") fresh.pending = []
    const text = kind === "sync" ? "Synced with remote" : kind === "push" ? "Pushed to remote" : "Pulled from remote"
    recordAction(fresh, "info", text)
    commitState(fresh)
    succeed(text)
  }

  const submitPrompt = (value: string) => {
    const trimmed = value.trim()
    const kind = prompt?.kind
    setPrompt(null)
    if (!trimmed || !kind) return

    if (kind === "path") {
      adoptPath(trimmed)
      return
    }

    const prepared = ensureRepo(ctx.storage)
    if (!prepared.ok) return fail(prepared.stderr || "git init failed")
    const remote = setRemote(ctx.storage, trimmed)
    if (!remote.ok) return fail(remote.stderr || "could not set the remote")

    const next = { ...ctx.config, remote: trimmed }
    ctx.config = next
    setConfig(next)
    saveConfig(ctx.paths, next)
    succeed(`Remote set to ${trimmed}`)
  }

  const openPrompt = (kind: PromptState["kind"]) => {
    setPrompt({ kind, value: kind === "remote" ? (config.remote ?? "") : "" })
    setMessage(null)
  }

  const reload = () => {
    setState(loadState(ctx.paths.statePath))
    setMessage(null)
  }

  useKeyboard((key) => {
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

    // Terminals report shift+r as either "R" (raw) or "r" + shift (kitty protocol).
    if (key.name === "R" || (key.name.toLowerCase() === "r" && key.shift)) {
      openPrompt("remote")
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
        if (focus === "files" && selectedRow?.isDir) toggleExpanded(selectedRow.path)
        else if (focus === "managed" && selectedManaged?.isDir && expanded.has(selectedManaged.path))
          toggleExpanded(selectedManaged.path)
        break
      case "right":
      case "l":
        if (focus === "files" && selectedRow?.isDir && !expanded.has(selectedRow.path)) toggleExpanded(selectedRow.path)
        else if (focus === "managed" && selectedManaged?.isDir && !expanded.has(selectedManaged.path))
          toggleExpanded(selectedManaged.path)
        break
      case "space":
        activate(false)
        break
      case "return":
        activate(true)
        break
      case "s":
        runGit("sync")
        break
      case "p":
        runGit("push")
        break
      case "u":
        runGit("pull")
        break
      case "a":
        openPrompt("path")
        break
      case "b":
        toggleBackup()
        break
      case "r":
        reload()
        break
      default:
        break
    }
  })

  const focusLabel = focus === "files" ? "FILES" : "MANAGED"
  const selectionLabel =
    focus === "files"
      ? selectedRow
        ? displayPath(selectedRow.path, ctx.home)
        : "nothing selected"
      : selectedManaged
        ? displayPath(selectedManaged.path, ctx.home)
        : "nothing managed"

  return (
    <box style={{ flexDirection: "column", width: "100%", height: "100%", backgroundColor: "#1e1e2e" }}>
      <box style={{ flexDirection: "row", height: mainHeight, flexShrink: 0 }}>
        <Sidebar
          rows={rows}
          selected={sIdx}
          focused={focus === "files"}
          width={sidebarWidth}
          height={mainHeight}
          rootLabel="~"
          managed={managedPaths}
          expanded={expanded}
        />
        <MainPanel
          rows={managedTree}
          itemCount={state.items.length}
          selected={mIdx}
          focused={focus === "managed"}
          width={Math.max(10, width - sidebarWidth)}
          height={mainHeight}
          home={ctx.home}
          storageLabel={displayPath(ctx.storage, ctx.home)}
          pending={state.pending.length}
          expanded={expanded}
        />
      </box>
      <StatusPanel
        config={config}
        storageLabel={displayPath(ctx.storage, ctx.home)}
        repoReady={isRepo(ctx.storage)}
        lastAction={state.lastAction}
        message={message}
        pending={state.pending.length}
        focusLabel={focusLabel}
        selectionLabel={selectionLabel}
        prompt={prompt}
        height={statusHeight}
        width={width}
        onPromptInput={(value) => setPrompt((current) => (current ? { ...current, value } : current))}
        onPromptSubmit={submitPrompt}
      />
    </box>
  )
}
