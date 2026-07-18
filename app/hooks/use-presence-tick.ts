import { useEffect, useState } from "react"

// Presence/staleness (e.g. effective_status) is derived from Date.now() at
// render time, so a component that only re-renders on new data can keep
// showing a stale-but-not-yet-refetched user as "online" indefinitely. This
// forces a re-render every `interval_ms` purely to recompute those values.
export const use_presence_tick = (interval_ms = 30_000) => {
  const [tick, set_tick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => set_tick(t => t + 1), interval_ms)
    return () => clearInterval(id)
  }, [interval_ms])

  return tick
}
