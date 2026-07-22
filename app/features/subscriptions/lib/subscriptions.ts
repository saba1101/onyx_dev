import { supabase } from "~/lib/supabase"

export type ServiceColor    = "gray" | "blue" | "yellow" | "green" | "red" | "purple" | "orange"
export type ServiceStatus   = "active" | "paused" | "cancelled"
export type RecurringCycle  = "weekly" | "monthly" | "quarterly" | "yearly"
export type EntryKind       = "income" | "expense"

export type Service = {
  id:                string
  user_id:           string
  name:              string
  category:          string | null
  color:             ServiceColor
  status:            ServiceStatus
  recurring_amount:  number | null
  recurring_cycle:   RecurringCycle | null
  url:               string | null
  notes:             string | null
  created_at:        string
  updated_at:        string
}

export type Entry = {
  id:          string
  service_id:  string
  user_id:     string
  kind:        EntryKind
  amount:      number
  occurred_on: string
  note:        string | null
  created_at:  string
}

// ── Color tokens (mirrors the tone scale used elsewhere in the app) ──────────

export const COLOR_OPTIONS: ServiceColor[] = ["gray", "blue", "yellow", "green", "red", "purple", "orange"]

export const COLOR_HEX: Record<ServiceColor, string> = {
  gray:   "#9ca3af",
  blue:   "#60a5fa",
  yellow: "#eab308",
  green:  "#22c55e",
  red:    "#ef4444",
  purple: "#a855f7",
  orange: "#f97316",
}

export const COLOR_TONE: Record<ServiceColor, { dot: string; badge: string }> = {
  gray:   { dot: "bg-muted/60",    badge: "bg-line/50 text-muted" },
  blue:   { dot: "bg-blue-400",    badge: "bg-blue-400/10 text-blue-400" },
  yellow: { dot: "bg-royal-gold",  badge: "bg-royal-gold/10 text-royal-gold" },
  green:  { dot: "bg-light-green", badge: "bg-light-green/10 text-light-green" },
  red:    { dot: "bg-flag-red",    badge: "bg-flag-red/10 text-flag-red" },
  purple: { dot: "bg-purple-400",  badge: "bg-purple-400/10 text-purple-400" },
  orange: { dot: "bg-orange-400",  badge: "bg-orange-400/10 text-orange-400" },
}

export const CYCLE_LABEL: Record<RecurringCycle, string> = {
  weekly: "week", monthly: "month", quarterly: "quarter", yearly: "year",
}

const CYCLE_DAYS: Record<RecurringCycle, number> = {
  weekly: 7, monthly: 30, quarterly: 91, yearly: 365,
}

// Monthly-equivalent cost, for the "monthly recurring" summary stat.
export const monthly_equivalent = (amount: number, cycle: RecurringCycle) =>
  cycle === "weekly" ? amount * (30 / 7)
  : cycle === "monthly" ? amount
  : cycle === "quarterly" ? amount / 3
  : amount / 12

// Next renewal date: anchored to the latest logged expense for this service,
// falling back to when the service was added if nothing's been logged yet.
export const next_renewal = (service: Service, entries: Entry[]): Date | null => {
  if (!service.recurring_cycle) return null
  const expenses = entries.filter(e => e.service_id === service.id && e.kind === "expense")
  const anchor = expenses.length
    ? expenses.reduce((latest, e) => e.occurred_on > latest ? e.occurred_on : latest, expenses[0].occurred_on)
    : service.created_at.slice(0, 10)
  const d = new Date(anchor)
  d.setDate(d.getDate() + CYCLE_DAYS[service.recurring_cycle])
  return d
}

export const days_until = (date: Date): number =>
  Math.ceil((date.getTime() - Date.now()) / 86_400_000)

export const fmt_money = (n: number) => {
  const sign = n < 0 ? "-" : ""
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const fmt_date = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })

// ── API ───────────────────────────────────────────────────────────────────────

export const api = {
  services: {
    list: () =>
      supabase.from("finance_services").select("*").order("updated_at", { ascending: false }),
    create: (d: {
      user_id: string; name: string; category: string | null; color: ServiceColor
      recurring_amount: number | null; recurring_cycle: RecurringCycle | null
      url: string | null; notes: string | null
    }) =>
      supabase.from("finance_services").insert(d).select().single(),
    update: (id: string, patch: Partial<Pick<Service,
      "name" | "category" | "color" | "status" | "recurring_amount" | "recurring_cycle" | "url" | "notes"
    >>) =>
      supabase.from("finance_services")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id).select().single(),
    remove: (id: string) =>
      supabase.from("finance_services").delete().eq("id", id),
  },

  entries: {
    list_all: () =>
      supabase.from("finance_entries").select("*").order("occurred_on", { ascending: true }),
    create: (d: { user_id: string; service_id: string; kind: EntryKind; amount: number; occurred_on: string; note: string | null }) =>
      supabase.from("finance_entries").insert(d).select().single(),
    update: (id: string, patch: Partial<Pick<Entry, "kind" | "amount" | "occurred_on" | "note">>) =>
      supabase.from("finance_entries").update(patch).eq("id", id).select().single(),
    remove: (id: string) =>
      supabase.from("finance_entries").delete().eq("id", id),
  },
}
