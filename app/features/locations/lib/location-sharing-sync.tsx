import { useEffect, useRef, useState } from "react"
import { useLocation } from "react-router"
import { useAuth } from "~/features/auth/lib/auth"
import { supabase } from "~/lib/supabase"
import { upsert_location } from "~/features/locations/lib/locations"

const ON_LOCATIONS_PAGE_MS = 30_000
const ELSEWHERE_MS         = 60_000

// Mounted once at the app root. If the current user already has an active
// shared location (a row in user_locations), keeps it fresh from whatever
// page they're on — every 30s while on the Locations page itself, every 60s
// everywhere else. Starts and stops in sync with the row itself, so "Stop
// sharing" on the Locations page is the only way to turn this off.
export const LocationSharingSync = () => {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [sharing, set_sharing] = useState(false)

  // Track whether sharing is currently on, via an initial check + realtime.
  useEffect(() => {
    if (!user) { set_sharing(false); return }

    supabase
      .from("user_locations")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => set_sharing(!!data))

    const channel = supabase
      .channel(`location_sharing_sync_${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_locations", filter: `user_id=eq.${user.id}` },
        () => set_sharing(true),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "user_locations", filter: `user_id=eq.${user.id}` },
        () => set_sharing(false),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  // Push loop — cadence depends on the current page, restarts on navigation.
  const user_id = user?.id
  useEffect(() => {
    if (!user_id || !sharing) return

    const push = () => {
      navigator.geolocation.getCurrentPosition(
        pos => { upsert_location(user_id, pos.coords.latitude, pos.coords.longitude) },
        () => {},
        { timeout: 10_000 },
      )
    }

    const ms = pathname === "/locations" ? ON_LOCATIONS_PAGE_MS : ELSEWHERE_MS
    const id = setInterval(push, ms)
    return () => clearInterval(id)
  }, [user_id, sharing, pathname])

  return null
}
