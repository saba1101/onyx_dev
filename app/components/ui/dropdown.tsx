import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "motion/react"
import { CheckIcon } from "~/components/ui/icons"

const ease_out = [0.22, 1, 0.36, 1] as const

export type dropdown_option = {
  value: string
  label: string
  dot?: string
}

type MenuPos = { top: number; left?: number; right?: number }

export const Dropdown = ({
  value,
  options,
  on_select,
  disabled,
  align = "left",
  menu_width = "w-44",
  trigger_class = "",
  children,
}: {
  value: string
  options: dropdown_option[]
  on_select: (value: string) => void
  disabled?: boolean
  align?: "left" | "right"
  menu_width?: string
  trigger_class?: string
  children: (state: { open: boolean; selected?: dropdown_option }) => ReactNode
}) => {
  const [open,     set_open]     = useState(false)
  const [menu_pos, set_menu_pos] = useState<MenuPos>({ top: 0, left: 0 })
  const trigger_ref = useRef<HTMLButtonElement>(null)
  const menu_ref    = useRef<HTMLDivElement>(null)
  const selected    = options.find((opt) => opt.value === value)

  const calc_pos = () => {
    if (!trigger_ref.current) return
    const r = trigger_ref.current.getBoundingClientRect()
    const top  = r.bottom + 6
    if (align === "right") {
      set_menu_pos({ top, right: window.innerWidth - r.right })
    } else {
      set_menu_pos({ top, left: r.left })
    }
  }

  const toggle = () => {
    if (disabled) return
    if (!open) calc_pos()
    set_open(prev => !prev)
  }

  useEffect(() => {
    if (!open) return
    const on_outside = (e: MouseEvent) => {
      const t = e.target as Node
      if (!trigger_ref.current?.contains(t) && !menu_ref.current?.contains(t)) {
        set_open(false)
      }
    }
    const on_escape = (e: KeyboardEvent) => { if (e.key === "Escape") set_open(false) }
    const on_scroll = () => { calc_pos() }
    document.addEventListener("mousedown", on_outside)
    document.addEventListener("keydown",   on_escape)
    window.addEventListener("scroll",      on_scroll, true)
    return () => {
      document.removeEventListener("mousedown", on_outside)
      document.removeEventListener("keydown",   on_escape)
      window.removeEventListener("scroll",      on_scroll, true)
    }
  }, [open])

  const choose = (next: string) => {
    set_open(false)
    if (next !== value) on_select(next)
  }

  const menu = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={menu_ref}
          role="listbox"
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.15, ease: ease_out }}
          style={{
            position: "fixed",
            top:   menu_pos.top,
            left:  menu_pos.left,
            right: menu_pos.right,
            zIndex: 9999,
          }}
          className={`${menu_width} overflow-hidden rounded-xl border border-line bg-card p-1 shadow-xl shadow-carbon-black/20`}
        >
          {options.map((opt) => {
            const active = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => choose(opt.value)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-line/50 ${
                  active ? "text-ink" : "text-muted"
                }`}
              >
                {opt.dot && <span className={`h-2 w-2 shrink-0 rounded-full ${opt.dot}`} />}
                <span className="flex-1 truncate">{opt.label}</span>
                {active && <CheckIcon size={13} className="shrink-0 text-flag-red" />}
              </button>
            )
          })}
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
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={trigger_class}
      >
        {children({ open, selected })}
      </button>

      {typeof document !== "undefined" && createPortal(menu, document.body)}
    </div>
  )
}
