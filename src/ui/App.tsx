import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import type { MouseEvent } from "@opentui/core"
import { useMemo, useRef, useState } from "react"
import { createCtx, saveConfig, type Config } from "../core/config.ts"
import { ensureRepo, git, push, setRemote, sync } from "../core/git.ts"
import { add, apply, forget, restore } from "../core/ops.ts"
import { loadState, recordAction, saveState, type State } from "../core/state.ts"
import { displayPath, expandHome } from "../core/util.ts"
import { scrollDelta } from "./mouse.ts"
import { Footer, type ModalState, type PromptState } from "./Footer.tsx"
import { ManagedPanel } from "./ManagedPanel.tsx"
import { Modal, helpRows, paletteRows } from "./Modals.tsx"
import { Sidebar } from "./Sidebar.tsx"
import { clampIndex, listTree, managedRows, type ManagedRow } from "./tree.ts"
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
  const [foldersFirst, setFoldersFirst] = useState(true)
  const [prompt, _setPrompt] = useState<PromptState | null>(null)
  // Ref mirror so keystrokes arriving between renders see the prompt/modal,
  // instead of the stale render closure.
  const promptRef = useRef<PromptState | null>(null)
  const setPrompt = (value: PromptState | null) => {
    promptRef.current = value
    _setPrompt(value)
  }
  const [modal, _setModal] = useState<ModalState>(null)
  const modalRef = useRef<ModalState>(null)
  const setModal = (value: ModalState) => {
    modalRef.current = value
    _setModal(value)
  }
  const [paletteIndex, setPaletteIndex] = useState(0)
  const paletteIndexRef = useRef(0)
  const movePalette = (delta: number) => {
    paletteIndexRef.current = clampIndex(paletteIndexRef.current + delta, 4)
    setPaletteIndex(paletteIndexRef.current)
  }
  const [message, setMessage] = useState<Message | null>(null)

  const rows = useMemo(() => listTree(ctx.home, expanded, foldersFirst), [ctx.home, expanded, foldersFirst])
  const managedPaths = useMemo(() => new Set(state.items.map((item) => item.path)), [state.items])
  const tree = useMemo(() => managedRows(state.items, ctx.home, expanded), [state.items, ctx.home, expanded])

  const sIdx = clampIndex(sidebarIndex, rows.length)
  const mIdx = clampIndex(mainIndex, tree.length)
  const selectedRow = rows[sIdx]
  const selectedManaged = tree[mIdx]

  const sidebarWidth = Math.min(48, Math.max(22, Math.floor(width * 0.35)))
  const mainHeight = Math.max(4, height - 5)
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
    if (outcome.ok) succeed(outcome.message)
    else fail(outcome.error)
  }

  const forgetPath = (path: string) => {
    const fresh = loadState(ctx.paths.statePath)
    const outcome = forget(ctx, fresh, path)
    commitState(fresh)
    if (outcome.ok) {
      succeed(outcome.message)
    } else {
      fail(outcome.error)
    }
  }

  /** Undo the last pending operation: revert it and drop it from pending. */
  const undo = () => {
    const fresh = loadState(ctx.paths.statePath)
    const last = fresh.pending[fresh.pending.length - 1]
    if (!last) {
      succeed("nothing to undo")
      return
    }
    const count = fresh.pending.length
    const outcome = last.kind === "add" ? forget(ctx, fresh, last.path) : add(ctx, fresh, last.path)
    if (outcome.ok) {
      // Revert leaves no pending trace: drop the revert's own entry + the original.
      fresh.pending = fresh.pending.slice(0, count - 1)
    }
    commitState(fresh)
    if (outcome.ok) succeed(outcome.message)
    else fail(outcome.error)
  }

  const restoreAll = () => {
    const fresh = loadState(ctx.paths.statePath)
    const outcome = restore(ctx, fresh)
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

    if (kind === "push") {
      if (!config.remote) return fail("no remote configured — open the palette (:) and set one")
      const remote = setRemote(ctx.storage, config.remote)
      if (!remote.ok) return fail(remote.stderr || "could not configure the remote")
      const result = push(ctx.storage)
      if (!result.ok) return fail(result.stderr || "git push failed")
      const fresh = loadState(ctx.paths.statePath)
      fresh.pending = []
      recordAction(fresh, "info", "Pushed to remote")
      commitState(fresh)
      return succeed("Pushed to remote")
    }

    // Sync: pull when a remote is set; rebuild links/state from the repo manifest
    // either way — this is also the recovery path after deleting state.json.
    if (config.remote) {
      const remote = setRemote(ctx.storage, config.remote)
      if (!remote.ok) return fail(remote.stderr || "could not configure the remote")
      const result = sync(ctx.storage)
      if (!result.ok) return fail(result.stderr || "git sync failed")
    }
    const fresh = loadState(ctx.paths.statePath)
    const outcome = apply(ctx, fresh)
    fresh.pending = []
    recordAction(fresh, "info", outcome.ok ? outcome.message : "Sync saved")
    commitState(fresh)
    if (outcome.ok) succeed(config.remote ? outcome.message : `${outcome.message} (local restore — no remote configured)`)
    else fail(outcome.error)
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
    ctx.config = next // ops read backup/storage off ctx.config
    setConfig(next)
    saveConfig(ctx.paths, next)
    succeed(note)
  }

  const toggleFoldersFirst = () => {
    setFoldersFirst((current) => {
      const next = !current
      succeed(next ? "Folders first ON" : "Folders first OFF")
      return next
    })
  }
  const runPaletteCommand = (index: number) => {
    setModal(null)
    if (index === 0) return toggleBackup()
    if (index === 1) return succeed("theme picker: planned")
    if (index === 2) return setPrompt({ label: " Git remote URL", placeholder: "git@github.com:you/dotfiles.git", value: config.remote ?? "" })
    if (index === 3) return setPrompt({ label: " Storage path (repo dir, takes effect on the next add)", placeholder: "~/dotfiles", value: config.storage })
    return toggleFoldersFirst()
  }

  const submitPrompt = (value: string) => {
    const label = prompt?.label ?? ""
    const trimmed = value.trim()
    setPrompt(null)
    if (!trimmed) return fail("cancelled: empty input")

    if (label === null || label.startsWith(" Path to add")) {
      addPath(trimmed)
    } else if (label.startsWith(" Git remote")) {
      changeConfig({ remote: trimmed }, `Remote set to ${trimmed}`)
    } else {
      changeConfig({ storage: expandHome(trimmed, ctx.home) }, `Storage set to ${trimmed}`)
    }
  }

  const openPrompt = (payload: PromptState) => {
    setPrompt(payload)
    setMessage(null)
  }

  useKeyboard((key) => {
    // Input prompts swallow everything but escape/submit.
    if (promptRef.current) {
      if (key.name === "escape") {
        setPrompt(null)
        setMessage(null)
      }
      return
    }

    if (modalRef.current) {
      if (key.name === "escape") return setModal(null)
      if (modalRef.current.kind === "push") {
        if (key.name === "return" || key.name === "enter") {
          setModal(null)
          runSync("push")
        }
        return
      }
      if (modalRef.current.kind === "confirm-restore") {
        if (key.name === "return" || key.name === "enter" || key.name === "r") {
          setModal(null)
          restoreAll()
        }
        return
      }
      if (modalRef.current.kind === "help") {
        setModal(null)
        return
      }
      // palette: j/k move, enter runs, or hit the row's letter directly
      if (key.name === "j" || key.name === "down") return movePalette(1)
      if (key.name === "k" || key.name === "up") return movePalette(-1)
      if (key.name === "b") return runPaletteCommand(0)
      if (key.name === "t") return runPaletteCommand(1)
      if (key.name === "r") {
        setModal(null)
        return setPrompt({ label: " Git remote URL", placeholder: "git@github.com:you/dotfiles.git", value: config.remote ?? "" })
      }
      if (key.name === "s") {
        setModal(null)
        return setPrompt({ label: " Storage path (repo dir, takes effect on the next add)", placeholder: "~/dotfiles", value: config.storage })
      }
      if (key.name === "f") return runPaletteCommand(4)
      if (key.name === "return" || key.name === "enter") return runPaletteCommand(paletteIndexRef.current)
      return
    }

    if (key.name === "q" || (key.name === "c" && key.ctrl)) {
      renderer.stop()
      renderer.destroy()
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
        else if (focus === "managed" && selectedManaged?.toggle && selectedManaged.open) setExpanded(toggleIn(expanded, selectedManaged.path))
        break
      case "right":
      case "l":
        if (focus === "files" && selectedRow?.isDir && !expanded.has(selectedRow.path)) setExpanded(toggleIn(expanded, selectedRow.path))
        else if (focus === "managed" && selectedManaged?.toggle && !selectedManaged.open) setExpanded(toggleIn(expanded, selectedManaged.path))
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
      case "?":
        setModal({ kind: "help" })
        break
      case "u":
        undo()
        break
      case "r":
        setModal({
          kind: "confirm-restore",
        })
        break
      case "space":
        if (focus === "files" && selectedRow) addPath(selectedRow.path)
        else fail("nothing to add")
        break
      default:
        break
    }
  })

  const modalNode = !modal ? null : modal.kind === "push" ? (
    <Modal
      title={` Push — ${modal.changes.length} change(s) `}
      rows={(modal.changes.length === 0 ? [{ label: "(nothing new; push anyway)" }] : modal.changes.map((change) => ({ label: change }))).concat([{ label: "enter  push · esc  cancel" }])}
      selected={0}
      width={width}
      height={height}
    />
  ) : modal.kind === "help" ? (
    <Modal title=" Keybindings — press any key to close " rows={helpRows()} selected={0} width={width} height={height} />
  ) : modal.kind === "confirm-restore" ? (
    <Modal
      title=" Restore all — remove symlinks? "
      rows={[
        { label: `Removes all ${state.items.length} symlinks and copies the` },
        { label: "content back to its original location." },
        { label: "" },
        { label: "Items stay managed — press S to relink them." },
        { label: "" },
        { label: "enter  confirm · esc  cancel" },
      ]}
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
            if (row.managed && !row.toggle) forgetPath(row.path)
            else setExpanded(toggleIn(expanded, row.path))
          }}
        />
      </box>
      <Footer
        config={config}
        pending={state.pending.length}
        lastAction={state.lastAction}
        message={message}
        width={width}
        prompt={prompt}
        onPromptInput={(value) =>
          setPrompt(promptRef.current ? { ...promptRef.current, value } : null)
        }
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
