import { useEffect, useState } from "react"

type Theme = "light" | "dark"

export const use_theme = () => {
  const [theme, set_theme] = useState<Theme>("light")
  const [mounted, set_mounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("theme")
    const is_dark = saved
      ? saved === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches
    const resolved: Theme = is_dark ? "dark" : "light"
    document.documentElement.classList.toggle("dark", is_dark)
    set_theme(resolved)
    set_mounted(true)
  }, [])

  const toggle = () => {
    set_theme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark"
      document.documentElement.classList.toggle("dark", next === "dark")
      localStorage.setItem("theme", next)
      return next
    })
  }

  return { theme, toggle, mounted }
}
