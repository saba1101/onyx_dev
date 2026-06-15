import { useEffect, useState } from "react"
import {
  api, default_permissions,
  type MemberPermissions,
} from "~/features/permissions/lib/permissions"

export type PermissionsState = {
  edit_any_task:      boolean
  delete_task:        boolean
  delete_any_comment: boolean
  manage_columns:     boolean
  loaded:             boolean
}

export const usePermissions = (user_id: string | null, is_root: boolean): PermissionsState => {
  const [state, set_state] = useState<PermissionsState>({
    ...default_permissions(),
    loaded: false,
  })

  useEffect(() => {
    if (!user_id) return
    if (is_root) {
      set_state({
        edit_any_task: true, delete_task: true,
        delete_any_comment: true, manage_columns: true,
        loaded: true,
      })
      return
    }
    api.get_own(user_id).then(({ data }) => {
      const p = data as MemberPermissions | null
      set_state({
        edit_any_task:      p?.edit_any_task      ?? false,
        delete_task:        p?.delete_task        ?? false,
        delete_any_comment: p?.delete_any_comment ?? false,
        manage_columns:     p?.manage_columns     ?? false,
        loaded: true,
      })
    })
  }, [user_id, is_root])

  return state
}
