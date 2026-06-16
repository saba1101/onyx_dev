import { useEffect, useState } from "react"

export const use_fullscreen = () => {
  const [is_fullscreen, set_fs] = useState(false)

  useEffect(() => {
    const on_change = () => set_fs(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", on_change)
    return () => document.removeEventListener("fullscreenchange", on_change)
  }, [])

  const toggle = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  return { is_fullscreen, toggle }
}
