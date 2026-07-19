import { useEffect, useMemo, useState } from "react"
import { motion } from "motion/react"
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
} from "recharts"
import { api, STATUS_COLORS, type WTask, type WStatus, type WProfile, type StatusColor } from "~/features/workspace/lib/workspace"

const ease = [0.22, 1, 0.36, 1] as const

const is_done_status = (name: string) =>
  /done|complete|completed|finished|closed|resolved/i.test(name)

const STATUS_HEX: Record<StatusColor, string> = {
  gray:   "#9ca3af",
  blue:   "#60a5fa",
  yellow: "#eab308",
  green:  "#22c55e",
  red:    "#ef4444",
  purple: "#a855f7",
  orange: "#f97316",
}

// ── Custom recharts tooltip ───────────────────────────────────────────────────

const Tip = ({ active, payload, label }: {
  active?: boolean
  label?: string
  payload?: Array<{ color: string; name: string; value: number }>
}) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-2 shadow-xl">
      {label && <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted/60">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5 text-xs">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
          <span className="font-semibold text-ink">{p.value}</span>
          {p.name && <span className="text-muted">— {p.name}</span>}
        </p>
      ))}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

const Stat = ({
  label, value, sub, accent, children,
}: {
  label: string; value: string | number; sub?: string; accent?: boolean; children?: React.ReactNode
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, ease }}
    className="surface flex flex-col justify-between gap-3 rounded-2xl p-4"
  >
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/60">// {label}</p>
    <div className="flex items-end justify-between gap-2">
      <div>
        <p className={`text-3xl font-bold leading-none ${accent ? "text-flag-red" : "text-ink"}`}>{value}</p>
        {sub && <p className="mt-1 text-[11px] text-muted">{sub}</p>}
      </div>
      {children}
    </div>
  </motion.div>
)

// ── Completion ring ───────────────────────────────────────────────────────────

const Ring = ({ rate }: { rate: number }) => {
  const r = 28
  const circ = 2 * Math.PI * r
  const dash = (rate / 100) * circ
  return (
    <svg width={72} height={72} viewBox="0 0 72 72" className="shrink-0">
      <circle cx="36" cy="36" r={r} fill="none" strokeWidth="7" stroke="currentColor" className="text-line/40" />
      <circle
        cx="36" cy="36" r={r} fill="none" strokeWidth="7"
        stroke="#c0392b" strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        transform="rotate(-90 36 36)"
        style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.22,1,.36,1)" }}
      />
      <text x="36" y="40" textAnchor="middle" fontSize="12" fontWeight="700" fill="currentColor" className="text-ink">{rate}%</text>
    </svg>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

const Panel = ({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, ease }}
    className={`surface rounded-2xl p-4 ${className}`}
  >
    <div className="mb-4 flex items-center gap-2">
      <span className="text-[10px] font-bold text-flag-red/50">//</span>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/60">{title}</p>
      <div className="h-px flex-1 bg-gradient-to-r from-line/60 to-transparent" />
    </div>
    {children}
  </motion.div>
)

// ── Tab component ─────────────────────────────────────────────────────────────

export function AnalyticsTab({ project_id }: { project_id: string }) {
  const [tasks,    set_tasks]    = useState<WTask[]>([])
  const [statuses, set_statuses] = useState<WStatus[]>([])
  const [profiles, set_profiles] = useState<WProfile[]>([])
  const [fetching, set_fetching] = useState(true)

  useEffect(() => {
    Promise.all([
      api.tasks.list(project_id),
      api.statuses.list(project_id),
      api.profiles.list(),
    ]).then(([t, s, p]) => {
      set_tasks((t.data ?? []) as WTask[])
      set_statuses((s.data ?? []) as WStatus[])
      set_profiles((p.data ?? []) as WProfile[])
      set_fetching(false)
    })
  }, [project_id])

  if (fetching) return (
    <div className="flex flex-1 items-center justify-center">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-flag-red" />
    </div>
  )

  return <Body tasks={tasks} statuses={statuses} profiles={profiles} />
}

// ── Body (all charts) ─────────────────────────────────────────────────────────

function Body({ tasks, statuses, profiles }: { tasks: WTask[]; statuses: WStatus[]; profiles: WProfile[] }) {

  const done_ids = useMemo(
    () => new Set(statuses.filter(s => is_done_status(s.name)).map(s => s.id)),
    [statuses],
  )

  // ── Core metrics ──
  const total      = tasks.length
  const done       = tasks.filter(t => done_ids.has(t.status_id ?? "")).length
  const open       = total - done
  const rate       = total ? Math.round((done / total) * 100) : 0
  const unassigned = tasks.filter(t => !t.assigned_to).length
  const bugs       = tasks.filter(t => t.type === "bug").length
  const features   = tasks.filter(t => t.type === "feature").length

  const avg_age = useMemo(() => {
    const open_tasks = tasks.filter(t => !done_ids.has(t.status_id ?? ""))
    if (!open_tasks.length) return 0
    const days = open_tasks.reduce((s, t) =>
      s + (Date.now() - new Date(t.created_at).getTime()) / 86_400_000, 0)
    return Math.round(days / open_tasks.length)
  }, [tasks, done_ids])

  // ── Status distribution ──
  const by_status = useMemo(() =>
    statuses
      .map(s => ({
        name:  s.name,
        value: tasks.filter(t => t.status_id === s.id).length,
        color: STATUS_HEX[s.color],
        done:  is_done_status(s.name),
      }))
      .filter(s => s.value > 0),
    [tasks, statuses],
  )

  // ── Tasks per assignee ──
  const by_assignee = useMemo(() =>
    profiles
      .map(p => ({
        name:     (p.full_name || p.username || "Unknown").split(" ")[0],
        assigned: tasks.filter(t => t.assigned_to === p.id).length,
        created:  tasks.filter(t => t.created_by === p.id).length,
      }))
      .filter(p => p.assigned > 0 || p.created > 0)
      .sort((a, b) => b.assigned - a.assigned),
    [tasks, profiles],
  )

  // ── 30-day creation trend ──
  const trend = useMemo(() => {
    const days = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const day = tasks.filter(t => t.created_at.startsWith(key))
      days.push({
        date:     d.toLocaleDateString("en", { month: "short", day: "numeric" }),
        tasks:    day.length,
        features: day.filter(t => t.type === "feature").length,
        bugs:     day.filter(t => t.type === "bug").length,
      })
    }
    return days
  }, [tasks])

  // ── Top contributors (created + assigned combined) ──
  const contributors = useMemo(() =>
    profiles
      .map(p => ({
        name:     p.full_name || p.username || "User",
        avatar:   p.avatar_url,
        created:  tasks.filter(t => t.created_by === p.id).length,
        assigned: tasks.filter(t => t.assigned_to === p.id).length,
        done:     tasks.filter(t => t.created_by === p.id && done_ids.has(t.status_id ?? "")).length,
      }))
      .filter(p => p.created > 0 || p.assigned > 0)
      .sort((a, b) => (b.created + b.assigned) - (a.created + a.assigned)),
    [tasks, profiles, done_ids],
  )

  const tick_style = { fontSize: 10, fill: "var(--color-muted)" } as const
  const grid_props = { stroke: "var(--color-line)", strokeOpacity: 0.5, strokeDasharray: "3 3" } as const

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-6">
      <div className="space-y-5">

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">

          <Stat label="Total tasks" value={total} sub={`${features} features · ${bugs} bugs`}>
            <TasksIcon />
          </Stat>

          <Stat label="Completion rate" value={`${rate}%`} sub={`${done} of ${total} done`} accent>
            <Ring rate={rate} />
          </Stat>

          <Stat label="Open tasks" value={open} sub={`${unassigned} unassigned`}>
            <OpenIcon />
          </Stat>

          <Stat label="Avg age (open)" value={avg_age === 0 ? "—" : `${avg_age}d`} sub="days since created">
            <ClockIcon />
          </Stat>

        </div>

        {/* ── Status distribution + Assignees ── */}
        <div className="grid gap-5 lg:grid-cols-5">

          {/* Status donut */}
          <Panel title="Status distribution" className="lg:col-span-2">
            {by_status.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted/50">No tasks yet</p>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={by_status} cx="50%" cy="50%"
                      innerRadius={50} outerRadius={80}
                      paddingAngle={2} dataKey="value"
                    >
                      {by_status.map((s, i) => (
                        <Cell key={i} fill={s.color} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip content={<Tip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full space-y-1.5">
                  {by_status.map((s, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                        <span className="text-muted">{s.name}</span>
                      </div>
                      <span className="font-semibold text-ink">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          {/* Assignee bar chart */}
          <Panel title="Tasks per assignee" className="lg:col-span-3">
            {by_assignee.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted/50">No assignments yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={by_assignee} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <CartesianGrid horizontal={false} {...grid_props} />
                  <XAxis type="number" tick={tick_style} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={tick_style} axisLine={false} tickLine={false} width={64} />
                  <Tooltip content={<Tip />} cursor={{ fill: "var(--color-line)", fillOpacity: 0.3 }} />
                  <Bar dataKey="assigned" name="Assigned" fill="#c0392b" radius={[0, 4, 4, 0]} maxBarSize={20} />
                  <Bar dataKey="created"  name="Created"  fill="#60a5fa" radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="mt-2 flex items-center gap-4 text-[10px] text-muted/60">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-flag-red" /> Assigned to</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400" /> Created by</span>
            </div>
          </Panel>

        </div>

        {/* ── 30-day trend ── */}
        <Panel title="Task creation — last 30 days">
          {trend.every(d => d.tasks === 0) ? (
            <p className="py-8 text-center text-sm text-muted/50">No tasks created in the last 30 days</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#60a5fa" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="gb" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#c0392b" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#c0392b" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid {...grid_props} />
                <XAxis dataKey="date" tick={tick_style} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={tick_style} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<Tip />} />
                <Area type="monotone" dataKey="features" name="Features" stroke="#60a5fa" strokeWidth={2} fill="url(#gf)" dot={false} />
                <Area type="monotone" dataKey="bugs"     name="Bugs"     stroke="#c0392b" strokeWidth={2} fill="url(#gb)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
          <div className="mt-2 flex items-center gap-4 text-[10px] text-muted/60">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400" /> Features</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-flag-red" /> Bugs</span>
          </div>
        </Panel>

        {/* ── Type split + Contributors ── */}
        <div className="grid gap-5 lg:grid-cols-2">

          {/* Feature vs Bug donut */}
          <Panel title="Feature vs bug split">
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={[
                    { name: "Features", value: features, color: "#60a5fa" },
                    { name: "Bugs",     value: bugs,     color: "#c0392b" },
                  ]} cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={3} dataKey="value">
                    <Cell fill="#60a5fa" stroke="transparent" />
                    <Cell fill="#c0392b" stroke="transparent" />
                  </Pie>
                  <Tooltip content={<Tip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-3">
                <TypeRow label="Features" value={features} total={total} color="#60a5fa" />
                <TypeRow label="Bugs"     value={bugs}     total={total} color="#c0392b" />
                <div className="border-t border-line/40 pt-2">
                  <p className="text-[11px] text-muted">
                    Bug rate: <span className="font-semibold text-ink">{total ? Math.round((bugs / total) * 100) : 0}%</span>
                  </p>
                </div>
              </div>
            </div>
          </Panel>

          {/* Top contributors */}
          <Panel title="Top contributors">
            {contributors.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted/50">No activity yet</p>
            ) : (
              <div className="space-y-2">
                {contributors.slice(0, 6).map((c, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-4 shrink-0 text-right text-[10px] font-bold text-muted/40">{i + 1}</span>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-line/40 text-[10px] font-bold text-muted">
                      {c.avatar
                        ? <img src={c.avatar} alt="" className="h-full w-full object-cover" />
                        : c.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="truncate text-xs font-medium text-ink">{c.name}</p>
                        <p className="shrink-0 text-[11px] text-muted">{c.created + c.assigned} total</p>
                      </div>
                      <div className="mt-1 flex gap-0.5 overflow-hidden rounded-full">
                        {c.created > 0 && (
                          <div
                            className="h-1.5 bg-blue-400/70"
                            style={{ width: `${(c.created / (c.created + c.assigned)) * 100}%` }}
                          />
                        )}
                        {c.assigned > 0 && (
                          <div
                            className="h-1.5 bg-flag-red/70"
                            style={{ width: `${(c.assigned / (c.created + c.assigned)) * 100}%` }}
                          />
                        )}
                      </div>
                      <div className="mt-0.5 flex gap-3 text-[9px] text-muted/60">
                        <span>{c.created} created</span>
                        <span>{c.assigned} assigned</span>
                        <span>{c.done} done</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex items-center gap-4 text-[10px] text-muted/60">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400/70" /> Created</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-flag-red/70" /> Assigned</span>
            </div>
          </Panel>

        </div>

      </div>
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

const TypeRow = ({ label, value, total, color }: { label: string; value: number; total: number; color: string }) => (
  <div>
    <div className="flex justify-between text-xs">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line/40">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${total ? (value / total) * 100 : 0}%`, background: color }}
      />
    </div>
  </div>
)

// ── Icons ─────────────────────────────────────────────────────────────────────

const ip = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }

const ChartIcon  = () => <svg {...ip}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
const TasksIcon  = () => <svg {...ip} className="text-muted/30" width={32} height={32}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12h6M9 8h6M9 16h4"/></svg>
const OpenIcon   = () => <svg {...ip} className="text-muted/30" width={32} height={32}><circle cx="12" cy="12" r="9"/><path d="M12 8v4l2 2"/></svg>
const ClockIcon  = () => <svg {...ip} className="text-muted/30" width={32} height={32}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
