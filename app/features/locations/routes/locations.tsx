import "leaflet/dist/leaflet.css"
import { useEffect, useState, useCallback } from "react"
import { Link } from "react-router"
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap } from "react-leaflet"
import L from "leaflet"
import { useAuth } from "~/features/auth/lib/auth"
import { useProfile } from "~/features/profile/lib/profile-context"
import {
  fetch_locations,
  upsert_location,
  delete_location,
  fmt_ago,
  type LocationWithProfile,
} from "../lib/locations"
import { MapPinIcon, ChevronsLeftIcon } from "~/components/ui/icons"

const REFRESH_INTERVAL = 30

// ── Custom marker icon ───────────────────────────────────────────────────────

const make_icon = (profile: LocationWithProfile["profile"], is_you: boolean) => {
  const name       = profile.full_name?.split(" ")[0] || profile.username || "?"
  const role_color = profile.role === "root" ? "#b45309" : profile.role === "admin" ? "#d97706" : "#6b7280"
  const border     = is_you ? "#dc2626" : role_color

  const inner = profile.avatar_url
    ? `<img src="${profile.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`
    : `<span style="font-size:11px;font-weight:700;color:#fff;line-height:1">${name.slice(0, 2).toUpperCase()}</span>`

  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
      <div style="
        width:36px;height:36px;border-radius:50%;border:2.5px solid ${border};
        background:#1c1c1c;display:flex;align-items:center;justify-content:center;
        overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.35)
      ">${inner}</div>
      <div style="
        background:rgba(15,15,15,0.82);color:#f5f5f5;font-size:9px;font-weight:600;
        padding:1px 5px;border-radius:4px;white-space:nowrap;letter-spacing:0.3px;
        border:1px solid rgba(255,255,255,0.08)
      ">${name}${is_you ? " · you" : ""}</div>
      <div style="
        width:0;height:0;border-left:5px solid transparent;
        border-right:5px solid transparent;border-top:7px solid ${border};margin-top:-1px
      "></div>
    </div>
  `

  return L.divIcon({
    html,
    className:   "",
    iconSize:    [50, 60],
    iconAnchor:  [25, 60],
    popupAnchor: [0, -62],
  })
}

// ── Fly-to helper ─────────────────────────────────────────────────────────────

const FlyTo = ({ center }: { center: [number, number] | null }) => {
  const map = useMap()
  useEffect(() => {
    if (center) map.flyTo(center, 18, { duration: 1.2 })
  }, [center, map])
  return null
}

// ── Role badge ────────────────────────────────────────────────────────────────

const RoleBadge = ({ role }: { role: string }) => {
  const styles: Record<string, string> = {
    root:   "bg-amber-500/15 text-amber-500 border-amber-500/25",
    admin:  "bg-yellow-500/15 text-yellow-600 border-yellow-500/25",
    member: "bg-line/40 text-muted border-line",
  }
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold capitalize ${styles[role] ?? styles.member}`}>
      {role}
    </span>
  )
}

// ── People list (shared between sidebar and bottom sheet) ─────────────────────

const PeopleList = ({
  loading,
  locations,
  is_root,
  user_id,
  on_fly,
}: {
  loading:   boolean
  locations: LocationWithProfile[]
  is_root:   boolean
  user_id:   string | undefined
  on_fly:    (coords: [number, number]) => void
}) => {
  if (loading)
    return <div className="flex flex-1 items-center justify-center py-8 text-xs text-muted">Loading…</div>

  if (locations.length === 0)
    return <div className="py-6 text-center text-xs text-muted">No one is sharing yet.</div>

  return (
    <>
      {locations.map((loc) => {
        const is_you = loc.user_id === user_id
        const name   = loc.profile.full_name || loc.profile.username || "Unknown"
        return (
          <button
            key={loc.user_id}
            type="button"
            onClick={() => on_fly([loc.latitude, loc.longitude])}
            className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-line/40"
          >
            <div className="relative shrink-0">
              {loc.profile.avatar_url ? (
                <img src={loc.profile.avatar_url} alt={name} className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-line/60 text-[11px] font-bold text-ink">
                  {name.slice(0, 2).toUpperCase()}
                </div>
              )}
              {is_you && (
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-flag-red" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-medium text-ink">{name}</span>
                {is_you && <span className="text-[10px] text-flag-red">you</span>}
              </div>
              <div className="flex items-center gap-1.5">
                <RoleBadge role={loc.profile.role} />
                <span className="text-[10px] text-muted">{fmt_ago(loc.shared_at)}</span>
              </div>
            </div>
          </button>
        )
      })}

      {!is_root && (
        <p className="mt-auto pt-3 text-[10px] text-muted/60">
          Root member locations are not visible to you.
        </p>
      )}
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LocationsPage() {
  const { user }    = useAuth()
  const { profile } = useProfile()

  const [locations, set_locations] = useState<LocationWithProfile[]>([])
  const [loading, set_loading]     = useState(true)
  const [sharing, set_sharing]     = useState(false)
  const [stopping, set_stopping]   = useState(false)
  const [error_msg, set_error_msg] = useState<string | null>(null)
  const [countdown, set_countdown] = useState(REFRESH_INTERVAL)
  const [fly_to, set_fly_to]       = useState<[number, number] | null>(null)
  const [sheet_open, set_sheet]    = useState(false)

  const my_location = locations.find((l) => l.user_id === user?.id)
  const is_root     = profile?.role === "root"

  const load = useCallback(async () => {
    const data = await fetch_locations()
    set_locations(data)
    set_loading(false)
    set_countdown(REFRESH_INTERVAL)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const tick = setInterval(() => {
      set_countdown((prev) => {
        if (prev <= 1) { load(); return REFRESH_INTERVAL }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [load])

  const handle_share = async () => {
    if (!user) return
    set_sharing(true)
    set_error_msg(null)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10_000 }),
      )
      const { error } = await upsert_location(user.id, pos.coords.latitude, pos.coords.longitude)
      if (error) throw error
      await load()
      set_fly_to([pos.coords.latitude, pos.coords.longitude])
    } catch (e: unknown) {
      const msg = e instanceof GeolocationPositionError
        ? "Location access denied. Please allow location in your browser."
        : "Failed to share location."
      set_error_msg(msg)
    } finally {
      set_sharing(false)
    }
  }

  const handle_stop = async () => {
    if (!user) return
    set_stopping(true)
    await delete_location(user.id)
    await load()
    set_stopping(false)
  }

  const map_center: [number, number] = my_location
    ? [my_location.latitude, my_location.longitude]
    : locations.length
    ? [locations[0].latitude, locations[0].longitude]
    : [48.8566, 2.3522]

  const fly_and_close = (coords: [number, number]) => {
    set_fly_to(coords)
    set_sheet(false)
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden pt-[52px] lg:pt-0">

      {/* ── Header ── */}
      <div className="shrink-0 border-b border-line bg-card px-4 py-2.5 lg:px-5 lg:py-3">
        {/* Row 1: back + title */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              to="/"
              className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg border border-line text-muted transition-colors hover:bg-line/50 hover:text-ink"
              title="Back to app"
            >
              <ChevronsLeftIcon size={15} />
            </Link>
            <span className="h-4 w-px shrink-0 bg-line" />
            <MapPinIcon size={14} className="shrink-0 text-flag-red" />
            <h1 className="truncate text-sm font-semibold text-ink">Live Locations</h1>
            <span className="shrink-0 rounded-md border border-line bg-line/20 px-1.5 py-0.5 text-[10px] text-muted">
              {locations.length} sharing
            </span>
          </div>

          {/* Countdown — desktop only in row 1 */}
          <div className="hidden items-center gap-1.5 text-[10px] text-muted lg:flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flag-red opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-flag-red" />
            </span>
            {countdown}s
          </div>
        </div>

        {/* Row 2: actions */}
        <div className="mt-2 flex items-center gap-2">
          {/* Countdown — mobile */}
          <div className="flex items-center gap-1.5 text-[10px] text-muted lg:hidden">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flag-red opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-flag-red" />
            </span>
            {countdown}s
          </div>

          <div className="flex-1" />

          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-flag-red/30 hover:text-ink"
          >
            <span className="hidden sm:inline">Refresh now</span>
            <svg className="sm:hidden" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>

          {my_location ? (
            <button
              type="button"
              onClick={handle_stop}
              disabled={stopping}
              className="rounded-lg border border-flag-red/30 bg-flag-red/8 px-3 py-1.5 text-xs font-medium text-flag-red transition-opacity hover:opacity-75 disabled:opacity-40"
            >
              {stopping ? "Stopping…" : "Stop sharing"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handle_share}
              disabled={sharing}
              className="rounded-lg bg-flag-red px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {sharing ? "Getting location…" : "Share my location"}
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error_msg && (
        <div className="shrink-0 border-b border-flag-red/20 bg-flag-red/8 px-4 py-2 text-xs text-flag-red">
          {error_msg}
        </div>
      )}

      {/* ── Map + desktop sidebar ── */}
      <div className="relative flex flex-1 overflow-hidden">

        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-card p-3 lg:flex">
          <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
            Sharing now
          </p>
          <PeopleList
            loading={loading}
            locations={locations}
            is_root={is_root}
            user_id={user?.id}
            on_fly={fly_and_close}
          />
        </aside>

        {/* Map */}
        <div className="relative flex-1">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/60 backdrop-blur-sm">
              <span className="text-xs text-muted">Loading map…</span>
            </div>
          )}

          {!loading && locations.length === 0 && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-card/40 backdrop-blur-[2px]">
              <MapPinIcon size={32} className="text-muted/40" />
              <p className="text-sm font-medium text-muted">No locations shared yet</p>
              <p className="text-xs text-muted/60">Be the first — tap "Share my location"</p>
            </div>
          )}

          <style>{`
            .loc-popup .leaflet-popup-content-wrapper {
              background: #141414;
              border: 1px solid rgba(255,255,255,0.08);
              border-radius: 12px;
              box-shadow: 0 6px 24px rgba(0,0,0,0.55);
              padding: 0;
            }
            .loc-popup .leaflet-popup-content { margin: 0; }
            .loc-popup .leaflet-popup-tip { background: #141414; }
          `}</style>

          <MapContainer
            center={map_center}
            zoom={locations.length ? 13 : 4}
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <ZoomControl position="bottomright" />
            <FlyTo center={fly_to} />

            {locations.map((loc) => (
              <Marker
                key={loc.user_id}
                position={[loc.latitude, loc.longitude]}
                icon={make_icon(loc.profile, loc.user_id === user?.id)}
              >
                <Popup closeButton={false} className="loc-popup">
                  <div style={{ minWidth: 168, padding: "10px 12px" }}>
                    <div className="flex items-center gap-2.5">
                      {loc.profile.avatar_url ? (
                        <img src={loc.profile.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                      ) : (
                        <div style={{ background: "#2a2a2a", color: "#f5f5f5" }} className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold">
                          {(loc.profile.full_name || loc.profile.username || "?").slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p style={{ color: "#f5f5f5" }} className="text-xs font-semibold">
                          {loc.profile.full_name || loc.profile.username || "Unknown"}
                          {loc.user_id === user?.id && <span style={{ color: "#dc2626" }} className="ml-1">(you)</span>}
                        </p>
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <RoleBadge role={loc.profile.role} />
                        </div>
                      </div>
                    </div>
                    <p style={{ color: "#888", marginTop: 8 }} className="text-[10px]">Shared {fmt_ago(loc.shared_at)}</p>
                    <p style={{ color: "#555" }} className="mt-0.5 text-[10px]">
                      {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Mobile floating "People" pill */}
          {!loading && locations.length > 0 && (
            <button
              type="button"
              onClick={() => set_sheet(true)}
              className="absolute bottom-4 left-1/2 z-[400] -translate-x-1/2 flex items-center gap-2 rounded-full border border-line bg-card/90 px-4 py-2 text-xs font-semibold text-ink shadow-lg backdrop-blur-sm transition-colors hover:bg-card lg:hidden"
            >
              <MapPinIcon size={12} className="text-flag-red" />
              {locations.length} sharing
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Mobile bottom sheet ── */}
      {/* backdrop */}
      <div
        onClick={() => set_sheet(false)}
        className={`fixed inset-0 z-[500] bg-carbon-black/50 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
          sheet_open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      {/* sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-[510] flex max-h-[70vh] flex-col rounded-t-2xl border-t border-line bg-card transition-transform duration-300 ease-out lg:hidden ${
          sheet_open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* handle + header */}
        <div className="flex shrink-0 flex-col items-center px-4 pt-3 pb-2">
          <div className="mb-3 h-1 w-10 rounded-full bg-line" />
          <div className="flex w-full items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Sharing now</p>
            <button
              type="button"
              onClick={() => set_sheet(false)}
              className="grid h-6 w-6 place-items-center rounded-md text-muted hover:text-ink"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
        {/* scrollable list */}
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-6">
          <PeopleList
            loading={loading}
            locations={locations}
            is_root={is_root}
            user_id={user?.id}
            on_fly={fly_and_close}
          />
        </div>
      </div>

    </div>
  )
}
