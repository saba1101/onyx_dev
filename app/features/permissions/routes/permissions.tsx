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
  api, PERMISSIONS, PERMISSION_META, PAGES, PAGE_META, PRIVILEGED_PAGES,
  ROLES, default_permissions, default_role_permissions,
  type MemberPermissions, type RolePermissions, type Permission, type PageKey, type RoleKey,
} from "~/features/permissions/lib/permissions"

export const meta = () => [{ title: "Permissions — Onyx Dev" }]

const ease = [0.22, 1, 0.36, 1] as const

// ── Shared UI ─────────────────────────────────────────────────────────────────

const Toggle = ({ checked, onChange, saving, disabled }: {
  checked: boolean; onChange: () => void; saving?: boolean; disabled?: boolean
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    disabled={saving || disabled}
    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40
      ${checked ? "bg-flag-red" : "bg-line"} ${!disabled ? "cursor-pointer" : ""}`}
  >
    <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-4" : "translate-x-0"}`} />
  </button>
)

const Row = ({ label, desc, checked, saving, onChange, disabled }: {
  label: React.ReactNode; desc: string; checked: boolean
  saving?: boolean; onChange: () => void; disabled?: boolean
}) => (
  <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${disabled ? "opacity-50" : "hover:bg-line/20"}`}>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium text-ink">{label}</p>
      <p className="text-[10px] text-muted">{desc}</p>
    </div>
    <Toggle checked={checked} onChange={onChange} saving={saving} disabled={disabled} />
  </div>
)

const SectionHead = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <div className="mb-1 flex items-center gap-2">
    <span className="text-muted">{icon}</span>
    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">{label}</span>
    <div className="h-px flex-1 bg-line/40" />
  </div>
)

// ── By-user tab ───────────────────────────────────────────────────────────────

type PermsMap = Record<string, MemberPermissions>

const CollapsedSummary = ({ mp }: { mp: MemberPermissions | undefined }) => {
  const active        = PERMISSIONS.filter(p => mp?.[p])
  const hidden        = mp?.hidden_pages ?? []
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

const UserCard = ({
  member, perms, saving, index, on_toggle_perm, on_toggle_page,
}: {
  member: UserAdmin; perms: PermsMap; saving: Set<string>; index: number
  on_toggle_perm: (uid: string, perm: Permission) => void
  on_toggle_page: (uid: string, page: PageKey) => void
}) => {
  const [open, set_open] = useState(false)
  const mp   = perms[member.id]
  const rs   = role_style[member.role] ?? role_style.member
  const name = member.full_name || member.username || member.email?.split("@")[0] || "Unknown"

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease, delay: index * 0.04 }}
      className="overflow-hidden rounded-2xl border border-line/50 bg-card"
    >
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
            <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${rs.classes}`}>{rs.label}</span>
          </div>
          {member.username && <p className="mt-0.5 text-[10px] text-muted">@{member.username}</p>}
          {!open && <CollapsedSummary mp={mp} />}
        </div>
        <span className={`shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <ChevronSvg />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-line/30 px-4 pb-4 pt-4">
              <div>
                <SectionHead icon={<TaskSvg />} label="Task Permissions" />
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
              <div>
                <SectionHead icon={<EyeSvg />} label="Page Visibility" />
                {PAGES.map(page => {
                  const hidden     = mp?.hidden_pages ?? []
                  const visible    = !hidden.includes(page)
                  const privileged = PRIVILEGED_PAGES.has(page)
                  return (
                    <Row
                      key={page}
                      label={
                        <span className="flex items-center gap-1.5">
                          {PAGE_META[page].label}
                          {privileged && (
                            <span className="rounded-full bg-flag-red/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-flag-red">root</span>
                          )}
                        </span>
                      }
                      desc={privileged ? `${PAGE_META[page].desc} — hidden by default, grant with caution` : PAGE_META[page].desc}
                      checked={visible}
                      saving={saving.has(member.id + "page_" + page)}
                      onChange={() => on_toggle_page(member.id, page)}
                    />
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── By-role tab ───────────────────────────────────────────────────────────────

type RolePermsMap = Record<RoleKey, RolePermissions>

const RoleCard = ({
  role_key, label, desc, color, rp, saving_set, members,
  on_toggle_perm, on_toggle_page, on_apply,
}: {
  role_key:       RoleKey
  label:          string
  desc:           string
  color:          string
  rp:             RolePermissions | undefined
  saving_set:     Set<string>
  members:        UserAdmin[]
  on_toggle_perm: (role: RoleKey, perm: Permission) => void
  on_toggle_page: (role: RoleKey, page: PageKey) => void
  on_apply:       (role: RoleKey) => void
}) => {
  const count = members.filter(m => m.role === role_key).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease }}
      className="flex flex-col overflow-hidden rounded-2xl border border-line/50 bg-card"
    >
      {/* Card header */}
      <div className="flex items-center gap-3 border-b border-line/30 p-4">
        <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${color}`}>{label}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-ink">{desc}</p>
          <p className="text-[10px] text-muted">{count} member{count !== 1 ? "s" : ""} with this role</p>
        </div>
      </div>

      <div className="flex-1 space-y-4 p-4">
        {/* Task permissions */}
        <div>
          <SectionHead icon={<TaskSvg />} label="Task Permissions" />
          {PERMISSIONS.map(perm => (
            <Row
              key={perm}
              label={PERMISSION_META[perm].label}
              desc={PERMISSION_META[perm].desc}
              checked={rp?.[perm] ?? false}
              saving={saving_set.has(role_key + perm)}
              onChange={() => on_toggle_perm(role_key, perm)}
            />
          ))}
        </div>

        {/* Page visibility */}
        <div>
          <SectionHead icon={<EyeSvg />} label="Page Visibility" />
          {PAGES.map(page => {
            const hidden     = rp?.hidden_pages ?? ["system", "permissions"]
            const visible    = !hidden.includes(page)
            const privileged = PRIVILEGED_PAGES.has(page)
            return (
              <Row
                key={page}
                label={
                  <span className="flex items-center gap-1.5">
                    {PAGE_META[page].label}
                    {privileged && (
                      <span className="rounded-full bg-flag-red/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-flag-red">root</span>
                    )}
                  </span>
                }
                desc={privileged ? `${PAGE_META[page].desc} — grant with caution` : PAGE_META[page].desc}
                checked={visible}
                saving={saving_set.has(role_key + "page_" + page)}
                onChange={() => on_toggle_page(role_key, page)}
              />
            )
          })}
        </div>
      </div>

      {/* Apply footer */}
      <div className="border-t border-line/30 p-3">
        <button
          type="button"
          onClick={() => on_apply(role_key)}
          disabled={count === 0 || saving_set.has(role_key + "__apply")}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-flag-red/10 px-4 py-2.5 text-xs font-semibold text-flag-red transition-colors hover:bg-flag-red/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving_set.has(role_key + "__apply") ? (
            <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-flag-red/30 border-t-flag-red" /> Applying…</>
          ) : (
            <><ApplyIcon />Apply to all {label}s ({count})</>
          )}
        </button>
        <p className="mt-1.5 text-center text-[10px] text-muted/50">
          Overwrites individual settings for all {label.toLowerCase()} users
        </p>
      </div>
    </motion.div>
  )
}

const RootCard = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25, ease, delay: 0.1 }}
    className="overflow-hidden rounded-2xl border border-flag-red/20 bg-flag-red/5"
  >
    <div className="flex items-center gap-3 p-4">
      <span className="rounded-lg border border-flag-red/20 bg-flag-red/10 px-2 py-1 text-xs font-bold text-flag-red">Root</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-ink">Superadmin — unrestricted access</p>
        <p className="text-[10px] text-muted">All permissions enabled · All pages visible · Cannot be modified</p>
      </div>
      <span className="shrink-0 text-flag-red/40"><LockIcon /></span>
    </div>
    <div className="grid grid-cols-2 gap-px border-t border-flag-red/10 bg-flag-red/10 lg:grid-cols-4">
      {PERMISSIONS.map(p => (
        <div key={p} className="flex items-center gap-1.5 bg-card/60 px-3 py-2">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-flag-red/60" />
          <span className="text-[10px] font-medium text-ink/70">{PERMISSION_META[p].label}</span>
        </div>
      ))}
    </div>
  </motion.div>
)

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PermissionsPage() {
  const { user }    = useAuth()
  const { profile } = useProfile()
  const notify      = use_notify()

  const [tab,      set_tab]     = useState<"users" | "roles">("users")
  const [members,  set_members] = useState<UserAdmin[]>([])
  const [perms,    set_perms]   = useState<PermsMap>({})
  const [role_perms, set_role_perms] = useState<RolePermsMap>({} as RolePermsMap)
  const [loading,  set_loading] = useState(true)
  const [saving,   set_saving]  = useState<Set<string>>(new Set())

  if (profile && profile.role !== "root") return <Navigate to="/" replace />

  const load = useCallback(async () => {
    const [u_res, p_res, rp_res] = await Promise.all([
      list_users_admin(),
      api.list(),
      api.roles.list(),
    ])

    if (u_res.error) {
      notify({ tone: "error", title: "Failed to load members" })
      set_loading(false)
      return
    }

    set_members(u_res.users.filter(u => u.role !== "root"))

    const map: PermsMap = {}
    ;(p_res.data ?? []).forEach((row: MemberPermissions) => { map[row.user_id] = row })
    set_perms(map)

    const rmap = {} as RolePermsMap
    ;(rp_res.data ?? []).forEach((row: RolePermissions) => { rmap[row.role] = row })
    // Fill missing roles with defaults
    for (const r of ["member", "admin"] as RoleKey[]) {
      if (!rmap[r]) rmap[r] = { role: r, ...default_role_permissions(r), updated_at: "" }
    }
    set_role_perms(rmap)
    set_loading(false)
  }, [notify])

  useEffect(() => { load() }, [load])

  // ── User tab handlers ─────────────────────────────────────────────────────

  const toggle_user_perm = async (user_id: string, perm: Permission) => {
    const key     = user_id + perm
    if (saving.has(key)) return
    const current = perms[user_id] ?? { user_id, ...default_permissions(), updated_at: "" }
    const new_val = !current[perm]
    set_perms(prev => ({ ...prev, [user_id]: { ...current, [perm]: new_val } }))
    set_saving(prev => new Set(prev).add(key))
    const { error } = await api.upsert(user_id, { [perm]: new_val })
    if (error) {
      set_perms(prev => ({ ...prev, [user_id]: current }))
      notify({ tone: "error", title: "Failed to update permission" })
    }
    set_saving(prev => { const n = new Set(prev); n.delete(key); return n })
  }

  const toggle_user_page = async (user_id: string, page: PageKey) => {
    const key     = user_id + "page_" + page
    if (saving.has(key)) return
    const current   = perms[user_id] ?? { user_id, ...default_permissions(), updated_at: "" }
    const hidden    = current.hidden_pages ?? []
    const new_hidden = hidden.includes(page) ? hidden.filter(p => p !== page) : [...hidden, page]
    set_perms(prev => ({ ...prev, [user_id]: { ...current, hidden_pages: new_hidden } }))
    set_saving(prev => new Set(prev).add(key))
    const { error } = await api.upsert(user_id, { hidden_pages: new_hidden })
    if (error) {
      set_perms(prev => ({ ...prev, [user_id]: current }))
      notify({ tone: "error", title: "Failed to update page visibility" })
    }
    set_saving(prev => { const n = new Set(prev); n.delete(key); return n })
  }

  // ── Role tab handlers ─────────────────────────────────────────────────────

  const toggle_role_perm = async (role: RoleKey, perm: Permission) => {
    const key     = role + perm
    if (saving.has(key)) return
    const current = role_perms[role] ?? { role, ...default_role_permissions(role), updated_at: "" }
    const new_val = !current[perm]
    set_role_perms(prev => ({ ...prev, [role]: { ...current, [perm]: new_val } }))
    set_saving(prev => new Set(prev).add(key))
    const { error } = await api.roles.upsert(role, { [perm]: new_val })
    if (error) {
      set_role_perms(prev => ({ ...prev, [role]: current }))
      notify({ tone: "error", title: "Failed to update role permission" })
    }
    set_saving(prev => { const n = new Set(prev); n.delete(key); return n })
  }

  const toggle_role_page = async (role: RoleKey, page: PageKey) => {
    const key     = role + "page_" + page
    if (saving.has(key)) return
    const current    = role_perms[role] ?? { role, ...default_role_permissions(role), updated_at: "" }
    const hidden     = current.hidden_pages ?? ["system", "permissions"]
    const new_hidden = hidden.includes(page) ? hidden.filter(p => p !== page) : [...hidden, page]
    set_role_perms(prev => ({ ...prev, [role]: { ...current, hidden_pages: new_hidden } }))
    set_saving(prev => new Set(prev).add(key))
    const { error } = await api.roles.upsert(role, { hidden_pages: new_hidden })
    if (error) {
      set_role_perms(prev => ({ ...prev, [role]: current }))
      notify({ tone: "error", title: "Failed to update role page visibility" })
    }
    set_saving(prev => { const n = new Set(prev); n.delete(key); return n })
  }

  const apply_role_to_all = async (role: RoleKey) => {
    const key      = role + "__apply"
    if (saving.has(key)) return
    const rp       = role_perms[role]
    if (!rp) return
    const user_ids = members.filter(m => m.role === role).map(m => m.id)
    if (!user_ids.length) return

    set_saving(prev => new Set(prev).add(key))
    const patch = {
      edit_any_task:      rp.edit_any_task,
      delete_task:        rp.delete_task,
      delete_any_comment: rp.delete_any_comment,
      manage_columns:     rp.manage_columns,
      hidden_pages:       rp.hidden_pages,
    }
    const { error } = await api.roles.apply_to_all(role, patch, user_ids)
    if (error) {
      notify({ tone: "error", title: "Failed to apply role permissions" })
    } else {
      // Optimistically update individual user perms in local state
      const updated: PermsMap = { ...perms }
      user_ids.forEach(uid => {
        updated[uid] = { ...(perms[uid] ?? { user_id: uid, updated_at: "" }), ...patch }
      })
      set_perms(updated)
      notify({ tone: "success", title: `Applied to all ${role}s`, message: `${user_ids.length} user${user_ids.length !== 1 ? "s" : ""} updated` })
    }
    set_saving(prev => { const n = new Set(prev); n.delete(key); return n })
  }

  if (!user) return null

  const active_perms_total = Object.values(perms).reduce(
    (sum, p) => sum + PERMISSIONS.filter(k => p[k]).length, 0,
  )

  return (
    <div className="flex h-screen overflow-hidden">
      <SideRail />

      <main className="flex flex-1 flex-col overflow-hidden pt-14 lg:pt-0">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease }}
          className="flex shrink-0 items-center gap-3 border-b border-line bg-card px-4 py-3 lg:px-6 lg:py-4"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-flag-red/10 text-flag-red">
            <ShieldSvg />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold text-ink">Permissions</h1>
            <p className="text-[10px] text-muted">Control task permissions and page visibility per member or role</p>
          </div>
          {!loading && (
            <div className="hidden shrink-0 items-center gap-3 sm:flex">
              <Stat label="Members" value={members.length} />
              <Stat label="Permissions granted" value={active_perms_total} accent />
            </div>
          )}
        </motion.div>

        {/* Tabs */}
        <div className="flex shrink-0 items-center gap-1 border-b border-line px-4 lg:px-6">
          {([["users", "By User", <UserSvg />], ["roles", "By Role", <RoleSvg />]] as const).map(([key, label, icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => set_tab(key)}
              className={`relative flex items-center gap-1.5 px-3 py-3 text-xs font-semibold transition-colors ${
                tab === key
                  ? "text-flag-red after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:rounded-full after:bg-flag-red"
                  : "text-muted hover:text-ink"
              }`}
            >
              {icon}{label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {loading ? (
            <LoadingSkeleton />
          ) : (
            <AnimatePresence mode="wait">

              {/* ── By User ── */}
              {tab === "users" && (
                <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  {members.length === 0 ? <EmptyState /> : (
                    <div className="space-y-3">
                      {members.map((member, i) => (
                        <UserCard
                          key={member.id} member={member} perms={perms}
                          saving={saving} index={i}
                          on_toggle_perm={toggle_user_perm}
                          on_toggle_page={toggle_user_page}
                        />
                      ))}
                      <p className="pt-2 text-[10px] text-muted/50">
                        Changes save instantly · Root users always have full access and are not listed
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── By Role ── */}
              {tab === "roles" && (
                <motion.div key="roles" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  <div className="space-y-5">
                    <div className="grid gap-5 lg:grid-cols-2">
                      {ROLES.map(r => (
                        <RoleCard
                          key={r.key}
                          role_key={r.key} label={r.label} desc={r.desc} color={r.color}
                          rp={role_perms[r.key]}
                          saving_set={saving}
                          members={members}
                          on_toggle_perm={toggle_role_perm}
                          on_toggle_page={toggle_role_page}
                          on_apply={apply_role_to_all}
                        />
                      ))}
                    </div>
                    <RootCard />
                    <p className="text-[10px] text-muted/50">
                      Role defaults auto-save · Use "Apply to all" to push settings to every user of that role
                    </p>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
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
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-line/40 text-muted"><ShieldSvg /></span>
    <p className="text-sm font-semibold text-ink">No members yet</p>
    <p className="text-xs text-muted">Invite team members to manage their permissions here.</p>
  </div>
)

// ── Icons ─────────────────────────────────────────────────────────────────────

const ip = { width: 13, height: 13, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.8,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const }

const ChevronSvg = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
const ShieldSvg  = () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
const TaskSvg    = () => <svg {...ip}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m9 12 2 2 4-4"/></svg>
const EyeSvg     = () => <svg {...ip}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
const UserSvg    = () => <svg {...ip}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
const RoleSvg    = () => <svg {...ip}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
const ApplyIcon  = () => <svg {...ip}><polyline points="20 6 9 17 4 12"/></svg>
const LockIcon   = () => <svg {...ip}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
