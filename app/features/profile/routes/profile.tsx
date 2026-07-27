import { useState, type ReactNode } from "react"
import { Navigate } from "react-router"
import { motion, AnimatePresence } from "motion/react"
import { useAuth } from "~/features/auth/lib/auth"
import { useProfile } from "~/features/profile/lib/profile-context"
import {
  upsert_profile,
  upload_avatar,
  check_avatar,
  status_options,
  status_tone,
  type ProfileUpdate,
  type profile_status,
} from "~/features/profile/lib/profile"
import { AvatarUploader } from "~/features/profile/components/avatar-uploader"
import { SideRail } from "~/components/ui/side-rail"
import { Dropdown, type dropdown_option } from "~/components/ui/dropdown"
import { use_notify } from "~/hooks/use-notify"
import {
  PencilIcon,
  MailIcon,
  PhoneIcon,
  MapPinIcon,
  GlobeIcon,
  BriefcaseIcon,
  CalendarIcon,
  ClockIcon,
  AtSignIcon,
  ShieldIcon,
  CheckIcon,
  ChevronIcon,
  XIcon,
  GithubIcon,
  TwitterIcon,
  LinkedinIcon,
} from "~/components/ui/icons"

export const meta = () => [{ title: "Profile — Onyx Dev" }]

const ease_out = [0.22, 1, 0.36, 1] as const

const month_year = (stamp?: string | null) => {
  if (!stamp) return "—"
  return new Date(stamp).toLocaleDateString(undefined, { month: "long", year: "numeric" })
}

const day_month_year = (stamp?: string | null) => {
  if (!stamp) return "—"
  return new Date(stamp).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

const tidy_url = (raw?: string | null) => {
  if (!raw) return ""
  return raw.replace(/^https?:\/\//, "").replace(/\/$/, "")
}

const with_protocol = (raw: string) => (/^https?:\/\//.test(raw) ? raw : `https://${raw}`)

const is_web_address = (raw: string) => {
  try {
    return new URL(with_protocol(raw)).hostname.includes(".")
  } catch {
    return false
  }
}

type field_errors = Partial<Record<keyof ProfileUpdate, string>>

const collect_errors = (form: ProfileUpdate): field_errors => {
  const found: field_errors = {}
  const username = (form.username ?? "").trim()
  if (username && !/^[a-zA-Z0-9_.]{2,30}$/.test(username)) {
    found.username = "2–30 characters: letters, numbers, dots or underscores."
  }
  const website = (form.website ?? "").trim()
  if (website && !is_web_address(website)) {
    found.website = "Enter a valid web address, like jane.dev."
  }
  return found
}

const trimmed = (value?: string | null) => {
  const text = (value ?? "").trim()
  return text.length ? text : null
}

const Profile = () => {
  const { user, loading: auth_loading } = useAuth()
  const { profile, set_profile, loading: profile_loading } = useProfile()
  const notify = use_notify()

  const [editing, set_editing] = useState(false)
  const [form, set_form] = useState<ProfileUpdate>({})
  const [pending_file, set_pending_file] = useState<File | null>(null)
  const [errors, set_errors] = useState<field_errors>({})
  const [saving, set_saving] = useState(false)
  const [status_saving, set_status_saving] = useState(false)

  if (auth_loading || profile_loading) return null
  if (!user) return <Navigate to="/login" replace />

  const display_name = profile?.full_name || profile?.username || user.email?.split("@")[0] || "User"
  const status = profile?.status ?? "active"
  const tone = status_tone[status]

  const start_edit = () => {
    set_form({
      full_name: profile?.full_name ?? "",
      username: profile?.username ?? "",
      status: profile?.status ?? "active",
      bio: profile?.bio ?? "",
      phone: profile?.phone ?? "",
      location: profile?.location ?? "",
      website: profile?.website ?? "",
      company: profile?.company ?? "",
      job_title: profile?.job_title ?? "",
      timezone: profile?.timezone ?? "",
      github_url: profile?.github_url ?? "",
      twitter_url: profile?.twitter_url ?? "",
      linkedin_url: profile?.linkedin_url ?? "",
      avatar_url: profile?.avatar_url ?? "",
    })
    set_editing(true)
  }

  const cancel_edit = () => {
    set_pending_file(null)
    set_errors({})
    set_editing(false)
  }

  const handle_change = (field: keyof ProfileUpdate, value: string) => {
    set_form((prev) => ({ ...prev, [field]: value }))
    set_errors((prev) => {
      if (!prev[field]) return prev
      const { [field]: _removed, ...rest } = prev
      return rest
    })
  }

  const switch_status = async (next: profile_status) => {
    if (!profile || next === profile.status || status_saving) return
    set_status_saving(true)
    const { data, error } = await upsert_profile(user.id, { status: next })
    if (error) {
      notify({ tone: "error", title: "Status not updated", message: error.message })
    } else {
      set_profile(data)
    }
    set_status_saving(false)
  }

  const handle_submit = async (e: React.FormEvent) => {
    e.preventDefault()

    const found = collect_errors(form)
    if (Object.keys(found).length) {
      set_errors(found)
      notify({ tone: "error", title: "Check the form", message: "Some fields need attention." })
      return
    }

    set_saving(true)

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
      full_name: trimmed(form.full_name),
      username: trimmed(form.username),
      status: (form.status as profile_status) || "active",
      bio: trimmed(form.bio),
      phone: trimmed(form.phone),
      location: trimmed(form.location),
      website: trimmed(form.website),
      company: trimmed(form.company),
      job_title: trimmed(form.job_title),
      timezone: trimmed(form.timezone),
      github_url: trimmed(form.github_url),
      twitter_url: trimmed(form.twitter_url),
      linkedin_url: trimmed(form.linkedin_url),
      avatar_url,
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

  const work_line = [profile?.job_title, profile?.company].filter(Boolean).join(" · ")

  return (
    <div className="flex min-h-screen">
      <SideRail />
      <main className="relative flex min-w-0 flex-1 flex-col gap-4 px-4 pb-12 pt-20 sm:px-6 lg:gap-5 lg:px-8 lg:pb-8 lg:pt-12">

        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: ease_out }}
          className="flex items-center justify-between gap-4 lg:absolute lg:inset-x-8 lg:top-2 lg:z-10"
        >
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold tracking-tight text-ink">
              {editing ? "Edit Profile" : "Profile"}
            </h1>
            <span className="hidden text-[11px] text-muted sm:block">
              {editing ? "Update your account information" : "Your account information"}
            </span>
          </div>

          {!editing && (
            <button
              onClick={start_edit}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-card/60 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-line/50"
            >
              <PencilIcon size={13} />
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
              transition={{ duration: 0.25, ease: ease_out }}
              className="grid w-full gap-5 lg:grid-cols-2"
            >
              <div className="surface flex items-center gap-4 rounded-2xl p-5 lg:col-span-2">
                <AvatarUploader
                  url={form.avatar_url}
                  editing
                  on_file_select={set_pending_file}
                  validate={check_avatar}
                  on_reject={(message) => notify({ tone: "error", title: "Invalid image", message })}
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-ink">Profile photo</p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {pending_file ? `${pending_file.name} — save to apply` : "Click the photo to choose a new image"}
                  </p>
                </div>
              </div>

              <EditCard title="Identity">
                <EditField label="Full name" value={form.full_name ?? ""} onChange={(v) => handle_change("full_name", v)} placeholder="Jane Doe" autoComplete="name" maxLength={80} />
                <EditField label="Username" value={form.username ?? ""} onChange={(v) => handle_change("username", v)} placeholder="janedoe" autoComplete="username" maxLength={30} error={errors.username} />
                <SelectField
                  label="Status"
                  value={(form.status as string) ?? "active"}
                  onChange={(v) => handle_change("status", v)}
                  options={status_choices}
                />
              </EditCard>

              <EditCard title="Contact">
                <EditField label="Phone" value={form.phone ?? ""} onChange={(v) => handle_change("phone", v)} placeholder="+1 555 0100" autoComplete="tel" maxLength={30} />
                <EditField label="Location" value={form.location ?? ""} onChange={(v) => handle_change("location", v)} placeholder="Berlin, Germany" maxLength={80} />
                <EditField label="Website" value={form.website ?? ""} onChange={(v) => handle_change("website", v)} placeholder="jane.dev" maxLength={120} error={errors.website} />
                <ReadOnlyField label="Email" value={user.email} />
              </EditCard>

              <EditCard title="Work">
                <EditField label="Company" value={form.company ?? ""} onChange={(v) => handle_change("company", v)} placeholder="Onyx Labs" autoComplete="organization" maxLength={80} />
                <EditField label="Job title" value={form.job_title ?? ""} onChange={(v) => handle_change("job_title", v)} placeholder="Frontend Engineer" maxLength={80} />
                <EditField label="Timezone" value={form.timezone ?? ""} onChange={(v) => handle_change("timezone", v)} placeholder="GMT+1" maxLength={40} />
              </EditCard>

              <EditCard title="Social">
                <EditField label="GitHub" value={form.github_url ?? ""} onChange={(v) => handle_change("github_url", v)} placeholder="github.com/janedoe" maxLength={120} />
                <EditField label="X / Twitter" value={form.twitter_url ?? ""} onChange={(v) => handle_change("twitter_url", v)} placeholder="x.com/janedoe" maxLength={120} />
                <EditField label="LinkedIn" value={form.linkedin_url ?? ""} onChange={(v) => handle_change("linkedin_url", v)} placeholder="linkedin.com/in/janedoe" maxLength={120} />
              </EditCard>

              <div className="lg:col-span-2">
                <EditCard title="About">
                  <EditField label="Bio" value={form.bio ?? ""} onChange={(v) => handle_change("bio", v)} placeholder="A short bio about yourself" multiline maxLength={300} />
                </EditCard>
              </div>

              <div className="flex items-center gap-3 lg:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-flag-red px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  <CheckIcon size={15} />
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={cancel_edit}
                  className="inline-flex items-center gap-2 rounded-lg border border-line bg-card/60 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-line/50"
                >
                  <XIcon size={15} />
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
              transition={{ duration: 0.25, ease: ease_out }}
              className="flex w-full flex-col gap-5"
            >
              <section className="surface relative z-20 rounded-2xl p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-4">
                    <AvatarUploader url={profile?.avatar_url} editing={false} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold tracking-tight text-ink">{display_name}</h2>
                        <span className="inline-flex items-center gap-1 rounded-md bg-flag-red/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-flag-red">
                          <ShieldIcon size={11} />
                          {profile?.role ?? "member"}
                        </span>
                      </div>
                      {profile?.username && <p className="mt-0.5 text-xs text-muted">@{profile.username}</p>}

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
                        {work_line && <MetaChip icon={<BriefcaseIcon size={13} />} label={work_line} />}
                        {profile?.location && <MetaChip icon={<MapPinIcon size={13} />} label={profile.location} />}
                        <MetaChip icon={<CalendarIcon size={13} />} label={`Joined ${month_year(profile?.created_at)}`} />
                      </div>
                    </div>
                  </div>

                  <StatusSwitcher current={status} saving={status_saving} on_select={switch_status} />
                </div>
              </section>

              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard icon={<span className={`h-2 w-2 rounded-full ${tone.dot}`} />} label="Status" value={tone.label} />
                <StatCard icon={<CalendarIcon size={15} className="text-muted" />} label="Member since" value={month_year(profile?.created_at)} />
                <StatCard icon={<ClockIcon size={15} className="text-muted" />} label="Last updated" value={day_month_year(profile?.updated_at)} />
              </div>

              {profile?.bio && (
                <SectionCard title="About">
                  <p className="text-sm leading-relaxed text-ink">{profile.bio}</p>
                </SectionCard>
              )}

              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" }}
              >
                <SectionCard title="Contact">
                  <InfoRow icon={<MailIcon size={15} />} label="Email" value={user.email} />
                  <InfoRow icon={<PhoneIcon size={15} />} label="Phone" value={profile?.phone} />
                  <InfoRow icon={<GlobeIcon size={15} />} label="Website" value={tidy_url(profile?.website)} href={profile?.website ? with_protocol(profile.website) : undefined} />
                  <InfoRow icon={<MapPinIcon size={15} />} label="Location" value={profile?.location} />
                </SectionCard>

                <SectionCard title="Work">
                  <InfoRow icon={<BriefcaseIcon size={15} />} label="Company" value={profile?.company} />
                  <InfoRow icon={<AtSignIcon size={15} />} label="Job title" value={profile?.job_title} />
                  <InfoRow icon={<ClockIcon size={15} />} label="Timezone" value={profile?.timezone} />
                </SectionCard>

                {(profile?.github_url || profile?.twitter_url || profile?.linkedin_url) && (
                  <SectionCard title="Social">
                    <div className="flex flex-wrap gap-2.5">
                      <SocialLink icon={<GithubIcon size={15} />} label="GitHub" href={profile?.github_url} />
                      <SocialLink icon={<TwitterIcon size={14} />} label="X" href={profile?.twitter_url} />
                      <SocialLink icon={<LinkedinIcon size={15} />} label="LinkedIn" href={profile?.linkedin_url} />
                    </div>
                  </SectionCard>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  )
}

const status_choices = status_options.map((opt) => ({ ...opt, dot: status_tone[opt.value].dot }))

const StatusSwitcher = ({
  current,
  saving,
  on_select,
}: {
  current: profile_status
  saving: boolean
  on_select: (next: profile_status) => void
}) => {
  const tone = status_tone[current]

  return (
    <Dropdown
      value={current}
      options={status_choices}
      on_select={(next) => on_select(next as profile_status)}
      disabled={saving}
      align="right"
      menu_width="w-36"
      trigger_class={`inline-flex items-center gap-1.5 rounded-full border border-line bg-card/80 px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-line/40 disabled:opacity-60 ${tone.text}`}
    >
      {({ open }) => (
        <>
          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
          {saving ? "Saving…" : tone.label}
          <ChevronIcon size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </>
      )}
    </Dropdown>
  )
}

const MetaChip = ({ icon, label }: { icon: ReactNode; label: string }) => (
  <span className="inline-flex items-center gap-1.5">
    {icon}
    {label}
  </span>
)

const StatCard = ({ icon, label, value }: { icon: ReactNode; label: string; value: string }) => (
  <div className="surface rounded-xl border-l-2 border-l-flag-red/25 px-4 py-3">
    <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-muted">
      {icon}
      {label}
    </div>
    <p className="mt-1.5 text-sm font-semibold text-ink">{value}</p>
  </div>
)

const SectionCard = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="surface rounded-2xl p-5">
    <p className="mb-3 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted before:h-px before:w-3 before:bg-flag-red/50 before:content-['']">{title}</p>
    <div className="flex flex-col gap-3">{children}</div>
  </section>
)

const InfoRow = ({
  icon,
  label,
  value,
  href,
}: {
  icon: ReactNode
  label: string
  value?: string | null
  href?: string
}) => (
  <div className="flex items-center gap-3">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-line/30 text-muted dark:bg-obsidian dark:text-muted">{icon}</span>
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</p>
      {href && value ? (
        <a href={href} target="_blank" rel="noreferrer" className="truncate text-sm text-flag-red transition-opacity hover:opacity-80">
          {value}
        </a>
      ) : (
        <p className={`truncate text-sm ${value ? "text-ink" : "italic text-muted/60"}`}>{value || "—"}</p>
      )}
    </div>
  </div>
)

const SocialLink = ({ icon, label, href }: { icon: ReactNode; label: string; href?: string | null }) => {
  if (!href) return null
  return (
    <a
      href={with_protocol(href)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-lg border border-line bg-line/20 px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-line/40 dark:bg-obsidian dark:hover:bg-white/5"
    >
      {icon}
      {label}
    </a>
  )
}

const EditCard = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="surface rounded-2xl p-5">
    <p className="mb-4 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted before:h-px before:w-3 before:bg-flag-red/50 before:content-['']">{title}</p>
    <div className="flex flex-col gap-4">{children}</div>
  </div>
)

const EditField = ({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  multiline,
  maxLength,
  error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
  multiline?: boolean
  maxLength?: number
  error?: string
}) => {
  const edge = error ? "border-flag-red" : "border-line focus:border-flag-red"
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          maxLength={maxLength}
          className={`w-full resize-none rounded-lg border bg-page/60 px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted/50 ${edge}`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          maxLength={maxLength}
          className={`w-full rounded-lg border bg-page/60 px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted/50 ${edge}`}
        />
      )}
      {error && <span className="text-[11px] text-flag-red">{error}</span>}
    </div>
  )
}

const SelectField = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: dropdown_option[]
}) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
    <Dropdown
      value={value}
      options={options}
      on_select={onChange}
      menu_width="w-full"
      trigger_class="flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-page/60 px-3 py-2 text-sm text-ink outline-none transition-colors hover:border-flag-red"
    >
      {({ open, selected }) => (
        <>
          <span className="flex items-center gap-2">
            {selected?.dot && <span className={`h-2 w-2 rounded-full ${selected.dot}`} />}
            {selected?.label ?? "Select"}
          </span>
          <ChevronIcon size={14} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
        </>
      )}
    </Dropdown>
  </div>
)

const ReadOnlyField = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
    <p className="rounded-lg border border-line bg-line/20 px-3 py-2 text-sm text-muted">{value || "—"}</p>
  </div>
)

export default Profile
