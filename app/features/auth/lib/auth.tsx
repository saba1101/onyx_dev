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
    //   • Only fire while the tab is visible AND the user has interacted in the
    //     last IDLE_MS (5 min). A tab left open but untouched goes offline.
    //   • Heartbeat fires at most every 60 s — cheap, not spammy.
    //   • When the user returns after being idle we fire immediately so they
    //     appear online within seconds rather than waiting for the next tick.
    //   • Activity events are throttled to once per 30 s so mousemove etc.
    //     don't generate redundant work.

    const IDLE_MS        = 5 * 60_000   // 5 min idle → stop heartbeat
    const BEAT_MS        = 60_000       // heartbeat interval
    const ACTIVITY_MS    = 30_000       // min gap between activity recordings

    let last_activity    = Date.now()   // assume active on load
    let last_activity_ts = Date.now()   // throttle gate

    const push_presence = () => {
      const sess = session_ref.current
      if (!sess?.user) return
      supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", sess.user.id)
        .then(() => {})
    }

    const beat = () => {
      const idle = Date.now() - last_activity > IDLE_MS
      if (document.visibilityState !== "visible" || idle) return
      push_presence()
    }

    const on_activity = () => {
      const now = Date.now()
      if (now - last_activity_ts < ACTIVITY_MS) return   // throttle
      last_activity_ts = now

      const was_idle = now - last_activity > IDLE_MS
      last_activity  = now

      // Snap back online immediately after returning from idle
      if (was_idle && document.visibilityState === "visible") push_presence()
    }

    const on_visibility = () => {
      if (document.visibilityState === "visible") {
        last_activity = Date.now()   // treat tab-focus as activity
        push_presence()
      }
    }

    const interval = setInterval(beat, BEAT_MS)

    const activity_events = ["mousemove", "keydown", "pointerdown", "scroll", "touchstart"] as const
    activity_events.forEach(e => document.addEventListener(e, on_activity, { passive: true }))
    document.addEventListener("visibilitychange", on_visibility)

    return () => {
      subscription.unsubscribe()
      clearInterval(interval)
      activity_events.forEach(e => document.removeEventListener(e, on_activity))
      document.removeEventListener("visibilitychange", on_visibility)
    }
  }, [])

  return <Ctx.Provider value={{ user, loading }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
