import { useEffect, useRef, useState } from "react"
import type { profile_status } from "~/features/profile/lib/profile"
import { effective_status, status_tone } from "~/features/profile/lib/profile"
import { ChatAvatar } from "~/features/chat/components/chat-avatar"
import { ChevronLeftIcon, SendIcon } from "~/components/ui/icons"
import { fmt_time, type Message } from "~/features/chat/lib/chat"

type Person = {
  id:           string
  name:         string
  avatar_url:   string | null
  status:       profile_status
  last_seen_at: string | null
}

type Props = {
  me:       string
  person:   Person
  messages: Message[]
  loading:  boolean
  sending:  boolean
  on_back:  () => void
  on_send:  (body: string) => void
}

export const MessageThread = ({ me, person, messages, loading, sending, on_back, on_send }: Props) => {
  const [draft, set_draft] = useState("")
  const scroll_ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scroll_ref.current?.scrollTo({ top: scroll_ref.current.scrollHeight })
  }, [messages.length])

  const status = effective_status(person.status, person.last_seen_at)
  const tone = status_tone[status]

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body || sending) return
    on_send(body)
    set_draft("")
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-line/60 p-2.5">
        <button
          type="button"
          onClick={on_back}
          aria-label="Back to conversations"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted transition-colors hover:text-ink"
        >
          <ChevronLeftIcon size={15} />
        </button>
        <ChatAvatar url={person.avatar_url} name={person.name} size="sm" status={status} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-semibold leading-tight text-ink">{person.name}</p>
          <p className={`text-[10px] leading-tight ${tone.text}`}>{tone.label}</p>
        </div>
      </div>

      <div ref={scroll_ref} className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <p className="pt-6 text-center text-[12px] text-muted">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="pt-6 text-center text-[12px] text-muted">Say hello to {person.name.split(" ")[0]}.</p>
        ) : (
          messages.map((m, i) => {
            const mine = m.sender_id === me
            const prev = messages[i - 1]
            const show_time = !prev || new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60_000
            return (
              <div key={m.id} className="flex flex-col">
                {show_time && (
                  <p className="my-1.5 text-center font-mono text-[9.5px] uppercase tracking-wide text-muted">
                    {fmt_time(m.created_at)}
                  </p>
                )}
                <div
                  className={`max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-[12.5px] leading-snug ${
                    mine
                      ? "self-end rounded-br-md bg-flag-red text-white"
                      : "self-start rounded-bl-md bg-line/70 text-ink dark:bg-line/50"
                  }`}
                >
                  {m.body}
                </div>
              </div>
            )
          })
        )}
      </div>

      <form onSubmit={submit} className="flex shrink-0 items-center gap-2 border-t border-line/60 p-2.5">
        <input
          value={draft}
          onChange={e => set_draft(e.target.value)}
          placeholder={`Message ${person.name.split(" ")[0]}…`}
          className="w-full min-w-0 flex-1 rounded-full border border-line bg-page/60 px-3 py-1.5 text-[12.5px] text-ink outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          aria-label="Send"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-flag-red text-white transition-opacity disabled:opacity-40"
        >
          <SendIcon size={13} />
        </button>
      </form>
    </div>
  )
}
