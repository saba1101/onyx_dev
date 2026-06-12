import { useState } from "react"
import { Navigate } from "react-router"
import { motion, AnimatePresence } from "motion/react"
import { useAuth } from "~/features/auth/lib/auth"
import { useProfile } from "~/features/profile/lib/profile-context"
import { upsert_profile, upload_avatar, type ProfileUpdate } from "~/features/profile/lib/profile"
import { AvatarUploader } from "~/features/profile/components/avatar-uploader"
import { SideRail } from "~/components/ui/side-rail"
import { use_notify } from "~/hooks/use-notify"

export const meta = () => [{ title: "Profile — Onyx Dev" }]

const BASE_ROLES = ["member", "developer", "designer", "admin", "viewer"]

const Profile = () => {
  const { user, loading: auth_loading } = useAuth()
  const { profile, set_profile, loading: profile_loading } = useProfile()
  const notify = use_notify()

  const [editing, set_editing] = useState(false)
  const [form, set_form] = useState<ProfileUpdate>({})
  const [pending_file, set_pending_file] = useState<File | null>(null)
  const [saving, set_saving] = useState(false)

  if (auth_loading || profile_loading) return null
  if (!user) return <Navigate to="/login" replace />

  const display_name = profile?.full_name || profile?.username || user.email?.split("@")[0] || "User"

  const start_edit = () => {
    set_form({
      full_name: profile?.full_name ?? "",
      username: profile?.username ?? "",
      role: profile?.role ?? "member",
      bio: profile?.bio ?? "",
      avatar_url: profile?.avatar_url ?? "",
    })
    set_editing(true)
  }

  const cancel_edit = () => {
    set_pending_file(null)
    set_editing(false)
  }

  const handle_change = (field: keyof ProfileUpdate, value: string) => {
    set_form((prev) => ({ ...prev, [field]: value }))
  }

  // include a DB role that isn't in the hardcoded list
  const current_role = form.role ?? profile?.role ?? "member"
  const roles = BASE_ROLES.includes(current_role) ? BASE_ROLES : [current_role, ...BASE_ROLES]

  const handle_submit = async (e: React.FormEvent) => {
    e.preventDefault()
    set_saving(true)

    // upload image first if the user selected one
    let avatar_url = form.avatar_url || null
    if (pending_file) {
      const { url, error: upload_err } = await upload_avatar(user.id, pending_file)
      if (upload_err) {
        notify({ tone: "error", title: "Image upload failed", message: upload_err.message })
        set_saving(false)
        return
      }
      avatar_url = url
      set_pending_file(null)
    }

    const payload: ProfileUpdate = {
      full_name: form.full_name || null,
      username: form.username || null,
      bio: form.bio || null,
      avatar_url,
      role: form.role || "member",
    }
    const { data, error } = await upsert_profile(user.id, payload)
    if (error) {
      notify({ tone: "error", title: "Save failed", message: error.message })
    } else {
      set_profile(data)
      set_editing(false)
      notify({ tone: "success", title: "Profile saved", message: "Your changes have been applied." })
    }
    set_saving(false)
  }

  return (
    <div className="flex min-h-screen">
      <SideRail />
      <main className="flex flex-1 flex-col gap-10 p-8">

        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-start justify-between"
        >
          <div>
            <p className="text-[11px] uppercase tracking-widest text-flag-red">// profile</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {editing ? "Edit Profile" : "Profile"}
            </h1>
            <p className="mt-1 text-xs text-muted">
              {editing ? "Update your account information" : "Your account information"}
            </p>
          </div>

          {!editing && (
            <button
              onClick={start_edit}
              className="rounded-lg border border-line bg-card/60 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-line/50"
            >
              Edit profile
            </button>
          )}
        </motion.header>

        <AnimatePresence mode="wait">
          {editing ? (
            <motion.form
              key="edit"
              onSubmit={handle_submit}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="flex max-w-lg flex-col gap-6"
            >
              <div className="flex items-center gap-4">
                <AvatarUploader
                  url={form.avatar_url}
                  editing
                  on_file_select={set_pending_file}
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-ink">Profile photo</p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {pending_file ? `${pending_file.name} — save to apply` : "Click to choose a new image"}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4 overflow-hidden rounded-2xl border border-line bg-card/80 p-5 shadow-sm backdrop-blur">
                <EditField
                  label="Full name"
                  value={form.full_name ?? ""}
                  onChange={(v) => handle_change("full_name", v)}
                  placeholder="Jane Doe"
                  autoComplete="name"
                />
                <EditField
                  label="Username"
                  value={form.username ?? ""}
                  onChange={(v) => handle_change("username", v)}
                  placeholder="janedoe"
                  autoComplete="username"
                />
                <EditField
                  label="Bio"
                  value={form.bio ?? ""}
                  onChange={(v) => handle_change("bio", v)}
                  placeholder="A short bio about yourself"
                  multiline
                />

                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted">Role</span>
                  <select
                    value={current_role}
                    onChange={(e) => handle_change("role", e.target.value)}
                    className="rounded-lg border border-line bg-page/60 px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-flag-red"
                  >
                    {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted">Email</span>
                  <p className="rounded-lg border border-line bg-line/20 px-3 py-2 text-sm text-muted">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-flag-red px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={cancel_edit}
                  className="rounded-lg border border-line bg-card/60 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-line/50"
                >
                  Cancel
                </button>
              </div>
            </motion.form>
          ) : (
            <motion.div
              key="view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="flex max-w-lg flex-col gap-6"
            >
              <div className="flex items-center gap-4">
                <AvatarUploader
                  url={profile?.avatar_url}
                  editing={false}
                />
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-ink">{display_name}</p>
                  <p className="truncate text-xs text-muted">{user.email}</p>
                  {profile?.role && (
                    <span className="mt-1 inline-flex items-center gap-1.5 text-[10px] text-light-green">
                      <span className="h-1.5 w-1.5 rounded-full bg-light-green" />
                      {profile.role}
                    </span>
                  )}
                </div>
              </div>

              <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card/80 shadow-sm backdrop-blur">
                <ProfileField label="Full name" value={profile?.full_name} />
                <ProfileField label="Username" value={profile?.username} />
                <ProfileField label="Email" value={user.email} />
                <ProfileField label="Role" value={profile?.role} highlight />
                <ProfileField label="Bio" value={profile?.bio} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  )
}

const ProfileField = ({
  label,
  value,
  highlight,
}: {
  label: string
  value?: string | null
  highlight?: boolean
}) => (
  <div className="flex items-center gap-4 px-5 py-3.5">
    <p className="w-24 shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
    <p className={`truncate text-sm ${highlight ? "text-light-green" : "text-ink"} ${!value ? "italic text-muted/60" : ""}`}>
      {value || "—"}
    </p>
  </div>
)

const EditField = ({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  multiline,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
  multiline?: boolean
}) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
    {multiline ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-none rounded-lg border border-line bg-page/60 px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-flag-red"
      />
    ) : (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-line bg-page/60 px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-flag-red"
      />
    )}
  </div>
)

export default Profile
