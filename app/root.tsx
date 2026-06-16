import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router"

import type { Route } from "./+types/root"
import { SplashIntro } from "~/components/ui/splash-intro"
import { NotificationProvider } from "~/components/ui/notifications"
import { Backdrop } from "~/components/ui/backdrop"
import { ThemeToggle } from "~/components/ui/theme-toggle"
import { AuthProvider } from "~/features/auth/lib/auth"
import { ProfileProvider } from "~/features/profile/lib/profile-context"
import { PermissionsProvider } from "~/features/permissions/lib/permissions-context"
import "./app.css"

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/png", href: "/onyx.png" },
  { rel: "apple-touch-icon", href: "/onyx.png" },
]

const appearance_setup = `(() => {
  // Theme
  const t = localStorage.getItem("theme") ?? "system"
  const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.toggle("dark", dark)

  // Intro
  if (localStorage.getItem("disable_intro") === "true")
    document.documentElement.setAttribute("data-no-intro", "")

  // Accent colour
  const accents = {
    red:     "hsl(355 81% 47%)", blue:    "hsl(217 91% 56%)",
    purple:  "hsl(258 80% 56%)", emerald: "hsl(152 68% 37%)",
    amber:   "hsl(35 92% 50%)",  rose:    "hsl(334 76% 55%)",
  }
  const a = accents[localStorage.getItem("accent")] || accents.red
  document.documentElement.style.setProperty("--color-flag-red", a)
  document.documentElement.style.setProperty("--color-primary",  a)

  // Font size
  const sizes = { compact: "13px", default: "16px", comfortable: "18px" }
  document.documentElement.style.fontSize =
    sizes[localStorage.getItem("font_size")] || "16px"
})()`

export const Layout = ({ children }: { children: React.ReactNode }) => (
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <Meta />
      <Links />
      <script dangerouslySetInnerHTML={{ __html: appearance_setup }} />
    </head>
    <body>
      <Backdrop />
      <SplashIntro />
      <NotificationProvider>
        {children}
        <ThemeToggle />
      </NotificationProvider>
      <ScrollRestoration />
      <Scripts />
    </body>
  </html>
)

const App = () => (
  <AuthProvider>
    <ProfileProvider>
      <PermissionsProvider>
        <Outlet />
      </PermissionsProvider>
    </ProfileProvider>
  </AuthProvider>
)
export default App

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
  let title = "Error"
  let msg = "Something went wrong."
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "404" : "Error"
    msg = error.status === 404 ? "Page not found." : error.statusText || msg
  } else if (import.meta.env.DEV && error instanceof Error) {
    msg = error.message
    stack = error.stack
  }

  return (
    <main className="p-8">
      <h1>{title}</h1>
      <p>{msg}</p>
      {stack && (
        <pre className="overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  )
}
