import { useEffect, useRef, useState } from "react"
import { SendIcon } from "~/components/ui/icons"
import { EmojiPopover } from "~/features/chat/components/emoji-popover"
import { fmt_time, type Message } from "~/features/chat/lib/chat"

type Props = {
  me:          string
  first_name:  string
  messages:    Message[]
  loading:     boolean
  sending:     boolean
  on_send:     (body: string) => void
}

export const MessageThread = ({ me, first_name, messages, loading, sending, on_send }: Props) => {
  const [draft, set_draft] = useState("")
  const scroll_ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scroll_ref.current?.scrollTo({ top: scroll_ref.current.scrollHeight })
  }, [messages.length])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body || sending) return
    on_send(body)
    set_draft("")
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroll_ref} className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <p className="pt-6 text-center text-[12px] text-muted">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="pt-6 text-center text-[12px] text-muted">Say hello to {first_name}.</p>
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

      <form
        onSubmit={submit}
        className="flex shrink-0 items-center gap-1 border-t border-line/60 p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:pb-2.5"
      >
        <EmojiPopover on_pick={e => set_draft(d => d + e)} />
        <input
          value={draft}
          onChange={e => set_draft(e.target.value)}
          placeholder={`Message ${first_name}…`}
          className="w-full min-w-0 flex-1 rounded-full border border-line bg-page/60 px-3 py-1.5 text-[12.5px] text-ink outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          aria-label="Send"
          className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full bg-flag-red text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SendIcon size={13} />
        </button>
      </form>
    </div>
  )
}
