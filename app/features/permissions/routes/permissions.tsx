import { useCallback, useEffect, useState } from "react"
import { Navigate } from "react-router"
import { motion } from "motion/react"
import { useAuth } from "~/features/auth/lib/auth"
import { useProfile } from "~/features/profile/lib/profile-context"
import { SideRail } from "~/components/ui/side-rail"
import { use_notify } from "~/hooks/use-notify"
import { list_users_admin, role_style, type UserAdmin } from "~/features/users/lib/users"
import { AvatarUploader } from "~/features/profile/components/avatar-uploader"
import {
  api, PERMISSIONS, PERMISSION_META, default_permissions,
  type MemberPermissions, type Permission,
} from "~/features/permissions/lib/permissions"

export const meta = () => [{ title: "Permissions — Onyx Dev" }]

const ease_out = [0.22, 1, 0.36, 1] as const

// ── Toggle switch ─────────────────────────────────────────────────────────────

const Toggle = ({
  checked, onChange, saving,
}: {
  checked: boolean
  onChange: () => void
  saving:  boolean
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    disabled={saving}
    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:cursor-wait disabled:opacity-60
      ${checked ? "bg-flag-red" : "bg-line"}`}
  >
    <span
      className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200
        ${checked ? "translate-x-4" : "translate-x-0"}`}
    />
  </button>
)

// ── Page ──────────────────────────────────────────────────────────────────────

type PermsMap = Record<string, MemberPermissions>

export default function PermissionsPage() {
  const { user }    = useAuth()
  const { profile } = useProfile()
  const notify      = use_notify()

  const [members, set_members] = useState<UserAdmin[]>([])
  const [perms,   set_perms]   = useState<PermsMap>({})
  const [loading, set_loading] = useState(true)
  const [saving,  set_saving]  = useState<Set<string>>(new Set())

  if (profile && profile.role !== "root") return <Navigate to="/" replace />

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    const [u_res, p_res] = await Promise.all([
      list_users_admin(),
      api.list(),
    ])

    if (u_res.error) {
      notify({ tone: "error", title: "Failed to load members" })
      set_loading(false)
      return
    }

    const non_root = u_res.users.filter(u => u.role !== "root")
    set_members(non_root)

    const map: PermsMap = {}
    ;(p_res.data ?? []).forEach((row: MemberPermissions) => {
      map[row.user_id] = row
    })
    set_perms(map)
    set_loading(false)
  }, [notify])

  useEffect(() => { load() }, [load])

  // ── Toggle ────────────────────────────────────────────────────────────────

  const toggle = async (user_id: string, perm: Permission) => {
    const key = user_id + perm
    if (saving.has(key)) return

    const current = perms[user_id] ?? { user_id, ...default_permissions(), updated_at: "" }
    const new_val  = !current[perm]

    set_perms(prev => ({ ...prev, [user_id]: { ...current, [perm]: new_val } }))
    set_saving(prev => new Set(prev).add(key))

    const { error } = await api.upsert(user_id, { [perm]: new_val })

    if (error) {
      set_perms(prev => ({ ...prev, [user_id]: { ...current } }))
      notify({ tone: "error", title: "Failed to update permission" })
    }

    set_saving(prev => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!user) return null

  return (
    <div className="flex h-screen overflow-hidden">
      <SideRail />

      <main className="flex flex-1 flex-col overflow-hidden pt-14 lg:pt-0">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: ease_out }}
          className="flex shrink-0 items-center gap-3 border-b border-line bg-card/50 px-4 py-3 backdrop-blur-xl lg:gap-4 lg:px-6 lg:py-4"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-flag-red/10 text-flag-red">
            <ShieldIcon />
          </span>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-ink">Permissions</h1>
            <p className="truncate text-[10px] text-muted">
              Control what each member can do across the workspace
            </p>
          </div>

          {!loading && (
            <span className="ml-auto shrink-0 rounded-full bg-line/40 px-2.5 py-1 text-[10px] font-semibold text-muted">
              {members.length} member{members.length !== 1 ? "s" : ""}
            </span>
          )}
        </motion.div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 lg:p-6">
          {loading ? (
            <LoadingSkeleton />
          ) : members.length === 0 ? (
            <EmptyState />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: ease_out }}
            >
              {/* ── Mobile card layout (< lg) ── */}
              <div className="space-y-3 lg:hidden">
                {members.map((member, i) => {
                  const rs   = role_style[member.role] ?? role_style.member
                  const mp   = perms[member.id]
                  const name = member.full_name || member.username || member.email?.split("@")[0] || "Unknown"

                  return (
                    <motion.div
                      key={member.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, delay: i * 0.04 }}
                      className="surface rounded-2xl p-4"
                    >
                      {/* User info */}
                      <div className="mb-4 flex items-center gap-3">
                        <div className="shrink-0">
                          <AvatarUploader url={member.avatar_url} editing={false} size="sm" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">{name}</p>
                          {member.username && (
                            <p className="truncate text-[10px] text-muted">@{member.username}</p>
                          )}
                        </div>
                        <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${rs.classes}`}>
                          {rs.label}
                        </span>
                      </div>

                      {/* Permission rows */}
                      <div className="divide-y divide-line/50">
                        {PERMISSIONS.map(perm => (
                          <div key={perm} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-ink">{PERMISSION_META[perm].label}</p>
                              <p className="text-[10px] text-muted">{PERMISSION_META[perm].desc}</p>
                            </div>
                            <Toggle
                              checked={mp?.[perm] ?? false}
                              onChange={() => toggle(member.id, perm)}
                              saving={saving.has(member.id + perm)}
                            />
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {/* ── Desktop table layout (>= lg) ── */}
              <div className="hidden overflow-hidden rounded-2xl surface lg:block">
                {/* Table header */}
                <div
                  className="grid items-center border-b border-line bg-line/10 px-5 py-3"
                  style={{ gridTemplateColumns: "1fr repeat(4, 130px)" }}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                    Member
                  </span>
                  {PERMISSIONS.map(p => (
                    <div key={p} className="flex flex-col items-center gap-0.5 text-center">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                        {PERMISSION_META[p].label}
                      </span>
                      <span className="text-[9px] leading-tight text-muted/50">
                        {PERMISSION_META[p].desc}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Member rows */}
                {members.map((member, i) => {
                  const rs   = role_style[member.role] ?? role_style.member
                  const mp   = perms[member.id]
                  const name = member.full_name || member.username || member.email?.split("@")[0] || "Unknown"

                  return (
                    <motion.div
                      key={member.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.18, delay: i * 0.04 }}
                      className="grid items-center border-b border-line/50 px-5 py-3.5 transition-colors last:border-0 hover:bg-line/10"
                      style={{ gridTemplateColumns: "1fr repeat(4, 130px)" }}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="shrink-0">
                          <AvatarUploader url={member.avatar_url} editing={false} size="sm" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{name}</p>
                          {member.username && (
                            <p className="truncate text-[10px] text-muted">@{member.username}</p>
                          )}
                        </div>
                        <span className={`ml-2 shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${rs.classes}`}>
                          {rs.label}
                        </span>
                      </div>

                      {PERMISSIONS.map(perm => (
                        <div key={perm} className="flex items-center justify-center">
                          <Toggle
                            checked={mp?.[perm] ?? false}
                            onChange={() => toggle(member.id, perm)}
                            saving={saving.has(member.id + perm)}
                          />
                        </div>
                      ))}
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          )}

          {!loading && members.length > 0 && (
            <p className="mt-4 text-[10px] text-muted/60">
              Changes save instantly. Root users always have full access and are not listed here.
            </p>
          )}
        </div>
      </main>
    </div>
  )
}

// ── Skeletons & empty state ───────────────────────────────────────────────────

const LoadingSkeleton = () => (
  <>
    {/* Mobile skeleton */}
    <div className="space-y-3 lg:hidden">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="surface rounded-2xl p-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-line/40" />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="h-3 w-28 animate-pulse rounded bg-line/40" />
              <div className="h-2.5 w-20 animate-pulse rounded bg-line/30" />
            </div>
          </div>
          <div className="space-y-3">
            {[...Array(4)].map((_, j) => (
              <div key={j} className="flex items-center justify-between py-1">
                <div className="h-3 w-32 animate-pulse rounded bg-line/40" />
                <div className="h-5 w-9 animate-pulse rounded-full bg-line/40" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>

    {/* Desktop skeleton */}
    <div className="hidden overflow-hidden rounded-2xl surface lg:block">
      <div className="border-b border-line bg-line/10 px-5 py-3.5" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line/50 px-5 py-4 last:border-0">
          <div className="h-8 w-8 animate-pulse rounded-full bg-line/40" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-3 w-32 animate-pulse rounded bg-line/40" />
            <div className="h-2.5 w-20 animate-pulse rounded bg-line/30" />
          </div>
          <div className="flex gap-8">
            {[...Array(4)].map((_, j) => (
              <div key={j} className="h-5 w-9 animate-pulse rounded-full bg-line/40" />
            ))}
          </div>
        </div>
      ))}
    </div>
  </>
)

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-line/40 text-muted">
      <ShieldIcon />
    </span>
    <p className="text-sm font-semibold text-ink">No members yet</p>
    <p className="text-xs text-muted">Invite team members to manage their permissions here.</p>
  </div>
)

// ── Inline icon ───────────────────────────────────────────────────────────────

const ShieldIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)
