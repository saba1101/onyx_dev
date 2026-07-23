import type { profile_status } from "~/features/profile/lib/profile"
import { effective_status } from "~/features/profile/lib/profile"
import { ChatAvatar } from "~/features/chat/components/chat-avatar"
import { SearchIcon } from "~/components/ui/icons"
import { fmt_time } from "~/features/chat/lib/chat"

export type ListItem = {
  id:             string
  name:           string
  avatar_url:     string | null
  status:         profile_status
  last_seen_at:   string | null
  preview:        string | null
  last_at:        string | null
  last_from_me:   boolean
  unread:         number
}

type Props = {
  items:              ListItem[]
  query:              string
  on_query_change:    (q: string) => void
  on_select:          (id: string) => void
  loading:            boolean
}

export const ConversationList = ({ items, query, on_query_change, on_select, loading }: Props) => (
  <div className="flex min-h-0 flex-1 flex-col">
    <div className="shrink-0 border-b border-line/60 p-2.5">
      <div className="flex items-center gap-2 rounded-lg border border-line bg-page/60 px-2.5 py-1.5">
        <SearchIcon size={13} className="shrink-0 text-muted" />
        <input
          value={query}
          onChange={e => on_query_change(e.target.value)}
          placeholder="Find someone…"
          className="w-full bg-transparent text-[12.5px] text-ink outline-none placeholder:text-muted"
        />
      </div>
    </div>

    <div className="min-h-0 flex-1 overflow-y-auto">
      {loading ? (
        <p className="p-4 text-center text-[12px] text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="p-4 text-center text-[12px] text-muted">
          {query ? "No one matches that search." : "No teammates to message yet."}
        </p>
      ) : (
        items.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => on_select(item.id)}
            className="flex w-full items-center gap-2.5 border-b border-line/40 px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-flag-red/[0.04] dark:hover:bg-flag-red/[0.06]"
          >
            <ChatAvatar url={item.avatar_url} name={item.name} status={effective_status(item.status, item.last_seen_at)} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[12.5px] font-semibold text-ink">{item.name}</p>
                {item.last_at && (
                  <span className="shrink-0 font-mono text-[10px] text-muted">{fmt_time(item.last_at)}</span>
                )}
              </div>
              <p className="truncate text-[11.5px] text-muted">
                {item.preview ? `${item.last_from_me ? "You: " : ""}${item.preview}` : "No messages yet"}
              </p>
            </div>
            {item.unread > 0 && (
              <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-flag-red px-1 font-mono text-[9.5px] font-bold text-white">
                {item.unread}
              </span>
            )}
          </button>
        ))
      )}
    </div>
  </div>
)
