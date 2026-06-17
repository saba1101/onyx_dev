import { SearchIcon, XIcon } from "~/components/ui/icons"

type Props = {
  value:        string
  on_change:    (v: string) => void
  placeholder?: string
  class_name?:  string
}

export const SearchInput = ({ value, on_change, placeholder = "Search…", class_name }: Props) => (
  <div className={`relative ${class_name ?? ""}`}>
    <SearchIcon size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
    <input
      type="text"
      value={value}
      onChange={e => on_change(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-line bg-card/60 py-1.5 pl-8 pr-7 text-xs text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-flag-red"
    />
    {value && (
      <button
        type="button"
        onClick={() => on_change("")}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
      >
        <XIcon size={10} />
      </button>
    )}
  </div>
)
