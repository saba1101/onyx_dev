import { supabase } from "~/lib/supabase"
import type { Profile, profile_status } from "~/features/profile/lib/profile"

export type UserAdmin = Profile & {
  last_sign_in_at: string | null
  confirmed_at: string | null
  banned_until: string | null
}

export type AdminUpdate = {
  full_name?: string | null
  username?: string | null
  email?: string | null
  role?: string
  status?: profile_status
  bio?: string | null
  phone?: string | null
  location?: string | null
  website?: string | null
  company?: string | null
  job_title?: string | null
  timezone?: string | null
  github_url?: string | null
  twitter_url?: string | null
  linkedin_url?: string | null
}

export const role_options = [
  { value: "member", label: "Member" },
  { value: "admin",  label: "Admin"  },
  { value: "root",   label: "Root"   },
]

export const role_style: Record<string, { label: string; classes: string }> = {
  root:   { label: "Root",   classes: "text-flag-red bg-flag-red/10 border-flag-red/20"     },
  admin:  { label: "Admin",  classes: "text-royal-gold bg-royal-gold/10 border-royal-gold/20" },
  member: { label: "Member", classes: "text-muted bg-line/40 border-line"                    },
}

const rel_time = (iso: string | null) => {
  if (!iso) return "never"
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)   return "just now"
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30)  return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export const format_rel = rel_time

export const format_date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"

export const list_users_admin = async () => {
  const { data, error } = await supabase.rpc("get_users_admin")
  return { users: (data ?? []) as UserAdmin[], error }
}

export const admin_update = async (user_id: string, updates: AdminUpdate) => {
  const { data, error } = await supabase
    .from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", user_id)
    .select()
    .single()
  return { data: data as Profile | null, error }
}

export const admin_ban = async (target_user_id: string) => {
  const { error } = await supabase.rpc("admin_ban_user", { target_user_id })
  return { error }
}

export const admin_unban = async (target_user_id: string) => {
  const { error } = await supabase.rpc("admin_unban_user", { target_user_id })
  return { error }
}

export const admin_delete = async (target_user_id: string) => {
  const { error } = await supabase.rpc("admin_delete_user", { target_user_id })
  return { error }
}
