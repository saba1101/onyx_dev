import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "motion/react"
import { CalendarIcon, ChevronLeftIcon } from "~/components/ui/icons"

const ease_out = [0.22, 1, 0.36, 1] as const

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

const pad = (n: number) => String(n).padStart(2, "0")
const to_ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
const parse_ymd = (s: string) => {
  const [y, m, d] = s.split("-").map(Number)
  return { y, m: m - 1, d }
}
const days_in_month  = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
const first_weekday  = (y: number, m: number) => new Date(Date.UTC(y, m, 1)).getUTCDay()
const key_of         = (y: number, m: number, d: number) => y * 372 + m * 31 + d // stable order for comparisons

type MenuPos = { top: number; left: number }

export const DatePicker = ({
  value,
  onChange,
  max,
}: {
  value:    string
  onChange: (v: string) => void
  max?:     string
}) => {
  const sel = parse_ymd(value)
  const cap = max ? parse_ymd(max) : null

  const [open,     set_open]     = useState(false)
  const [cursor,   set_cursor]   = useState({ y: sel.y, m: sel.m })
  const [menu_pos, set_menu_pos] = useState<MenuPos>({ top: 0, left: 0 })
  const trigger_ref = useRef<HTMLButtonElement>(null)
  const menu_ref     = useRef<HTMLDivElement>(null)

  const calc_pos = () => {
    if (!trigger_ref.current) return
    const r = trigger_ref.current.getBoundingClientRect()
    set_menu_pos({ top: r.bottom + 6, left: r.left })
  }

  const toggle = () => {
    if (!open) { set_cursor({ y: sel.y, m: sel.m }); calc_pos() }
    set_open(prev => !prev)
  }

  useEffect(() => {
    if (!open) return
    const on_outside = (e: MouseEvent) => {
      const t = e.target as Node
      if (!trigger_ref.current?.contains(t) && !menu_ref.current?.contains(t)) set_open(false)
    }
    const on_escape = (e: KeyboardEvent) => { if (e.key === "Escape") set_open(false) }
    const on_scroll = () => calc_pos()
    document.addEventListener("mousedown", on_outside)
    document.addEventListener("keydown",   on_escape)
    window.addEventListener("scroll",      on_scroll, true)
    return () => {
      document.removeEventListener("mousedown", on_outside)
      document.removeEventListener("keydown",   on_escape)
      window.removeEventListener("scroll",      on_scroll, true)
    }
  }, [open])

  const cap_key   = cap ? key_of(cap.y, cap.m, cap.d) : null
  const next_disabled = cap_key !== null && key_of(cursor.y, cursor.m + 1, 1) > cap_key

  const go_month = (delta: number) => {
    set_cursor(prev => {
      const m = prev.m + delta
      return { y: prev.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }
    })
  }

  const choose = (d: number) => {
    onChange(to_ymd(cursor.y, cursor.m, d))
    set_open(false)
  }

  const lead   = first_weekday(cursor.y, cursor.m)
  const total  = days_in_month(cursor.y, cursor.m)
  const cells: Array<number | null> = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const today = new Date()
  const today_key = key_of(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())

  const menu = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={menu_ref}
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.15, ease: ease_out }}
          style={{ position: "fixed", top: menu_pos.top, left: menu_pos.left, zIndex: 9999 }}
          className="w-64 overflow-hidden rounded-xl border border-line bg-card p-3 shadow-xl shadow-carbon-black/20"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => go_month(-1)}
              className="grid h-6 w-6 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-line/50 hover:text-ink"
            >
              <ChevronLeftIcon size={13} />
            </button>
            <p className="text-xs font-semibold text-ink">{MONTH_NAMES[cursor.m]} {cursor.y}</p>
            <button
              type="button"
              onClick={() => go_month(1)}
              disabled={next_disabled}
              className="grid h-6 w-6 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-line/50 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeftIcon size={13} className="rotate-180" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map(w => (
              <div key={w} className="grid h-6 place-items-center text-[9.5px] font-semibold uppercase text-muted/60">{w}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (d === null) return <div key={i} />
              const k = key_of(cursor.y, cursor.m, d)
              const is_selected = k === key_of(sel.y, sel.m, sel.d)
              const is_today    = k === today_key
              const is_disabled = cap_key !== null && k > cap_key
              return (
                <button
                  key={i}
                  type="button"
                  disabled={is_disabled}
                  onClick={() => choose(d)}
                  className={`relative grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-xs transition-colors
                    ${is_selected ? "bg-flag-red font-semibold text-white" : "text-ink hover:bg-line/50"}
                    ${is_disabled ? "cursor-not-allowed text-muted/30 hover:bg-transparent" : ""}`}
                >
                  {d}
                  {is_today && !is_selected && (
                    <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-flag-red" />
                  )}
                </button>
              )
            })}
          </div>

          {cap && (
            <button
              type="button"
              onClick={() => { onChange(max!); set_open(false) }}
              className="mt-2 w-full rounded-lg border border-line px-2 py-1.5 text-[11px] font-medium text-muted transition-colors hover:bg-line/40 hover:text-ink"
            >
              Today
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <div className="relative">
      <button
        ref={trigger_ref}
        type="button"
        onClick={toggle}
        className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-line bg-page/60 px-3 py-2 text-sm text-ink outline-none transition-colors hover:border-line focus:border-flag-red/50"
      >
        <span>{MONTH_NAMES[sel.m].slice(0, 3)} {sel.d}, {sel.y}</span>
        <CalendarIcon size={14} className="text-muted" />
      </button>

      {typeof document !== "undefined" && createPortal(menu, document.body)}
    </div>
  )
}
