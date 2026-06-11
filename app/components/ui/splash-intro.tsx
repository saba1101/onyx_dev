import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "motion/react"

export const SplashIntro = () => {
  const [show, set_show] = useState(true)
  const [count, set_count] = useState(0)
  const wordmark = "onyx dev"
  const split_at = 4

  useEffect(() => {
    if (count >= wordmark.length) return
    const timer = setTimeout(() => set_count((current) => current + 1), 95)
    return () => clearTimeout(timer)
  }, [count])

  useEffect(() => {
    if (count < wordmark.length) return
    const timer = setTimeout(() => set_show(false), 650)
    return () => clearTimeout(timer)
  }, [count])

  const typed = wordmark.slice(0, count)
  const brand = typed.slice(0, split_at)
  const tail = typed.slice(split_at)

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center bg-carbon-black"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          <span className="inline-flex items-center text-5xl font-bold tracking-tight">
            {brand && <span className="bg-flag-red p-4 text-platinum">{brand}</span>}
            {tail && <span className="whitespace-pre text-flag-red">{tail}</span>}
            <Caret />
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const Caret = () => (
  <motion.span
    aria-hidden
    className="ml-1.5 inline-block h-[1em] w-[3px] bg-flag-red"
    animate={{ opacity: [1, 1, 0, 0] }}
    transition={{ duration: 0.9, repeat: Infinity, ease: "linear", times: [0, 0.5, 0.5, 1] }}
  />
)
