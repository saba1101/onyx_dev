import type { profile_status } from "~/features/profile/lib/profile"
import { status_tone } from "~/features/profile/lib/profile"

type Props = {
  url?:    string | null
  name:    string
  size?:   "sm" | "md"
  status?: profile_status
}

// Small avatar with an optional presence dot — used throughout the chat
// widget wherever a person needs to be represented.
export const ChatAvatar = ({ url, name, size = "md", status }: Props) => {
  const dim = size === "sm" ? "h-8 w-8 text-[10px]" : "h-9 w-9 text-[11px]"
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?"

  return (
    <div className="relative shrink-0">
      <div className={`${dim} overflow-hidden rounded-full border border-line bg-line/40`}>
        {url
          ? <img src={url} alt={name} className="h-full w-full object-cover" />
          : <div className="flex h-full w-full items-center justify-center font-semibold text-muted">{initials}</div>
        }
      </div>
      {status && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${status_tone[status].dot}`}
        />
      )}
    </div>
  )
}
