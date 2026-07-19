import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { motion } from "motion/react"
import { useAuth } from "~/features/auth/lib/auth"
import { useProfile } from "~/features/profile/lib/profile-context"
import { SideRail } from "~/components/ui/side-rail"
import { use_notify } from "~/hooks/use-notify"
import { SearchInput } from "~/components/ui/search-input"
import { Dropdown } from "~/components/ui/dropdown"
import { ProjectModal } from "~/features/workspace/components/project-modal"
import {
  PlusIcon, PencilIcon, LockIcon, GlobeIcon, ChevronIcon,
} from "~/components/ui/icons"
import {
  api, fmt_rel, STATUS_COLORS,
  type WProject, type WProfile,
} from "~/features/workspace/lib/workspace"

export const meta = () => [{ title: "Workspace — Onyx Dev" }]

const ease_out = [0.22, 1, 0.36, 1] as const

// ── Grid/list view toggle icons ───────────────────────────────────────────────

const GridViewIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" />
    <rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" />
  </svg>
)
const ListViewIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
  </svg>
)
const KanbanIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="4" height="14" rx="1.5" /><rect x="10" y="3" width="4" height="9" rx="1.5" /><rect x="17" y="3" width="4" height="11" rx="1.5" />
  </svg>
)

// ── Project card (grid) ────────────────────────────────────────────────────────

const ProjectCard = ({
  project, task_count, owner_label, can_edit, on_open, on_edit,
}: {
  project:     WProject
  task_count:  number
  owner_label: string | null
  can_edit:    boolean
  on_open:     () => void
  on_edit:     () => void
}) => {
  const c = STATUS_COLORS[project.color]
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18 }}
      onClick={on_open}
      className="surface group relative flex cursor-pointer flex-col gap-3 rounded-2xl p-4 transition-shadow hover:shadow-lg"
    >
      {can_edit && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); on_edit() }}
          title="Edit project"
          className="absolute right-3 top-3 grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-muted opacity-0 transition-opacity hover:bg-line/50 hover:text-ink group-hover:opacity-100"
        >
          <PencilIcon size={12} />
        </button>
      )}

      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${c.badge}`}>
          <KanbanIcon />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{project.name}</p>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted">
            {project.visibility === "public" ? <GlobeIcon size={9} /> : <LockIcon size={9} />}
            {project.visibility}
          </span>
        </div>
      </div>

      <p className="line-clamp-2 min-h-[2.2em] text-xs text-muted">
        {project.description || <span className="italic text-muted/50">No description</span>}
      </p>

      <div className="flex items-center justify-between border-t border-line/50 pt-3 text-[11px] text-muted">
        <span>{task_count} task{task_count !== 1 ? "s" : ""}</span>
        <span>{owner_label ? `${owner_label} · ` : ""}{fmt_rel(project.updated_at)}</span>
      </div>
    </motion.div>
  )
}

// ── Project row (list) ─────────────────────────────────────────────────────────

const ProjectRow = ({
  project, task_count, owner_label, can_edit, on_open, on_edit,
}: {
  project:     WProject
  task_count:  number
  owner_label: string | null
  can_edit:    boolean
  on_open:     () => void
  on_edit:     () => void
}) => {
  const c = STATUS_COLORS[project.color]
  return (
    <tr onClick={on_open} className="group cursor-pointer border-b border-line/50 transition-colors last:border-0 hover:bg-flag-red/[0.03] dark:hover:bg-flag-red/[0.05]">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${c.badge}`}>
            <KanbanIcon />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{project.name}</p>
            <p className="truncate text-[11px] text-muted">{project.description || "—"}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
          {project.visibility === "public" ? <GlobeIcon size={9} /> : <LockIcon size={9} />}
          {project.visibility}
        </span>
      </td>
      <td className="hidden px-4 py-3 text-xs text-muted sm:table-cell">{task_count}</td>
      <td className="hidden px-4 py-3 text-[11px] text-muted md:table-cell">{owner_label ?? "—"}</td>
      <td className="hidden px-4 py-3 text-[11px] text-muted lg:table-cell">{fmt_rel(project.updated_at)}</td>
      <td className="px-4 py-3 text-right">
        {can_edit ? (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); on_edit() }}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[11px] font-medium text-muted transition-colors hover:border-flag-red/40 hover:text-flag-red"
          >
            <PencilIcon size={11} /> Edit
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[11px] font-medium text-muted transition-colors group-hover:border-flag-red/40 group-hover:text-flag-red">
            Open <ChevronIcon size={11} className="-rotate-90" />
          </span>
        )}
      </td>
    </tr>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

const VIEW_KEY = "workspace_view"

export default function WorkspacePage() {
  const { user, loading: auth_loading } = useAuth()
  const { profile } = useProfile()
  const notify = use_notify()
  const navigate = useNavigate()
  const is_root = profile?.role === "root"

  const [projects,   set_projects]   = useState<WProject[]>([])
  const [counts,     set_counts]     = useState<Map<string, number>>(new Map())
  const [profiles,   set_profiles]   = useState<Map<string, WProfile>>(new Map())
  const [fetching,   set_fetching]   = useState(true)
  const [search,     set_search]     = useState("")
  const [owner_f,    set_owner_f]    = useState("all")
  const [view,       set_view]       = useState<"grid" | "list">(
    () => (typeof window !== "undefined" && localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid"),
  )
  const [modal_open, set_modal_open] = useState(false)
  const [editing,    set_editing]    = useState<WProject | null>(null)

  const load = () => {
    Promise.all([api.projects.list(), api.tasks.count_by_project(), api.profiles.list()]).then(
      ([pr, tc, pf]) => {
        if (pr.error) { notify({ tone: "error", title: "Failed to load projects", message: pr.error.message }); set_fetching(false); return }
        set_projects((pr.data as WProject[]) ?? [])

        const cmap = new Map<string, number>()
        ;((tc.data ?? []) as { project_id: string }[]).forEach(t => cmap.set(t.project_id, (cmap.get(t.project_id) ?? 0) + 1))
        set_counts(cmap)

        const pmap = new Map<string, WProfile>()
        ;((pf.data ?? []) as WProfile[]).forEach(p => pmap.set(p.id, p))
        set_profiles(pmap)

        set_fetching(false)
      },
    )
  }

  useEffect(() => { load() }, [])

  const set_view_persist = (v: "grid" | "list") => {
    set_view(v)
    localStorage.setItem(VIEW_KEY, v)
  }

  const owner_label = (project: WProject): string | null => {
    if (!user) return null
    if (project.owner_id === user.id) return "You"
    const owner = project.owner_id ? profiles.get(project.owner_id) : null
    return owner?.full_name || owner?.username || null
  }

  const q = search.trim().toLowerCase()
  const filtered = useMemo(() => projects.filter(p => {
    if (q && !p.name.toLowerCase().includes(q) && !p.description?.toLowerCase().includes(q)) return false
    if (owner_f === "mine" && p.owner_id !== user?.id) return false
    if (owner_f === "public" && p.visibility !== "public") return false
    return true
  }), [projects, q, owner_f, user?.id])

  const open_create = () => { set_editing(null); set_modal_open(true) }
  const open_edit = (p: WProject) => { set_editing(p); set_modal_open(true) }

  const on_saved = (p: WProject) => {
    set_projects(prev => {
      const idx = prev.findIndex(x => x.id === p.id)
      return idx >= 0 ? prev.map(x => x.id === p.id ? p : x) : [p, ...prev]
    })
  }
  const on_deleted = (id: string) => {
    set_projects(prev => prev.filter(p => p.id !== id))
  }

  if (auth_loading) return null
  if (!user) return null

  const owner_filter_opts = [
    { value: "all",    label: "All projects" },
    { value: "mine",   label: "Mine" },
    { value: "public", label: "Public" },
  ]

  return (
    <div className="flex h-full overflow-hidden">
      <SideRail />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden pt-14 lg:pt-0">

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: ease_out }}
          className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line bg-card px-4 py-3 lg:px-6 lg:py-4"
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-flag-red">//</span>
            <h1 className="text-sm font-semibold tracking-tight text-ink">Workspace</h1>
            <span className="text-[11px] text-muted">
              {fetching ? "Loading…" : `${projects.length} project${projects.length !== 1 ? "s" : ""}`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={search} on_change={set_search} placeholder="Search projects…" class_name="w-40 lg:w-56" />

            <Dropdown value={owner_f} options={owner_filter_opts} on_select={set_owner_f} menu_width="w-36"
              trigger_class="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card/60 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-flag-red/40 hover:text-ink"
            >
              {({ open }) => (
                <>
                  {owner_filter_opts.find(o => o.value === owner_f)?.label}
                  <ChevronIcon size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                </>
              )}
            </Dropdown>

            <div className="flex items-center gap-0.5 rounded-lg border border-line bg-line/20 p-0.5">
              <button
                type="button"
                onClick={() => set_view_persist("grid")}
                title="Grid view"
                className={`grid h-7 w-7 cursor-pointer place-items-center rounded-md transition-colors ${view === "grid" ? "bg-card text-flag-red shadow-sm" : "text-muted hover:text-ink"}`}
              >
                <GridViewIcon />
              </button>
              <button
                type="button"
                onClick={() => set_view_persist("list")}
                title="List view"
                className={`grid h-7 w-7 cursor-pointer place-items-center rounded-md transition-colors ${view === "list" ? "bg-card text-flag-red shadow-sm" : "text-muted hover:text-ink"}`}
              >
                <ListViewIcon />
              </button>
            </div>

            <button
              type="button"
              onClick={open_create}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-flag-red px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-80"
            >
              <PlusIcon size={12} />
              New project
            </button>
          </div>
        </motion.div>

        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          {fetching ? (
            view === "grid" ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="surface flex flex-col gap-3 rounded-2xl p-4">
                    <div className="h-9 w-9 animate-pulse rounded-xl bg-line/40" />
                    <div className="h-3 w-32 animate-pulse rounded bg-line/40" />
                    <div className="h-8 animate-pulse rounded bg-line/30" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="surface overflow-hidden rounded-2xl">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 border-b border-line/50 px-4 py-3 last:border-0">
                    <div className="h-8 w-8 animate-pulse rounded-lg bg-line/40" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 w-32 animate-pulse rounded bg-line/40" />
                      <div className="h-2 w-48 animate-pulse rounded bg-line/30" />
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : filtered.length === 0 ? (
            <div className="surface flex flex-col items-center gap-4 rounded-2xl px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-line/40 text-muted">
                <KanbanIcon />
              </div>
              {projects.length === 0 ? (
                <>
                  <div>
                    <p className="text-sm font-semibold text-ink">No projects yet</p>
                    <p className="mt-1 text-xs text-muted">Create a project to get a kanban board for its tasks</p>
                  </div>
                  <button
                    type="button"
                    onClick={open_create}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-flag-red px-3.5 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-80"
                  >
                    <PlusIcon size={12} />
                    New project
                  </button>
                </>
              ) : (
                <p className="text-sm text-muted">No projects match your filters.</p>
              )}
            </div>
          ) : view === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map(p => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  task_count={counts.get(p.id) ?? 0}
                  owner_label={owner_label(p)}
                  can_edit={p.owner_id === user.id || is_root}
                  on_open={() => navigate(`/workspace/${p.id}`)}
                  on_edit={() => open_edit(p)}
                />
              ))}
            </div>
          ) : (
            <div className="surface overflow-hidden rounded-2xl">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line/60 text-[10px] uppercase tracking-widest text-muted">
                    <th className="px-4 py-2.5 font-medium">Project</th>
                    <th className="px-4 py-2.5 font-medium">Visibility</th>
                    <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Tasks</th>
                    <th className="hidden px-4 py-2.5 font-medium md:table-cell">Owner</th>
                    <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Updated</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <ProjectRow
                      key={p.id}
                      project={p}
                      task_count={counts.get(p.id) ?? 0}
                      owner_label={owner_label(p)}
                      can_edit={p.owner_id === user.id || is_root}
                      on_open={() => navigate(`/workspace/${p.id}`)}
                      on_edit={() => open_edit(p)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <ProjectModal
        open={modal_open}
        editing={editing}
        owner_id={user.id}
        on_close={() => set_modal_open(false)}
        on_saved={on_saved}
        on_deleted={on_deleted}
      />
    </div>
  )
}
