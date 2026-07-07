import "@xyflow/react/dist/style.css"
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  ReactFlow, Background, Controls, MiniMap, Panel,
  addEdge, useNodesState, useEdgesState, useReactFlow, ReactFlowProvider,
  NodeResizer, Handle, Position, BackgroundVariant,
  type Node, type Edge, type Connection, type NodeProps, type OnSelectionChangeParams,
} from "@xyflow/react"
import { motion, AnimatePresence } from "motion/react"
import { SideRail } from "~/components/ui/side-rail"
import { useAuth } from "~/features/auth/lib/auth"
import { use_notify } from "~/hooks/use-notify"
import {
  api, NODE_COLORS, NODE_COLOR_MAP,
  type PlanBoard, type PlanNodeData, type NodeColorKey,
  type BoardVisibility, type BoardEditor, type BoardEditorProfile,
} from "~/features/planning/lib/planning"

export const meta = () => [{ title: "Flow Map — Onyx Dev" }]

const ease = [0.22, 1, 0.36, 1] as const

// ── CSS overrides ─────────────────────────────────────────────────────────────

const flow_css = `
  .react-flow__controls { box-shadow:none!important; border:1px solid hsl(220 13% 20%)!important; border-radius:10px!important; overflow:hidden; }
  .react-flow__controls-button { background:hsl(220 13% 11%)!important; border-bottom:1px solid hsl(220 13% 20%)!important; color:hsl(220 13% 70%)!important; fill:hsl(220 13% 70%)!important; width:28px!important; height:28px!important; }
  .react-flow__controls-button:hover { background:hsl(220 13% 17%)!important; color:hsl(220 13% 90%)!important; fill:hsl(220 13% 90%)!important; }
  .react-flow__controls-button svg { max-width:12px; max-height:12px; fill:inherit!important; }
  .react-flow__edge-path { stroke:hsl(220 13% 38%)!important; stroke-width:1.5!important; }
  .react-flow__edge.selected .react-flow__edge-path { stroke:hsl(355 81% 47%)!important; }
  .react-flow__connection-path { stroke:hsl(355 81% 47%)!important; stroke-width:1.5!important; }
  .react-flow__minimap { border-radius:10px!important; border:1px solid hsl(220 13% 20%)!important; overflow:hidden; }
`

// ── Canvas context (read-only gate) ───────────────────────────────────────────

const CanvasCtx = createContext(true)

// ── Custom node ───────────────────────────────────────────────────────────────

function PlanNode({ id, data, selected }: NodeProps) {
  const can_edit     = useContext(CanvasCtx)
  const d            = data as PlanNodeData
  const c            = NODE_COLOR_MAP[d.color] ?? NODE_COLOR_MAP["slate"]
  const { setNodes } = useReactFlow()
  const [editing, set_editing] = useState(false)
  const [draft,   set_draft]   = useState(d.label)
  const input_ref = useRef<HTMLInputElement>(null)
  const committed = useRef(false)

  useEffect(() => { set_draft(d.label) }, [d.label])
  useEffect(() => { committed.current = false }, [editing])

  const start_edit = () => {
    if (!can_edit) return
    set_editing(true)
    setTimeout(() => input_ref.current?.select(), 0)
  }

  const commit = () => {
    if (committed.current) return
    committed.current = true
    set_editing(false)
    const label = draft.trim() || "Node"
    setNodes(ns => ns.map(n => n.id === id ? { ...n, data: { ...n.data, label } } : n))
  }

  const handle_key = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); commit() }
    if (e.key === "Escape") { committed.current = true; set_draft(d.label); set_editing(false) }
    e.stopPropagation()
  }

  const dot: React.CSSProperties = { width: 10, height: 10, background: c.border, border: "2px solid " + c.bg, borderRadius: "50%" }

  return (
    <div
      onDoubleClick={start_edit}
      style={{
        background: c.bg,
        border: `1.5px solid ${selected ? c.text : c.border}`,
        boxShadow: selected ? `0 0 0 2px ${c.border}55` : "none",
        borderRadius: 10, width: "100%", height: "100%",
        minWidth: 120, minHeight: 48,
        padding: "10px 14px", boxSizing: "border-box",
        transition: "border-color 0.15s, box-shadow 0.15s",
        cursor: can_edit ? "default" : "not-allowed",
      }}
    >
      <NodeResizer
        isVisible={selected && can_edit}
        minWidth={120} minHeight={48}
        lineStyle={{ border: "1px solid " + c.border }}
        handleStyle={{ width: 8, height: 8, borderRadius: 2, background: c.border, border: "1.5px solid " + c.bg }}
      />
      <Handle type="target" position={Position.Top}    style={dot} />
      <Handle type="source" position={Position.Bottom} style={dot} />
      <Handle type="target" position={Position.Left}   style={dot} />
      <Handle type="source" position={Position.Right}  style={dot} />

      {editing ? (
        <input
          ref={input_ref} value={draft} autoFocus
          onChange={e => set_draft(e.target.value)}
          onBlur={commit} onKeyDown={handle_key}
          className="nodrag w-full bg-transparent text-sm font-medium outline-none"
          style={{ color: c.text, caretColor: c.border }}
        />
      ) : (
        <p className="select-none text-sm font-medium leading-snug" style={{ color: c.text, wordBreak: "break-word" }}>
          {d.label || "Node"}
        </p>
      )}
    </div>
  )
}

const node_types = { plan: PlanNode }

// ── Color picker ──────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange, label }: { value: NodeColorKey; onChange: (c: NodeColorKey) => void; label: string }) {
  const [open, set_open] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = NODE_COLOR_MAP[value]

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Element)) set_open(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button" title={label}
        onClick={() => set_open(o => !o)}
        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${open ? "border-flag-red bg-flag-red/8 text-flag-red" : "border-line bg-card text-muted hover:border-flag-red/50 hover:text-ink"}`}
      >
        <span className="h-3 w-3 rounded-full ring-1 ring-white/10" style={{ background: active?.border }} />
        <span className="hidden sm:inline">{active?.label}</span>
        <ChevronIcon open={open} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.12, ease }}
            className="absolute left-0 top-full z-50 mt-1.5 w-48 rounded-xl border border-line bg-card p-2 shadow-xl"
          >
            <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-widest text-muted">{label}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {NODE_COLORS.map(c => (
                <button
                  key={c.key} type="button" title={c.label}
                  onClick={() => { onChange(c.key); set_open(false) }}
                  style={{ background: c.bg, border: `1.5px solid ${value === c.key ? c.text : c.border}` }}
                  className="flex cursor-pointer flex-col items-center gap-1 rounded-lg p-2 transition-all hover:scale-105"
                >
                  <span className="h-4 w-4 rounded-full" style={{ background: c.border, boxShadow: value === c.key ? `0 0 0 2px ${c.text}55` : "none" }} />
                  <span className="text-[9px] font-medium" style={{ color: c.text }}>{c.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Create board form ─────────────────────────────────────────────────────────

function CreateBoardForm({ on_create, on_cancel }: {
  on_create: (name: string, visibility: BoardVisibility) => void
  on_cancel: () => void
}) {
  const [name,       set_name]       = useState("")
  const [visibility, set_visibility] = useState<BoardVisibility>("PRIVATE")
  const input_ref = useRef<HTMLInputElement>(null)

  useEffect(() => { input_ref.current?.focus() }, [])

  const submit = () => {
    const n = name.trim() || "Untitled"
    on_create(n, visibility)
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18, ease }}
      className="overflow-hidden border-b border-line"
    >
      <div className="flex flex-col gap-2 p-3">
        <input
          ref={input_ref}
          value={name}
          placeholder="Board name"
          onChange={e => set_name(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") on_cancel() }}
          className="w-full rounded-md border border-line bg-transparent px-2.5 py-1.5 text-xs text-ink outline-none placeholder:text-muted focus:border-flag-red"
        />

        {/* Visibility toggle */}
        <div className="grid grid-cols-2 gap-1.5">
          {(["PRIVATE", "SHARED"] as BoardVisibility[]).map(v => (
            <button
              key={v} type="button"
              onClick={() => set_visibility(v)}
              className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-md border py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                visibility === v
                  ? "border-flag-red bg-flag-red/10 text-flag-red"
                  : "border-line text-muted hover:border-line/80 hover:text-ink"
              }`}
            >
              {v === "PRIVATE" ? <LockIcon /> : <GlobeIcon />}
              {v === "PRIVATE" ? "Private" : "Shared"}
            </button>
          ))}
        </div>

        <p className="text-[10px] leading-tight text-muted">
          {visibility === "PRIVATE"
            ? "Only you can see and edit this board."
            : "Anyone can view. You control who can edit."}
        </p>

        <div className="flex gap-1.5">
          <button type="button" onClick={on_cancel}
            className="flex-1 cursor-pointer rounded-md border border-line py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-ink">
            Cancel
          </button>
          <button type="button" onClick={submit}
            className="flex-1 cursor-pointer rounded-md bg-flag-red py-1.5 text-[11px] font-medium text-white transition-opacity hover:opacity-80">
            Create
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ── More options menu ─────────────────────────────────────────────────────────

function MoreOptionsMenu({ board, is_creator, on_delete, on_manage_editors, on_change_visibility }: {
  board:                 PlanBoard
  is_creator:            boolean
  on_delete:             () => void
  on_manage_editors:     () => void
  on_change_visibility:  () => void
}) {
  const [open, set_open]   = useState(false)
  const [pos,  set_pos]    = useState({ top: 0, left: 0 })
  const btn_ref            = useRef<HTMLButtonElement>(null)
  const menu_ref           = useRef<HTMLDivElement>(null)

  const open_menu = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!btn_ref.current) return
    const r = btn_ref.current.getBoundingClientRect()
    set_pos({ top: r.bottom + 4, left: r.left })
    set_open(o => !o)
  }

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (btn_ref.current?.contains(e.target as Element))  return
      if (menu_ref.current?.contains(e.target as Element)) return
      set_open(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  const menu = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={menu_ref}
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -4 }}
          transition={{ duration: 0.1, ease }}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
          className="w-44 rounded-xl border border-line bg-card py-1 shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {is_creator && (
            <>
              <button
                type="button"
                onClick={() => { set_open(false); on_change_visibility() }}
                className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-xs text-muted transition-colors hover:bg-line/40 hover:text-ink"
              >
                {board.visibility === "PRIVATE" ? <GlobeIcon /> : <LockIcon />}
                {board.visibility === "PRIVATE" ? "Make shared" : "Make private"}
              </button>
              {board.visibility === "SHARED" && (
                <button
                  type="button"
                  onClick={() => { set_open(false); on_manage_editors() }}
                  className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-xs text-muted transition-colors hover:bg-line/40 hover:text-ink"
                >
                  <UsersIcon />
                  Manage editors
                </button>
              )}
              <div className="my-1 border-t border-line" />
            </>
          )}
          <button
            type="button"
            onClick={() => { set_open(false); on_delete() }}
            className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-xs text-flag-red transition-colors hover:bg-flag-red/8"
          >
            <TrashIcon />
            Delete board
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <div className="shrink-0">
      <button
        ref={btn_ref}
        type="button"
        onClick={open_menu}
        className="cursor-pointer rounded p-0.5 text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-ink"
      >
        <EditIcon />
      </button>
      {typeof document !== "undefined" && createPortal(menu, document.body)}
    </div>
  )
}

// ── Board sidebar ─────────────────────────────────────────────────────────────

type BoardSidebarProps = {
  boards:             PlanBoard[]
  active_id:          string | null
  user_id:            string
  on_select:          (b: PlanBoard) => void
  on_create:          (name: string, visibility: BoardVisibility) => void
  on_rename:          (id: string, name: string) => void
  on_delete:             (id: string) => void
  on_manage_editors:     (b: PlanBoard) => void
  on_change_visibility:  (b: PlanBoard) => void
  creating:              boolean
}

function BoardSidebar({
  boards, active_id, user_id, on_select, on_create, on_rename,
  on_delete, on_manage_editors, on_change_visibility, creating,
}: BoardSidebarProps) {
  const [show_form,      set_show_form]      = useState(false)
  const [rename_id,      set_rename_id]      = useState<string | null>(null)
  const [rename_val,     set_rename_val]     = useState("")
  const [confirm_id,     set_confirm_id]     = useState<string | null>(null)
  const [vis_confirm_id, set_vis_confirm_id] = useState<string | null>(null)
  const committed = useRef(false)

  const start_rename = (b: PlanBoard) => {
    committed.current = false
    set_rename_id(b.id)
    set_rename_val(b.name)
  }

  const commit_rename = (id: string) => {
    if (committed.current) return
    committed.current = true
    const v = rename_val.trim()
    if (v) on_rename(id, v)
    set_rename_id(null)
  }

  const cancel_rename = () => { committed.current = true; set_rename_id(null) }

  const handle_create = (name: string, visibility: BoardVisibility) => {
    set_show_form(false)
    on_create(name, visibility)
  }

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-line bg-card">
      <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted">Flow Maps</span>
        <button
          type="button" title="New board"
          onClick={() => set_show_form(v => !v)}
          disabled={creating}
          className={`grid h-6 w-6 cursor-pointer place-items-center rounded-md transition-colors disabled:opacity-40 ${show_form ? "bg-flag-red/10 text-flag-red" : "text-muted hover:bg-line/50 hover:text-ink"}`}
        >
          <PlusIcon />
        </button>
      </div>

      <AnimatePresence>
        {show_form && (
          <CreateBoardForm
            on_create={handle_create}
            on_cancel={() => set_show_form(false)}
          />
        )}
      </AnimatePresence>

      <ul className="flex-1 overflow-y-auto py-2">
        {boards.length === 0 && !show_form && (
          <li className="px-4 py-8 text-center text-xs text-muted">No boards yet</li>
        )}

        {boards.map(b => {
          const is_creator = b.created_by === user_id
          return (
            <li key={b.id}>
              {confirm_id === b.id ? (
                <div className="mx-2 my-1 rounded-lg border border-flag-red/30 bg-flag-red/6 p-2.5">
                  <p className="mb-2 truncate text-[11px] font-medium text-ink">Delete &ldquo;{b.name}&rdquo;?</p>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => set_confirm_id(null)}
                      className="flex-1 cursor-pointer rounded-md border border-line bg-card py-1 text-[11px] font-medium text-muted hover:text-ink">
                      Cancel
                    </button>
                    <button type="button" onClick={() => { set_confirm_id(null); on_delete(b.id) }}
                      className="flex-1 cursor-pointer rounded-md bg-flag-red py-1 text-[11px] font-medium text-white hover:opacity-80">
                      Delete
                    </button>
                  </div>
                </div>
              ) : vis_confirm_id === b.id ? (
                <div className="mx-2 my-1 rounded-lg border border-line bg-line/20 p-2.5">
                  <p className="mb-1.5 truncate text-[11px] font-medium text-ink">
                    {b.visibility === "PRIVATE" ? `Share "${b.name}"?` : `Make "${b.name}" private?`}
                  </p>
                  <p className="mb-2 text-[10px] leading-tight text-muted">
                    {b.visibility === "PRIVATE"
                      ? "Everyone can view. You control who can edit."
                      : "Only you will see and edit this board."}
                  </p>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => set_vis_confirm_id(null)}
                      className="flex-1 cursor-pointer rounded-md border border-line bg-card py-1 text-[11px] font-medium text-muted hover:text-ink">
                      Cancel
                    </button>
                    <button type="button" onClick={() => { set_vis_confirm_id(null); on_change_visibility(b) }}
                      className="flex-1 cursor-pointer rounded-md bg-flag-red py-1 text-[11px] font-medium text-white hover:opacity-80">
                      Confirm
                    </button>
                  </div>
                </div>
              ) : rename_id === b.id ? (
                <div className="px-2 py-1">
                  <input
                    autoFocus value={rename_val}
                    onChange={e => set_rename_val(e.target.value)}
                    onBlur={() => commit_rename(b.id)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commit_rename(b.id) } if (e.key === "Escape") cancel_rename() }}
                    className="w-full rounded-md border border-line bg-transparent px-2 py-1 text-xs text-ink outline-none focus:border-flag-red"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => on_select(b)}
                  onDoubleClick={() => is_creator && start_rename(b)}
                  className={`group flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                    active_id === b.id ? "bg-flag-red/8 text-flag-red" : "text-muted hover:bg-line/40 hover:text-ink"
                  }`}
                >
                  {b.visibility === "PRIVATE" ? <LockIcon /> : <GlobeIcon />}
                  <span className="flex-1 truncate font-medium">{b.name}</span>
                  {is_creator && (
                    <MoreOptionsMenu
                      board={b}
                      is_creator={is_creator}
                      on_delete={() => set_confirm_id(b.id)}
                      on_manage_editors={() => on_manage_editors(b)}
                      on_change_visibility={() => set_vis_confirm_id(b.id)}
                    />
                  )}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </aside>
  )
}

// ── Editors modal ─────────────────────────────────────────────────────────────

function EditorsModal({ board, current_user_id, on_close }: {
  board:           PlanBoard
  current_user_id: string
  on_close:        () => void
}) {
  const notify = use_notify()
  const [editors,  set_editors]  = useState<BoardEditor[]>([])
  const [search,   set_search]   = useState("")
  const [results,  set_results]  = useState<BoardEditorProfile[]>([])
  const [loading,  set_loading]  = useState(true)
  const [removing, set_removing] = useState<string | null>(null)
  const [adding,   set_adding]   = useState<string | null>(null)
  const search_timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    set_loading(true)
    api.editors.list(board.id).then(({ data }) => {
      set_editors(data)
      set_loading(false)
    })
  }, [board.id])

  useEffect(() => {
    if (search_timer.current) clearTimeout(search_timer.current)
    if (!search.trim()) { set_results([]); return }
    search_timer.current = setTimeout(async () => {
      const { data } = await api.profiles_search(search)
      const editor_ids = new Set(editors.map(e => e.user_id))
      set_results(
        ((data ?? []) as BoardEditorProfile[]).filter(
          p => p.id !== current_user_id && !editor_ids.has(p.id)
        )
      )
    }, 300)
  }, [search, editors, current_user_id])

  const add_editor = async (profile: BoardEditorProfile) => {
    set_adding(profile.id)
    const { error } = await api.editors.add(board.id, profile.id, current_user_id)
    set_adding(null)
    if (error) { notify({ tone: "error", title: "Failed to add editor" }); return }
    set_editors(prev => [...prev, { board_id: board.id, user_id: profile.id, granted_by: current_user_id, granted_at: new Date().toISOString(), profile }])
    set_results(prev => prev.filter(p => p.id !== profile.id))
    set_search("")
  }

  const remove_editor = async (user_id: string) => {
    set_removing(user_id)
    const { error } = await api.editors.remove(board.id, user_id)
    set_removing(null)
    if (error) { notify({ tone: "error", title: "Failed to remove editor" }); return }
    set_editors(prev => prev.filter(e => e.user_id !== user_id))
  }

  const display = (p: BoardEditorProfile | null) =>
    p?.full_name || p?.username || p?.email?.split("@")[0] || "Unknown"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.18, ease }}
        className="surface w-full max-w-md rounded-2xl border border-line shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-ink">Manage editors</p>
            <p className="mt-0.5 truncate text-xs text-muted">{board.name}</p>
          </div>
          <button type="button" onClick={on_close}
            className="cursor-pointer rounded-md p-1 text-muted transition-colors hover:bg-line/50 hover:text-ink">
            <XIcon />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          {/* Current editors */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
              Editors {editors.length > 0 && `(${editors.length})`}
            </p>
            {loading ? (
              <p className="text-xs text-muted">Loading…</p>
            ) : editors.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-muted">
                No editors yet — add people below
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {editors.map(e => (
                  <li key={e.user_id} className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2">
                    <Avatar profile={e.profile} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-ink">{display(e.profile)}</p>
                      {e.profile?.email && <p className="truncate text-[10px] text-muted">{e.profile.email}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => remove_editor(e.user_id)}
                      disabled={removing === e.user_id}
                      className="cursor-pointer rounded-md p-1 text-muted transition-colors hover:text-flag-red disabled:opacity-40"
                    >
                      <XIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Add editor */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted">Add editor</p>
            <div className="relative">
              <input
                value={search}
                onChange={e => set_search(e.target.value)}
                placeholder="Search by name or username…"
                className="w-full rounded-lg border border-line bg-transparent px-3 py-2 text-xs text-ink outline-none placeholder:text-muted focus:border-flag-red"
              />
              <AnimatePresence>
                {results.length > 0 && (
                  <motion.ul
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.1 }}
                    className="absolute left-0 top-full z-10 mt-1 w-full rounded-xl border border-line bg-card py-1 shadow-xl"
                  >
                    {results.map(p => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => add_editor(p)}
                          disabled={adding === p.id}
                          className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-line/40 disabled:opacity-50"
                        >
                          <Avatar profile={p} />
                          <div className="min-w-0 flex-1 text-left">
                            <p className="truncate font-medium text-ink">{display(p)}</p>
                            {p.email && <p className="truncate text-muted">{p.email}</p>}
                          </div>
                          <span className="shrink-0 text-flag-red">
                            <PlusIcon />
                          </span>
                        </button>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function Avatar({ profile }: { profile: BoardEditorProfile | null }) {
  const name = profile?.full_name || profile?.username || "?"
  return profile?.avatar_url ? (
    <img src={profile.avatar_url} alt={name} className="h-7 w-7 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-line text-[10px] font-bold text-muted">
      {name.slice(0, 2).toUpperCase()}
    </span>
  )
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

function Toolbar({ board, sel_color, on_color, on_add, on_delete_sel, has_selection, saving, node_count, can_edit }: {
  board:         PlanBoard
  sel_color:     NodeColorKey
  on_color:      (c: NodeColorKey) => void
  on_add:        () => void
  on_delete_sel: () => void
  has_selection: boolean
  saving:        boolean
  node_count:    number
  can_edit:      boolean
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-line bg-card px-4 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <p className="truncate text-sm font-semibold text-ink">{board.name}</p>
        <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
          board.visibility === "SHARED"
            ? "bg-blue-500/10 text-blue-400"
            : "bg-line/40 text-muted"
        }`}>
          {board.visibility === "SHARED" ? "Shared" : "Private"}
        </span>
        {node_count > 0 && (
          <span className="shrink-0 rounded-md bg-line/40 px-1.5 py-0.5 text-[10px] text-muted">{node_count}</span>
        )}
      </div>

      {can_edit ? (
        <>
          <ColorPicker value={sel_color} onChange={on_color} label={has_selection ? "Change color" : "New node color"} />
          <div className="h-4 w-px bg-line" />
          <button type="button" onClick={on_add}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-flag-red hover:text-flag-red">
            <PlusIcon /> Add node
          </button>
          {has_selection && (
            <button type="button" onClick={on_delete_sel}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-flag-red transition-colors hover:border-flag-red hover:bg-flag-red/8">
              <TrashIcon /> Delete
            </button>
          )}
        </>
      ) : (
        <span className="flex items-center gap-1.5 rounded-lg border border-line/50 px-2.5 py-1 text-[10px] font-medium text-muted">
          <EyeIcon /> Read only
        </span>
      )}

      {saving && <span className="text-[10px] text-muted">Saving…</span>}
    </div>
  )
}

// ── Canvas ────────────────────────────────────────────────────────────────────

type CanvasProps = {
  active:          PlanBoard
  nodes:           Node[]
  edges:           Edge[]
  on_nodes_change: ReturnType<typeof useNodesState>[2]
  on_edges_change: ReturnType<typeof useEdgesState>[2]
  on_connect:      (c: Connection) => void
  on_selection:    (p: OnSelectionChangeParams) => void
  sel_color:       NodeColorKey
  selected:        { nodes: Node[]; edges: Edge[] }
  saving:          boolean
  on_color:        (c: NodeColorKey) => void
  on_add:          () => void
  on_delete_sel:   () => void
  can_edit:        boolean
}

function Canvas({
  active, nodes, edges, on_nodes_change, on_edges_change,
  on_connect, on_selection, sel_color, selected, saving,
  on_color, on_add, on_delete_sel, can_edit,
}: CanvasProps) {
  const has_selection = selected.nodes.length > 0 || selected.edges.length > 0

  return (
    <CanvasCtx.Provider value={can_edit}>
      <div className="flex flex-1 flex-col overflow-hidden">
        <style>{flow_css}</style>
        <Toolbar
          board={active} sel_color={sel_color} on_color={on_color}
          on_add={on_add} on_delete_sel={on_delete_sel}
          has_selection={has_selection} saving={saving}
          node_count={nodes.length} can_edit={can_edit}
        />
        <div className="relative flex-1">
          <ReactFlow
            nodes={nodes} edges={edges} nodeTypes={node_types}
            onNodesChange={on_nodes_change} onEdgesChange={on_edges_change}
            onConnect={can_edit ? on_connect : undefined}
            onSelectionChange={on_selection}
            deleteKeyCode={can_edit ? ["Backspace", "Delete"] : null}
            multiSelectionKeyCode="Shift"
            nodesDraggable={can_edit}
            nodesConnectable={can_edit}
            colorMode="dark"
            fitView fitViewOptions={{ padding: 0.25 }}
            style={{ background: "hsl(220 13% 8%)" }}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="hsl(220 13% 22%)" />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={n => NODE_COLOR_MAP[(n.data as PlanNodeData).color ?? "slate"]?.border ?? "#555"}
              maskColor="hsl(220 13% 5% / 0.65)"
            />
            <Panel position="bottom-center">
              <AnimatePresence>
                {has_selection && can_edit && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.15, ease }}
                    className="rounded-lg border border-line bg-card px-3 py-1.5 text-xs text-muted shadow-lg"
                  >
                    {selected.nodes.length > 0 && `${selected.nodes.length} node${selected.nodes.length > 1 ? "s" : ""}`}
                    {selected.nodes.length > 0 && selected.edges.length > 0 && " · "}
                    {selected.edges.length > 0 && `${selected.edges.length} edge${selected.edges.length > 1 ? "s" : ""}`}
                    {" selected · "}<kbd className="font-mono">Del</kbd> to remove
                  </motion.div>
                )}
              </AnimatePresence>
            </Panel>
          </ReactFlow>
        </div>
      </div>
    </CanvasCtx.Provider>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

function PlanningInner() {
  const { user }   = useAuth()
  const notify     = use_notify()
  const { setNodes: rf_set_nodes } = useReactFlow()

  const [boards,       set_boards]       = useState<PlanBoard[]>([])
  const [active,       set_active]       = useState<PlanBoard | null>(null)
  const [editors,      set_editors]      = useState<BoardEditor[]>([])
  const [can_edit,     set_can_edit]     = useState(true)
  const [creating,     set_creating]     = useState(false)
  const [saving,       set_saving]       = useState(false)
  const [sel_color,    set_sel_color]    = useState<NodeColorKey>("slate")
  const [selected,     set_selected]     = useState<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] })
  const [editors_board, set_editors_board] = useState<PlanBoard | null>(null)

  const [nodes, set_nodes, on_nodes_change] = useNodesState<Node>([])
  const [edges, set_edges, on_edges_change] = useEdgesState<Edge>([])

  const save_timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const active_ref = useRef<PlanBoard | null>(null)
  const nodes_ref  = useRef<Node[]>([])
  const edges_ref  = useRef<Edge[]>([])
  active_ref.current = active
  nodes_ref.current  = nodes
  edges_ref.current  = edges

  // ── Load all boards ────────────────────────────────────────────────────────

  useEffect(() => {
    api.list().then(({ data, error }) => {
      if (error) { notify({ tone: "error", title: error.message }); return }
      const list = (data ?? []) as PlanBoard[]
      set_boards(list)
      if (list.length > 0) load_board(list[0])
    })
  }, [])

  // ── Load board into canvas ─────────────────────────────────────────────────

  const load_board = useCallback((b: PlanBoard) => {
    set_active(b)
    set_nodes((b.nodes ?? []) as Node[])
    set_edges((b.edges ?? []) as Edge[])
    set_selected({ nodes: [], edges: [] })
    // Resolve can_edit synchronously for common cases to avoid toolbar flash
    if (user?.id) {
      const immediate = b.created_by === user.id || b.visibility === "PRIVATE"
      set_can_edit(immediate)
    }
  }, [user?.id])

  // ── Resolve can_edit for shared boards (async editor check) ───────────────

  useEffect(() => {
    if (!active || !user?.id) return
    if (active.created_by === user.id || active.visibility === "PRIVATE") return
    api.editors.list(active.id).then(({ data }) => {
      set_editors(data)
      set_can_edit(data.some(e => e.user_id === user.id))
    })
  }, [active?.id, user?.id])

  // ── Debounced save ─────────────────────────────────────────────────────────

  const schedule_save = useCallback(() => {
    if (!active_ref.current) return
    if (save_timer.current) clearTimeout(save_timer.current)
    save_timer.current = setTimeout(async () => {
      if (!active_ref.current) return
      set_saving(true)
      await api.save(active_ref.current.id, nodes_ref.current, edges_ref.current)
      set_saving(false)
    }, 1200)
  }, [])

  const handle_nodes_change: typeof on_nodes_change = useCallback((ch) => { on_nodes_change(ch); schedule_save() }, [on_nodes_change, schedule_save])
  const handle_edges_change: typeof on_edges_change = useCallback((ch) => { on_edges_change(ch); schedule_save() }, [on_edges_change, schedule_save])

  const on_connect = useCallback((p: Connection) => {
    set_edges(es => addEdge({ ...p, animated: false }, es))
    schedule_save()
  }, [schedule_save])

  // ── Node operations ────────────────────────────────────────────────────────

  const add_node = useCallback(() => {
    set_nodes(ns => [...ns, {
      id: crypto.randomUUID(), type: "plan",
      position: { x: 140 + Math.random() * 240, y: 100 + Math.random() * 180 },
      data: { label: "New node", color: sel_color } satisfies PlanNodeData,
    }])
    schedule_save()
  }, [sel_color, schedule_save])

  const apply_color = useCallback((color: NodeColorKey) => {
    set_sel_color(color)
    if (selected.nodes.length === 0) return
    const ids = new Set(selected.nodes.map(n => n.id))
    rf_set_nodes(ns => ns.map(n => ids.has(n.id) ? { ...n, data: { ...n.data, color } } : n))
    schedule_save()
  }, [selected.nodes, rf_set_nodes, schedule_save])

  const delete_selected = useCallback(() => {
    const nids = new Set(selected.nodes.map(n => n.id))
    const eids = new Set(selected.edges.map(e => e.id))
    set_nodes(ns => ns.filter(n => !nids.has(n.id)))
    set_edges(es => es.filter(e => !eids.has(e.id) && !nids.has(e.source) && !nids.has(e.target)))
    set_selected({ nodes: [], edges: [] })
    schedule_save()
  }, [selected, schedule_save])

  const on_selection_change = useCallback(({ nodes: ns, edges: es }: OnSelectionChangeParams) => {
    set_selected({ nodes: ns, edges: es })
  }, [])

  // ── Board CRUD ─────────────────────────────────────────────────────────────

  const flush_save = () => {
    if (save_timer.current && active_ref.current) {
      clearTimeout(save_timer.current)
      api.save(active_ref.current.id, nodes_ref.current, edges_ref.current)
    }
  }

  const create_board = async (name: string, visibility: BoardVisibility) => {
    if (!user?.id) return
    set_creating(true)
    const { data, error } = await api.create(name, user.id, visibility)
    set_creating(false)
    if (error || !data) { notify({ tone: "error", title: (error as Error)?.message ?? "Failed to create board" }); return }
    const board = data as PlanBoard
    set_boards(bs => [board, ...bs])
    load_board(board)
  }

  const select_board = (b: PlanBoard) => {
    if (active?.id === b.id) return
    flush_save()
    load_board(b)
  }

  const rename_board = async (id: string, name: string) => {
    const { error } = await api.rename(id, name)
    if (error) { notify({ tone: "error", title: (error as Error)?.message }); return }
    set_boards(bs => bs.map(b => b.id === id ? { ...b, name } : b))
    set_active(a => a?.id === id ? { ...a, name } : a)
  }

  const change_visibility = async (b: PlanBoard) => {
    const next = b.visibility === "PRIVATE" ? "SHARED" : "PRIVATE"
    const { error } = await api.set_visibility(b.id, next)
    if (error) { notify({ tone: "error", title: (error as Error)?.message }); return }
    const updated = { ...b, visibility: next } as PlanBoard
    set_boards(bs => bs.map(x => x.id === b.id ? updated : x))
    if (active?.id === b.id) set_active(updated)
  }

  const delete_board = async (id: string) => {
    const { error } = await api.remove(id)
    if (error) { notify({ tone: "error", title: (error as Error)?.message }); return }
    const next = boards.filter(b => b.id !== id)
    set_boards(next)
    if (active?.id === id) {
      if (next.length > 0) load_board(next[0])
      else { set_active(null); set_nodes([]); set_edges([]) }
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <SideRail />

      <BoardSidebar
        boards={boards}
        active_id={active?.id ?? null}
        user_id={user?.id ?? ""}
        on_select={select_board}
        on_create={create_board}
        on_rename={rename_board}
        on_delete={delete_board}
        on_manage_editors={b => set_editors_board(b)}
        on_change_visibility={change_visibility}
        creating={creating}
      />

      {active ? (
        <Canvas
          active={active} nodes={nodes} edges={edges}
          on_nodes_change={handle_nodes_change} on_edges_change={handle_edges_change}
          on_connect={on_connect} on_selection={on_selection_change}
          sel_color={sel_color} selected={selected}
          saving={saving} on_color={apply_color}
          on_add={add_node} on_delete_sel={delete_selected}
          can_edit={can_edit}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <NetworkIcon size={48} className="text-muted" />
          <div className="text-center">
            <p className="text-sm font-semibold text-ink">No boards yet</p>
            <p className="mt-1 text-xs text-muted">Create a board to start planning</p>
          </div>
        </div>
      )}

      <AnimatePresence>
        {editors_board && (
          <EditorsModal
            board={editors_board}
            current_user_id={user?.id ?? ""}
            on_close={() => set_editors_board(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default function PlanningPage() {
  return (
    <ReactFlowProvider>
      <PlanningInner />
    </ReactFlowProvider>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const sv = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }

const PlusIcon  = () => <svg {...sv}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const TrashIcon = () => <svg {...sv}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
const XIcon     = () => <svg {...sv}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const UsersIcon = () => <svg {...sv}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
const EyeIcon   = () => <svg {...sv}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
const EditIcon  = () => <svg {...sv}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>

function LockIcon() {
  return <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
}
function GlobeIcon() {
  return <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
}
function ChevronIcon({ open }: { open: boolean }) {
  return <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none" }}><polyline points="6 9 12 15 18 9"/></svg>
}
function NetworkIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><line x1="12" y1="7" x2="5" y2="17"/><line x1="12" y1="7" x2="19" y2="17"/><line x1="5" y1="19" x2="19" y2="19"/></svg>
}
