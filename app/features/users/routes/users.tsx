import { useEffect, useRef, useState, type ReactNode } from "react"
import { Navigate } from "react-router"
import { motion } from "motion/react"
import { useAuth } from "~/features/auth/lib/auth"
import { useProfile } from "~/features/profile/lib/profile-context"
import { use_presence_tick } from "~/hooks/use-presence-tick"
import { AccessTab } from "~/features/permissions/routes/permissions"
import { effective_status, status_options, status_tone } from "~/features/profile/lib/profile"
import { SideRail } from "~/components/ui/side-rail"
import { Modal } from "~/components/ui/modal"
import { Dropdown } from "~/components/ui/dropdown"
import { use_notify } from "~/hooks/use-notify"
import {
  SearchIcon, TrashIcon, BanIcon, PencilIcon,
  CheckIcon, XIcon, ChevronIcon, ShieldIcon,
  MailIcon, PhoneIcon, MapPinIcon, GlobeIcon,
  BriefcaseIcon, ClockIcon, AtSignIcon,
  GithubIcon, TwitterIcon, LinkedinIcon, CalendarIcon,
} from "~/components/ui/icons"
import { supabase } from "~/lib/supabase"
import {
  list_users_admin, admin_update, admin_ban, admin_unban, admin_delete,
  list_public_profiles,
  role_options, role_style, format_date, format_rel,
  type UserAdmin, type AdminUpdate, type PublicProfile,
} from "~/features/users/lib/users"

export const meta = () => [{ title: "Team — Onyx Dev" }]

// ─── Avatar ──────────────────────────────────────────────────────────────────

const Avatar = ({ url, name, size = "md" }: { url?: string | null; name: string; size?: "sm" | "md" | "lg" }) => {
  const dim = size === "sm" ? "h-8 w-8 text-[10px]" : size === "lg" ? "h-16 w-16 text-lg" : "h-10 w-10 text-xs"
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?"
  return (
    <div className={`shrink-0 ${dim} overflow-hidden rounded-full border border-line bg-line/40`}>
      {url
        ? <img src={url} alt={name} className="h-full w-full object-cover" />
        : <div className="flex h-full w-full items-center justify-center font-semibold text-muted">{initials}</div>
      }
    </div>
  )
}

// ─── Detail modal ─────────────────────────────────────────────────────────────

type DetailModalProps = {
  user: UserAdmin | null
  current_uid: string
  on_close: () => void
  on_save: (updated: UserAdmin) => void
  on_remove: (id: string) => void
}

const DetailModal = ({ user, current_uid, on_close, on_save, on_remove }: DetailModalProps) => {
  const notify = use_notify()
  const [editing, set_editing]             = useState(false)
  const [form, set_form]                   = useState<AdminUpdate>({})
  const [saving, set_saving]               = useState(false)
  const [banning, set_banning]             = useState(false)
  const [confirm, set_confirm]             = useState<"delete" | null>(null)
  const [deleting, set_deleting]           = useState(false)

  useEffect(() => {
    if (!user) { set_editing(false); set_confirm(null) }
  }, [user])

  if (!user) return null

  const is_self     = user.id === current_uid
  const is_banned   = !!user.banned_until && new Date(user.banned_until) > new Date()
  const display     = user.full_name || user.username || user.email?.split("@")[0] || "User"
  const role_info   = role_style[user.role] ?? role_style.member
  const tone        = status_tone[effective_status(user.status ?? "offline", user.last_seen_at)]

  const start_edit = () => {
    set_form({
      full_name: user.full_name ?? "", username: user.username ?? "",
      email: user.email ?? "", role: user.role, status: user.status,
      bio: user.bio ?? "", phone: user.phone ?? "", location: user.location ?? "",
      website: user.website ?? "", company: user.company ?? "",
      job_title: user.job_title ?? "", timezone: user.timezone ?? "",
      github_url: user.github_url ?? "", twitter_url: user.twitter_url ?? "",
      linkedin_url: user.linkedin_url ?? "",
    })
    set_editing(true)
  }

  const handle_save = async () => {
    set_saving(true)
    const { data, error } = await admin_update(user.id, form)
    if (error) {
      notify({ tone: "error", title: "Save failed", message: error.message })
    } else if (data) {
      on_save({ ...user, ...data })
      set_editing(false)
      notify({ tone: "success", title: "User updated", message: `${display} has been saved.` })
    }
    set_saving(false)
  }

  const handle_ban = async () => {
    set_banning(true)
    const { error } = is_banned ? await admin_unban(user.id) : await admin_ban(user.id)
    if (error) {
      notify({ tone: "error", title: "Failed", message: error.message })
    } else {
      const next_banned = is_banned ? null : new Date(Date.now() + 100 * 365 * 86400_000).toISOString()
      on_save({ ...user, banned_until: next_banned })
      notify({ tone: "success", title: is_banned ? "User unbanned" : "User banned", message: display })
    }
    set_banning(false)
  }

  const handle_delete = async () => {
    set_deleting(true)
    const { error } = await admin_delete(user.id)
    if (error) {
      notify({ tone: "error", title: "Delete failed", message: error.message })
      set_deleting(false)
    } else {
      notify({ tone: "success", title: "User deleted", message: `${display} has been removed.` })
      on_remove(user.id)
      on_close()
    }
  }

  const field = (v: string | null | undefined) =>
    form[v as keyof AdminUpdate] as string ?? ""

  const set = (k: keyof AdminUpdate) => (v: string) =>
    set_form(p => ({ ...p, [k]: v }))

  return (
    <Modal
      open={!!user}
      on_close={() => { if (!saving && !deleting) { set_editing(false); set_confirm(null); on_close() } }}
      title={editing ? "Edit User" : display}
      size="xl"
    >
      {/* ── Hero row ── */}
      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-line/60 bg-line/10 p-4 dark:bg-white/[0.02]">
        <Avatar url={user.avatar_url} name={display} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-ink">{display}</p>
            <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${role_info.classes}`}>
              <ShieldIcon size={10} />
              {role_info.label}
            </span>
            {is_banned && (
              <span className="inline-flex items-center gap-1 rounded-md border border-flag-red/30 bg-flag-red/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-flag-red">
                Banned
              </span>
            )}
          </div>
          {user.username && <p className="mt-0.5 text-xs text-muted">@{user.username}</p>}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
            <span className={`inline-flex items-center gap-1.5 ${tone.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} /> {tone.label}
            </span>
            <span>Joined {format_date(user.created_at)}</span>
            <span>Last seen {format_rel(user.last_sign_in_at)}</span>
            {user.confirmed_at && <span className="text-light-green">Verified</span>}
          </div>
        </div>
      </div>

      {editing ? (
        /* ── Edit form ── */
        <div className="grid gap-4 sm:grid-cols-2">
          <EditSection title="Identity">
            <EF label="Full name"  value={field("full_name")}  onChange={set("full_name")}  placeholder="Jane Doe" />
            <EF label="Username"   value={field("username")}   onChange={set("username")}   placeholder="janedoe" />
            <EF label="Email"      value={field("email")}      onChange={set("email")}      placeholder="jane@example.com" type="email" />
            <DF label="Role"
              value={form.role ?? user.role}
              options={role_options}
              onChange={(v) => set_form(p => ({ ...p, role: v }))}
            />
            <DF label="Status"
              value={form.status ?? user.status}
              options={status_options}
              onChange={(v) => set_form(p => ({ ...p, status: v as UserAdmin["status"] }))}
            />
          </EditSection>

          <EditSection title="Contact">
            <EF label="Phone"    value={field("phone")}    onChange={set("phone")}    placeholder="+1 555 0100" />
            <EF label="Location" value={field("location")} onChange={set("location")} placeholder="Berlin, Germany" />
            <EF label="Website"  value={field("website")}  onChange={set("website")}  placeholder="jane.dev" />
          </EditSection>

          <EditSection title="Work">
            <EF label="Company"   value={field("company")}   onChange={set("company")}   placeholder="Onyx Labs" />
            <EF label="Job title" value={field("job_title")} onChange={set("job_title")} placeholder="Engineer" />
            <EF label="Timezone"  value={field("timezone")}  onChange={set("timezone")}  placeholder="GMT+1" />
          </EditSection>

          <EditSection title="Social">
            <EF label="GitHub"    value={field("github_url")}   onChange={set("github_url")}   placeholder="github.com/jane" />
            <EF label="X"         value={field("twitter_url")}  onChange={set("twitter_url")}  placeholder="x.com/jane" />
            <EF label="LinkedIn"  value={field("linkedin_url")} onChange={set("linkedin_url")} placeholder="linkedin.com/in/jane" />
          </EditSection>

          <div className="sm:col-span-2">
            <EditSection title="About">
              <EF label="Bio" value={field("bio")} onChange={set("bio")} placeholder="Short bio…" multiline />
            </EditSection>
          </div>

          <div className="flex gap-3 sm:col-span-2">
            <button
              onClick={handle_save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-flag-red px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <CheckIcon size={14} /> {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              onClick={() => set_editing(false)}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-card/60 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-line/40"
            >
              <XIcon size={14} /> Cancel
            </button>
          </div>
        </div>
      ) : (
        /* ── View ── */
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <ViewSection title="Contact">
              <IR icon={<MailIcon size={14} />}      label="Email"    value={user.email} />
              <IR icon={<PhoneIcon size={14} />}     label="Phone"    value={user.phone} />
              <IR icon={<MapPinIcon size={14} />}    label="Location" value={user.location} />
              <IR icon={<GlobeIcon size={14} />}     label="Website"  value={user.website}
                href={user.website ? (user.website.startsWith("http") ? user.website : `https://${user.website}`) : undefined} />
            </ViewSection>

            <ViewSection title="Work">
              <IR icon={<BriefcaseIcon size={14} />} label="Company"  value={user.company} />
              <IR icon={<AtSignIcon size={14} />}    label="Title"    value={user.job_title} />
              <IR icon={<ClockIcon size={14} />}     label="Timezone" value={user.timezone} />
            </ViewSection>
          </div>

          {(user.github_url || user.twitter_url || user.linkedin_url) && (
            <ViewSection title="Social">
              <div className="flex flex-wrap gap-2">
                {user.github_url   && <SL icon={<GithubIcon size={14} />}   label="GitHub"   href={user.github_url} />}
                {user.twitter_url  && <SL icon={<TwitterIcon size={13} />}  label="X"        href={user.twitter_url} />}
                {user.linkedin_url && <SL icon={<LinkedinIcon size={14} />} label="LinkedIn" href={user.linkedin_url} />}
              </div>
            </ViewSection>
          )}

          {user.bio && (
            <ViewSection title="About">
              <p className="text-sm leading-relaxed text-ink">{user.bio}</p>
            </ViewSection>
          )}

          <ViewSection title="Auth metadata">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Meta label="User ID"     value={user.id.slice(0, 8) + "…"} mono />
              <Meta label="Joined"      value={format_date(user.created_at)} />
              <Meta label="Last active" value={format_rel(user.last_sign_in_at)} />
              <Meta label="Verified"    value={user.confirmed_at ? "Yes" : "No"} />
              <Meta label="Banned"      value={is_banned ? "Yes" : "No"} highlight={is_banned} />
              <Meta label="Role"        value={role_info.label} />
            </div>
          </ViewSection>

          {/* Actions */}
          {confirm === "delete" ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-flag-red/30 bg-flag-red/5 p-4">
              <p className="flex-1 text-sm text-ink">
                Permanently delete <strong>{display}</strong>? This removes their auth account and cannot be undone.
              </p>
              <button
                onClick={handle_delete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-flag-red px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                <TrashIcon size={14} /> {deleting ? "Deleting…" : "Confirm delete"}
              </button>
              <button
                onClick={() => set_confirm(null)}
                className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-ink"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <button
                onClick={start_edit}
                className="inline-flex items-center gap-2 rounded-lg border border-line bg-card/60 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-line/40"
              >
                <PencilIcon size={13} /> Edit profile
              </button>

              {!is_self && (
                <>
                  <button
                    onClick={handle_ban}
                    disabled={banning}
                    className="inline-flex items-center gap-2 rounded-lg border border-line bg-card/60 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-royal-gold/40 hover:text-royal-gold disabled:opacity-60"
                  >
                    <BanIcon size={13} /> {banning ? "Working…" : is_banned ? "Unban user" : "Ban user"}
                  </button>
                  <button
                    onClick={() => set_confirm("delete")}
                    className="inline-flex items-center gap-2 rounded-lg border border-line bg-card/60 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-flag-red/40 hover:text-flag-red"
                  >
                    <TrashIcon size={13} /> Delete user
                  </button>
                </>
              )}
              {is_self && (
                <p className="self-center text-[11px] text-muted italic">You cannot ban or delete your own account.</p>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

// ─── Sub-components used by the modal ────────────────────────────────────────

const ViewSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="rounded-xl border border-line/60 bg-line/10 p-4 dark:bg-white/[0.02]">
    <p className="mb-3 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted before:h-px before:w-3 before:bg-flag-red/50 before:content-['']">{title}</p>
    <div className="space-y-2.5">{children}</div>
  </div>
)

const EditSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="rounded-xl border border-line/60 bg-line/10 p-4 dark:bg-white/[0.02]">
    <p className="mb-3 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted before:h-px before:w-3 before:bg-flag-red/50 before:content-['']">{title}</p>
    <div className="space-y-3">{children}</div>
  </div>
)

const IR = ({ icon, label, value, href }: { icon: ReactNode; label: string; value?: string | null; href?: string }) => (
  <div className="flex items-center gap-2.5">
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-line/30 text-muted dark:bg-obsidian">{icon}</span>
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      {href && value
        ? <a href={href} target="_blank" rel="noreferrer" className="truncate text-xs text-flag-red hover:underline">{value}</a>
        : <p className={`truncate text-xs ${value ? "text-ink" : "italic text-muted/50"}`}>{value || "—"}</p>
      }
    </div>
  </div>
)

const SL = ({ icon, label, href }: { icon: ReactNode; label: string; href?: string | null }) => {
  if (!href) return null
  const url = href.startsWith("http") ? href : `https://${href}`
  return (
    <a href={url} target="_blank" rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-line/20 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-line/40 dark:bg-obsidian dark:hover:bg-white/5"
    >
      {icon} {label}
    </a>
  )
}

const Meta = ({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
    <p className={`mt-0.5 text-xs font-medium ${highlight ? "text-flag-red" : "text-ink"} ${mono ? "font-mono" : ""}`}>{value}</p>
  </div>
)

const EF = ({
  label, value, onChange, placeholder, type = "text", multiline,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; multiline?: boolean }) => (
  <div>
    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
    {multiline
      ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3}
          className="w-full resize-none rounded-lg border border-line bg-page/60 px-3 py-2 text-xs text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-flag-red" />
      : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="w-full rounded-lg border border-line bg-page/60 px-3 py-2 text-xs text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-flag-red" />
    }
  </div>
)

const DF = ({
  label, value, options, onChange,
}: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) => (
  <div>
    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
    <Dropdown value={value} options={options} on_select={onChange} menu_width="w-full"
      trigger_class="flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-page/60 px-3 py-2 text-xs text-ink outline-none transition-colors hover:border-flag-red"
    >
      {({ open, selected }) => (
        <>
          <span>{selected?.label ?? "Select"}</span>
          <ChevronIcon size={12} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
        </>
      )}
    </Dropdown>
  </div>
)

// ─── Users table row ──────────────────────────────────────────────────────────

const UserRow = ({ user, on_click }: { user: UserAdmin; on_click: () => void }) => {
  const tone      = status_tone[effective_status(user.status ?? "offline", user.last_seen_at)]
  const role_info = role_style[user.role] ?? role_style.member
  const display   = user.full_name || user.username || user.email?.split("@")[0] || "—"
  const is_banned = !!user.banned_until && new Date(user.banned_until) > new Date()

  return (
    <tr
      onClick={on_click}
      className="group cursor-pointer border-b border-line/50 transition-colors last:border-0 hover:bg-flag-red/[0.03] dark:hover:bg-flag-red/[0.05]"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar url={user.avatar_url} name={display} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-ink">{display}</p>
              {is_banned && (
                <span className="shrink-0 rounded bg-flag-red/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-flag-red">banned</span>
              )}
            </div>
            <p className="truncate text-[11px] text-muted">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${role_info.classes}`}>
          {role_info.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 text-xs ${tone.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
          {tone.label}
        </span>
      </td>
      <td className="hidden px-4 py-3 text-xs text-muted md:table-cell">
        {user.location || "—"}
      </td>
      <td className="hidden px-4 py-3 text-[11px] text-muted lg:table-cell">
        {format_rel(user.last_sign_in_at)}
      </td>
      <td className="px-4 py-3 text-right">
        <span className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[11px] font-medium text-muted transition-colors group-hover:border-flag-red/40 group-hover:text-flag-red">
          View <ChevronIcon size={11} className="-rotate-90" />
        </span>
      </td>
    </tr>
  )
}

const UserCard = ({ user, on_click }: { user: UserAdmin; on_click: () => void }) => {
  const tone      = status_tone[effective_status(user.status ?? "offline", user.last_seen_at)]
  const role_info = role_style[user.role] ?? role_style.member
  const display   = user.full_name || user.username || user.email?.split("@")[0] || "—"
  const is_banned = !!user.banned_until && new Date(user.banned_until) > new Date()

  return (
    <button
      type="button"
      onClick={on_click}
      className="flex w-full items-center gap-3 border-b border-line/50 px-4 py-3 text-left transition-colors last:border-0 hover:bg-flag-red/[0.03] active:bg-flag-red/[0.06]"
    >
      <Avatar url={user.avatar_url} name={display} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium text-ink">{display}</p>
          {is_banned && (
            <span className="shrink-0 rounded bg-flag-red/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-flag-red">banned</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-px text-[9px] font-medium uppercase tracking-wide ${role_info.classes}`}>
            {role_info.label}
          </span>
          <span className={`inline-flex items-center gap-1 text-[11px] ${tone.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
            {tone.label}
          </span>
        </div>
      </div>
      <ChevronIcon size={14} className="-rotate-90 shrink-0 text-muted" />
    </button>
  )
}

// ─── Member view ─────────────────────────────────────────────────────────────

const TeamCard = ({ p, on_click }: { p: PublicProfile; on_click: () => void }) => {
  const tone     = status_tone[effective_status(p.status ?? "offline", p.last_seen_at)]
  const ri       = role_style[p.role] ?? role_style.member
  const display  = p.full_name || p.username || "User"
  const work_line = [p.job_title, p.company].filter(Boolean).join(" · ")

  return (
    <motion.button
      type="button"
      onClick={on_click}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18 }}
      className="surface group flex w-full flex-col items-center rounded-2xl p-5 text-center transition-shadow hover:shadow-lg"
    >
      {/* Avatar + online dot */}
      <div className="relative mb-3">
        <Avatar url={p.avatar_url} name={display} size="lg" />
        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${tone.dot}`} />
      </div>

      <p className="w-full truncate text-sm font-semibold text-ink">{display}</p>
      {p.username && <p className="mt-0.5 w-full truncate text-[11px] text-muted">@{p.username}</p>}

      <span className={`mt-2 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${ri.classes}`}>
        <ShieldIcon size={9} />{ri.label}
      </span>

      {work_line && (
        <p className="mt-2 w-full truncate text-[11px] text-muted">{work_line}</p>
      )}
      {p.location && (
        <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted">
          <MapPinIcon size={11} />{p.location}
        </p>
      )}
    </motion.button>
  )
}

const PublicDetailModal = ({ p, on_close }: { p: PublicProfile | null; on_close: () => void }) => {
  if (!p) return null
  const tone    = status_tone[effective_status(p.status ?? "offline", p.last_seen_at)]
  const ri      = role_style[p.role] ?? role_style.member
  const display = p.full_name || p.username || "User"

  return (
    <Modal open={!!p} on_close={on_close} title={display} size="md">
      {/* Hero */}
      <div className="mb-5 flex items-center gap-4 rounded-xl border border-line/60 bg-line/10 p-4 dark:bg-white/[0.02]">
        <div className="relative shrink-0">
          <Avatar url={p.avatar_url} name={display} size="lg" />
          <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${tone.dot}`} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink">{display}</p>
            <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${ri.classes}`}>
              <ShieldIcon size={9} />{ri.label}
            </span>
          </div>
          {p.username && <p className="mt-0.5 text-xs text-muted">@{p.username}</p>}
          <p className={`mt-1.5 inline-flex items-center gap-1.5 text-xs ${tone.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />{tone.label}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {p.bio && (
          <ViewSection title="About">
            <p className="text-sm leading-relaxed text-ink">{p.bio}</p>
          </ViewSection>
        )}

        {(p.company || p.job_title || p.location || p.timezone) && (
          <ViewSection title="Work">
            {p.job_title && <IR icon={<AtSignIcon size={14} />}    label="Title"    value={p.job_title} />}
            {p.company   && <IR icon={<BriefcaseIcon size={14} />} label="Company"  value={p.company} />}
            {p.location  && <IR icon={<MapPinIcon size={14} />}    label="Location" value={p.location} />}
            {p.timezone  && <IR icon={<ClockIcon size={14} />}     label="Timezone" value={p.timezone} />}
          </ViewSection>
        )}

        {(p.github_url || p.twitter_url || p.linkedin_url) && (
          <ViewSection title="Social">
            <div className="flex flex-wrap gap-2">
              {p.github_url   && <SL icon={<GithubIcon size={14} />}   label="GitHub"   href={p.github_url} />}
              {p.twitter_url  && <SL icon={<TwitterIcon size={13} />}  label="X"        href={p.twitter_url} />}
              {p.linkedin_url && <SL icon={<LinkedinIcon size={14} />} label="LinkedIn" href={p.linkedin_url} />}
            </div>
          </ViewSection>
        )}

        <p className="pt-1 text-[11px] text-muted">
          Joined {format_date(p.created_at)}
        </p>
      </div>
    </Modal>
  )
}

const TeamView = () => {
  const [profiles, set_profiles] = useState<PublicProfile[]>([])
  const [fetching, set_fetching] = useState(true)
  const [search, set_search]     = useState("")
  const [status_f, set_status_f] = useState("all")
  const [selected, set_selected] = useState<PublicProfile | null>(null)
  const notify = use_notify()
  use_presence_tick()

  useEffect(() => {
    list_public_profiles().then(({ profiles: data, error }) => {
      if (error) notify({ tone: "error", title: "Failed to load team", message: error.message })
      else set_profiles(data)
      set_fetching(false)
    })
  }, [])

  const q = search.trim().toLowerCase()
  const filtered = profiles.filter(p => {
    if (q && !p.full_name?.toLowerCase().includes(q) && !p.username?.toLowerCase().includes(q)) return false
    if (status_f !== "all" && p.status !== status_f) return false
    return true
  })

  const status_filter_opts = [
    { value: "all", label: "All statuses" },
    ...status_options.map(o => ({ value: o.value, label: o.label })),
  ]

  return (
    <div className="flex min-h-screen">
      <SideRail />
      <main className="relative flex min-w-0 flex-1 flex-col gap-4 px-4 pb-12 pt-20 sm:px-6 lg:gap-5 lg:px-8 lg:pb-8 lg:pt-12">

        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-wrap items-center justify-between gap-3 lg:absolute lg:inset-x-8 lg:top-2 lg:z-10"
        >
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold tracking-tight text-ink">Team</h1>
            <span className="text-[11px] text-muted">
              {fetching ? "Loading…" : `${profiles.length} member${profiles.length !== 1 ? "s" : ""}`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <SearchIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={e => set_search(e.target.value)}
                placeholder="Search…"
                className="w-44 rounded-lg border border-line bg-card/60 py-1.5 pl-8 pr-3 text-xs text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-flag-red"
              />
            </div>
            <Dropdown value={status_f} options={status_filter_opts} on_select={set_status_f} menu_width="w-36"
              trigger_class="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card/60 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-flag-red/40 hover:text-ink"
            >
              {({ open }) => (
                <>
                  {status_filter_opts.find(o => o.value === status_f)?.label}
                  <ChevronIcon size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                </>
              )}
            </Dropdown>
          </div>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
        >
          {fetching ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="surface flex flex-col items-center rounded-2xl p-5">
                  <div className="mb-3 h-16 w-16 animate-pulse rounded-full bg-line/40" />
                  <div className="mb-1.5 h-3 w-24 animate-pulse rounded bg-line/40" />
                  <div className="h-2 w-16 animate-pulse rounded bg-line/30" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="surface rounded-2xl px-6 py-16 text-center">
              <p className="text-sm text-muted">No members match your filters.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map(p => (
                <TeamCard key={p.id} p={p} on_click={() => set_selected(p)} />
              ))}
            </div>
          )}
        </motion.div>

      </main>

      <PublicDetailModal p={selected} on_close={() => set_selected(null)} />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const Users = () => {
  const { user, loading: auth_loading }       = useAuth()
  const { profile, loading: profile_loading } = useProfile()
  const [users, set_users]                    = useState<UserAdmin[]>([])
  const [fetching, set_fetching]              = useState(true)
  const [fetch_err, set_fetch_err]            = useState<string | null>(null)
  const [search, set_search]                  = useState("")
  const [role_f, set_role_f]                  = useState("all")
  const [status_f, set_status_f]              = useState("all")
  const [selected, set_selected]              = useState<UserAdmin | null>(null)
  const [active_tab, set_active_tab]          = useState<"members" | "access">("members")

  const notify   = use_notify()
  use_presence_tick()
  // Keep a stable ref so the Realtime callback always sees the latest state
  const users_ref = useRef<UserAdmin[]>([])
  users_ref.current = users

  useEffect(() => {
    if (!profile || profile.role !== "root") return
    list_users_admin().then(({ users: data, error }) => {
      if (error) {
        set_fetch_err(error.message)
        notify({ tone: "error", title: "Failed to load users", message: error.message })
      } else {
        set_users(data)
      }
      set_fetching(false)
    })
  }, [profile?.id])

  // Live profile updates — status/online changes appear without a refresh
  useEffect(() => {
    if (!profile || profile.role !== "root") return

    const channel = supabase
      .channel("users_admin_presence")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          const patch = payload.new as Partial<UserAdmin>
          set_users(prev => prev.map(u => u.id === patch.id ? { ...u, ...patch } : u))
          set_selected(prev => prev && prev.id === patch.id ? { ...prev, ...patch } : prev)
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id])

  if (auth_loading || profile_loading) return null
  if (!user)    return <Navigate to="/login" replace />
  if (!profile) return null
  if (profile.role !== "root") return <TeamView />

  const q = search.trim().toLowerCase()
  const filtered = users.filter(u => {
    if (q && !u.full_name?.toLowerCase().includes(q) &&
              !u.email?.toLowerCase().includes(q) &&
              !u.username?.toLowerCase().includes(q)) return false
    if (role_f   !== "all" && u.role   !== role_f)   return false
    if (status_f !== "all" && u.status !== status_f) return false
    return true
  })

  const role_filter_opts = [
    { value: "all",    label: "All roles"   },
    { value: "root",   label: "Root"        },
    { value: "admin",  label: "Admin"       },
    { value: "member", label: "Member"      },
  ]

  const status_filter_opts = [
    { value: "all", label: "All statuses" },
    ...status_options.map(o => ({ value: o.value, label: o.label })),
  ]

  return (
    <div className="flex h-screen overflow-hidden">
      <SideRail />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden pt-14 lg:pt-0">

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex shrink-0 items-center justify-between border-b border-line bg-card px-4 py-3 lg:px-8 lg:py-4"
        >
          {/* Left — title */}
          <div className="flex shrink-0 items-center gap-2">
            <h1 className="text-sm font-semibold tracking-tight text-ink">Users</h1>
            <span className="text-[11px] text-muted">
              {fetching ? "Loading…" : `${users.length} registered`}
            </span>
          </div>

          {/* Center — tabs, absolutely positioned so they stay truly centred */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="pointer-events-auto inline-flex items-center gap-0.5 rounded-xl bg-line/30 p-1">
              {([
                { key: "members", label: "Members", icon: <TabUsersIcon /> },
                { key: "access",  label: "Access",  icon: <TabShieldIcon /> },
              ] as const).map(({ key, label, icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => set_active_tab(key)}
                  className={`relative rounded-lg px-3.5 py-1.5 text-[11px] font-semibold transition-colors duration-150 ${
                    active_tab === key ? "text-flag-red" : "text-muted hover:text-ink"
                  }`}
                >
                  {active_tab === key && (
                    <motion.span
                      layoutId="usr_tab_bg"
                      className="absolute inset-0 rounded-lg bg-card shadow-sm"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {icon}
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Right — search + filters (members tab only) */}
          <div className="flex shrink-0 items-center gap-2">
            {active_tab === "members" && (
              <>
                <div className="relative hidden sm:block">
                  <SearchIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    value={search}
                    onChange={e => set_search(e.target.value)}
                    placeholder="Search users…"
                    className="w-40 rounded-lg border border-line bg-card/60 py-1.5 pl-8 pr-3 text-xs text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-flag-red lg:w-48"
                  />
                </div>
                <Dropdown value={role_f} options={role_filter_opts} on_select={set_role_f} menu_width="w-36"
                  trigger_class="inline-flex items-center justify-between gap-1.5 rounded-lg border border-line bg-card/60 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-flag-red/40 hover:text-ink"
                >
                  {({ open }) => (
                    <>
                      {role_filter_opts.find(o => o.value === role_f)?.label}
                      <ChevronIcon size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                    </>
                  )}
                </Dropdown>
                <Dropdown value={status_f} options={status_filter_opts} on_select={set_status_f} menu_width="w-36"
                  trigger_class="inline-flex items-center justify-between gap-1.5 rounded-lg border border-line bg-card/60 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-flag-red/40 hover:text-ink"
                >
                  {({ open }) => (
                    <>
                      {status_filter_opts.find(o => o.value === status_f)?.label}
                      <ChevronIcon size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                    </>
                  )}
                </Dropdown>
              </>
            )}
          </div>
        </motion.div>

        {/* Scrollable content — fixed height prevents layout shift on tab switch */}
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          {active_tab === "access" ? (
            <AccessTab />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
              className="surface overflow-hidden rounded-2xl"
            >
              {fetch_err ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm text-flag-red">{fetch_err}</p>
                  <p className="mt-1 text-xs text-muted">Check your Supabase RLS policies and ensure you are signed in as root.</p>
                </div>
              ) : fetching ? (
                <div className="space-y-0">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 border-b border-line/50 px-4 py-3 last:border-0">
                      <div className="h-8 w-8 animate-pulse rounded-full bg-line/40" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-2.5 w-32 animate-pulse rounded bg-line/40" />
                        <div className="h-2 w-48 animate-pulse rounded bg-line/30" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm text-muted">No users match your filters.</p>
                </div>
              ) : (
                <>
                  {/* Mobile: stacked card list */}
                  <div className="sm:hidden">
                    {filtered.map(u => (
                      <UserCard key={u.id} user={u} on_click={() => set_selected(u)} />
                    ))}
                  </div>
                  {/* Desktop: table */}
                  <div className="hidden sm:block">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-line/60 text-[10px] uppercase tracking-widest text-muted">
                          <th className="px-4 py-2.5 font-medium">User</th>
                          <th className="px-4 py-2.5 font-medium">Role</th>
                          <th className="px-4 py-2.5 font-medium">Status</th>
                          <th className="hidden px-4 py-2.5 font-medium md:table-cell">Location</th>
                          <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Last active</th>
                          <th className="px-4 py-2.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(u => (
                          <UserRow key={u.id} user={u} on_click={() => set_selected(u)} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </div>

      </main>

      <DetailModal
        user={selected}
        current_uid={user.id}
        on_close={() => set_selected(null)}
        on_save={(updated) => {
          set_users(prev => prev.map(u => u.id === updated.id ? updated : u))
          set_selected(updated)
        }}
        on_remove={(id) => set_users(prev => prev.filter(u => u.id !== id))}
      />
    </div>
  )
}

const ti = { width: 12, height: 12, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
const TabUsersIcon  = () => <svg {...ti}><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/></svg>
const TabShieldIcon = () => <svg {...ti}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>

export default Users
