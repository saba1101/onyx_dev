import { supabase } from "~/lib/supabase"

export type ClientStatus =
  | "not_contacted" | "contacted" | "replied" | "negotiating" | "won" | "lost" | "ghosted"

export type Client = {
  id:              string
  user_id:         string
  company_name:    string
  contact_name:    string | null
  email:           string | null
  phone:           string | null
  website:         string | null
  social_url:      string | null
  maps_url:        string | null
  address:         string | null
  service_offered: string | null
  payment_amount:  number | null
  status:          ClientStatus
  conversation:    string | null
  last_contact_at: string | null
  follow_up_at:    string | null
  created_at:      string
  updated_at:      string
}

// ── Status → color tokens ────────────────────────────────────────────────────
// Fixed, not user-customizable — never ride on flag-red/--color-primary, which
// the Settings accent picker overwrites at runtime (see app.css --color-loss).

export const STATUS_ORDER: ClientStatus[] =
  ["not_contacted", "contacted", "replied", "negotiating", "won", "lost", "ghosted"]

export const STATUS_META: Record<ClientStatus, { label: string; dot: string; badge: string; wash: string }> = {
  not_contacted: { label: "Not contacted", dot: "bg-muted/60",     badge: "bg-line/50 text-muted",              wash: "border-line/60 bg-line/[0.06]" },
  contacted:     { label: "Contacted",     dot: "bg-blue-400",     badge: "bg-blue-400/10 text-blue-400",       wash: "border-blue-400/20 bg-blue-400/[0.05]" },
  replied:       { label: "Replied",       dot: "bg-royal-gold",   badge: "bg-royal-gold/10 text-royal-gold",   wash: "border-royal-gold/20 bg-royal-gold/[0.05]" },
  negotiating:   { label: "Negotiating",   dot: "bg-purple-400",   badge: "bg-purple-400/10 text-purple-400",   wash: "border-purple-400/20 bg-purple-400/[0.05]" },
  won:           { label: "Won",           dot: "bg-light-green",  badge: "bg-light-green/10 text-light-green", wash: "border-light-green/20 bg-light-green/[0.05]" },
  lost:          { label: "Lost",          dot: "bg-loss",         badge: "bg-loss/10 text-loss",               wash: "border-loss/20 bg-loss/[0.05]" },
  ghosted:       { label: "Ghosted",       dot: "bg-orange-400",   badge: "bg-orange-400/10 text-orange-400",   wash: "border-orange-400/20 bg-orange-400/[0.05]" },
}

export const SERVICE_SUGGESTIONS = [
  "Website", "Web app", "Mobile app", "Marketing", "SEO", "Branding", "Consulting", "Other",
]

// ── Formatters ────────────────────────────────────────────────────────────────

export const fmt_money = (n: number): string =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

export const fmt_date = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })

export const days_since = (date: string): number =>
  Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000)

export const fmt_last_contact = (date: string | null): string => {
  if (!date) return "Never contacted"
  const d = days_since(date)
  if (d <= 0) return "Today"
  if (d === 1) return "1d ago"
  return `${d}d ago`
}

// A lead is "stale" once it's been sitting in contacted/replied for a while
// with no resolution — the visual cue that stops the user re-contacting
// someone they already reached, or forgetting to follow up.
export const is_stale = (c: Pick<Client, "status" | "last_contact_at">): boolean =>
  (c.status === "contacted" || c.status === "replied") &&
  !!c.last_contact_at && days_since(c.last_contact_at) >= 7

export const is_follow_up_due = (c: Pick<Client, "follow_up_at">): boolean =>
  !!c.follow_up_at && c.follow_up_at <= new Date().toISOString().slice(0, 10)

// ── API ───────────────────────────────────────────────────────────────────────

export const api = {
  list: () =>
    supabase.from("clients").select("*").order("updated_at", { ascending: false }),
  create: (d: {
    user_id: string; company_name: string; contact_name: string | null
    email: string | null; phone: string | null; website: string | null
    social_url: string | null; maps_url: string | null; address: string | null
    service_offered: string | null; payment_amount: number | null
    status: ClientStatus; conversation: string | null
    last_contact_at: string | null; follow_up_at: string | null
  }) =>
    supabase.from("clients").insert(d).select().single(),
  update: (id: string, patch: Partial<Pick<Client,
    | "company_name" | "contact_name" | "email" | "phone" | "website" | "social_url"
    | "maps_url" | "address" | "service_offered" | "payment_amount" | "status"
    | "conversation" | "last_contact_at" | "follow_up_at"
  >>) =>
    supabase.from("clients")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id).select().single(),
  remove: (id: string) =>
    supabase.from("clients").delete().eq("id", id),
}

// Resolves a pasted Google Maps link server-side (redirects, then reads the
// canonical /place/<name>/@<lat>,<lng> URL) and reverse-geocodes the address
// via OpenStreetMap — no Google API key required, so name/address only, no
// phone or rating (Google doesn't expose those without their paid API).
export const fetch_place = (maps_url: string) =>
  supabase.functions.invoke<{ name: string | null; address: string | null; error?: string }>(
    "fetch-place", { body: { url: maps_url } },
  )
