import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "motion/react"

export const SplashIntro = () => {
  const [show, set_show] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => set_show(false), 700)
    return () => clearTimeout(timer)
  }, [])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center bg-carbon-black"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="text-5xl font-bold tracking-tight"
          >
            <span className="text-platinum bg-flag-red p-4">onyx</span>
            <span className="text-flag-red"> dev</span>
            <Dots />
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const Dots = () => (
  <span className="inline-flex text-flag-red">
    {[0, 1, 2].map((slot) => (
      <motion.span
        key={slot}
        animate={{ opacity: [0.2, 1, 0.2] }}
        transition={{
          duration: 0.6,
          repeat: Infinity,
          delay: slot * 0.15,
        }}
      >
        .
      </motion.span>
    ))}
  </span>
)
