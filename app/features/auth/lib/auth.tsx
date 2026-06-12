import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "~/lib/supabase"

type AuthCtx = { user: User | null; loading: boolean }

const Ctx = createContext<AuthCtx>({ user: null, loading: true })

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, set_user] = useState<User | null>(null)
  const [loading, set_loading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      set_user(session?.user ?? null)
      set_loading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      set_user(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return <Ctx.Provider value={{ user, loading }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
