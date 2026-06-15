import { supabase } from "~/lib/supabase"

export type profile_status = "active" | "away" | "busy" | "offline"

export type Profile = {
  id: string
  email: string | null
  username: string | null
  full_name: string | null
  avatar_url: string | null
  role: string
  status: profile_status
  bio: string | null
  phone: string | null
  location: string | null
  website: string | null
  company: string | null
  job_title: string | null
  timezone: string | null
  github_url: string | null
  twitter_url: string | null
  linkedin_url: string | null
  created_at: string | null
  updated_at: string | null
  last_seen_at: string | null
}

export type ProfileUpdate = Partial<Omit<Profile, "id" | "role" | "created_at" | "updated_at">>

export const status_options: { value: profile_status; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "away", label: "Away" },
  { value: "busy", label: "Busy" },
  { value: "offline", label: "Offline" },
]

// Returns the status that should actually be displayed for a user.
// If last_seen_at is older than 3 minutes the user is considered offline
// regardless of what their status field says (handles closed-browser case).
export const effective_status = (
  status: profile_status,
  last_seen_at: string | null,
): profile_status => {
  if (status === "offline") return "offline"
  if (!last_seen_at) return status
  const stale = Date.now() - new Date(last_seen_at).getTime() > 3 * 60_000
  return stale ? "offline" : status
}

export const status_tone: Record<profile_status, { label: string; dot: string; text: string }> = {
  active: { label: "Active", dot: "bg-light-green", text: "text-light-green" },
  away: { label: "Away", dot: "bg-royal-gold", text: "text-royal-gold" },
  busy: { label: "Busy", dot: "bg-flag-red", text: "text-flag-red" },
  offline: { label: "Offline", dot: "bg-muted", text: "text-muted" },
}

export const get_profile = async (user_id: string): Promise<Profile | null> => {
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user_id)
    .single()
  return profile ?? null
}

export const upsert_profile = async (user_id: string, updates: ProfileUpdate) => {
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: user_id, ...updates, updated_at: new Date().toISOString() })
    .select()
    .single()
  return { data, error }
}

export const avatar_max_bytes = 2 * 1024 * 1024

export const avatar_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]

const ext_by_type: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}

const readable_size = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)}MB`

export const check_avatar = (file: File): string | null => {
  if (!avatar_types.includes(file.type)) return "Use a JPG, PNG, WebP, or GIF image."
  if (file.size > avatar_max_bytes) return `Image must be under ${readable_size(avatar_max_bytes)}.`
  return null
}

export const upload_avatar = async (user_id: string, file: File) => {
  const problem = check_avatar(file)
  if (problem) return { url: null, error: { message: problem } }

  const ext = ext_by_type[file.type] ?? "jpg"
  const path = `${user_id}/avatar.${ext}`

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true })

  if (error) return { url: null, error }

  const { data: published } = supabase.storage.from("avatars").getPublicUrl(path)
  return { url: `${published.publicUrl}?v=${Date.now()}`, error: null }
}
