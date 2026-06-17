import { useState, useEffect, useCallback, createContext, useContext } from "react"
import {
  ReactFlow, Background, BackgroundVariant, Controls, MiniMap,
  Handle, Position, MarkerType,
  type NodeProps, type Node, type Edge,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { motion } from "motion/react"
import { Modal } from "~/components/ui/modal"
import { Toggle } from "~/components/ui/toggle"
import { supabase } from "~/lib/supabase"
import { PencilIcon, TrashIcon, PlusIcon, XIcon, CheckIcon } from "~/components/ui/icons"

const ease_out = [0.22, 1, 0.36, 1] as const

// ── Schema metadata ───────────────────────────────────────────────────────────

type ColType = "text" | "bool" | "int" | "enum" | "uuid" | "timestamp" | "pages_array"

type ColMeta = {
  name:     string
  type:     ColType
  editable: boolean
  options?: string[]
}

type TableSchema = { pk: string; cols: ColMeta[] }

const PAGE_KEYS = [
  "dashboard", "workspace", "git",
  "users", "settings", "scanner", "system",
]

const TABLE_SCHEMA: Record<string, TableSchema> = {
  profiles: {
    pk: "id",
    cols: [
      { name: "id",              type: "uuid",      editable: false },
      { name: "email",           type: "text",      editable: true  },
      { name: "full_name",       type: "text",      editable: true  },
      { name: "role",            type: "enum",      editable: true, options: ["member", "admin", "root"] },
      { name: "username",        type: "text",      editable: true  },
      { name: "bio",             type: "text",      editable: true  },
      { name: "status",          type: "enum",      editable: true, options: ["active", "away", "busy", "offline"] },
      { name: "phone",           type: "text",      editable: true  },
      { name: "location",        type: "text",      editable: true  },
      { name: "website",         type: "text",      editable: true  },
      { name: "company",         type: "text",      editable: true  },
      { name: "job_title",       type: "text",      editable: true  },
      { name: "timezone",        type: "text",      editable: true  },
      { name: "github_url",      type: "text",      editable: true  },
      { name: "twitter_url",     type: "text",      editable: true  },
      { name: "linkedin_url",    type: "text",      editable: true  },
      { name: "github_username", type: "text",      editable: true  },
      { name: "avatar_url",      type: "text",      editable: true  },
      { name: "created_at",      type: "timestamp", editable: false },
      { name: "updated_at",      type: "timestamp", editable: false },
      { name: "last_seen_at",    type: "timestamp", editable: false },
    ],
  },
  workspace_statuses: {
    pk: "id",
    cols: [
      { name: "id",         type: "uuid",      editable: false },
      { name: "name",       type: "text",      editable: true  },
      { name: "color",      type: "text",      editable: true  },
      { name: "position",   type: "int",       editable: true  },
      { name: "created_at", type: "timestamp", editable: false },
    ],
  },
  workspace_tasks: {
    pk: "id",
    cols: [
      { name: "id",          type: "uuid",      editable: false },
      { name: "title",       type: "text",      editable: true  },
      { name: "description", type: "text",      editable: true  },
      { name: "type",        type: "enum",      editable: true, options: ["feature", "bug"] },
      { name: "status_id",   type: "uuid",      editable: true  },
      { name: "assigned_to", type: "uuid",      editable: true  },
      { name: "position",    type: "int",       editable: true  },
      { name: "created_by",  type: "uuid",      editable: false },
      { name: "created_at",  type: "timestamp", editable: false },
      { name: "updated_at",  type: "timestamp", editable: false },
    ],
  },
  workspace_comments: {
    pk: "id",
    cols: [
      { name: "id",         type: "uuid",      editable: false },
      { name: "task_id",    type: "uuid",      editable: false },
      { name: "author_id",  type: "uuid",      editable: false },
      { name: "body",       type: "text",      editable: true  },
      { name: "created_at", type: "timestamp", editable: false },
    ],
  },
  member_permissions: {
    pk: "user_id",
    cols: [
      { name: "user_id",            type: "uuid",        editable: false },
      { name: "edit_any_task",      type: "bool",        editable: true  },
      { name: "delete_task",        type: "bool",        editable: true  },
      { name: "delete_any_comment", type: "bool",        editable: true  },
      { name: "manage_columns",     type: "bool",        editable: true  },
      { name: "hidden_pages",       type: "pages_array", editable: true  },
      { name: "updated_at",         type: "timestamp",   editable: false },
    ],
  },
  role_permissions: {
    pk: "role",
    cols: [
      { name: "role",               type: "text",        editable: false },
      { name: "edit_any_task",      type: "bool",        editable: true  },
      { name: "delete_task",        type: "bool",        editable: true  },
      { name: "delete_any_comment", type: "bool",        editable: true  },
      { name: "manage_columns",     type: "bool",        editable: true  },
      { name: "hidden_pages",       type: "pages_array", editable: true  },
      { name: "updated_at",         type: "timestamp",   editable: false },
    ],
  },
}

const default_row = (schema: TableSchema): Record<string, unknown> => {
  const row: Record<string, unknown> = {}
  schema.cols.forEach(col => {
    if (!col.editable) return
    if (col.type === "bool")        row[col.name] = false
    else if (col.type === "int")    row[col.name] = 0
    else if (col.type === "enum")   row[col.name] = col.options?.[0] ?? ""
    else if (col.type === "pages_array") row[col.name] = []
    else                            row[col.name] = ""
  })
  return row
}

// ── Actions context (avoids putting callbacks in node data) ───────────────────

type DbActions = {
  on_edit:   (table: string, row: Record<string, unknown>) => void
  on_add:    (table: string) => void
  on_delete: (table: string, row: Record<string, unknown>) => void
}
const DbActionsCtx = createContext<DbActions>({
  on_edit:   () => {},
  on_add:    () => {},
  on_delete: () => {},
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt_val = (val: unknown): string => {
  if (val === null || val === undefined) return "—"
  if (typeof val === "boolean") return val ? "✓" : "✗"
  if (typeof val === "number") return String(val)
  if (Array.isArray(val)) return val.length ? val.join(", ") : "[ ]"
  const s = String(val)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s))
    return "…" + s.slice(-6)
  return s.length > 22 ? s.slice(0, 22) + "…" : s
}

const fmt_ts = (val: unknown): string => {
  if (!val) return "—"
  try { return new Date(String(val)).toLocaleString() } catch { return String(val) }
}

// ── Node data type ────────────────────────────────────────────────────────────

type TableNodeData = {
  label:        string
  rows:         Record<string, unknown>[]
  display_cols: string[]
  total:        number
  header_cls:   string
  text_cls:     string
}

// ── Custom table node ─────────────────────────────────────────────────────────

const TableNode = ({ data }: NodeProps) => {
  const d = data as TableNodeData
  const { on_edit, on_add, on_delete } = useContext(DbActionsCtx)
  const col_count = d.display_cols.length

  return (
    <div className="min-w-[260px] max-w-[300px] overflow-hidden rounded-2xl border border-line/50 bg-card shadow-2xl">
      <Handle type="target" position={Position.Top}    id="t-top"    style={handle_style} />
      <Handle type="target" position={Position.Left}   id="t-left"   style={handle_style} />
      <Handle type="source" position={Position.Bottom} id="s-bottom" style={handle_style} />
      <Handle type="source" position={Position.Right}  id="s-right"  style={handle_style} />

      {/* Header */}
      <div className={`flex items-center gap-2 border-b border-line/30 px-3 py-2.5 ${d.header_cls}`}>
        <DbIcon cls={d.text_cls} />
        <span className={`truncate font-mono text-[10px] font-bold tracking-tight ${d.text_cls}`}>
          {d.label}
        </span>
        <span className={`ml-auto shrink-0 rounded-full bg-card/70 px-1.5 py-0.5 text-[9px] font-semibold ${d.text_cls}`}>
          {d.total} rows
        </span>
        <button
          type="button"
          onClick={() => on_add(d.label)}
          title="Add row"
          className={`shrink-0 rounded-md p-0.5 transition-colors hover:bg-card/60 ${d.text_cls}`}
        >
          <PlusIcon size={11} />
        </button>
      </div>

      {/* Column headers */}
      <div
        className="grid gap-2 border-b border-line/20 bg-line/10 px-3 py-1.5"
        style={{ gridTemplateColumns: `repeat(${col_count}, 1fr) 40px` }}
      >
        {d.display_cols.map(col => (
          <span key={col} className="truncate text-[8px] font-bold uppercase tracking-wider text-muted/50">
            {col.replace(/_/g, " ")}
          </span>
        ))}
        <span />
      </div>

      {/* Data rows */}
      <div className="max-h-[180px] overflow-y-auto">
        {d.rows.map((row, i) => (
          <div
            key={i}
            className="group grid items-center gap-2 border-b border-line/10 px-3 py-1.5 last:border-0 hover:bg-line/10"
            style={{ gridTemplateColumns: `repeat(${col_count}, 1fr) 40px` }}
          >
            {d.display_cols.map(col => {
              const v = row[col]
              const is_bool = typeof v === "boolean"
              return (
                <span
                  key={col}
                  className={`truncate font-mono text-[10px] ${
                    is_bool
                      ? v ? "font-semibold text-light-green" : "text-muted/30"
                      : "text-ink/80"
                  }`}
                >
                  {fmt_val(v)}
                </span>
              )
            })}
            {/* Row actions */}
            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => on_edit(d.label, row)}
                className="rounded p-0.5 text-muted hover:text-ink"
                title="Edit row"
              >
                <PencilIcon size={10} />
              </button>
              <button
                type="button"
                onClick={() => on_delete(d.label, row)}
                className="rounded p-0.5 text-muted hover:text-flag-red"
                title="Delete row"
              >
                <TrashIcon size={10} />
              </button>
            </div>
          </div>
        ))}
        {d.total > d.rows.length && (
          <p className="px-3 py-1.5 text-[9px] text-muted/40">
            +{d.total - d.rows.length} more rows not shown
          </p>
        )}
      </div>
    </div>
  )
}

const handle_style: React.CSSProperties = {
  width: 7, height: 7,
  background: "var(--color-line, #334155)",
  border: "2px solid var(--color-card, #0f1117)",
}

const node_types = { table: TableNode }

// ── Field input ───────────────────────────────────────────────────────────────

const FieldInput = ({
  col, value, on_change,
}: {
  col: ColMeta
  value: unknown
  on_change: (v: unknown) => void
}) => {
  const input_cls = "w-full rounded-xl border border-line bg-line/20 px-3 py-2 text-xs text-ink placeholder:text-muted/40 focus:border-flag-red/40 focus:outline-none focus:ring-1 focus:ring-flag-red/20 font-mono"
  const readonly_cls = "w-full rounded-xl border border-line/30 bg-line/10 px-3 py-2 text-xs text-muted/60 font-mono cursor-not-allowed"

  if (!col.editable) {
    return (
      <div className={readonly_cls}>
        {col.type === "timestamp" ? fmt_ts(value) : fmt_val(value)}
      </div>
    )
  }

  if (col.type === "bool") {
    return (
      <div className="flex items-center gap-2">
        <Toggle checked={!!value} onChange={v => on_change(v)} />
        <span className="text-xs text-muted">{value ? "true" : "false"}</span>
      </div>
    )
  }

  if (col.type === "enum") {
    return (
      <select
        value={String(value ?? "")}
        onChange={e => on_change(e.target.value)}
        className={input_cls}
      >
        {col.options?.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }

  if (col.type === "int") {
    return (
      <input
        type="number"
        value={Number(value ?? 0)}
        onChange={e => on_change(parseInt(e.target.value, 10))}
        className={input_cls}
      />
    )
  }

  if (col.type === "pages_array") {
    const pages = Array.isArray(value) ? (value as string[]) : []
    const toggle_page = (key: string) => {
      const next = pages.includes(key) ? pages.filter(p => p !== key) : [...pages, key]
      on_change(next)
    }
    return (
      <div className="grid grid-cols-3 gap-1.5">
        {PAGE_KEYS.map(key => {
          const active = pages.includes(key)
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle_page(key)}
              className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[9px] font-semibold transition-colors ${
                active
                  ? "border-flag-red/30 bg-flag-red/10 text-flag-red"
                  : "border-line bg-line/20 text-muted hover:border-line/60 hover:text-ink"
              }`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-flag-red" : "bg-muted/30"}`} />
              {key}
            </button>
          )
        })}
      </div>
    )
  }

  // text, uuid (editable)
  return (
    <input
      type="text"
      value={String(value ?? "")}
      onChange={e => on_change(e.target.value)}
      placeholder={col.type === "uuid" ? "UUID…" : ""}
      className={input_cls}
    />
  )
}

// ── Edit/Add modal ────────────────────────────────────────────────────────────

type ModalState = {
  mode:  "edit" | "add"
  table: string
  row:   Record<string, unknown>
}

const RowEditModal = ({
  state, on_close, on_saved,
}: {
  state: ModalState | null
  on_close: () => void
  on_saved: (table: string) => void
}) => {
  const [draft,          set_draft]          = useState<Record<string, unknown>>({})
  const [saving,         set_saving]         = useState(false)
  const [error,          set_error]          = useState<string | null>(null)
  const [confirm_delete, set_confirm_delete] = useState(false)

  useEffect(() => {
    if (state) {
      set_draft({ ...state.row })
      set_error(null)
      set_confirm_delete(false)
    }
  }, [state])

  if (!state) return null

  const schema = TABLE_SCHEMA[state.table]
  if (!schema) return null

  const set_field = (name: string, value: unknown) =>
    set_draft(prev => ({ ...prev, [name]: value }))

  const handle_save = async () => {
    set_saving(true)
    set_error(null)
    const patch: Record<string, unknown> = {}
    schema.cols.forEach(col => {
      if (col.editable) patch[col.name] = draft[col.name] ?? null
    })
    const { error: err } = state.mode === "edit"
      ? await supabase.from(state.table).update(patch).eq(schema.pk, draft[schema.pk])
      : await supabase.from(state.table).insert(patch)
    if (err) { set_error(err.message); set_saving(false); return }
    on_saved(state.table)
    on_close()
    set_saving(false)
  }

  const handle_delete = async () => {
    set_saving(true)
    const { error: err } = await supabase
      .from(state.table).delete().eq(schema.pk, draft[schema.pk])
    if (err) { set_error(err.message); set_confirm_delete(false); set_saving(false); return }
    on_saved(state.table)
    on_close()
    set_saving(false)
  }

  return (
    <Modal
      open={!!state}
      on_close={on_close}
      title={state.mode === "edit" ? `Edit row` : `Add row`}
      description={state.table}
      size="md"
    >
      <div className="space-y-3 py-1">
        {schema.cols.map(col => (
          <div key={col.name}>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted/50">
                {col.name.replace(/_/g, " ")}
              </span>
              {col.name === schema.pk && (
                <span className="rounded-full bg-royal-gold/10 px-1.5 py-0.5 text-[8px] font-bold text-royal-gold">PK</span>
              )}
              {!col.editable && (
                <span className="rounded-full bg-line/40 px-1.5 py-0.5 text-[8px] text-muted/50">readonly</span>
              )}
            </div>
            <FieldInput col={col} value={draft[col.name]} on_change={v => set_field(col.name, v)} />
          </div>
        ))}

        {error && (
          <p className="rounded-xl border border-flag-red/20 bg-flag-red/8 px-3 py-2 text-xs text-flag-red">
            {error}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="mt-5 flex items-center gap-2 border-t border-line/30 pt-4">
        {/* Delete */}
        {state.mode === "edit" && !confirm_delete && (
          <button
            type="button"
            onClick={() => set_confirm_delete(true)}
            className="flex items-center gap-1.5 rounded-xl border border-flag-red/20 bg-flag-red/8 px-3 py-2 text-xs font-medium text-flag-red transition-colors hover:bg-flag-red/15"
          >
            <TrashIcon size={12} /> Delete
          </button>
        )}
        {confirm_delete && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted">Sure?</span>
            <button
              type="button"
              onClick={handle_delete}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-xl bg-flag-red px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              <CheckIcon size={12} /> Confirm
            </button>
            <button
              type="button"
              onClick={() => set_confirm_delete(false)}
              className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-medium text-muted transition-colors hover:text-ink"
            >
              <XIcon size={12} />
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={on_close}
            className="rounded-xl border border-line px-4 py-2 text-xs font-medium text-muted transition-colors hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handle_save}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl bg-flag-red px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {saving && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
            {state.mode === "edit" ? "Save changes" : "Add row"}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Static config ─────────────────────────────────────────────────────────────

type TableCfg = {
  key:          string
  display_cols: string[]
  position:     { x: number; y: number }
  header_cls:   string
  text_cls:     string
}

const TABLE_CFG: TableCfg[] = [
  { key: "member_permissions", display_cols: ["edit_any_task", "delete_task", "manage_columns"], position: { x: 20,  y: 20  }, header_cls: "bg-purple-500/12", text_cls: "text-purple-400"  },
  { key: "profiles",           display_cols: ["email", "full_name", "role"],                     position: { x: 390, y: 20  }, header_cls: "bg-blue-500/12",   text_cls: "text-blue-400"    },
  { key: "role_permissions",   display_cols: ["role", "edit_any_task", "manage_columns"],        position: { x: 760, y: 20  }, header_cls: "bg-orange-500/12", text_cls: "text-orange-400"  },
  { key: "workspace_statuses", display_cols: ["name", "color", "position"],                      position: { x: 20,  y: 420 }, header_cls: "bg-royal-gold/12", text_cls: "text-royal-gold"  },
  { key: "workspace_tasks",    display_cols: ["title", "type"],                                  position: { x: 390, y: 420 }, header_cls: "bg-flag-red/12",   text_cls: "text-flag-red"    },
  { key: "workspace_comments", display_cols: ["body"],                                           position: { x: 760, y: 420 }, header_cls: "bg-light-green/12",text_cls: "text-light-green" },
]

const EDGE_DEF = [
  { id: "e1", source: "member_permissions", sourceHandle: "s-right",  target: "profiles",           targetHandle: "t-left",  label: "user_id"    },
  { id: "e2", source: "profiles",           sourceHandle: "s-bottom", target: "workspace_tasks",    targetHandle: "t-top",   label: "created_by" },
  { id: "e3", source: "profiles",           sourceHandle: "s-right",  target: "workspace_comments", targetHandle: "t-top",   label: "author_id"  },
  { id: "e4", source: "workspace_statuses", sourceHandle: "s-right",  target: "workspace_tasks",    targetHandle: "t-left",  label: "status_id"  },
  { id: "e5", source: "workspace_tasks",    sourceHandle: "s-right",  target: "workspace_comments", targetHandle: "t-left",  label: "task_id"    },
]

const STATIC_EDGES: Edge[] = EDGE_DEF.map(def => ({
  ...def,
  type: "smoothstep",
  animated: true,
  markerEnd: { type: MarkerType.ArrowClosed, color: "#475569", width: 14, height: 14 },
  style: { stroke: "#475569", strokeWidth: 1.5 },
  labelStyle: { fontSize: 9, fill: "#64748b", fontFamily: "monospace", fontWeight: 700 },
  labelBgStyle: { fill: "var(--color-card, #0f1117)", fillOpacity: 0.9 },
  labelBgPadding: [4, 6] as [number, number],
  labelBgBorderRadius: 4,
}))

// ── Page ──────────────────────────────────────────────────────────────────────

type TableData = { rows: Record<string, unknown>[]; total: number }

export function DatabaseTab() {
  const [data,    set_data]    = useState<Record<string, TableData>>({})
  const [loading, set_loading] = useState(true)
  const [modal,   set_modal]   = useState<ModalState | null>(null)

  const refetch = useCallback(async (table_key: string) => {
    const res = await supabase.from(table_key).select("*", { count: "exact" }).limit(5)
    set_data(prev => ({
      ...prev,
      [table_key]: {
        rows:  (res.data ?? []) as Record<string, unknown>[],
        total: res.count ?? 0,
      },
    }))
  }, [])

  useEffect(() => {
    const fetch_all = async () => {
      const results = await Promise.all(
        TABLE_CFG.map(t => supabase.from(t.key).select("*", { count: "exact" }).limit(5))
      )
      const map: Record<string, TableData> = {}
      TABLE_CFG.forEach((t, i) => {
        map[t.key] = {
          rows:  (results[i].data ?? []) as Record<string, unknown>[],
          total: results[i].count ?? 0,
        }
      })
      set_data(map)
      set_loading(false)
    }
    fetch_all()
  }, [])

  const actions: DbActions = {
    on_edit:   (table, row) => set_modal({ mode: "edit", table, row }),
    on_add:    (table) => {
      const schema = TABLE_SCHEMA[table]
      if (!schema) return
      set_modal({ mode: "add", table, row: default_row(schema) })
    },
    on_delete: (table, row) => set_modal({ mode: "edit", table, row }),
  }

  const nodes: Node[] = TABLE_CFG.map(t => ({
    id:       t.key,
    type:     "table",
    position: t.position,
    data: {
      label:        t.key,
      display_cols: t.display_cols,
      header_cls:   t.header_cls,
      text_cls:     t.text_cls,
      rows:         data[t.key]?.rows  ?? [],
      total:        data[t.key]?.total ?? 0,
    } satisfies TableNodeData,
  }))

  return (
    <div className="flex flex-1 flex-col overflow-hidden">

      {/* Header */}
      <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: ease_out }}
          className="flex shrink-0 items-center gap-3 border-b border-line bg-card px-4 py-3 lg:px-6 lg:py-4"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-flag-red/10 text-flag-red">
            <DbIconLg />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold text-ink">Database</h1>
            <p className="text-[10px] text-muted">
              Live data · {TABLE_CFG.length} tables · hover rows to edit · <span className="text-flag-red">+</span> to add
            </p>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            {TABLE_CFG.map(t => (
              <div key={t.key} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${t.header_cls.replace("/12", "")} opacity-70`} />
                <span className="font-mono text-[9px] text-muted/60">{t.key.replace("workspace_", "")}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Canvas */}
        <div className="relative flex-1">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-flag-red/20 border-t-flag-red" />
                <p className="text-xs text-muted">Loading database…</p>
              </div>
            </div>
          )}

          <DbActionsCtx.Provider value={actions}>
            <ReactFlow
              nodes={nodes}
              edges={STATIC_EDGES}
              nodeTypes={node_types}
              fitView
              fitViewOptions={{ padding: 0.15 }}
              nodesDraggable
              nodesConnectable={false}
              elementsSelectable
              proOptions={{ hideAttribution: true }}
              colorMode={
                typeof document !== "undefined" &&
                document.documentElement.classList.contains("dark")
                  ? "dark" : "light"
              }
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={20} size={1}
                color="var(--color-line, #1e293b)"
              />
              <Controls
                showFitView showZoom showInteractive={false}
                style={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-line)",
                  borderRadius: 12,
                  boxShadow: "none",
                }}
              />
              <MiniMap
                nodeColor={node_minimap_color}
                maskColor="rgba(0,0,0,0.25)"
                style={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-line)",
                  borderRadius: 12,
                }}
              />
            </ReactFlow>
          </DbActionsCtx.Provider>
        </div>

      <RowEditModal
        state={modal}
        on_close={() => set_modal(null)}
        on_saved={refetch}
      />
    </div>
  )
}

const node_minimap_color = (node: Node): string => {
  const d = node.data as TableNodeData
  const map: Record<string, string> = {
    "text-purple-400":  "#a855f7",
    "text-blue-400":    "#60a5fa",
    "text-orange-400":  "#fb923c",
    "text-royal-gold":  "#d4a017",
    "text-flag-red":    "#e53e3e",
    "text-light-green": "#22c55e",
  }
  return map[d.text_cls] ?? "#475569"
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const DbIcon = ({ cls }: { cls: string }) => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    className={cls}
  >
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
    <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
  </svg>
)

const DbIconLg = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
  >
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
    <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
  </svg>
)
