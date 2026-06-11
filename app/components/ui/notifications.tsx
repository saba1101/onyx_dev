import { useCallback, useState, type ReactNode } from "react"
import { AnimatePresence, motion } from "motion/react"
import { notify_context, type notice, type notice_input } from "~/hooks/use-notify"

const tone_accent: Record<notice["tone"], string> = {
  success: "bg-royal-gold",
  error: "bg-watermelon",
  info: "bg-charcoal-blue",
}

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notices, set_notices] = useState<notice[]>([])

  const dismiss = useCallback((id: number) => {
    set_notices((current) => current.filter((item) => item.id !== id))
  }, [])

  const push = useCallback(
    (input: notice_input) => {
      const id = Date.now() + Math.random()
      set_notices((current) => [
        ...current,
        { id, tone: input.tone ?? "info", title: input.title, message: input.message },
      ])
      setTimeout(() => dismiss(id), 4200)
    },
    [dismiss]
  )

  return (
    <notify_context.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[120] flex w-full max-w-xs -translate-x-1/2 flex-col gap-2 sm:left-auto sm:right-4 sm:translate-x-0">
        <AnimatePresence initial={false}>
          {notices.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => dismiss(item.id)}
              className="pointer-events-auto flex cursor-pointer gap-2.5 rounded-xl border border-line bg-card/90 p-3 shadow-lg shadow-ink-black/10 backdrop-blur"
            >
              <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${tone_accent[item.tone]}`} />
              <div className="flex flex-col gap-0.5">
                <p className="text-xs font-semibold leading-tight text-ink">{item.title}</p>
                {item.message && <p className="text-[11px] leading-snug text-muted">{item.message}</p>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </notify_context.Provider>
  )
}
