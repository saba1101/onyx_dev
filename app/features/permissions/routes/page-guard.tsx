import { Outlet, Navigate, useLocation } from "react-router"
import { useAuth } from "~/features/auth/lib/auth"
import { useProfile } from "~/features/profile/lib/profile-context"
import { usePermissionsStore } from "~/features/permissions/lib/permissions-store"

const PATH_TO_KEY: Record<string, string> = {
  "/":          "dashboard",
  "/workspace": "workspace",
  "/git":       "git",
  "/users":     "users",
  "/settings":  "settings",
  "/system":    "system",
  "/inspector": "scanner",
  "/locations": "locations",
  "/planning":  "planning",
  "/subscriptions": "subscriptions",
  "/clients":   "clients",
}

export default function PageGuard() {
  const location    = useLocation()
  const { user, loading: auth_loading } = useAuth()
  const { profile } = useProfile()
  const is_root     = profile?.role === "root"
  const loaded      = usePermissionsStore(s => s.loaded)
  const hidden_pages = usePermissionsStore(s => s.hidden_pages)

  const page_key = PATH_TO_KEY[location.pathname]

  // Every route under this layout requires a session — direct URL access
  // (typed, bookmarked, or otherwise) must land on /login until signed in,
  // not just links from within the already-authenticated app.
  if (auth_loading) return null
  if (!user) return <Navigate to="/login" replace />

  if (!loaded) return <Outlet />

  if (page_key && !is_root && hidden_pages.includes(page_key)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
