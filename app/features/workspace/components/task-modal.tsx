import { useEffect, useRef, useState } from "react"
import { Modal } from "~/components/ui/modal"
import { PermissionModal } from "~/components/ui/permission-modal"
import { Dropdown } from "~/components/ui/dropdown"
import { use_notify } from "~/hooks/use-notify"
import {
  PencilIcon, TrashIcon, CheckIcon, XIcon,
  MessageSquareIcon, ChevronIcon,
} from "~/components/ui/icons"
import {
  api, fmt_rel,
  STATUS_COLORS, TYPE_META, COLOR_OPTIONS,
  type WTask, type WStatus, type WComment, type WProfile, type TaskType, type StatusColor,
} from "~/features/workspace/lib/workspace"
import type { PermissionsState } from "~/features/permissions/lib/permissions-store"

// ── Mini avatar ───────────────────────────────────────────────────────────────

const MiniAvatar = ({ p, size = "sm" }: { p?: WProfile | null; size?: "sm" | "xs" }) => {
  const dim = size === "xs" ? "h-5 w-5 text-[9px]" : "h-7 w-7 text-[10px]"
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

// ── Comment list + form ───────────────────────────────────────────────────────

const Comments = ({
  task_id, user_id, can_delete_any, profiles, on_perm_denied,
}: {
  task_id:        string
  user_id:        string
  can_delete_any: boolean
  profiles:       Map<string, WProfile>
  on_perm_denied: (action: string) => void
}) => {
  const notify = use_notify()
  const [comments,  set_comments]  = useState<WComment[]>([])
  const [loading,   set_loading]   = useState(true)
  const [body,      set_body]      = useState("")
  const [posting,   set_posting]   = useState(false)
  const [deleting,  set_deleting]  = useState<string | null>(null)
  const end_ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    set_loading(true)
    api.comments.list(task_id).then(({ data }) => {
      set_comments((data as WComment[]) ?? [])
      set_loading(false)
    })
  }, [task_id])

  useEffect(() => {
    end_ref.current?.scrollIntoView({ behavior: "smooth" })
  }, [comments.length])

  const post = async () => {
    const text = body.trim()
    if (!text || posting) return
    set_posting(true)
    const { data, error } = await api.comments.create(task_id, user_id, text)
    if (error) notify({ tone: "error", title: "Failed to post", message: error.message })
    else { set_comments(prev => [...prev, data as WComment]); set_body("") }
    set_posting(false)
  }

  const handle_delete = (c: WComment) => {
    const is_own = c.author_id === user_id
    if (!is_own && !can_delete_any) {
      on_perm_denied("delete this comment")
      return
    }
    remove(c.id)
  }

  const remove = async (id: string) => {
    set_deleting(id)
    const { error } = await api.comments.remove(id)
    if (error) notify({ tone: "error", title: "Failed to delete", message: error.message })
    else set_comments(prev => prev.filter(c => c.id !== id))
    set_deleting(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-t border-line/40 pt-4">
        <MessageSquareIcon size={13} className="text-muted" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          Comments {comments.length > 0 && `· ${comments.length}`}
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex gap-2.5">
              <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-line/40" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 w-24 animate-pulse rounded bg-line/40" />
                <div className="h-8 animate-pulse rounded-lg bg-line/40" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted/60">No comments yet</p>
      ) : (
        <div className="space-y-4">
          {comments.map(c => {
            const author = profiles.get(c.author_id ?? "")
            const name   = author?.full_name || author?.username || "Unknown"
            return (
              <div key={c.id} className="group flex gap-2.5">
                <MiniAvatar p={author} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-ink">{name}</span>
                    <span className="text-[10px] text-muted">{fmt_rel(c.created_at)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink/90">{c.body}</p>
                </div>
                <button
                  onClick={() => handle_delete(c)}
                  disabled={deleting === c.id}
                  className="mt-0.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 text-muted hover:text-flag-red disabled:opacity-30"
                >
                  <TrashIcon size={13} />
                </button>
              </div>
            )
          })}
          <div ref={end_ref} />
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2.5 border-t border-line/40 pt-3">
        <MiniAvatar p={profiles.get(user_id)} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <textarea
            value={body}
            onChange={e => set_body(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) post() }}
            placeholder="Add a comment… (⌘ + Enter to post)"
            rows={2}
            className="w-full resize-none rounded-lg border border-line bg-page/60 px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted/40 focus:border-flag-red/50"
          />
          <button
            onClick={post}
            disabled={!body.trim() || posting}
            className="self-end rounded-lg bg-flag-red px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {posting ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── User picker dropdown ──────────────────────────────────────────────────────

const UserPicker = ({
  value, profiles, placeholder = "Unassigned", on_select, trigger_class,
}: {
  value:          string | null
  profiles:       Map<string, WProfile>
  placeholder?:   string
  on_select:      (id: string | null) => void
  trigger_class?: string
}) => {
  const profile_list = Array.from(profiles.values())
  const selected_p   = value ? profiles.get(value) : null

  const opts = [
    { value: "", label: "Unassigned", dot: undefined as string | undefined },
    ...profile_list.map(p => ({
      value: p.id,
      label: p.full_name || p.username || p.id.slice(0, 8),
      dot:   undefined as string | undefined,
    })),
  ]

  const cls = trigger_class ??
    "inline-flex items-center gap-2 rounded-lg border border-line bg-line/20 px-2.5 py-1 text-[11px] font-medium text-ink outline-none transition-colors hover:bg-line/40 max-w-[180px]"

  return (
    <Dropdown
      value={value ?? ""}
      options={opts}
      on_select={v => on_select(v || null)}
      menu_width="w-52"
      trigger_class={cls}
    >
      {({ open: dd_open }) => (
        <>
          {selected_p ? (
            <>
              <MiniAvatar p={selected_p} size="xs" />
              <span className="truncate">{selected_p.full_name || selected_p.username || "Unknown"}</span>
            </>
          ) : (
            <span className="text-muted/60">{placeholder}</span>
          )}
          <ChevronIcon size={10} className={`ml-auto shrink-0 text-muted transition-transform ${dd_open ? "rotate-180" : ""}`} />
        </>
      )}
    </Dropdown>
  )
}

// ── Task modal ────────────────────────────────────────────────────────────────

type Props = {
  open:           boolean
  task:           WTask | null
  default_status: string | null
  project_id:     string
  statuses:       WStatus[]
  profiles:       Map<string, WProfile>
  user_id:        string
  is_root:        boolean
  permissions:    PermissionsState
  on_close:       () => void
  on_created:     (t: WTask) => void
  on_updated:     (t: WTask) => void
  on_deleted:     (id: string) => void
}

export const TaskModal = ({
  open, task, default_status, project_id, statuses, profiles,
  user_id, is_root, permissions,
  on_close, on_created, on_updated, on_deleted,
}: Props) => {
  const notify = use_notify()
  const is_create = task === null

  const [editing,    set_editing]    = useState(false)
  const [saving,     set_saving]     = useState(false)
  const [confirming, set_confirming] = useState(false)
  const [deleting,   set_deleting]   = useState(false)
  const [perm_error, set_perm_error] = useState<string | null>(null)

  const [title,       set_title]       = useState("")
  const [desc,        set_desc]        = useState("")
  const [type,        set_type]        = useState<TaskType>("feature")
  const [status_id,   set_status_id]   = useState<string | null>(null)
  const [assigned_to, set_assigned_to] = useState<string | null>(null)

  useEffect(() => {
    if (!open) { set_editing(false); set_confirming(false); set_perm_error(null); return }
    if (is_create) {
      set_title(""); set_desc(""); set_type("feature")
      set_status_id(default_status ?? statuses[0]?.id ?? null)
      set_assigned_to(null)
      set_editing(true)
    } else {
      set_title(task.title); set_desc(task.description ?? "")
      set_type(task.type);   set_status_id(task.status_id)
      set_assigned_to(task.assigned_to)
      set_editing(false)
    }
  }, [open, task?.id])

  // ── Permission helpers ────────────────────────────────────────────────────

  const is_own_task = task?.created_by === user_id
  const can_edit    = is_own_task || permissions.edit_any_task
  const can_delete  = is_own_task || permissions.delete_task

  const handle_edit_click = () => {
    if (can_edit) set_editing(true)
    else          set_perm_error("edit this task")
  }

  const handle_delete_click = () => {
    if (can_delete) set_confirming(true)
    else            set_perm_error("delete this task")
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  const status_opts = statuses.map(s => ({ value: s.id, label: s.name, dot: STATUS_COLORS[s.color].dot }))

  const save = async () => {
    if (!title.trim() || saving) return
    set_saving(true)
    if (is_create) {
      const { data, error } = await api.tasks.create({
        project_id, title: title.trim(), description: desc.trim() || null,
        type, status_id, created_by: user_id, assigned_to,
      })
      if (error) notify({ tone: "error", title: "Failed to create", message: error.message })
      else { on_created(data as WTask); on_close() }
    } else {
      const { data, error } = await api.tasks.update(task.id, {
        title: title.trim(), description: desc.trim() || null, type, status_id, assigned_to,
      })
      if (error) notify({ tone: "error", title: "Failed to save", message: error.message })
      else { on_updated(data as WTask); set_editing(false) }
    }
    set_saving(false)
  }

  const remove = async () => {
    if (!task || deleting) return
    set_deleting(true)
    const { error } = await api.tasks.remove(task.id)
    if (error) notify({ tone: "error", title: "Failed to delete", message: error.message })
    else { on_deleted(task.id); on_close() }
    set_deleting(false)
  }

  const quick_status = async (sid: string) => {
    if (!task || sid === task.status_id) return
    const { data, error } = await api.tasks.update(task.id, { status_id: sid })
    if (!error && data) on_updated(data as WTask)
  }

  const quick_assign = async (uid: string | null) => {
    if (!task || uid === task.assigned_to) return
    const { data, error } = await api.tasks.update(task.id, { assigned_to: uid })
    if (error) notify({ tone: "error", title: "Failed to assign", message: error.message })
    else if (data) on_updated(data as WTask)
  }

  const creator  = profiles.get(task?.created_by ?? "")
  const assignee = profiles.get(task?.assigned_to ?? "")
  const cur_stat = statuses.find(s => s.id === (task ? task.status_id : status_id))

  const modal_title = is_create ? "New task" : (editing ? "Edit task" : (task?.title ?? ""))

  return (
    <>
      <Modal open={open} on_close={on_close} title={modal_title} size="lg">
        <div className="space-y-5">

          {/* ── View mode header ── */}
          {!editing && task && (
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TYPE_META[task.type].cls}`}>
                {TYPE_META[task.type].label}
              </span>

              <Dropdown
                value={task.status_id ?? ""}
                options={status_opts}
                on_select={quick_status}
                menu_width="w-44"
                trigger_class="inline-flex items-center gap-1.5 rounded-md border border-line bg-card/60 px-2 py-0.5 text-[10px] font-medium text-ink transition-colors hover:bg-line/40"
              >
                {({ open: dd_open, selected }) => (
                  <>
                    {selected?.dot && <span className={`h-1.5 w-1.5 rounded-full ${selected.dot}`} />}
                    {cur_stat?.name ?? "No status"}
                    <ChevronIcon size={10} className={`text-muted transition-transform ${dd_open ? "rotate-180" : ""}`} />
                  </>
                )}
              </Dropdown>

              <div className="ml-auto flex items-center gap-1.5">
                <button
                  onClick={handle_edit_click}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card/60 px-2.5 py-1 text-[11px] font-medium text-ink transition-colors hover:bg-line/40"
                >
                  <PencilIcon size={12} /> Edit
                </button>

                {!confirming ? (
                  <button
                    onClick={handle_delete_click}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card/60 px-2.5 py-1 text-[11px] font-medium text-muted transition-colors hover:border-flag-red/40 hover:text-flag-red"
                  >
                    <TrashIcon size={12} /> Delete
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={remove}
                      disabled={deleting}
                      className="rounded-lg bg-flag-red px-2.5 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {deleting ? "Deleting…" : "Confirm"}
                    </button>
                    <button
                      onClick={() => set_confirming(false)}
                      className="rounded-lg border border-line px-2.5 py-1 text-[11px] text-muted hover:text-ink"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Form (create + edit) ── */}
          {editing && (
            <div className="space-y-0">
              <div className="flex flex-wrap items-center gap-2 pb-4">
                <div className="flex items-center gap-1 rounded-lg border border-line bg-line/20 p-0.5">
                  {(["feature", "bug"] as TaskType[]).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set_type(t)}
                      className={`cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all duration-150
                        ${type === t ? `${TYPE_META[t].cls} shadow-sm` : "text-muted hover:text-ink"}`}
                    >
                      {TYPE_META[t].label}
                    </button>
                  ))}
                </div>

                <Dropdown
                  value={status_id ?? ""}
                  options={status_opts}
                  on_select={v => set_status_id(v || null)}
                  menu_width="w-44"
                  trigger_class="inline-flex items-center gap-2 rounded-lg border border-line bg-line/20 px-2.5 py-1 text-[11px] font-medium text-ink outline-none transition-colors hover:bg-line/40"
                >
                  {({ open: dd_open, selected }) => (
                    <>
                      {selected?.dot
                        ? <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${selected.dot}`} />
                        : <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted/40" />
                      }
                      <span>{selected?.label ?? "No status"}</span>
                      <ChevronIcon size={10} className={`text-muted transition-transform ${dd_open ? "rotate-180" : ""}`} />
                    </>
                  )}
                </Dropdown>
              </div>

              <input
                autoFocus
                value={title}
                onChange={e => set_title(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) save() }}
                placeholder="Task title…"
                maxLength={120}
                className="w-full border-0 bg-transparent pb-1 text-lg font-bold text-ink outline-none placeholder:font-normal placeholder:text-muted/30"
              />

              <div className="mb-3 h-px bg-line/60" />

              <textarea
                value={desc}
                onChange={e => set_desc(e.target.value)}
                placeholder="Add a description…"
                rows={4}
                maxLength={2000}
                className="w-full resize-none border-0 bg-transparent pb-2 text-sm leading-relaxed text-ink/80 outline-none placeholder:text-muted/30"
              />

              {/* Assignee row */}
              <div className="flex items-center gap-3 border-t border-line/60 pt-4 pb-1">
                <span className="w-20 shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted">Assign to</span>
                <UserPicker
                  value={assigned_to}
                  profiles={profiles}
                  on_select={set_assigned_to}
                />
              </div>

              <div className="flex items-center gap-2 border-t border-line/60 pt-4">
                <button
                  onClick={save}
                  disabled={!title.trim() || saving}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-flag-red px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  <CheckIcon size={13} />
                  {saving ? "Saving…" : is_create ? "Create task" : "Save changes"}
                </button>
                <button
                  onClick={() => is_create ? on_close() : set_editing(false)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-line/40 hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── View mode body ── */}
          {!editing && task && (
            <>
              {task.description ? (
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink/80">{task.description}</p>
              ) : (
                <p className="text-sm italic text-muted/40">No description</p>
              )}

              <ViewDivider label="details" />

              {/* People */}
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line/40 bg-line/30">
                <div className="space-y-1.5 bg-card/60 p-3">
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-muted/60">Assigned by</p>
                  {creator ? (
                    <div className="flex items-center gap-2">
                      <MiniAvatar p={creator} size="xs" />
                      <span className="text-xs text-ink">{creator.full_name || creator.username || "Unknown"}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted/40">—</span>
                  )}
                </div>
                <div className="space-y-1.5 bg-card/60 p-3">
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-muted/60">Assigned to</p>
                  <UserPicker
                    value={task.assigned_to}
                    profiles={profiles}
                    on_select={quick_assign}
                    trigger_class="inline-flex items-center gap-1.5 rounded-md border border-line bg-card/60 px-2 py-0.5 text-xs font-medium text-ink transition-colors hover:bg-line/40 max-w-full"
                  />
                </div>
              </div>

              {/* Timestamps */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted/60">
                <span className="flex items-center gap-1.5">
                  <ClockDotIcon />
                  Created {fmt_rel(task.created_at)}
                </span>
                {task.updated_at !== task.created_at && (
                  <span className="flex items-center gap-1.5">
                    <ClockDotIcon />
                    Updated {fmt_rel(task.updated_at)}
                  </span>
                )}
              </div>

              <ViewDivider label="discussion" />

              <Comments
                task_id={task.id}
                user_id={user_id}
                can_delete_any={permissions.delete_any_comment}
                profiles={profiles}
                on_perm_denied={action => set_perm_error(action)}
              />
            </>
          )}
        </div>
      </Modal>

      {/* Permission error — renders on top of the task modal */}
      <PermissionModal
        open={perm_error !== null}
        action={perm_error ?? ""}
        on_close={() => set_perm_error(null)}
      />
    </>
  )
}

// ── Status form modal ─────────────────────────────────────────────────────────

type StatusModalProps = {
  open:       boolean
  editing:    WStatus | null
  next_pos:   number
  project_id: string
  on_close:   () => void
  on_saved:   (s: WStatus) => void
  on_deleted: (id: string) => void
}

export const StatusModal = ({
  open, editing, next_pos, project_id, on_close, on_saved, on_deleted,
}: StatusModalProps) => {
  const notify    = use_notify()
  const is_new    = editing === null
  const [name,    set_name]    = useState("")
  const [color,   set_color]   = useState<StatusColor>("gray")
  const [saving,  set_saving]  = useState(false)
  const [deleting,set_deleting]= useState(false)
  const [confirm, set_confirm] = useState(false)

  useEffect(() => {
    if (!open) { set_confirm(false); return }
    set_name(editing?.name ?? "")
    set_color(editing?.color ?? "gray")
  }, [open, editing?.id])

  const save = async () => {
    if (!name.trim() || saving) return
    set_saving(true)
    if (is_new) {
      const { data, error } = await api.statuses.create(project_id, name.trim(), color, next_pos)
      if (error) notify({ tone: "error", title: "Failed", message: error.message })
      else { on_saved(data as WStatus); on_close() }
    } else {
      const { error } = await api.statuses.update(editing!.id, { name: name.trim(), color })
      if (error) notify({ tone: "error", title: "Failed", message: error.message })
      else { on_saved({ ...editing!, name: name.trim(), color }); on_close() }
    }
    set_saving(false)
  }

  const remove = async () => {
    if (!editing || deleting) return
    set_deleting(true)
    const { error } = await api.statuses.remove(editing.id)
    if (error) notify({ tone: "error", title: "Failed", message: error.message })
    else { on_deleted(editing.id); on_close() }
    set_deleting(false)
  }

  return (
    <Modal
      open={open}
      on_close={on_close}
      title={is_new ? "Add status" : "Edit status"}
      size="sm"
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted">Name</label>
          <input
            autoFocus
            value={name}
            onChange={e => set_name(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") save() }}
            placeholder="e.g. In Review"
            maxLength={40}
            className="w-full rounded-lg border border-line bg-page/60 px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted/40 focus:border-flag-red/50"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted">Color</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => set_color(c)}
                className={`h-7 w-7 rounded-full transition-all ${STATUS_COLORS[c].dot}
                  ${color === c ? "scale-110 ring-2 ring-current ring-offset-2 ring-offset-card" : "opacity-60 hover:opacity-100"}`}
              />
            ))}
          </div>
          <p className={`text-[11px] font-medium ${STATUS_COLORS[color].text}`}>
            {color.charAt(0).toUpperCase() + color.slice(1)}
          </p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={save}
            disabled={!name.trim() || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-flag-red px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <CheckIcon size={14} />
            {saving ? "Saving…" : is_new ? "Add column" : "Save"}
          </button>
          <button
            onClick={on_close}
            className="rounded-lg border border-line bg-card/60 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-line/40"
          >
            Cancel
          </button>

          {!is_new && !confirm && (
            <button
              onClick={() => set_confirm(true)}
              className="ml-auto rounded-lg border border-line px-3 py-2 text-sm text-muted transition-colors hover:border-flag-red/40 hover:text-flag-red"
            >
              <TrashIcon size={14} />
            </button>
          )}
          {!is_new && confirm && (
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={remove}
                disabled={deleting}
                className="rounded-lg bg-flag-red px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {deleting ? "…" : "Delete"}
              </button>
              <button
                onClick={() => set_confirm(false)}
                className="rounded-lg border border-line px-3 py-2 text-xs text-muted hover:text-ink"
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ── View divider ──────────────────────────────────────────────────────────────

const ViewDivider = ({ label }: { label: string }) => (
  <div className="flex items-center gap-2.5 py-1">
    <span className="text-[9px] font-semibold uppercase tracking-widest text-muted/50">{label}</span>
    <div className="h-px flex-1 bg-gradient-to-r from-line/60 to-transparent" />
  </div>
)

// ── Icons ─────────────────────────────────────────────────────────────────────

const ClockDotIcon = () => (
  <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)
