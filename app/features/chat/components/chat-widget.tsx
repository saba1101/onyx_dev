import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { useAuth } from "~/features/auth/lib/auth"
import { use_presence_tick } from "~/hooks/use-presence-tick"
import { use_notify } from "~/hooks/use-notify"
import { supabase } from "~/lib/supabase"
import { effective_status, status_tone } from "~/features/profile/lib/profile"
import { list_public_profiles, type PublicProfile } from "~/features/users/lib/users"
import { api, subscribe_incoming, type Conversation, type Message } from "~/features/chat/lib/chat"
import { ConversationList, type ListItem } from "~/features/chat/components/conversation-list"
import { MessageThread } from "~/features/chat/components/message-thread"
import { ChatAvatar } from "~/features/chat/components/chat-avatar"
import { MessageSquareIcon, ChevronLeftIcon, ExpandIcon, ShrinkIcon, XIcon } from "~/components/ui/icons"

const ease_out = [0.22, 1, 0.36, 1] as const

type Toast = { key: string; sender_id: string; name: string; avatar_url: string | null; body: string }

// Mounted once at the app root. A minimal DM widget — everyone in the team
// directory doubles as a conversation target, no separate "new message"
// flow. One realtime channel handles receiving for the whole app regardless
// of whether the panel is open or which thread (if any) is active.
export const ChatWidget = () => {
  const { user } = useAuth()
  const notify = use_notify()
  use_presence_tick(30_000)

  const [open, set_open]                 = useState(false)
  const [expanded, set_expanded]         = useState(false)
  const [directory, set_directory]       = useState<PublicProfile[]>([])
  const [conversations, set_conversations] = useState<Conversation[]>([])
  const [loaded, set_loaded]             = useState(false)
  const [query, set_query]               = useState("")
  const [active_id, set_active_id]       = useState<string | null>(null)
  const [messages, set_messages]         = useState<Message[]>([])
  const [thread_loading, set_thread_loading] = useState(false)
  const [sending, set_sending]           = useState(false)
  const [toast, set_toast]               = useState<Toast | null>(null)

  const me = user?.id

  const refresh_conversations = useCallback(async () => {
    if (!me) return
    try { set_conversations(await api.conversations.list()) } catch { /* stays as-is */ }
  }, [me])

  useEffect(() => {
    if (!me) return
    refresh_conversations()
    list_public_profiles().then(({ profiles }) => set_directory(profiles)).finally(() => set_loaded(true))
  }, [me])

  useEffect(() => {
    if (!open || !me) return
    list_public_profiles().then(({ profiles }) => set_directory(profiles))
    refresh_conversations()
  }, [open, me, refresh_conversations])

  const directory_map = useMemo(
    () => Object.fromEntries(directory.map(p => [p.id, p])) as Record<string, PublicProfile>,
    [directory],
  )
  const conv_map = useMemo(
    () => Object.fromEntries(conversations.map(c => [c.counterpart_id, c])) as Record<string, Conversation>,
    [conversations],
  )
  const total_unread = useMemo(() => conversations.reduce((sum, c) => sum + c.unread_count, 0), [conversations])

  const items: ListItem[] = useMemo(() => {
    const rows = directory
      .filter(p => p.id !== me)
      .map(p => {
        const conv = conv_map[p.id]
        return {
          id: p.id,
          name: p.full_name || p.username || "User",
          avatar_url: p.avatar_url,
          status: p.status,
          last_seen_at: p.last_seen_at,
          preview: conv?.last_body ?? null,
          last_at: conv?.last_at ?? null,
          last_from_me: conv?.last_sender_id === me,
          unread: conv?.unread_count ?? 0,
        }
      })

    const q = query.trim().toLowerCase()
    const filtered = q ? rows.filter(r => r.name.toLowerCase().includes(q)) : rows

    return filtered.sort((a, b) => {
      if (a.last_at && b.last_at) return new Date(b.last_at).getTime() - new Date(a.last_at).getTime()
      if (a.last_at) return -1
      if (b.last_at) return 1
      return a.name.localeCompare(b.name)
    })
  }, [directory, conv_map, query, me])

  const active_person = useMemo(() => {
    if (!active_id) return null
    const dir = directory_map[active_id]
    const conv = conv_map[active_id]
    return {
      id: active_id,
      name: dir?.full_name || dir?.username || conv?.full_name || conv?.username || "User",
      avatar_url: dir?.avatar_url ?? conv?.avatar_url ?? null,
      status: dir?.status ?? "offline",
      last_seen_at: dir?.last_seen_at ?? null,
    }
  }, [active_id, directory_map, conv_map])

  const open_thread = async (id: string) => {
    if (!me) return
    set_active_id(id)
    set_messages([])
    set_thread_loading(true)
    try {
      set_messages(await api.messages.list(id, me))
      api.messages.mark_read(id, me).then(refresh_conversations)
    } finally {
      set_thread_loading(false)
    }
  }

  const back_to_list = () => { set_active_id(null); set_messages([]) }

  // Expanded state never survives a close — reopening the widget always
  // starts back at the normal floating size.
  const close_widget = () => { set_open(false); set_expanded(false) }
  const toggle_open = () => (open ? close_widget() : set_open(true))

  const handle_send = async (body: string) => {
    if (!me || !active_id) return
    set_sending(true)
    const optimistic: Message = {
      id: `tmp_${Date.now()}`, sender_id: me, recipient_id: active_id,
      body, created_at: new Date().toISOString(), read_at: null,
    }
    set_messages(m => [...m, optimistic])
    try {
      const saved = await api.messages.send(active_id, me, body)
      set_messages(m => m.map(x => (x.id === optimistic.id ? saved : x)))
      refresh_conversations()
    } catch {
      set_messages(m => m.filter(x => x.id !== optimistic.id))
      notify({ tone: "error", title: "Message not sent", message: "Try again in a moment." })
    } finally {
      set_sending(false)
    }
  }

  // Refs so the realtime subscription (mounted once per session) always
  // sees current UI state without needing to resubscribe on every toggle.
  const open_ref = useRef(open); open_ref.current = open
  const active_ref = useRef(active_id); active_ref.current = active_id
  const dir_map_ref = useRef(directory_map); dir_map_ref.current = directory_map

  useEffect(() => {
    const t = setTimeout(() => set_toast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!me) return
    const channel = subscribe_incoming(me, async (msg) => {
      if (open_ref.current && active_ref.current === msg.sender_id) {
        set_messages(m => [...m, msg])
        await api.messages.mark_read(msg.sender_id, me)
        refresh_conversations()
        return
      }

      refresh_conversations()
      const known = dir_map_ref.current[msg.sender_id]
      const name = known?.full_name || known?.username || null
      if (name) {
        set_toast({ key: msg.id, sender_id: msg.sender_id, name, avatar_url: known.avatar_url, body: msg.body })
      } else {
        const p = await api.profile.peek(msg.sender_id)
        set_toast({
          key: msg.id, sender_id: msg.sender_id,
          name: p?.full_name || p?.username || "Someone", avatar_url: p?.avatar_url ?? null, body: msg.body,
        })
      }
    })
    return () => { supabase.removeChannel(channel) }
  }, [me, refresh_conversations])

  const open_from_toast = () => {
    if (!toast) return
    open_thread(toast.sender_id)
    set_open(true)
    set_toast(null)
  }

  if (!user) return null

  return (
    <>
      <AnimatePresence>
        {toast && !open && (
          <motion.button
            type="button"
            onClick={open_from_toast}
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: ease_out }}
            className="fixed bottom-20 left-4 right-4 z-40 flex cursor-pointer items-start gap-2.5 rounded-2xl border border-line bg-card p-3 text-left shadow-xl shadow-carbon-black/20 sm:left-auto sm:right-20 sm:w-64"
          >
            <ChatAvatar url={toast.avatar_url} name={toast.name} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold text-ink">{toast.name}</p>
              <p className="line-clamp-2 text-[11.5px] text-muted">{toast.body}</p>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => set_expanded(false)}
            className="fixed inset-0 z-40 hidden bg-carbon-black/60 backdrop-blur-sm sm:block"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            layout
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.18, ease: ease_out }}
            onClick={e => e.stopPropagation()}
            className={`fixed z-40 flex flex-col overflow-hidden border border-line bg-card shadow-xl shadow-carbon-black/20 ${
              expanded
                ? "inset-0 rounded-none sm:inset-0 sm:m-auto sm:h-[min(680px,85vh)] sm:w-[min(640px,92vw)] sm:rounded-2xl"
                : "inset-0 rounded-none sm:inset-auto sm:bottom-20 sm:right-20 sm:h-[440px] sm:w-[310px] sm:rounded-2xl"
            }`}
          >
            <div className="flex shrink-0 items-center gap-2.5 border-b border-line/60 px-3.5 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] sm:pt-2.5">
              {active_person ? (
                <>
                  <button
                    type="button"
                    onClick={back_to_list}
                    aria-label="Back to conversations"
                    className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:text-ink"
                  >
                    <ChevronLeftIcon size={15} />
                  </button>
                  <ChatAvatar
                    url={active_person.avatar_url}
                    name={active_person.name}
                    size="sm"
                    status={effective_status(active_person.status, active_person.last_seen_at)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold leading-tight text-ink">{active_person.name}</p>
                    <p className={`text-[10px] leading-tight ${status_tone[effective_status(active_person.status, active_person.last_seen_at)].text}`}>
                      {status_tone[effective_status(active_person.status, active_person.last_seen_at)].label}
                    </p>
                  </div>
                </>
              ) : (
                <p className="flex-1 text-[13px] font-semibold text-ink">Messages</p>
              )}

              <button
                type="button"
                onClick={() => set_expanded(x => !x)}
                aria-label={expanded ? "Shrink" : "Expand"}
                className="hidden h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:text-ink sm:grid"
              >
                {expanded ? <ShrinkIcon size={13} /> : <ExpandIcon size={13} />}
              </button>
              <button
                type="button"
                onClick={close_widget}
                aria-label="Close"
                className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:text-ink sm:h-6 sm:w-6"
              >
                <XIcon size={14} />
              </button>
            </div>

            {active_person ? (
              <MessageThread
                me={me!}
                first_name={active_person.name.split(" ")[0]}
                messages={messages}
                loading={thread_loading}
                sending={sending}
                on_send={handle_send}
              />
            ) : (
              <ConversationList
                items={items}
                query={query}
                on_query_change={set_query}
                on_select={open_thread}
                loading={!loaded}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={toggle_open}
        aria-label={open ? "Close messages" : "Open messages"}
        className={`fixed bottom-4 right-20 z-40 h-12 w-12 cursor-pointer place-items-center rounded-full bg-flag-red text-white shadow-lg shadow-flag-red/30 transition hover:scale-105 active:scale-95 ${
          !open ? "grid" : expanded ? "hidden" : "hidden sm:grid"
        }`}
      >
        <MessageSquareIcon size={19} />
        {total_unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-page bg-royal-gold px-1 font-mono text-[9.5px] font-bold text-carbon-black">
            {total_unread > 9 ? "9+" : total_unread}
          </span>
        )}
      </button>
    </>
  )
}
