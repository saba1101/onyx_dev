import { useCallback, useEffect, useState } from "react"
import { Navigate } from "react-router"
import { motion, AnimatePresence } from "motion/react"
import { useAuth } from "~/features/auth/lib/auth"
import { useProfile } from "~/features/profile/lib/profile-context"
import { SideRail } from "~/components/ui/side-rail"
import { use_notify } from "~/hooks/use-notify"
import { list_users_admin, role_style, type UserAdmin } from "~/features/users/lib/users"
import { AvatarUploader } from "~/features/profile/components/avatar-uploader"
import {
  api, PERMISSIONS, PERMISSION_META, PAGES, PAGE_META, default_permissions,
  type MemberPermissions, type Permission, type PageKey,
} from "~/features/permissions/lib/permissions"

export const meta = () => [{ title: "Permissions — Onyx Dev" }]

const ease = [0.22, 1, 0.36, 1] as const

// ── Toggle ────────────────────────────────────────────────────────────────────

const Toggle = ({ checked, onChange, saving }: {
  checked: boolean; onChange: () => void; saving: boolean
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    disabled={saving}
    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:cursor-wait disabled:opacity-50
      ${checked ? "bg-flag-red" : "bg-line"}`}
  >
    <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200
      ${checked ? "translate-x-4" : "translate-x-0"}`}
    />
  </button>
)

// ── Perm / page row ───────────────────────────────────────────────────────────

const Row = ({ label, desc, checked, saving, onChange }: {
  label: string; desc: string; checked: boolean; saving: boolean; onChange: () => void
}) => (
  <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-line/20">
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium text-ink">{label}</p>
      <p className="text-[10px] text-muted">{desc}</p>
    </div>
    <Toggle checked={checked} onChange={onChange} saving={saving} />
  </div>
)

// ── Section header ────────────────────────────────────────────────────────────

const Section = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <div className="mb-1 flex items-center gap-2">
    <span className="text-muted">{icon}</span>
    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">{label}</span>
    <div className="h-px flex-1 bg-line/40" />
  </div>
)

// ── Collapsed summary pills ───────────────────────────────────────────────────

const CollapsedSummary = ({ mp }: { mp: MemberPermissions | undefined }) => {
  const active = PERMISSIONS.filter(p => mp?.[p])
  const hidden = mp?.hidden_pages ?? []
  const visible_count = PAGES.length - hidden.length

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {active.length > 0 ? (
        active.map(p => (
          <span key={p} className="rounded-md bg-flag-red/10 px-1.5 py-0.5 text-[9px] font-semibold text-flag-red">
            {PERMISSION_META[p].label}
          </span>
        ))
      ) : (
        <span className="text-[10px] text-muted/40">No task permissions</span>
      )}
      <span className="text-[10px] text-muted/40">·</span>
      <span className={`text-[10px] font-medium ${visible_count < PAGES.length ? "text-royal-gold" : "text-muted"}`}>
        {visible_count}/{PAGES.length} pages visible
      </span>
    </div>
  )
}

// ── User card ─────────────────────────────────────────────────────────────────

type PermsMap = Record<string, MemberPermissions>

const UserCard = ({
  member, perms, saving, index,
  on_toggle_perm, on_toggle_page,
}: {
  member:         UserAdmin
  perms:          PermsMap
  saving:         Set<string>
  index:          number
  on_toggle_perm: (uid: string, perm: Permission) => void
  on_toggle_page: (uid: string, page: PageKey) => void
}) => {
  const [open, set_open] = useState(false)

  const mp   = perms[member.id]
  const rs   = role_style[member.role] ?? role_style.member
  const name = member.full_name || member.username || member.email?.split("@")[0] || "Unknown"

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease, delay: index * 0.04 }}
      className="overflow-hidden rounded-2xl border border-line/50 bg-card/50 backdrop-blur-sm"
    >
      {/* Header — always visible, click to expand */}
      <button
        type="button"
        onClick={() => set_open(o => !o)}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-line/10"
      >
        <div className="shrink-0">
          <AvatarUploader url={member.avatar_url} editing={false} size="sm" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">{name}</span>
            <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${rs.classes}`}>
              {rs.label}
            </span>
          </div>
          {member.username && (
            <p className="mt-0.5 text-[10px] text-muted">@{member.username}</p>
          )}
          {!open && <CollapsedSummary mp={mp} />}
        </div>

        <span className={`shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <ChevronSvg />
        </span>
      </button>

      {/* Expandable body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-line/30 px-4 pb-4 pt-4">

              {/* Task Permissions */}
              <div>
                <Section icon={<TaskSvg />} label="Task Permissions" />
                <div>
                  {PERMISSIONS.map(perm => (
                    <Row
                      key={perm}
                      label={PERMISSION_META[perm].label}
                      desc={PERMISSION_META[perm].desc}
                      checked={mp?.[perm] ?? false}
                      saving={saving.has(member.id + perm)}
                      onChange={() => on_toggle_perm(member.id, perm)}
                    />
                  ))}
                </div>
              </div>

              {/* Page Visibility */}
              <div>
                <Section icon={<EyeSvg />} label="Page Visibility" />
                <div>
                  {PAGES.map(page => {
                    const hidden   = mp?.hidden_pages ?? []
                    const visible  = !hidden.includes(page)
                    return (
                      <Row
                        key={page}
                        label={PAGE_META[page].label}
                        desc={PAGE_META[page].desc}
                        checked={visible}
                        saving={saving.has(member.id + "page_" + page)}
                        onChange={() => on_toggle_page(member.id, page)}
                      />
                    )
                  })}
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PermissionsPage() {
  const { user }    = useAuth()
  const { profile } = useProfile()
  const notify      = use_notify()

  const [members, set_members] = useState<UserAdmin[]>([])
  const [perms,   set_perms]   = useState<PermsMap>({})
  const [loading, set_loading] = useState(true)
  const [saving,  set_saving]  = useState<Set<string>>(new Set())

  if (profile && profile.role !== "root") return <Navigate to="/" replace />

  const load = useCallback(async () => {
    const [u_res, p_res] = await Promise.all([list_users_admin(), api.list()])

    if (u_res.error) {
      notify({ tone: "error", title: "Failed to load members" })
      set_loading(false)
      return
    }

    const non_root = u_res.users.filter(u => u.role !== "root")
    set_members(non_root)

    const map: PermsMap = {}
    ;(p_res.data ?? []).forEach((row: MemberPermissions) => { map[row.user_id] = row })
    set_perms(map)
    set_loading(false)
  }, [notify])

  useEffect(() => { load() }, [load])

  // ── Toggle task permission ────────────────────────────────────────────────

  const toggle_perm = async (user_id: string, perm: Permission) => {
    const key     = user_id + perm
    if (saving.has(key)) return
    const current = perms[user_id] ?? { user_id, ...default_permissions(), updated_at: "" }
    const new_val = !current[perm]

    set_perms(prev => ({ ...prev, [user_id]: { ...current, [perm]: new_val } }))
    set_saving(prev => new Set(prev).add(key))

    const { error } = await api.upsert(user_id, { [perm]: new_val })
    if (error) {
      set_perms(prev => ({ ...prev, [user_id]: { ...current } }))
      notify({ tone: "error", title: "Failed to update permission" })
    }
    set_saving(prev => { const n = new Set(prev); n.delete(key); return n })
  }

  // ── Toggle page visibility ────────────────────────────────────────────────

  const toggle_page = async (user_id: string, page: PageKey) => {
    const key     = user_id + "page_" + page
    if (saving.has(key)) return
    const current = perms[user_id] ?? { user_id, ...default_permissions(), updated_at: "" }
    const hidden  = current.hidden_pages ?? []
    const new_hidden = hidden.includes(page)
      ? hidden.filter(p => p !== page)
      : [...hidden, page]

    set_perms(prev => ({ ...prev, [user_id]: { ...current, hidden_pages: new_hidden } }))
    set_saving(prev => new Set(prev).add(key))

    const { error } = await api.upsert(user_id, { hidden_pages: new_hidden })
    if (error) {
      set_perms(prev => ({ ...prev, [user_id]: { ...current } }))
      notify({ tone: "error", title: "Failed to update page visibility" })
    }
    set_saving(prev => { const n = new Set(prev); n.delete(key); return n })
  }

  if (!user) return null

  const active_perms_total = Object.values(perms).reduce(
    (sum, p) => sum + PERMISSIONS.filter(k => p[k]).length, 0
  )

  return (
    <div className="flex h-screen overflow-hidden">
      <SideRail />

      <main className="flex flex-1 flex-col overflow-hidden pt-14 lg:pt-0">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease }}
          className="flex shrink-0 items-center gap-3 border-b border-line bg-card/50 px-4 py-3 backdrop-blur-xl lg:px-6 lg:py-4"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-flag-red/10 text-flag-red">
            <ShieldSvg />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold text-ink">Permissions</h1>
            <p className="text-[10px] text-muted">
              Control task permissions and page visibility per member
            </p>
          </div>
          {!loading && members.length > 0 && (
            <div className="hidden shrink-0 items-center gap-3 sm:flex">
              <Stat label="Members" value={members.length} />
              <Stat label="Permissions granted" value={active_perms_total} accent />
            </div>
          )}
        </motion.div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {loading ? (
            <LoadingSkeleton />
          ) : members.length === 0 ? (
            <EmptyState />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease }}
              className="space-y-3"
            >
              {members.map((member, i) => (
                <UserCard
                  key={member.id}
                  member={member}
                  perms={perms}
                  saving={saving}
                  index={i}
                  on_toggle_perm={toggle_perm}
                  on_toggle_page={toggle_page}
                />
              ))}

              <p className="pt-2 text-[10px] text-muted/50">
                Changes save instantly · Root users always have full access and are not listed
              </p>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  )
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

const Stat = ({ label, value, accent }: { label: string; value: number; accent?: boolean }) => (
  <div className={`rounded-lg border px-3 py-1.5 text-center ${accent ? "border-flag-red/20 bg-flag-red/5" : "border-line bg-line/20"}`}>
    <p className={`text-sm font-bold ${accent ? "text-flag-red" : "text-ink"}`}>{value}</p>
    <p className="text-[9px] text-muted">{label}</p>
  </div>
)

// ── Loading skeleton ──────────────────────────────────────────────────────────

const LoadingSkeleton = () => (
  <div className="space-y-3">
    {[...Array(3)].map((_, i) => (
      <div key={i} className="overflow-hidden rounded-2xl border border-line/50 bg-card/50 p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-line/40" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-3 w-32 animate-pulse rounded bg-line/40" />
            <div className="h-2.5 w-20 animate-pulse rounded bg-line/30" />
            <div className="flex gap-1.5">
              <div className="h-4 w-16 animate-pulse rounded-md bg-line/30" />
              <div className="h-4 w-20 animate-pulse rounded-md bg-line/30" />
            </div>
          </div>
        </div>
      </div>
    ))}
  </div>
)

// ── Empty state ───────────────────────────────────────────────────────────────

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-line/40 text-muted">
      <ShieldSvg />
    </span>
    <p className="text-sm font-semibold text-ink">No members yet</p>
    <p className="text-xs text-muted">Invite team members to manage their permissions here.</p>
  </div>
)

// ── Inline SVGs ───────────────────────────────────────────────────────────────

const ip = { width: 13, height: 13, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.8,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const }

const ChevronSvg = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
)

const ShieldSvg = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

const TaskSvg = () => (
  <svg {...ip}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)

const EyeSvg = () => (
  <svg {...ip}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
