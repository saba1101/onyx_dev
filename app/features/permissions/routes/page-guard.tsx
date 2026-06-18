import { Outlet, Navigate, useLocation } from "react-router"
import { useProfile } from "~/features/profile/lib/profile-context"
import { usePermissionsCtx } from "~/features/permissions/lib/permissions-context"

const PATH_TO_KEY: Record<string, string> = {
  "/":          "dashboard",
  "/workspace": "workspace",
  "/git":       "git",
  "/users":     "users",
  "/settings":  "settings",
  "/system":    "system",
  "/inspector": "scanner",
  "/locations": "locations",
}

export default function PageGuard() {
  const location    = useLocation()
  const { profile } = useProfile()
  const is_root     = profile?.role === "root"
  const perms       = usePermissionsCtx()

  const page_key = PATH_TO_KEY[location.pathname]

  if (!perms.loaded) return <Outlet />

  if (page_key && !is_root && perms.hidden_pages.includes(page_key)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
