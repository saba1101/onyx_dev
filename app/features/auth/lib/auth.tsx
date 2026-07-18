import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "~/lib/supabase"

type AuthCtx = { user: User | null; loading: boolean }

const Ctx = createContext<AuthCtx>({ user: null, loading: true })

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, set_user]       = useState<User | null>(null)
  const [loading, set_loading] = useState(true)
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

      if (event === "SIGNED_IN" && session?.user) {
        // Fresh sign-in → mark active and record presence
        supabase
          .from("profiles")
          .update({ status: "active", last_seen_at: new Date().toISOString() })
          .eq("id", session.user.id)
          .then(() => {})
      } else if (
        (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") &&
        session?.user
      ) {
        // Session restore / token refresh → update presence without changing status
        supabase
          .from("profiles")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", session.user.id)
          .then(() => {})
      }
    })

    // ── Presence heartbeat ────────────────────────────────────────────────────
    //
    // Rules:
    //   • Ping once a minute while the tab is open and visible. Being "online"
    //     just means the tab is here — no activity/idle tracking, since that
    //     flipped genuinely-open tabs to offline just for sitting still.
    //   • Fire an extra ping immediately when the tab regains visibility, so
    //     switching back doesn't wait up to a full minute to look online.
    //   • On tab close, best-effort mark offline right away instead of
    //     relying solely on the 3-minute staleness fallback in effective_status.

    const PING_MS = 60_000

    const push_presence = () => {
      const sess = session_ref.current
      if (!sess?.user) return
      supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", sess.user.id)
        .then(({ error }) => {
          if (error) console.error("presence ping failed:", error.message)
        })
    }

    const tick = () => {
      if (document.visibilityState === "visible") push_presence()
    }

    const on_visibility = () => {
      if (document.visibilityState === "visible") push_presence()
    }

    const on_unload = () => {
      const sess = session_ref.current
      if (!sess?.access_token) return
      const url = import.meta.env.VITE_SUPABASE_URL
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY
      fetch(`${url}/rest/v1/rpc/set_self_offline`, {
        method: "POST",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          apikey: key,
          Authorization: `Bearer ${sess.access_token}`,
        },
      }).catch(() => {})
    }

    const interval = setInterval(tick, PING_MS)
    document.addEventListener("visibilitychange", on_visibility)
    window.addEventListener("pagehide", on_unload)

    return () => {
      subscription.unsubscribe()
      clearInterval(interval)
      document.removeEventListener("visibilitychange", on_visibility)
      window.removeEventListener("pagehide", on_unload)
    }
  }, [])

  return <Ctx.Provider value={{ user, loading }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
