import { supabase } from "~/lib/supabase"
import type { Node, Edge } from "@xyflow/react"

export type BoardVisibility = "PRIVATE" | "SHARED"

export type PlanBoard = {
  id:         string
  name:       string
  nodes:      Node[]
  edges:      Edge[]
  created_by: string
  visibility: BoardVisibility
  created_at: string
  updated_at: string
}

export type BoardEditorProfile = {
  id:        string
  username:  string | null
  full_name: string | null
  avatar_url: string | null
  email:     string | null
}

export type BoardEditor = {
  board_id:   string
  user_id:    string
  granted_by: string | null
  granted_at: string
  profile:    BoardEditorProfile | null
}

export const NODE_COLORS = [
  { key: "slate",  label: "Slate",  bg: "hsl(220 13% 13%)", border: "hsl(220 13% 30%)", text: "hsl(220 13% 80%)" },
  { key: "red",    label: "Red",    bg: "hsl(355 40% 14%)", border: "hsl(355 81% 47%)", text: "hsl(355 70% 75%)" },
  { key: "blue",   label: "Blue",   bg: "hsl(217 40% 14%)", border: "hsl(217 91% 56%)", text: "hsl(217 80% 75%)" },
  { key: "green",  label: "Green",  bg: "hsl(152 40% 12%)", border: "hsl(152 68% 37%)", text: "hsl(152 55% 65%)" },
  { key: "purple", label: "Purple", bg: "hsl(258 40% 14%)", border: "hsl(258 80% 56%)", text: "hsl(258 70% 80%)" },
  { key: "amber",  label: "Amber",  bg: "hsl(35 40% 12%)",  border: "hsl(35 92% 50%)",  text: "hsl(35 80% 70%)"  },
] as const

export type NodeColorKey = typeof NODE_COLORS[number]["key"]

export const NODE_COLOR_MAP = Object.fromEntries(
  NODE_COLORS.map(c => [c.key, c])
) as Record<NodeColorKey, typeof NODE_COLORS[number]>

export type PlanNodeData = {
  label: string
  color: NodeColorKey
  [key: string]: unknown
}

const sanitize_nodes = (nodes: Node[]) =>
  nodes.map(n => ({
    id:       n.id,
    type:     n.type,
    position: n.position,
    data:     { label: (n.data as PlanNodeData).label, color: (n.data as PlanNodeData).color },
    ...(n.width  != null ? { width:  n.width  } : {}),
    ...(n.height != null ? { height: n.height } : {}),
  }))

const sanitize_edges = (edges: Edge[]) =>
  edges.map(({ id, source, target, sourceHandle, targetHandle }) =>
    ({ id, source, target, sourceHandle, targetHandle }))

export const api = {
  list: () =>
    supabase.from("plan_boards").select("*").order("updated_at", { ascending: false }),

  create: (name: string, created_by: string, visibility: BoardVisibility) =>
    supabase.from("plan_boards")
      .insert({ name, nodes: [], edges: [], created_by, visibility })
      .select()
      .single(),

  save: (id: string, nodes: Node[], edges: Edge[]) =>
    supabase.from("plan_boards").update({
      nodes: sanitize_nodes(nodes),
      edges: sanitize_edges(edges),
      updated_at: new Date().toISOString(),
    }).eq("id", id),

  rename: (id: string, name: string) =>
    supabase.from("plan_boards").update({
      name,
      updated_at: new Date().toISOString(),
    }).eq("id", id),

  set_visibility: (id: string, visibility: BoardVisibility) =>
    supabase.from("plan_boards").update({
      visibility,
      updated_at: new Date().toISOString(),
    }).eq("id", id),

  remove: (id: string) =>
    supabase.from("plan_boards").delete().eq("id", id),

  editors: {
    list: async (board_id: string): Promise<{ data: BoardEditor[]; error: unknown }> => {
      const { data: rows, error } = await supabase
        .from("plan_board_editors")
        .select("board_id, user_id, granted_by, granted_at")
        .eq("board_id", board_id)

      if (error || !rows?.length) return { data: [], error }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, email")
        .in("id", rows.map(r => r.user_id))

      const by_id = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

      return {
        data: rows.map(r => ({ ...r, profile: by_id[r.user_id] ?? null })),
        error: null,
      }
    },

    add: (board_id: string, user_id: string, granted_by: string) =>
      supabase.from("plan_board_editors")
        .insert({ board_id, user_id, granted_by }),

    remove: (board_id: string, user_id: string) =>
      supabase.from("plan_board_editors")
        .delete()
        .eq("board_id", board_id)
        .eq("user_id", user_id),
  },

  profiles_search: (query: string) =>
    supabase.from("profiles")
      .select("id, username, full_name, avatar_url, email")
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(6),
}
