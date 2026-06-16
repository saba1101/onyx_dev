import { useCallback, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { supabase } from "~/lib/supabase"
import { useAuth } from "~/features/auth/lib/auth"
import { useProfile } from "~/features/profile/lib/profile-context"
import { SideRail } from "~/components/ui/side-rail"
import { use_notify } from "~/hooks/use-notify"
import { PlusIcon, SlidersIcon, PencilIcon, XIcon, TrashIcon } from "~/components/ui/icons"
import { TaskModal, StatusModal } from "~/features/workspace/components/task-modal"
import { PermissionModal } from "~/components/ui/permission-modal"
import { usePermissions } from "~/features/permissions/lib/use-permissions"
import {
  api, fmt_rel, STATUS_COLORS, TYPE_META,
  type WStatus, type WTask, type WProfile,
} from "~/features/workspace/lib/workspace"

export const meta = () => [{ title: "Workspace — Onyx Dev" }]

const ease_out = [0.22, 1, 0.36, 1] as const

const is_done_status = (s: WStatus | undefined | null): boolean => {
  if (!s) return false
  const n = s.name.toLowerCase().trim()
  return n === "done" || n === "complete" || n === "completed" || n === "finished" || n === "closed" || n === "resolved"
}

// ── Drag state ────────────────────────────────────────────────────────────────

type DragInfo = { task_id: string; from_col: string | null }

// ── Avatar ────────────────────────────────────────────────────────────────────

const MiniAvatar = ({ p, size = "sm" }: { p?: WProfile | null; size?: "sm" | "xs" }) => {
  const dim = size === "xs" ? "h-4 w-4 text-[8px]" : "h-5 w-5 text-[9px]"
  const name = p?.full_name || p?.username || "?"
  const init = name[0].toUpperCase()
  return (
    <div className={`${dim} shrink-0 overflow-hidden rounded-full border border-line bg-line/40`}>
      {p?.avatar_url
        ? <img src={p.avatar_url} alt={name} className="h-full w-full object-cover" />
        : <div className="flex h-full w-full items-center justify-center font-semibold text-muted">{init}</div>
      }
    </div>
  )
}

// ── Task card (board) ─────────────────────────────────────────────────────────

const TaskCard = ({
  task,
  profiles,
  done,
  drag_over,
  on_drag_start,
  on_drag_over,
  on_drop,
  on_click,
}: {
  task:          WTask
  profiles:      Map<string, WProfile>
  done:          boolean
  drag_over:     boolean
  on_drag_start: (e: React.DragEvent) => void
  on_drag_over:  (e: React.DragEvent) => void
  on_drop:       (e: React.DragEvent) => void
  on_click:      () => void
}) => {
  const type_meta = TYPE_META[task.type]
  const creator   = task.created_by  ? profiles.get(task.created_by)  : null
  const assignee  = task.assigned_to ? profiles.get(task.assigned_to) : null

  return (
    <div
      draggable
      onDragStart={on_drag_start}
      onDragOver={on_drag_over}
      onDrop={on_drop}
      onClick={on_click}
      className={`group relative cursor-pointer rounded-xl border p-3 transition-all duration-150
        ${drag_over
          ? "border-flag-red/50 bg-flag-red/5"
          : done
            ? "border-light-green/20 bg-light-green/5 hover:border-light-green/35"
            : "surface border-transparent hover:border-line"
        }`}
    >
      {/* Done checkmark badge */}
      {done && (
        <span className="absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-light-green/20">
          <DoneCheckIcon />
        </span>
      )}

      <div className="mb-2.5 flex items-start gap-2">
        <GripDots />
        <p className={`flex-1 text-sm font-medium leading-snug line-clamp-2 transition-colors
          ${done ? "text-muted/60 line-through decoration-muted/40" : "text-ink"}`}>
          {task.title}
        </p>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${done ? "opacity-50" : ""} ${type_meta.cls}`}>
          {type_meta.label}
        </span>
        {task.description && (
          <span className="inline-flex items-center rounded-md bg-line/40 px-1.5 py-0.5 text-[10px] text-muted">
            desc
          </span>
        )}
      </div>

      {/* Assignee / creator row */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        {creator && (
          <div className="flex items-center gap-1" title={`Created by ${creator.full_name || creator.username}`}>
            <MiniAvatar p={creator} size="xs" />
            <span className="text-[10px] text-muted truncate max-w-[60px]">
              {creator.full_name || creator.username}
            </span>
          </div>
        )}
        {assignee && (
          <div className="flex items-center gap-1 ml-auto" title={`Assigned to ${assignee.full_name || assignee.username}`}>
            <span className="text-[9px] text-muted">→</span>
            <MiniAvatar p={assignee} size="xs" />
            <span className="text-[10px] text-muted truncate max-w-[60px]">
              {assignee.full_name || assignee.username}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

const GripDots = () => (
  <span className="mt-0.5 hidden shrink-0 opacity-0 transition-opacity group-hover:opacity-30 lg:block">
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" className="text-muted">
      <circle cx="2.5" cy="2.5"  r="1.5" />
      <circle cx="7.5" cy="2.5"  r="1.5" />
      <circle cx="2.5" cy="7"    r="1.5" />
      <circle cx="7.5" cy="7"    r="1.5" />
      <circle cx="2.5" cy="11.5" r="1.5" />
      <circle cx="7.5" cy="11.5" r="1.5" />
    </svg>
  </span>
)

// ── Column ────────────────────────────────────────────────────────────────────

const Column = ({
  status, tasks, profiles,
  dragging, col_drag_over,
  on_col_drag_enter, on_col_drag_leave, on_col_drop,
  on_drag_start, on_card_drag_over, on_card_drop,
  on_add, on_card_click,
}: {
  status:             WStatus
  tasks:              WTask[]
  profiles:           Map<string, WProfile>
  dragging:           DragInfo | null
  col_drag_over:      boolean
  on_col_drag_enter:  (e: React.DragEvent) => void
  on_col_drag_leave:  (e: React.DragEvent) => void
  on_col_drop:        (e: React.DragEvent) => void
  on_drag_start:      (e: React.DragEvent, task: WTask) => void
  on_card_drag_over:  (e: React.DragEvent) => void
  on_card_drop:       (e: React.DragEvent) => void
  on_add:             () => void
  on_card_click:      (task: WTask) => void
}) => {
  const c    = STATUS_COLORS[status.color]
  const done = is_done_status(status)

  return (
    <div
      onDragEnter={on_col_drag_enter}
      onDragLeave={on_col_drag_leave}
      onDragOver={e => e.preventDefault()}
      onDrop={on_col_drop}
      className={`flex w-full flex-col rounded-2xl border transition-colors duration-150
        ${col_drag_over && dragging
          ? "border-flag-red/30 bg-flag-red/3"
          : "border-line/50 bg-card/30"
        }`}
    >
      <div className="flex items-center gap-2 px-3.5 pt-3.5 pb-2.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${c.dot}`} />
        <span className="flex-1 text-xs font-semibold text-ink truncate">{status.name}</span>
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${c.badge}`}>
          {tasks.length}
        </span>
      </div>

      <div className={`mx-3.5 mb-3 h-0.5 rounded-full opacity-50 ${c.bar}`} />

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3 scrollbar-hide min-h-0">
        <AnimatePresence initial={false}>
          {tasks.map(task => (
            <motion.div
              key={task.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18, ease: ease_out }}
            >
              <TaskCard
                task={task}
                profiles={profiles}
                done={done}
                drag_over={false}
                on_drag_start={e => on_drag_start(e, task)}
                on_drag_over={on_card_drag_over}
                on_drop={on_card_drop}
                on_click={() => on_card_click(task)}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {tasks.length === 0 && (
          <div className={`rounded-xl border border-dashed py-8 text-center text-[11px] text-muted transition-colors
            ${col_drag_over && dragging ? "border-flag-red/40 bg-flag-red/5" : "border-line/40"}`}>
            {col_drag_over && dragging ? "Drop here" : "No tasks"}
          </div>
        )}
      </div>

      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={on_add}
          className="flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs text-muted transition-colors hover:bg-line/40 hover:text-ink active:bg-line/40"
        >
          <PlusIcon size={13} />
          Add task
        </button>
      </div>
    </div>
  )
}
// ── Columns manager panel ─────────────────────────────────────────────────────

const ColumnsPanel = ({
  open, statuses, on_close, on_edit_status, on_add_status, on_delete_status,
}: {
  open:              boolean
  statuses:          WStatus[]
  on_close:          () => void
  on_edit_status:    (s: WStatus) => void
  on_add_status:     () => void
  on_delete_status:  (s: WStatus) => void
}) => {
  const [confirming, set_confirming] = useState<string | null>(null)
  const [deleting,   set_deleting]   = useState<string | null>(null)
  const notify = use_notify()

  const handle_delete = async (s: WStatus) => {
    set_deleting(s.id)
    const { error } = await api.statuses.remove(s.id)
    if (error) notify({ tone: "error", title: "Failed to delete column" })
    else on_delete_status(s)
    set_deleting(null)
    set_confirming(null)
  }

  return (
  <AnimatePresence>
    {open && (
      <>
        <motion.button
          type="button"
          aria-label="Close"
          onClick={on_close}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-40 bg-carbon-black/30 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.2, ease: ease_out }}
          className="fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-line bg-card shadow-2xl sm:w-72"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <div className="flex items-center gap-2">
              <SlidersIcon size={14} className="text-muted" />
              <span className="text-sm font-semibold text-ink">Columns</span>
            </div>
            <button
              type="button"
              onClick={on_close}
              className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-muted transition-colors hover:bg-line/40 hover:text-ink"
            >
              <XIcon size={14} />
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            {statuses.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted">No columns yet</p>
            ) : (
              statuses.map(s => {
                const c = STATUS_COLORS[s.color]
                const is_confirming = confirming === s.id
                const is_deleting   = deleting   === s.id
                return (
                  <div
                    key={s.id}
                    className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-line/30"
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${c.dot}`} />
                    <span className="flex-1 text-sm text-ink truncate">{s.name}</span>

                    {is_confirming ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handle_delete(s)}
                          disabled={is_deleting}
                          className="rounded-md bg-flag-red px-2 py-0.5 text-[10px] font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
                        >
                          {is_deleting ? "…" : "Delete"}
                        </button>
                        <button
                          type="button"
                          onClick={() => set_confirming(null)}
                          className="rounded-md border border-line px-2 py-0.5 text-[10px] text-muted transition-colors hover:text-ink"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-0.5 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => on_edit_status(s)}
                          title="Edit"
                          className="grid h-6 w-6 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-line/40 hover:text-ink"
                        >
                          <PencilIcon size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => set_confirming(s.id)}
                          title="Delete"
                          className="grid h-6 w-6 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-flag-red/10 hover:text-flag-red"
                        >
                          <TrashIcon size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          <div className="border-t border-line p-3">
            <button
              type="button"
              onClick={on_add_status}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg bg-flag-red/10 px-3 py-2 text-xs font-medium text-flag-red transition-colors hover:bg-flag-red/15"
            >
              <PlusIcon size={13} />
              Add column
            </button>
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

const EmptyBoard = ({ on_manage }: { on_manage: () => void }) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-line/40">
      <KanbanIcon />
    </div>
    <div>
      <p className="text-sm font-semibold text-ink">No columns yet</p>
      <p className="mt-1 text-xs text-muted">Add columns to start organising tasks</p>
    </div>
    <button
      type="button"
      onClick={on_manage}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-flag-red px-3.5 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-80"
    >
      <PlusIcon size={12} />
      Add column
    </button>
  </div>
)

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WorkspacePage() {
  const { user }    = useAuth()
  const { profile } = useProfile()
  const notify      = use_notify()

  const [statuses, set_statuses] = useState<WStatus[]>([])
  const [tasks,    set_tasks]    = useState<WTask[]>([])
  const [profiles, set_profiles] = useState<Map<string, WProfile>>(new Map())
  const [loading,  set_loading]  = useState(true)

  // task modal: undefined = closed, null = create, WTask = view
  const [task_open,      set_task_open]      = useState(false)
  const [active_task,    set_active_task]    = useState<WTask | null>(null)
  const [default_status, set_default_status] = useState<string | null>(null)

  // columns panel + status modal
  const [col_panel_open,  set_col_panel_open]  = useState(false)
  // undefined = StatusModal closed, null = create new, WStatus = editing
  const [editing_status,  set_editing_status]  = useState<WStatus | null | undefined>(undefined)

  // drag
  const [dragging,       set_dragging]       = useState<DragInfo | null>(null)
  const [col_drag_over,  set_col_drag_over]  = useState<string | null>(null)
  const drag_counter = useRef<Record<string, number>>({})

  // column permission error
  const [col_perm_error, set_col_perm_error] = useState(false)

  const is_root   = profile?.role === "root"
  const permissions = usePermissions(user?.id ?? null, is_root)

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    const [s_res, t_res, p_res] = await Promise.all([
      api.statuses.list(),
      api.tasks.list(),
      api.profiles.list(),
    ])
    if (s_res.error) { notify({ tone: "error", title: s_res.error.message }); return }
    if (t_res.error) { notify({ tone: "error", title: t_res.error.message }); return }

    set_statuses((s_res.data as WStatus[]) ?? [])
    set_tasks((t_res.data as WTask[]) ?? [])

    if (p_res.data) {
      const map = new Map<string, WProfile>()
      ;(p_res.data as WProfile[]).forEach(p => map.set(p.id, p))
      set_profiles(map)
    }
    set_loading(false)
  }, [notify])

  useEffect(() => { load() }, [load])

  // ── Realtime ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const ch = supabase
      .channel("workspace_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_tasks" }, () => {
        api.tasks.list().then(({ data }) => {
          if (data) set_tasks(data as WTask[])
        })
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_statuses" }, () => {
        api.statuses.list().then(({ data }) => {
          if (data) set_statuses(data as WStatus[])
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [])

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const on_drag_start = (e: React.DragEvent, task: WTask) => {
    e.dataTransfer.effectAllowed = "move"
    set_dragging({ task_id: task.id, from_col: task.status_id })
  }

  const on_drag_end = () => {
    set_dragging(null)
    set_col_drag_over(null)
    drag_counter.current = {}
  }

  const on_col_drag_enter = (status_id: string, e: React.DragEvent) => {
    e.preventDefault()
    drag_counter.current[status_id] = (drag_counter.current[status_id] ?? 0) + 1
    set_col_drag_over(status_id)
  }

  const on_col_drag_leave = (status_id: string) => {
    drag_counter.current[status_id] = Math.max(0, (drag_counter.current[status_id] ?? 1) - 1)
    if (drag_counter.current[status_id] === 0) {
      set_col_drag_over(prev => prev === status_id ? null : prev)
    }
  }

  const on_col_drop = async (status_id: string, e: React.DragEvent) => {
    e.preventDefault()
    drag_counter.current[status_id] = 0
    set_col_drag_over(null)
    if (!dragging || dragging.from_col === status_id) return

    set_tasks(prev => prev.map(t => t.id === dragging.task_id ? { ...t, status_id } : t))

    const { error } = await api.tasks.update(dragging.task_id, { status_id })
    if (error) {
      notify({ tone: "error", title: "Failed to move task" })
      load()
    }
    set_dragging(null)
  }

  const on_card_drag_over = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const on_card_drop = (e: React.DragEvent) => { e.stopPropagation() }

  // ── Task modal helpers ────────────────────────────────────────────────────

  const open_create = (status_id?: string | null) => {
    set_active_task(null)
    set_default_status(status_id ?? statuses[0]?.id ?? null)
    set_task_open(true)
  }

  const open_task = (task: WTask) => {
    set_active_task(task)
    set_task_open(true)
  }

  const close_task = () => {
    set_task_open(false)
  }

  // ── Task mutations ────────────────────────────────────────────────────────

  const on_task_created = (task: WTask) => {
    set_tasks(prev => [...prev, task])
  }

  const on_task_updated = (task: WTask) => {
    set_tasks(prev => prev.map(t => t.id === task.id ? task : t))
    set_active_task(task)
  }

  const on_task_deleted = (id: string) => {
    set_tasks(prev => prev.filter(t => t.id !== id))
    close_task()
  }

  // ── Status mutations ──────────────────────────────────────────────────────

  const on_status_saved = (status: WStatus) => {
    set_statuses(prev => {
      const idx = prev.findIndex(s => s.id === status.id)
      return idx >= 0
        ? prev.map(s => s.id === status.id ? status : s)
        : [...prev, status]
    })
  }

  const on_status_deleted = (id: string) => {
    set_statuses(prev => prev.filter(s => s.id !== id))
    set_tasks(prev => prev.map(t => t.status_id === id ? { ...t, status_id: null } : t))
  }

  const open_add_status = () => {
    set_editing_status(null)
  }

  const open_edit_status = (s: WStatus) => {
    set_editing_status(s)
    set_col_panel_open(false)
  }

  const close_status_modal = () => {
    set_editing_status(undefined)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!user) return null

  const tasks_by_status = (status_id: string) =>
    tasks.filter(t => t.status_id === status_id)

  const uncategorised = tasks.filter(
    t => !t.status_id || !statuses.find(s => s.id === t.status_id)
  )

  return (
    <div className="flex h-screen overflow-hidden" onDragEnd={on_drag_end}>
      <SideRail />

      <main className="flex flex-1 flex-col overflow-hidden pt-14 lg:pt-0 min-h-0">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: ease_out }}
          className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-card/50 px-4 py-3 backdrop-blur-xl lg:gap-4 lg:px-6 lg:py-4"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-flag-red/10 text-flag-red">
              <KanbanIcon />
            </span>
            <div>
              <h1 className="text-sm font-bold text-ink">Workspace</h1>
              <p className="text-[10px] text-muted">
                {tasks.length} task{tasks.length !== 1 ? "s" : ""} · {statuses.length} column{statuses.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => permissions.manage_columns ? set_col_panel_open(true) : set_col_perm_error(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink lg:px-3"
            >
              <SlidersIcon size={12} />
              <span className="hidden sm:inline">Columns</span>
            </button>
            <button
              type="button"
              onClick={() => open_create()}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-flag-red px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-80"
            >
              <PlusIcon size={12} />
              New task
            </button>
          </div>
        </motion.div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-flag-red" />
          </div>
        ) : statuses.length === 0 ? (
          <EmptyBoard on_manage={() => permissions.manage_columns ? set_col_panel_open(true) : set_col_perm_error(true)} />
        ) : (
          <div className="flex flex-1 gap-3 overflow-x-auto overflow-y-hidden px-3 py-3 min-h-0 lg:gap-4 lg:px-5 lg:py-4">
            {statuses.map((status, i) => (
              <motion.div
                key={status.id}
                className="flex flex-1 min-w-[260px] lg:min-w-[280px]"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: ease_out, delay: i * 0.05 }}
              >
                <Column
                  status={status}
                  tasks={tasks_by_status(status.id)}
                  profiles={profiles}
                  dragging={dragging}
                  col_drag_over={col_drag_over === status.id}
                  on_col_drag_enter={e => on_col_drag_enter(status.id, e)}
                  on_col_drag_leave={() => on_col_drag_leave(status.id)}
                  on_col_drop={e => on_col_drop(status.id, e)}
                  on_drag_start={on_drag_start}
                  on_card_drag_over={on_card_drag_over}
                  on_card_drop={on_card_drop}
                  on_add={() => open_create(status.id)}
                  on_card_click={open_task}
                />
              </motion.div>
            ))}

            {uncategorised.length > 0 && (
              <motion.div
                className="flex flex-1 min-w-[260px] lg:min-w-[280px]"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: ease_out, delay: statuses.length * 0.05 }}
              >
                <div className="flex w-full flex-col rounded-2xl border border-dashed border-line/50 bg-card/20">
                  <div className="flex items-center gap-2 px-3.5 pt-3.5 pb-2.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-muted/40" />
                    <span className="flex-1 text-xs font-semibold text-muted">Uncategorised</span>
                    <span className="rounded-full bg-line/40 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                      {uncategorised.length}
                    </span>
                  </div>
                  <div className="mx-3.5 mb-3 h-0.5 rounded-full bg-line/30" />
                  <div className="flex flex-col gap-2 overflow-y-auto px-3 pb-3 scrollbar-hide min-h-0">
                    {uncategorised.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        profiles={profiles}
                        done={false}
                        drag_over={false}
                        on_drag_start={e => on_drag_start(e, task)}
                        on_drag_over={on_card_drag_over}
                        on_drop={on_card_drop}
                        on_click={() => open_task(task)}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </main>

      {/* Columns side panel */}
      <ColumnsPanel
        open={col_panel_open}
        statuses={statuses}
        on_close={() => set_col_panel_open(false)}
        on_edit_status={open_edit_status}
        on_add_status={open_add_status}
        on_delete_status={s => on_status_deleted(s.id)}
      />

      {/* Task modal */}
      <TaskModal
        open={task_open}
        task={active_task}
        default_status={default_status}
        statuses={statuses}
        profiles={profiles}
        user_id={user.id}
        is_root={is_root}
        permissions={permissions}
        on_close={close_task}
        on_created={on_task_created}
        on_updated={on_task_updated}
        on_deleted={on_task_deleted}
      />

      {/* Status modal (add / edit one column) */}
      <StatusModal
        open={editing_status !== undefined}
        editing={editing_status ?? null}
        next_pos={statuses.length}
        on_close={close_status_modal}
        on_saved={on_status_saved}
        on_deleted={on_status_deleted}
      />

      {/* Column permission error */}
      <PermissionModal
        open={col_perm_error}
        action="manage board columns"
        on_close={() => set_col_perm_error(false)}
      />
    </div>
  )
}

// ── Inline icons ──────────────────────────────────────────────────────────────

const ip = {
  width: 16, height: 16, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.8,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
}

const KanbanIcon = () => (
  <svg {...ip}>
    <rect x="3"  y="3" width="4" height="14" rx="1.5" />
    <rect x="10" y="3" width="4" height="9"  rx="1.5" />
    <rect x="17" y="3" width="4" height="11" rx="1.5" />
  </svg>
)


const DoneCheckIcon = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-light-green">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)
