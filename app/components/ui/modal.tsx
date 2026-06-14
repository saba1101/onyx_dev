import { useEffect, type ReactNode } from "react"
import { motion, AnimatePresence } from "motion/react"
import { XIcon } from "~/components/ui/icons"

const sizes = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
}

type ModalProps = {
  open: boolean
  on_close: () => void
  title: string
  description?: string
  size?: keyof typeof sizes
  children: ReactNode
}

export const Modal = ({ open, on_close, title, description, size = "md", children }: ModalProps) => {
  useEffect(() => {
    if (!open) return
    const on_key = (e: KeyboardEvent) => { if (e.key === "Escape") on_close() }
    document.addEventListener("keydown", on_key)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", on_key)
      document.body.style.overflow = ""
    }
  }, [open, on_close])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={on_close}
            className="absolute inset-0 bg-carbon-black/70 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className={`surface relative z-10 w-full ${sizes[size]} max-h-[90vh] overflow-hidden rounded-2xl flex flex-col`}
          >
            {/* Accent stripe */}
            <div className="h-px shrink-0 bg-gradient-to-r from-transparent via-flag-red to-transparent opacity-75" />

            {/* Corner brackets */}
            <span aria-hidden className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 border-l-2 border-t-2 border-flag-red/30" />
            <span aria-hidden className="pointer-events-none absolute right-3.5 top-3.5 h-4 w-4 border-r-2 border-t-2 border-flag-red/30" />
            <span aria-hidden className="pointer-events-none absolute bottom-3.5 left-3.5 h-4 w-4 border-b-2 border-l-2 border-flag-red/30" />
            <span aria-hidden className="pointer-events-none absolute bottom-3.5 right-3.5 h-4 w-4 border-b-2 border-r-2 border-flag-red/30" />

            {/* Header */}
            <div className="flex shrink-0 items-start justify-between gap-4 px-6 pb-4 pt-5">
              <div>
                {description && (
                  <p className="text-[11px] uppercase tracking-wider text-flag-red">{description}</p>
                )}
                <h2 id="modal-title" className="mt-0.5 text-base font-semibold tracking-tight">
                  {title}
                </h2>
              </div>
              <button
                onClick={on_close}
                aria-label="Close"
                className="mt-0.5 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line text-muted transition-colors hover:border-flag-red/40 hover:text-ink"
              >
                <XIcon size={14} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
