import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "~/lib/supabase"

type AuthCtx = { user: User | null; loading: boolean }

const Ctx = createContext<AuthCtx>({ user: null, loading: true })

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, set_user]     = useState<User | null>(null)
  const [loading, set_loading] = useState(true)
  // Keep latest session in a ref so the beforeunload handler can read it
  // without capturing a stale closure
  const session_ref = useRef<Session | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      session_ref.current = session
      set_user(session?.user ?? null)
      set_loading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      session_ref.current = session
      set_user(session?.user ?? null)

      // Fresh sign-in → mark the user active
      if (event === "SIGNED_IN" && session?.user) {
        supabase
          .from("profiles")
          .update({ status: "active" })
          .eq("id", session.user.id)
          .then(() => {})
      }
    })

    // When the tab / browser closes, mark the user offline.
    // fetch() with keepalive:true stays alive after the page unloads.
    const on_unload = () => {
      const sess = session_ref.current
      if (!sess?.access_token) return
      fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/set_self_offline`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sess.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
          },
          body: "{}",
          keepalive: true,
        },
      )
    }
    window.addEventListener("beforeunload", on_unload)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener("beforeunload", on_unload)
    }
  }, [])

  return <Ctx.Provider value={{ user, loading }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
