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
    // A single source of truth for session state — onAuthStateChange fires
    // once with "INITIAL_SESSION" right on subscribe (session restore or
    // logged-out), then again on sign-in/token refresh. Awaiting the presence
    // touch *before* set_user means ProfileProvider's fetch (triggered by the
    // user id changing) always reads an already-fresh row instead of racing
    // the write — that race was why status/last_seen_at could show stale
    // right after signing in.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      session_ref.current = session

      if (session?.user && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")) {
        await supabase
          .from("profiles")
          .update(
            event === "SIGNED_IN"
              ? { status: "active", last_seen_at: new Date().toISOString() }
              : { last_seen_at: new Date().toISOString() },
          )
          .eq("id", session.user.id)
      }

      set_user(session?.user ?? null)
      set_loading(false)
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
