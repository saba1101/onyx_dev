import { useEffect } from "react"
import { useAuth } from "~/features/auth/lib/auth"
import { useProfile } from "~/features/profile/lib/profile-context"
import { usePermissionsStore } from "./permissions-store"

export const PermissionsProvider = ({ children }: { children: React.ReactNode }) => {
  const { user }    = useAuth()
  const { profile } = useProfile()
  const is_root     = profile?.role === "root"
  const load        = usePermissionsStore(s => s.load)
  const reset       = usePermissionsStore(s => s.reset)

  useEffect(() => {
    if (!user?.id) { reset(); return }
    load(user.id, is_root)
  }, [user?.id, is_root])

  return <>{children}</>
}
