import { useEffect, useMemo, useState } from "react"
import { motion } from "motion/react"
import { AreaChart, Area, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts"
import { useAuth } from "~/features/auth/lib/auth"
import { SideRail } from "~/components/ui/side-rail"
import { use_notify } from "~/hooks/use-notify"
import { SearchInput } from "~/components/ui/search-input"
import { Dropdown } from "~/components/ui/dropdown"
import { Modal } from "~/components/ui/modal"
import { Table, type TableColumn } from "~/components/ui/table"
import { ConfirmPopover } from "~/components/ui/confirm-popover"
import { supabase } from "~/lib/supabase"
import { ServiceModal } from "~/features/subscriptions/components/service-modal"
import { EntryModal } from "~/features/subscriptions/components/entry-modal"
import {
  PlusIcon, PencilIcon, TrashIcon, WalletIcon, ChevronIcon, ArrowUpIcon, ArrowDownIcon, RefreshIcon,
  TrendingUpIcon, TrendingDownIcon,
} from "~/components/ui/icons"
import {
  api, COLOR_TONE, CYCLE_LABEL, monthly_equivalent, next_renewal, days_until, fmt_money, fmt_date,
  compute_auto_entries, compute_auto_entries_for_all,
  type Service, type Entry, type EntryKind,
} from "~/features/subscriptions/lib/subscriptions"

export const meta = () => [{ title: "Subscriptions — Onyx Dev" }]

const ease_out = [0.22, 1, 0.36, 1] as const

// ── Small shared bits ──────────────────────────────────────────────────────────

const initials = (name: string) => name.trim().slice(0, 2).toUpperCase() || "?"

// Tone for a header stat, driven by the sign of the money it represents —
// positive flow reads as gain (green), negative as loss (red), zero stays neutral.
const flow_tone = (n: number): "gain" | "loss" | undefined =>
  n > 0 ? "gain" : n < 0 ? "loss" : undefined

const net_of = (service_id: string, entries: Entry[]) =>
  entries.reduce((sum, e) => e.service_id === service_id ? sum + (e.kind === "income" ? e.amount : -e.amount) : sum, 0)

const running_balance = (service_id: string, entries: Entry[]) => {
  const own = entries.filter(e => e.service_id === service_id).sort((a, b) => a.occurred_on.localeCompare(b.occurred_on))
  let bal = 0
  return own.map(e => {
    bal += e.kind === "income" ? e.amount : -e.amount
    return { date: e.occurred_on, balance: Math.round(bal * 100) / 100 }
  })
}

const ChartTip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  const v = payload[0].value
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-2 text-xs shadow-xl">
      {label && <p className="mb-1 text-[10px] uppercase tracking-wide text-muted/60">{fmt_date(label)}</p>}
      <p className={`font-semibold ${v >= 0 ? "text-light-green" : "text-loss"}`}>{fmt_money(v)}</p>
    </div>
  )
}

// ── Sparkline (mini, no axes) ──────────────────────────────────────────────────

const Sparkline = ({ service_id, entries }: { service_id: string; entries: Entry[] }) => {
  const points = running_balance(service_id, entries)
  if (points.length < 2) {
    return <div className="flex h-7 items-center text-[10px] italic text-muted/50">No entries yet</div>
  }
  const positive = points[points.length - 1].balance >= 0
  const color = positive ? "var(--color-light-green)" : "var(--color-loss)"
  return (
    <ResponsiveContainer width="100%" height={28}>
      <AreaChart data={points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <Area type="monotone" dataKey="balance" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Service table columns ──────────────────────────────────────────────────────

const build_service_columns = (
  entries: Entry[],
  on_edit: (s: Service) => void,
  deleting_id: string | null,
  on_confirm_delete: (id: string) => void,
): TableColumn<Service>[] => [
  {
    key: "service",
    header: "Service",
    cell: s => (
      <div className={`flex items-center gap-3 ${s.status !== "active" ? "opacity-60" : ""}`}>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${COLOR_TONE[s.color].badge}`}>
          {initials(s.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{s.name}</p>
          <p className="truncate text-[10px] uppercase tracking-wide text-muted">{s.category || "Uncategorised"}</p>
        </div>
        {s.status !== "active" && (
          <span className="ml-1 shrink-0 rounded-full bg-line/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted">{s.status}</span>
        )}
      </div>
    ),
  },
  {
    key: "cost",
    className: "hidden text-xs text-muted sm:table-cell",
    header: "Cost",
    cell: s => s.recurring_amount && s.recurring_cycle
      ? `$${s.recurring_amount.toFixed(2)}/${CYCLE_LABEL[s.recurring_cycle].slice(0, 2)}`
      : "Pay as you go",
  },
  {
    key: "renewal",
    header: "Renewal",
    className: "hidden md:table-cell",
    cell: s => {
      if (s.status !== "active") return <span className="text-xs text-muted/50">—</span>
      const renewal = next_renewal(s, entries)
      if (!renewal) return <span className="text-xs text-muted/50">—</span>
      const due_in = days_until(renewal)
      return (
        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${due_in <= 7 ? "bg-royal-gold/15 text-royal-gold" : "bg-line/40 text-muted"}`}>
          {due_in < 0 ? "overdue" : `${due_in}d`}
        </span>
      )
    },
  },
  {
    key: "trend",
    header: "Trend",
    className: "hidden w-28 lg:table-cell",
    cell: s => <Sparkline service_id={s.id} entries={entries} />,
  },
  {
    key: "net",
    header: "Net",
    align: "right",
    cell: s => {
      const net = net_of(s.id, entries)
      return <span className={`text-sm font-bold tabular-nums ${net >= 0 ? "text-light-green" : "text-loss"}`}>{fmt_money(net)}</span>
    },
  },
  {
    key: "actions",
    header: "",
    align: "right",
    className: "w-16",
    cell: s => (
      <div className="flex items-center justify-end gap-0.5 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
        <button
          type="button"
          onClick={e => { e.stopPropagation(); on_edit(s) }}
          title="Edit service"
          className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-muted transition-colors hover:bg-line/50 hover:text-ink"
        >
          <PencilIcon size={12} />
        </button>
        <ConfirmPopover
          message={`Delete "${s.name}"? This removes the service and its whole ledger.`}
          busy={deleting_id === s.id}
          on_confirm={() => on_confirm_delete(s.id)}
          trigger={({ onClick }) => (
            <button
              type="button"
              onClick={onClick}
              title="Delete service"
              className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-muted transition-colors hover:bg-flag-red/10 hover:text-flag-red"
            >
              <TrashIcon size={12} />
            </button>
          )}
        />
      </div>
    ),
  },
]

// ── Ledger row ──────────────────────────────────────────────────────────────────

const LedgerRow = ({ entry, on_edit, on_delete }: { entry: Entry; on_edit: () => void; on_delete: () => void }) => (
  <tr className="group border-b border-line/40 last:border-0 even:bg-muted/[0.08]">
    <td className="py-2 pl-3 pr-3 text-[11px] text-muted">{fmt_date(entry.occurred_on)}</td>
    <td className="py-2 pr-3">
      <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase ${entry.kind === "income" ? "bg-light-green/15 text-light-green" : "bg-loss/10 text-loss"}`}>
        {entry.kind === "income" ? <ArrowUpIcon size={9} /> : <ArrowDownIcon size={9} />}
        {entry.kind === "income" ? "Gain" : "Spend"}
      </span>
    </td>
    <td className="py-2 pr-3 text-xs text-ink">
      {entry.note || <span className="italic text-muted/40">—</span>}
      {entry.source === "auto" && (
        <span className="ml-1.5 rounded-md bg-line/50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted" title="Auto-logged from recurring cycle">
          Auto
        </span>
      )}
    </td>
    <td className={`py-2 pr-2 text-right text-xs font-semibold tabular-nums ${entry.kind === "income" ? "text-light-green" : "text-loss"}`}>
      {entry.kind === "income" ? "+" : "-"}{fmt_money(entry.amount).replace("-", "")}
    </td>
    <td className="w-14 py-2 pr-1">
      <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button onClick={on_edit} className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-line/40 hover:text-ink"><PencilIcon size={11} /></button>
        <button onClick={on_delete} className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-flag-red/10 hover:text-flag-red"><TrashIcon size={11} /></button>
      </div>
    </td>
  </tr>
)

// ── Detail modal ────────────────────────────────────────────────────────────────

const DetailModal = ({
  service, entries, on_close, on_edit_service, on_log, on_edit_entry, on_delete_entry,
}: {
  service:          Service | null
  entries:          Entry[]
  on_close:         () => void
  on_edit_service:  () => void
  on_log:           (kind: EntryKind) => void
  on_edit_entry:    (e: Entry) => void
  on_delete_entry:  (id: string) => Promise<void>
}) => {
  if (!service) return null

  const tone   = COLOR_TONE[service.color]
  const own    = entries.filter(e => e.service_id === service.id).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))
  const net    = net_of(service.id, entries)
  const chart  = running_balance(service.id, entries)
  const renewal = next_renewal(service, entries)

  const subtitle = [
    service.category || "Uncategorised",
    service.recurring_amount && service.recurring_cycle
      ? `$${service.recurring_amount.toFixed(2)}/${CYCLE_LABEL[service.recurring_cycle]}`
      : "Pay as you go",
    service.recurring_cycle && service.start_date ? `since ${fmt_date(service.start_date)}` : null,
    renewal ? `renews ${fmt_date(renewal.toISOString())}` : null,
  ].filter(Boolean).join(" · ")

  return (
    <Modal open={!!service} on_close={on_close} title={service.name} description="// subscriptions" size="xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${tone.badge}`}>
            {initials(service.name)}
          </span>
          <div>
            <div className="flex items-center gap-2">
              {service.status !== "active" && (
                <span className="rounded-full bg-line/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted">{service.status}</span>
              )}
            </div>
            <p className="text-[11px] text-muted">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className={`text-xl font-bold tabular-nums ${net >= 0 ? "text-light-green" : "text-loss"}`}>{fmt_money(net)}</p>
            <p className="text-[9.5px] uppercase tracking-wide text-muted">net, all time</p>
          </div>
          <button onClick={on_edit_service} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted transition-colors hover:bg-line/40 hover:text-ink" title="Edit service">
            <PencilIcon size={13} />
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => on_log("expense")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-loss/30 bg-loss/5 px-3 py-1.5 text-xs font-medium text-loss transition-colors hover:bg-loss/10"
        >
          <PlusIcon size={11} /> Log spend
        </button>
        <button
          onClick={() => on_log("income")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-light-green/30 bg-light-green/5 px-3 py-1.5 text-xs font-medium text-light-green transition-colors hover:bg-light-green/10"
        >
          <PlusIcon size={11} /> Log gain
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <p className="mb-2 text-[9.5px] font-semibold uppercase tracking-wide text-muted">Entries</p>
          <div className="h-[280px] overflow-y-auto rounded-xl border border-line/40 bg-page/50">
            {own.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 border-dashed text-center">
                <p className="text-xs text-muted">No entries yet</p>
                <p className="text-[11px] text-muted/60">Log your first spend or gain above</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="sticky top-0 border-b border-line/60 bg-card text-[9px] uppercase tracking-widest text-muted">
                      <th className="py-1.5 pl-3 pr-3 text-left font-medium">Date</th>
                      <th className="py-1.5 pr-3 text-left font-medium">Type</th>
                      <th className="py-1.5 pr-3 text-left font-medium">Note</th>
                      <th className="py-1.5 pr-2 text-right font-medium">Amount</th>
                      <th className="w-14" />
                    </tr>
                  </thead>
                  <tbody>
                    {own.map(e => (
                      <LedgerRow key={e.id} entry={e} on_edit={() => on_edit_entry(e)} on_delete={() => on_delete_entry(e.id)} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <p className="mb-2 text-[9.5px] font-semibold uppercase tracking-wide text-muted">Running balance</p>
          <div className="h-[280px] rounded-xl border border-line/40 p-2">
            {chart.length < 2 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted/50">Not enough data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="net_fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={net >= 0 ? "var(--color-light-green)" : "var(--color-loss)"} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={net >= 0 ? "var(--color-light-green)" : "var(--color-loss)"} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-line)" strokeOpacity={0.5} strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--color-muted)" }} axisLine={false} tickLine={false} tickFormatter={d => fmt_date(d).replace(/, \d+$/, "")} />
                  <YAxis tick={{ fontSize: 9, fill: "var(--color-muted)" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Area type="monotone" dataKey="balance" stroke={net >= 0 ? "var(--color-light-green)" : "var(--color-loss)"} strokeWidth={2} fill="url(#net_fill)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const { user } = useAuth()
  const notify = use_notify()

  const [services, set_services] = useState<Service[]>([])
  const [entries,  set_entries]  = useState<Entry[]>([])
  const [fetching, set_fetching] = useState(true)

  const [search,     set_search]     = useState("")
  const [category_f, set_category_f] = useState("all")
  const [status_f,   set_status_f]   = useState("all")
  const [selected_id, set_selected_id] = useState<string | null>(null)
  const [deleting_id, set_deleting_id] = useState<string | null>(null)

  const [service_modal_open, set_service_modal_open] = useState(false)
  const [editing_service,    set_editing_service]    = useState<Service | null>(null)

  const [entry_modal_open, set_entry_modal_open] = useState(false)
  const [entry_service_id, set_entry_service_id] = useState<string | null>(null)
  const [editing_entry,    set_editing_entry]    = useState<Entry | null>(null)
  const [default_kind,     set_default_kind]     = useState<EntryKind>("expense")

  const load = async () => {
    const [s, e] = await Promise.all([api.services.list(), api.entries.list_all()])
    if (s.error) notify({ tone: "error", title: "Failed to load services", message: s.error.message })
    const svc = (s.data as Service[]) ?? []
    const ent = (e.data as Entry[]) ?? []

    // Backfill any recurring payments due since each service was registered,
    // then re-load so the table reflects server-assigned rows. Idempotent —
    // a re-run finds nothing left to insert once entries exist for a date.
    const missing = compute_auto_entries_for_all(svc, ent)
    if (missing.length) {
      const { error } = await api.entries.bulk_create(missing)
      if (error) {
        notify({ tone: "error", title: "Failed to auto-log recurring payments", message: error.message })
      } else {
        set_services(svc)
        set_fetching(false)
        return load()
      }
    }

    set_services(svc)
    set_entries(ent)
    set_fetching(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!user) return
    const ch = supabase
      .channel(`finance_${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_services", filter: `user_id=eq.${user.id}` }, () => {
        api.services.list().then(({ data }) => { if (data) set_services(data as Service[]) })
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_entries", filter: `user_id=eq.${user.id}` }, () => {
        api.entries.list_all().then(({ data }) => { if (data) set_entries(data as Entry[]) })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user?.id])

  const categories = useMemo(
    () => Array.from(new Set(services.map(s => s.category).filter(Boolean))) as string[],
    [services],
  )

  const q = search.trim().toLowerCase()
  const filtered = services.filter(s => {
    if (q && !s.name.toLowerCase().includes(q) && !s.category?.toLowerCase().includes(q)) return false
    if (category_f !== "all" && s.category !== category_f) return false
    if (status_f !== "all" && s.status !== status_f) return false
    return true
  })

  const total_spent  = entries.filter(e => e.kind === "expense").reduce((s, e) => s + e.amount, 0)
  const total_gained = entries.filter(e => e.kind === "income").reduce((s, e) => s + e.amount, 0)
  const net_all       = total_gained - total_spent
  const monthly_recurring = services
    .filter(s => s.status === "active" && s.recurring_amount && s.recurring_cycle)
    .reduce((sum, s) => sum + monthly_equivalent(s.recurring_amount!, s.recurring_cycle!), 0)

  const selected = services.find(s => s.id === selected_id) ?? null

  const open_create_service = () => { set_editing_service(null); set_service_modal_open(true) }
  const open_edit_service   = (s: Service) => { set_editing_service(s); set_service_modal_open(true) }

  const on_service_saved = async (s: Service) => {
    set_services(prev => {
      const idx = prev.findIndex(x => x.id === s.id)
      return idx >= 0 ? prev.map(x => x.id === s.id ? s : x) : [s, ...prev]
    })
    set_selected_id(prev => prev ?? s.id)

    // A new/edited recurring service can be immediately overdue for backfill
    // (e.g. a past start date) — without this, renewal/net/trend stay blank
    // until the next full load() re-runs the backfill.
    const missing = compute_auto_entries(s, entries)
    if (missing.length) {
      const { data, error } = await api.entries.bulk_create(missing)
      if (error) notify({ tone: "error", title: "Failed to auto-log recurring payments", message: error.message })
      else if (data) set_entries(prev => [...prev, ...(data as Entry[])])
    }
  }
  const on_service_deleted = (id: string) => {
    set_services(prev => prev.filter(s => s.id !== id))
    set_entries(prev => prev.filter(e => e.service_id !== id))
    set_selected_id(prev => prev === id ? null : prev)
  }

  const delete_service_row = async (id: string) => {
    set_deleting_id(id)
    const { error } = await api.services.remove(id)
    if (error) notify({ tone: "error", title: "Failed to delete", message: error.message })
    else on_service_deleted(id)
    set_deleting_id(null)
  }

  const open_log = (service_id: string, kind: EntryKind) => {
    set_entry_service_id(service_id); set_editing_entry(null); set_default_kind(kind); set_entry_modal_open(true)
  }
  const open_edit_entry = (e: Entry) => {
    set_entry_service_id(e.service_id); set_editing_entry(e); set_entry_modal_open(true)
  }
  const on_entry_saved = (e: Entry) => {
    set_entries(prev => {
      const idx = prev.findIndex(x => x.id === e.id)
      return idx >= 0 ? prev.map(x => x.id === e.id ? e : x) : [...prev, e]
    })
  }
  const on_entry_deleted = async (id: string) => {
    set_entries(prev => prev.filter(e => e.id !== id))
  }

  if (!user) return null

  const category_opts = [{ value: "all", label: "All categories" }, ...categories.map(c => ({ value: c, label: c }))]
  const status_opts = [
    { value: "all", label: "All statuses" },
    { value: "active", label: "Active" },
    { value: "paused", label: "Paused" },
    { value: "cancelled", label: "Cancelled" },
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
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-flag-red/10 text-flag-red">
              <WalletIcon size={16} />
            </span>
            <div>
              <h1 className="text-sm font-bold text-ink">Subscriptions</h1>
              <p className="text-[10px] text-muted">
                {fetching ? "Loading…" : `${services.length} service${services.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={search} on_change={set_search} placeholder="Search…" class_name="w-36 lg:w-48" />

            <Dropdown value={category_f} options={category_opts} on_select={set_category_f} menu_width="w-40"
              trigger_class="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card/60 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-flag-red/40 hover:text-ink"
            >
              {({ open }) => (<>{category_opts.find(o => o.value === category_f)?.label}<ChevronIcon size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} /></>)}
            </Dropdown>

            <Dropdown value={status_f} options={status_opts} on_select={set_status_f} menu_width="w-36"
              trigger_class="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card/60 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-flag-red/40 hover:text-ink"
            >
              {({ open }) => (<>{status_opts.find(o => o.value === status_f)?.label}<ChevronIcon size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} /></>)}
            </Dropdown>

            <button
              type="button"
              onClick={open_create_service}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-flag-red px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-80"
            >
              <PlusIcon size={12} />
              New service
            </button>
          </div>
        </motion.div>

        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">

          {!fetching && (
            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Total spent" value={fmt_money(-total_spent)} tone={flow_tone(-total_spent)} icon={<TrendingDownIcon size={13} />} />
              <StatTile label="Total gained" value={fmt_money(total_gained)} tone={flow_tone(total_gained)} icon={<TrendingUpIcon size={13} />} />
              <StatTile
                label="Net" value={fmt_money(net_all)} tone={net_all >= 0 ? "gain" : "loss"} hero
                icon={net_all >= 0 ? <TrendingUpIcon size={13} /> : <TrendingDownIcon size={13} />}
                sub={net_all >= 0 ? "gained more than spent" : "spent more than gained"}
              />
              <StatTile
                label="Monthly recurring" value={`$${monthly_recurring.toFixed(2)}`} icon={<RefreshIcon size={13} />}
                sub={`${services.filter(s => s.status === "active" && s.recurring_amount).length} active subscription${services.filter(s => s.status === "active" && s.recurring_amount).length !== 1 ? "s" : ""}`}
              />
            </div>
          )}

          {fetching ? (
            <div className="surface overflow-hidden rounded-2xl">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 border-b border-line/50 px-4 py-3 last:border-0">
                  <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-line/40" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 w-32 animate-pulse rounded bg-line/40" />
                    <div className="h-2 w-20 animate-pulse rounded bg-line/30" />
                  </div>
                  <div className="h-4 w-16 animate-pulse rounded bg-line/30" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="surface flex flex-col items-center gap-4 rounded-2xl px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-line/40 text-muted"><WalletIcon size={22} /></div>
              {services.length === 0 ? (
                <>
                  <div>
                    <p className="text-sm font-semibold text-ink">No services yet</p>
                    <p className="mt-1 text-xs text-muted">Add a subscription, or a tool you spend money on to try to earn it back</p>
                  </div>
                  <button
                    type="button"
                    onClick={open_create_service}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-flag-red px-3.5 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-80"
                  >
                    <PlusIcon size={12} /> New service
                  </button>
                </>
              ) : (
                <p className="text-sm text-muted">No services match your filters.</p>
              )}
            </div>
          ) : (
            <Table
              columns={build_service_columns(entries, open_edit_service, deleting_id, delete_service_row)}
              rows={filtered}
              row_key={s => s.id}
              on_row_click={s => set_selected_id(s.id)}
            />
          )}
        </div>
      </main>

      <DetailModal
        service={selected}
        entries={entries}
        on_close={() => set_selected_id(null)}
        on_edit_service={() => selected && open_edit_service(selected)}
        on_log={kind => selected && open_log(selected.id, kind)}
        on_edit_entry={open_edit_entry}
        on_delete_entry={on_entry_deleted}
      />

      <ServiceModal
        open={service_modal_open}
        editing={editing_service}
        user_id={user.id}
        on_close={() => set_service_modal_open(false)}
        on_saved={on_service_saved}
        on_deleted={on_service_deleted}
      />

      <EntryModal
        open={entry_modal_open}
        service_id={entry_service_id}
        user_id={user.id}
        editing={editing_entry}
        default_kind={default_kind}
        on_close={() => set_entry_modal_open(false)}
        on_saved={on_entry_saved}
        on_deleted={on_entry_deleted}
      />
    </div>
  )
}

// ── Stat tile ─────────────────────────────────────────────────────────────────

const StatTile = ({
  label, value, icon, tone, sub, hero,
}: {
  label: string
  value: string
  icon:  React.ReactNode
  tone?: "gain" | "loss"
  sub?:  string
  hero?: boolean
}) => {
  const value_cls = tone === "gain" ? "text-light-green" : tone === "loss" ? "text-loss" : "text-ink"
  const icon_cls  = tone === "gain" ? "bg-light-green/10 text-light-green" : tone === "loss" ? "bg-loss/10 text-loss" : "bg-royal-gold/10 text-royal-gold"
  const wash       = tone === "gain" ? "border-light-green/25 bg-light-green/[0.04]" : tone === "loss" ? "border-loss/25 bg-loss/[0.04]" : "border-royal-gold/20 bg-royal-gold/[0.04]"

  return (
    <div className={`surface flex flex-col gap-3 rounded-2xl p-4 ${wash}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9.5px] font-semibold uppercase tracking-widest text-muted">{label}</p>
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${icon_cls}`}>{icon}</span>
      </div>
      <div>
        <p className={`text-xl font-bold leading-none tabular-nums ${value_cls}`}>{value}</p>
        {sub && <p className="mt-1.5 text-[10px] text-muted">{sub}</p>}
      </div>
    </div>
  )
}
