import { useEffect, useState } from "react"

type Theme = "light" | "dark"

export const use_theme = () => {
  const [theme, set_theme] = useState<Theme>("light")

  useEffect(() => {
    const is_dark = document.documentElement.classList.contains("dark")
    set_theme(is_dark ? "dark" : "light")
  }, [])

  const toggle = () => {
    set_theme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark"
      document.documentElement.classList.toggle("dark", next === "dark")
      localStorage.setItem("theme", next)
      return next
    })
  }

  return { theme, toggle }
}
