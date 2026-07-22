import { Outlet, Navigate, useLocation } from "react-router"
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
}

export default function PageGuard() {
  const location    = useLocation()
  const { profile } = useProfile()
  const is_root     = profile?.role === "root"
  const loaded      = usePermissionsStore(s => s.loaded)
  const hidden_pages = usePermissionsStore(s => s.hidden_pages)

  const page_key = PATH_TO_KEY[location.pathname]

  if (!loaded) return <Outlet />

  if (page_key && !is_root && hidden_pages.includes(page_key)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
