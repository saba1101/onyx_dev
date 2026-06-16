import { useEffect, useState } from "react"

const ACCENT_KEY = "accent"

export type AccentKey = "red" | "blue" | "purple" | "emerald" | "amber" | "rose"

export const ACCENT_OPTIONS: Record<AccentKey, { label: string; hsl: string }> = {
  red:     { label: "Red",     hsl: "355 81% 47%" },
  blue:    { label: "Blue",    hsl: "217 91% 56%" },
  purple:  { label: "Purple",  hsl: "258 80% 56%" },
  emerald: { label: "Emerald", hsl: "152 68% 37%" },
  amber:   { label: "Amber",   hsl: "35 92% 50%"  },
  rose:    { label: "Rose",    hsl: "334 76% 55%"  },
}

export const apply_accent = (key: AccentKey) => {
  const { hsl } = ACCENT_OPTIONS[key] ?? ACCENT_OPTIONS.red
  document.documentElement.style.setProperty("--color-flag-red", `hsl(${hsl})`)
  document.documentElement.style.setProperty("--color-primary",  `hsl(${hsl})`)
}

export const use_accent = () => {
  const [accent,  set_accent_state] = useState<AccentKey>("red")
  const [mounted, set_mounted]      = useState(false)

  useEffect(() => {
    const saved = (localStorage.getItem(ACCENT_KEY) ?? "red") as AccentKey
    apply_accent(saved)
    set_accent_state(saved)
    set_mounted(true)
  }, [])

  const set_accent = (key: AccentKey) => {
    apply_accent(key)
    localStorage.setItem(ACCENT_KEY, key)
    set_accent_state(key)
  }

  return { accent, set_accent, mounted }
}
