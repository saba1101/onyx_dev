import { supabase } from "~/lib/supabase"

export type Permission =
  | "edit_any_task"
  | "delete_task"
  | "delete_any_comment"
  | "manage_columns"

export type MemberPermissions = {
  user_id:            string
  edit_any_task:      boolean
  delete_task:        boolean
  delete_any_comment: boolean
  manage_columns:     boolean
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

export const default_permissions = (): Omit<MemberPermissions, "user_id" | "updated_at"> => ({
  edit_any_task:      false,
  delete_task:        false,
  delete_any_comment: false,
  manage_columns:     false,
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
}
