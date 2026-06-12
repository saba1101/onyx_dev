import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router"

import type { Route } from "./+types/root"
import { ThemeToggle } from "~/components/ui/theme-toggle"
import { SplashIntro } from "~/components/ui/splash-intro"
import { NotificationProvider } from "~/components/ui/notifications"
import { Backdrop } from "~/components/ui/backdrop"
import "./app.css"

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/png", href: "/onyx.png" },
  { rel: "apple-touch-icon", href: "/onyx.png" },
]

const theme_setup = `(() => {
  const saved = localStorage.getItem("theme")
  const dark = saved ? saved === "dark" : matchMedia("(prefers-color-scheme: dark)").matches
  document.documentElement.classList.toggle("dark", dark)
  if (localStorage.getItem("disable_intro") === "true") {
    document.documentElement.setAttribute("data-no-intro", "")
  }
})()`

export const Layout = ({ children }: { children: React.ReactNode }) => (
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <Meta />
      <Links />
      <script dangerouslySetInnerHTML={{ __html: theme_setup }} />
    </head>
    <body>
      <Backdrop />
      <SplashIntro />
      <NotificationProvider>{children}</NotificationProvider>
      <ThemeToggle />
      <ScrollRestoration />
      <Scripts />
    </body>
  </html>
)

const App = () => <Outlet />
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
