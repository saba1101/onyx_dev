import { create } from "zustand"
import { api, default_permissions, type MemberPermissions } from "./permissions"

export type PermissionsState = {
  edit_any_task:      boolean
  delete_task:        boolean
  delete_any_comment: boolean
  manage_columns:     boolean
  hidden_pages:       string[]
  loaded:             boolean
}

type PermissionsStore = PermissionsState & {
  load:  (user_id: string, is_root: boolean) => Promise<void>
  reset: () => void
}

const unloaded: PermissionsState = {
  ...default_permissions(),
  loaded: false,
}

export const usePermissionsStore = create<PermissionsStore>((set) => ({
  ...unloaded,

  load: async (user_id, is_root) => {
    if (is_root) {
      set({
        edit_any_task: true, delete_task: true,
        delete_any_comment: true, manage_columns: true,
        hidden_pages: [], loaded: true,
      })
      return
    }
    const { data } = await api.get_own(user_id)
    const p = data as MemberPermissions | null
    set({
      edit_any_task:      p?.edit_any_task      ?? false,
      delete_task:        p?.delete_task        ?? false,
      delete_any_comment: p?.delete_any_comment ?? false,
      manage_columns:     p?.manage_columns     ?? false,
      hidden_pages:       p?.hidden_pages       ?? ["system"],
      loaded: true,
    })
  },

  reset: () => set(unloaded),
}))
