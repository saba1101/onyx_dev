import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "motion/react"

const ease_out = [0.22, 1, 0.36, 1] as const

type Props = {
  trigger:        (props: { onClick: (e: React.MouseEvent) => void }) => ReactNode
  message:        string
  confirm_label?: string
  busy?:          boolean
  on_confirm:     () => void
}

// A small floating confirm — anchored to its trigger, dismissible by
// clicking outside or Escape. Used in place of a full modal for a quick
// "are you sure" on a destructive row/list action.
export const ConfirmPopover = ({ trigger, message, confirm_label = "Delete", busy, on_confirm }: Props) => {
  const [open, set_open] = useState(false)
  const [pos, set_pos]   = useState<{ top: number; right: number }>({ top: 0, right: 0 })
  const anchor_ref = useRef<HTMLSpanElement>(null)

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!open && anchor_ref.current) {
      const r = anchor_ref.current.getBoundingClientRect()
      set_pos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    }
    set_open(o => !o)
  }

  useEffect(() => {
    if (!open || busy) return
    const on_outside = (e: MouseEvent) => {
      if (!anchor_ref.current?.contains(e.target as Node)) set_open(false)
    }
    const on_escape = (e: KeyboardEvent) => { if (e.key === "Escape") set_open(false) }
    document.addEventListener("mousedown", on_outside)
    document.addEventListener("keydown", on_escape)
    return () => {
      document.removeEventListener("mousedown", on_outside)
      document.removeEventListener("keydown", on_escape)
    }
  }, [open, busy])

  // Close only on the busy:true -> false transition, i.e. once the action
  // has actually finished — not the instant it starts.
  const was_busy_ref = useRef(false)
  useEffect(() => {
    if (was_busy_ref.current && !busy) set_open(false)
    was_busy_ref.current = !!busy
  }, [busy])

  const popover = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.15, ease: ease_out }}
          style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999 }}
          onClick={e => e.stopPropagation()}
          className="w-56 rounded-xl border border-line bg-card p-3 shadow-xl shadow-carbon-black/20"
        >
          <p className="mb-2.5 text-xs leading-relaxed text-ink">{message}</p>
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => set_open(false)}
              disabled={busy}
              className="rounded-md border border-line px-2.5 py-1 text-[11px] font-medium text-muted transition-colors hover:text-ink disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={on_confirm}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-flag-red px-2.5 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-70"
            >
              {busy && <span className="h-2.5 w-2.5 shrink-0 animate-spin rounded-full border-[1.5px] border-white/30 border-t-white" />}
              {busy ? "Deleting…" : confirm_label}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <span ref={anchor_ref} className="relative inline-flex">
      {trigger({ onClick: toggle })}
      {typeof document !== "undefined" && createPortal(popover, document.body)}
    </span>
  )
}
