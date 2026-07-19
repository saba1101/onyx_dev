import { supabase } from "~/lib/supabase"

export type TaskType         = "feature" | "bug"
export type StatusColor      = "gray" | "blue" | "yellow" | "green" | "red" | "purple" | "orange"
export type ProjectVisibility = "private" | "public"

export type WProject = {
  id:          string
  name:        string
  description: string | null
  color:       StatusColor
  visibility:  ProjectVisibility
  owner_id:    string | null
  created_at:  string
  updated_at:  string
}

export type WStatus = {
  id:         string
  name:       string
  color:      StatusColor
  position:   number
  project_id: string
  created_at: string
}

export type WTask = {
  id:          string
  title:       string
  description: string | null
  type:        TaskType
  status_id:   string | null
  project_id:  string
  created_by:  string | null
  assigned_to: string | null
  position:    number
  created_at:  string
  updated_at:  string
}

export type WComment = {
  id:         string
  task_id:    string
  author_id:  string | null
  body:       string
  created_at: string
}

export type WProfile = {
  id:         string
  full_name:  string | null
  username:   string | null
  avatar_url: string | null
}

// ── Color tokens ──────────────────────────────────────────────────────────────

export const STATUS_COLORS: Record<StatusColor, { dot: string; text: string; badge: string; bar: string }> = {
  gray:   { dot: "bg-muted/60",    text: "text-muted",       badge: "bg-line/50 text-muted",              bar: "bg-muted/50"    },
  blue:   { dot: "bg-blue-400",    text: "text-blue-400",    badge: "bg-blue-400/10 text-blue-400",       bar: "bg-blue-400"    },
  yellow: { dot: "bg-royal-gold",  text: "text-royal-gold",  badge: "bg-royal-gold/10 text-royal-gold",   bar: "bg-royal-gold"  },
  green:  { dot: "bg-light-green", text: "text-light-green", badge: "bg-light-green/10 text-light-green", bar: "bg-light-green" },
  red:    { dot: "bg-flag-red",    text: "text-flag-red",    badge: "bg-flag-red/10 text-flag-red",       bar: "bg-flag-red"    },
  purple: { dot: "bg-purple-400",  text: "text-purple-400",  badge: "bg-purple-400/10 text-purple-400",   bar: "bg-purple-400"  },
  orange: { dot: "bg-orange-400",  text: "text-orange-400",  badge: "bg-orange-400/10 text-orange-400",   bar: "bg-orange-400"  },
}

export const COLOR_OPTIONS: StatusColor[] = ["gray", "blue", "yellow", "green", "red", "purple", "orange"]

export const TYPE_META: Record<TaskType, { label: string; cls: string }> = {
  feature: { label: "Feature", cls: "bg-blue-400/10 text-blue-400" },
  bug:     { label: "Bug",     cls: "bg-flag-red/10 text-flag-red" },
}

export const fmt_rel = (iso: string): string => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (m <  1)  return "just now"
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d <  7)  return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

// ── API ───────────────────────────────────────────────────────────────────────

export const api = {
  projects: {
    list: () =>
      supabase.from("workspace_projects").select("*").order("updated_at", { ascending: false }),
    get: (id: string) =>
      supabase.from("workspace_projects").select("*").eq("id", id).single(),
    create: (d: { name: string; description: string | null; color: StatusColor; visibility: ProjectVisibility; owner_id: string }) =>
      supabase.from("workspace_projects").insert(d).select().single(),
    update: (id: string, patch: Partial<Pick<WProject, "name" | "description" | "color" | "visibility">>) =>
      supabase.from("workspace_projects")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id).select().single(),
    remove: (id: string) =>
      supabase.from("workspace_projects").delete().eq("id", id),
  },

  statuses: {
    list: (project_id: string) =>
      supabase.from("workspace_statuses").select("*").eq("project_id", project_id).order("position"),
    create: (project_id: string, name: string, color: StatusColor, position: number) =>
      supabase.from("workspace_statuses").insert({ project_id, name, color, position }).select().single(),
    update: (id: string, patch: { name?: string; color?: StatusColor }) =>
      supabase.from("workspace_statuses").update(patch).eq("id", id),
    remove: (id: string) =>
      supabase.from("workspace_statuses").delete().eq("id", id),
  },

  tasks: {
    list: (project_id: string) =>
      supabase.from("workspace_tasks").select("*").eq("project_id", project_id).order("created_at"),
    count_by_project: () =>
      supabase.from("workspace_tasks").select("project_id"),
    create: (d: { project_id: string; title: string; description: string | null; type: TaskType; status_id: string | null; created_by: string; assigned_to: string | null }) =>
      supabase.from("workspace_tasks").insert(d).select().single(),
    update: (id: string, patch: Partial<Pick<WTask, "title" | "description" | "type" | "status_id" | "assigned_to">>) =>
      supabase.from("workspace_tasks")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id).select().single(),
    remove: (id: string) =>
      supabase.from("workspace_tasks").delete().eq("id", id),
  },

  comments: {
    list: (task_id: string) =>
      supabase.from("workspace_comments").select("*").eq("task_id", task_id).order("created_at"),
    create: (task_id: string, author_id: string, body: string) =>
      supabase.from("workspace_comments").insert({ task_id, author_id, body }).select().single(),
    remove: (id: string) =>
      supabase.from("workspace_comments").delete().eq("id", id),
  },

  profiles: {
    list: () =>
      supabase.from("profiles").select("id, full_name, username, avatar_url"),
  },
}
