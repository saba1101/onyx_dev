import { createContext, useContext, useEffect, useState } from "react"
import { useAuth } from "~/features/auth/lib/auth"
import { useProfile } from "~/features/profile/lib/profile-context"
import { api, default_permissions, type MemberPermissions } from "~/features/permissions/lib/permissions"

export type PermissionsState = {
  edit_any_task:      boolean
  delete_task:        boolean
  delete_any_comment: boolean
  manage_columns:     boolean
  hidden_pages:       string[]
  loaded:             boolean
}

const Ctx = createContext<PermissionsState>({
  ...default_permissions(),
  loaded: false,
})

export const PermissionsProvider = ({ children }: { children: React.ReactNode }) => {
  const { user }    = useAuth()
  const { profile } = useProfile()
  const is_root     = profile?.role === "root"

  const [state, set_state] = useState<PermissionsState>({
    ...default_permissions(),
    loaded: false,
  })

  useEffect(() => {
    if (!user?.id) return
    if (is_root) {
      set_state({
        edit_any_task: true, delete_task: true,
        delete_any_comment: true, manage_columns: true,
        hidden_pages: [],
        loaded: true,
      })
      return
    }
    api.get_own(user.id).then(({ data }) => {
      const p = data as MemberPermissions | null
      set_state({
        edit_any_task:      p?.edit_any_task      ?? false,
        delete_task:        p?.delete_task        ?? false,
        delete_any_comment: p?.delete_any_comment ?? false,
        manage_columns:     p?.manage_columns     ?? false,
        hidden_pages:       p?.hidden_pages       ?? ["system", "permissions"],
        loaded: true,
      })
    })
  }, [user?.id, is_root])

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}

export const usePermissionsCtx = () => useContext(Ctx)
