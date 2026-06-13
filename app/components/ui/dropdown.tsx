import { useEffect, useRef, useState, type ReactNode } from "react"
import { motion, AnimatePresence } from "motion/react"
import { CheckIcon } from "~/components/ui/icons"

const ease_out = [0.22, 1, 0.36, 1] as const

export type dropdown_option = {
  value: string
  label: string
  dot?: string
}

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
  const [open, set_open] = useState(false)
  const wrap_ref = useRef<HTMLDivElement>(null)
  const selected = options.find((opt) => opt.value === value)

  useEffect(() => {
    if (!open) return
    const handle_outside = (event: MouseEvent) => {
      if (!wrap_ref.current?.contains(event.target as Node)) set_open(false)
    }
    const handle_escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") set_open(false)
    }
    document.addEventListener("mousedown", handle_outside)
    document.addEventListener("keydown", handle_escape)
    return () => {
      document.removeEventListener("mousedown", handle_outside)
      document.removeEventListener("keydown", handle_escape)
    }
  }, [open])

  const choose = (next: string) => {
    set_open(false)
    if (next !== value) on_select(next)
  }

  return (
    <div ref={wrap_ref} className="relative">
      <button
        type="button"
        onClick={() => set_open((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={trigger_class}
      >
        {children({ open, selected })}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: ease_out }}
            className={`absolute z-30 mt-1.5 ${menu_width} ${
              align === "right" ? "right-0" : "left-0"
            } overflow-hidden rounded-xl border border-line bg-card p-1 shadow-lg shadow-carbon-black/10`}
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
    </div>
  )
}
