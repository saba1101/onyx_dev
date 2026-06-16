import { useEffect, useState } from "react"

export type ThemeChoice = "light" | "dark" | "system"

const THEME_KEY = "theme"

export const apply_theme = (choice: ThemeChoice) => {
  const is_dark = choice === "dark" ||
    (choice === "system" && matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.toggle("dark", is_dark)
}

export const use_theme = () => {
  const [choice, set_choice] = useState<ThemeChoice>("system")
  const [mounted, set_mounted] = useState(false)

  useEffect(() => {
    const saved = (localStorage.getItem(THEME_KEY) ?? "system") as ThemeChoice
    apply_theme(saved)
    set_choice(saved)
    set_mounted(true)

    const mq = matchMedia("(prefers-color-scheme: dark)")
    const on_sys = () => {
      if ((localStorage.getItem(THEME_KEY) ?? "system") === "system") apply_theme("system")
    }
    mq.addEventListener("change", on_sys)
    return () => mq.removeEventListener("change", on_sys)
  }, [])

  const set = (c: ThemeChoice) => {
    apply_theme(c)
    localStorage.setItem(THEME_KEY, c)
    set_choice(c)
  }

  return { choice, set, mounted }
}
