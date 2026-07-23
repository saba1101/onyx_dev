import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "motion/react"
import { SmileIcon } from "~/components/ui/icons"

const ease_out = [0.22, 1, 0.36, 1] as const

const EMOJI = [
  "😀", "😂", "😅", "😊", "😍", "🤔", "😎", "😴", "😢", "😡", "🥳", "😱",
  "👍", "👎", "🙏", "👏", "🙌", "💪", "🤝", "✌️",
  "❤️", "🔥", "🎉", "✨", "💯", "⭐", "👀", "💀",
  "🚀", "✅", "❌", "⚠️", "💡", "📌", "📎", "🕒",
]

type Props = { on_pick: (emoji: string) => void }

// A small anchored emoji grid — mirrors ConfirmPopover's floating-panel
// pattern (portal, outside-click / Escape dismiss) rather than pulling in a
// full emoji-picker dependency for what's meant to stay a minimal widget.
export const EmojiPopover = ({ on_pick }: Props) => {
  const [open, set_open] = useState(false)
  const [pos, set_pos]   = useState({ bottom: 0, left: 0 })
  const anchor_ref = useRef<HTMLButtonElement>(null)

  const toggle = () => {
    if (!open && anchor_ref.current) {
      const r = anchor_ref.current.getBoundingClientRect()
      set_pos({ bottom: window.innerHeight - r.top + 8, left: r.left })
    }
    set_open(o => !o)
  }

  useEffect(() => {
    if (!open) return
    const on_outside = (e: MouseEvent) => {
      const target = e.target as Node
      if (anchor_ref.current?.contains(target)) return
      if ((target as HTMLElement).closest?.("[data-emoji-panel]")) return
      set_open(false)
    }
    const on_escape = (e: KeyboardEvent) => { if (e.key === "Escape") set_open(false) }
    document.addEventListener("mousedown", on_outside)
    document.addEventListener("keydown", on_escape)
    return () => {
      document.removeEventListener("mousedown", on_outside)
      document.removeEventListener("keydown", on_escape)
    }
  }, [open])

  const panel = (
    <AnimatePresence>
      {open && (
        <motion.div
          data-emoji-panel
          initial={{ opacity: 0, y: 6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.97 }}
          transition={{ duration: 0.15, ease: ease_out }}
          style={{ position: "fixed", bottom: pos.bottom, left: pos.left, zIndex: 9999 }}
          className="grid w-56 grid-cols-8 gap-0.5 rounded-xl border border-line bg-card p-2 shadow-xl shadow-carbon-black/20"
        >
          {EMOJI.map(e => (
            <button
              key={e}
              type="button"
              onClick={() => on_pick(e)}
              className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-[15px] transition-colors hover:bg-line/60"
            >
              {e}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <>
      <button
        ref={anchor_ref}
        type="button"
        onClick={toggle}
        aria-label="Insert emoji"
        className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full text-muted transition-colors hover:text-ink"
      >
        <SmileIcon size={17} />
      </button>
      {typeof document !== "undefined" && createPortal(panel, document.body)}
    </>
  )
}
