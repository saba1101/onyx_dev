import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useAuth } from "~/features/auth/lib/auth"
import { get_profile, type Profile } from "~/features/profile/lib/profile"

type ProfileCtx = {
  profile: Profile | null
  set_profile: (p: Profile | null) => void
  loading: boolean
}

const Ctx = createContext<ProfileCtx>({ profile: null, set_profile: () => {}, loading: true })

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth()
  const [profile, set_profile] = useState<Profile | null>(null)
  const [loading, set_loading] = useState(true)

  useEffect(() => {
    if (!user) {
      set_profile(null)
      set_loading(false)
      return
    }
    get_profile(user.id).then((p) => {
      set_profile(p)
      set_loading(false)
    })
  }, [user?.id])

  return <Ctx.Provider value={{ profile, set_profile, loading }}>{children}</Ctx.Provider>
}

export const useProfile = () => useContext(Ctx)
