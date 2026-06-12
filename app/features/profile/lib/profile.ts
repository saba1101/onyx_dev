import { supabase } from "~/lib/supabase"

export type Profile = {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  role: string
  bio: string | null
  updated_at: string | null
}

export type ProfileUpdate = Partial<Omit<Profile, "id" | "updated_at">>

export const get_profile = async (user_id: string): Promise<Profile | null> => {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user_id)
    .single()
  return data ?? null
}

export const upsert_profile = async (user_id: string, updates: ProfileUpdate) => {
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: user_id, ...updates, updated_at: new Date().toISOString() })
    .select()
    .single()
  return { data, error }
}

export const upload_avatar = async (user_id: string, file: File) => {
  const ext = file.name.split(".").pop() ?? "jpg"
  const path = `${user_id}/avatar.${ext}`

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true })

  if (error) return { url: null, error }

  const { data } = supabase.storage.from("avatars").getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}
