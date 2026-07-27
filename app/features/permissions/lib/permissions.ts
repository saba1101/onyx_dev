import { supabase } from "~/lib/supabase"

export type Permission =
  | "edit_any_task"
  | "delete_task"
  | "delete_any_comment"
  | "manage_columns"

export type PageKey = "dashboard" | "workspace" | "git" | "users" | "settings" | "system" | "scanner" | "locations" | "planning" | "crypto" | "subscriptions" | "clients"

export type MemberPermissions = {
  user_id:            string
  edit_any_task:      boolean
  delete_task:        boolean
  delete_any_comment: boolean
  manage_columns:     boolean
  hidden_pages:       string[]
  updated_at:         string
}

export const PERMISSIONS: Permission[] = [
  "edit_any_task",
  "delete_task",
  "delete_any_comment",
  "manage_columns",
]

export const PERMISSION_META: Record<Permission, { label: string; desc: string }> = {
  edit_any_task:      { label: "Edit tasks",       desc: "Edit tasks created by others" },
  delete_task:        { label: "Delete tasks",      desc: "Delete any task from the board" },
  delete_any_comment: { label: "Delete comments",   desc: "Remove comments posted by others" },
  manage_columns:     { label: "Manage columns",    desc: "Add, rename and delete board columns" },
}

export const PAGES: PageKey[] = ["dashboard", "workspace", "git", "users", "settings", "scanner", "locations", "planning", "crypto", "subscriptions", "clients", "system"]

export const PRIVILEGED_PAGES = new Set<PageKey>(["system"])

export const PAGE_META: Record<PageKey, { label: string; desc: string }> = {
  dashboard: { label: "Dashboard", desc: "Activity overview and team stats" },
  workspace: { label: "Workspace", desc: "Kanban task board and analytics" },
  git:       { label: "Git",       desc: "GitHub repos and activity feed" },
  users:     { label: "Users",     desc: "Team member directory and access control" },
  settings:  { label: "Settings",  desc: "Account and profile settings" },
  scanner:   { label: "Scanner",   desc: "Website URL parser and tech analyzer" },
  locations: { label: "Locations", desc: "Live location sharing between team members" },
  system:    { label: "System",    desc: "Server stats, database and storage" },
  planning:  { label: "Planning",  desc: "Visual flow boards for planning and mapping ideas" },
  crypto:    { label: "Crypto",    desc: "Live market data, portfolio tracker, and price charts" },
  subscriptions: { label: "Subscriptions", desc: "Track subscriptions and money-making tools — spend vs. gain" },
  clients:   { label: "Clients",   desc: "Track outreach to potential clients — status, contact info, and conversation history" },
}

export const default_permissions = (): Omit<MemberPermissions, "user_id" | "updated_at"> => ({
  edit_any_task:      false,
  delete_task:        false,
  delete_any_comment: false,
  manage_columns:     false,
  hidden_pages:       ["system"],
})

export type RoleKey = "member" | "admin"

export type RolePermissions = {
  role:               RoleKey
  edit_any_task:      boolean
  delete_task:        boolean
  delete_any_comment: boolean
  manage_columns:     boolean
  hidden_pages:       string[]
  updated_at:         string
}

export const ROLES: { key: RoleKey; label: string; desc: string; color: string }[] = [
  { key: "member", label: "Member", desc: "Default team member access", color: "text-muted bg-line/40 border-line" },
  { key: "admin",  label: "Admin",  desc: "Elevated team member access", color: "text-royal-gold bg-royal-gold/10 border-royal-gold/20" },
]

export const default_role_permissions = (role: RoleKey): Omit<RolePermissions, "role" | "updated_at"> => ({
  edit_any_task:      role === "admin",
  delete_task:        false,
  delete_any_comment: role === "admin",
  manage_columns:     role === "admin",
  hidden_pages:       ["system"],
})

export const api = {
  list: () =>
    supabase.from("member_permissions").select("*"),

  upsert: (user_id: string, patch: Partial<Omit<MemberPermissions, "user_id" | "updated_at">>) =>
    supabase.from("member_permissions").upsert(
      { user_id, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    ),

  get_own: (user_id: string) =>
    supabase.from("member_permissions").select("*").eq("user_id", user_id).maybeSingle(),

  roles: {
    list: () =>
      supabase.from("role_permissions").select("*"),

    upsert: (role: RoleKey, patch: Partial<Omit<RolePermissions, "role" | "updated_at">>) =>
      supabase.from("role_permissions").upsert(
        { role, ...patch, updated_at: new Date().toISOString() },
        { onConflict: "role" },
      ),

    apply_to_all: async (role: RoleKey, patch: Partial<Omit<RolePermissions, "role" | "updated_at">>, user_ids: string[]) => {
      if (!user_ids.length) return { error: null }
      const rows = user_ids.map(user_id => ({
        user_id, ...patch, updated_at: new Date().toISOString(),
      }))
      return supabase.from("member_permissions").upsert(rows, { onConflict: "user_id" })
    },
  },
}
