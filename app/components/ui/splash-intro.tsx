import { useEffect, useLayoutEffect, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Loader } from "~/components/ui/loader"

// useLayoutEffect on server causes a warning; this silences it while keeping
// the synchronous-before-paint behaviour on the client.
const use_layout_effect = typeof window !== "undefined" ? useLayoutEffect : useEffect

export const SplashIntro = () => {
  // Start as false (renders null) so server HTML and initial client render agree
  // — no hydration mismatch. useLayoutEffect then enables the splash before
  // the first paint if the user hasn't disabled it.
  const [enabled, set_enabled] = useState(false)

  use_layout_effect(() => {
    if (!document.documentElement.hasAttribute("data-no-intro")) {
      set_enabled(true)
    }
  }, [])

  if (!enabled) return null
  return <SplashContent />
}

const SplashContent = () => {
  const [show, set_show] = useState(true)
  const [count, set_count] = useState(0)
  const wordmark = "onyx dev"
  const split_at = 4

  useEffect(() => {
    if (count >= wordmark.length) return
    const timer = setTimeout(() => set_count((c) => c + 1), 95)
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
          className="fixed inset-0 z-[100] grid place-items-center gap-8 bg-carbon-black"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          <span className="inline-flex items-center text-5xl font-bold tracking-tight">
            {brand && <span className="bg-flag-red p-4 text-platinum">{brand}</span>}
            {tail && <span className="whitespace-pre text-flag-red">{tail}</span>}
            <Caret />
          </span>
          <Loader />
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
