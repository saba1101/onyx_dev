import { supabase } from "~/lib/supabase"
import type { RealtimeChannel } from "@supabase/supabase-js"

export type Message = {
  id:           string
  sender_id:    string
  recipient_id: string
  body:         string
  created_at:   string
  read_at:      string | null
}

export type Conversation = {
  counterpart_id: string
  full_name:      string | null
  username:       string | null
  avatar_url:     string | null
  last_body:      string
  last_at:        string
  last_sender_id: string
  unread_count:   number
}

export const fmt_time = (iso: string) => {
  const d = new Date(iso)
  const same_day = d.toDateString() === new Date().toDateString()
  return same_day
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export const api = {
  conversations: {
    list: async (): Promise<Conversation[]> => {
      const { data, error } = await supabase.rpc("chat_conversations")
      if (error) throw error
      return (data ?? []) as Conversation[]
    },
  },

  messages: {
    list: async (other_id: string, me: string): Promise<Message[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(`and(sender_id.eq.${me},recipient_id.eq.${other_id}),and(sender_id.eq.${other_id},recipient_id.eq.${me})`)
        .order("created_at", { ascending: true })
      if (error) throw error
      return (data ?? []) as Message[]
    },

    send: async (recipient_id: string, sender_id: string, body: string): Promise<Message> => {
      const { data, error } = await supabase
        .from("messages")
        .insert({ sender_id, recipient_id, body })
        .select()
        .single()
      if (error) throw error
      return data as Message
    },

    mark_read: async (other_id: string, me: string) => {
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("recipient_id", me)
        .eq("sender_id", other_id)
        .is("read_at", null)
    },
  },

  profile: {
    // Lightweight lookup for toasting a sender we may not have in the
    // conversation list yet (first message from someone new).
    peek: async (id: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .eq("id", id)
        .maybeSingle()
      return data as { id: string; full_name: string | null; username: string | null; avatar_url: string | null } | null
    },
  },
}

// One channel for the whole widget lifetime — every message addressed to me
// arrives here regardless of which thread (if any) is open.
export const subscribe_incoming = (me: string, on_insert: (msg: Message) => void): RealtimeChannel =>
  supabase
    .channel(`chat_incoming_${me}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${me}` },
      (payload) => on_insert(payload.new as Message),
    )
    .subscribe()
