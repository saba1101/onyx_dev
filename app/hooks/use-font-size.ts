import { useEffect, useState } from "react"

const FONT_KEY = "font_size"

export type FontSize = "compact" | "default" | "comfortable"

export const FONT_SIZES: Record<FontSize, { label: string; px: string; desc: string }> = {
  compact:     { label: "Compact",     px: "13px", desc: "Denser, more content visible" },
  default:     { label: "Default",     px: "16px", desc: "Balanced reading size" },
  comfortable: { label: "Comfortable", px: "18px", desc: "Easier on the eyes" },
}

export const apply_font_size = (size: FontSize) => {
  document.documentElement.style.fontSize = FONT_SIZES[size].px
}

export const use_font_size = () => {
  const [size,   set_size_state] = useState<FontSize>("default")
  const [mounted, set_mounted]   = useState(false)

  useEffect(() => {
    const saved = (localStorage.getItem(FONT_KEY) ?? "default") as FontSize
    apply_font_size(saved)
    set_size_state(saved)
    set_mounted(true)
  }, [])

  const set_size = (s: FontSize) => {
    apply_font_size(s)
    localStorage.setItem(FONT_KEY, s)
    set_size_state(s)
  }

  return { size, set_size, mounted }
}
