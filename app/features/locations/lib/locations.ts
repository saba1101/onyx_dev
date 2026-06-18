import { supabase } from "~/lib/supabase"

export type UserLocation = {
  user_id:   string
  latitude:  number
  longitude: number
  shared_at: string
}

export type LocationProfile = {
  id:         string
  full_name:  string | null
  username:   string | null
  avatar_url: string | null
  role:       string
}

export type LocationWithProfile = UserLocation & { profile: LocationProfile }

export const fetch_locations = async (): Promise<LocationWithProfile[]> => {
  const { data: locs, error } = await supabase
    .from("user_locations")
    .select("*")
  if (error || !locs?.length) return []

  const ids = locs.map((l) => l.user_id)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url, role")
    .in("id", ids)

  const profile_map = new Map((profiles ?? []).map((p) => [p.id, p]))

  return locs.map((loc) => ({
    ...loc,
    profile: profile_map.get(loc.user_id) ?? {
      id:         loc.user_id,
      full_name:  null,
      username:   null,
      avatar_url: null,
      role:       "member",
    },
  }))
}

export const upsert_location = (user_id: string, lat: number, lng: number) =>
  supabase.from("user_locations").upsert(
    { user_id, latitude: lat, longitude: lng, shared_at: new Date().toISOString() },
    { onConflict: "user_id" },
  )

export const delete_location = (user_id: string) =>
  supabase.from("user_locations").delete().eq("user_id", user_id)

export const fmt_ago = (iso: string): string => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)  return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
