import {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Navigate, Link, useSearchParams } from "react-router";
import { motion } from "motion/react";
import { useAuth } from "~/features/auth/lib/auth";
import { useProfile } from "~/features/profile/lib/profile-context";
import { SideRail } from "~/components/ui/side-rail";
import { AvatarUploader } from "~/features/profile/components/avatar-uploader";
import { use_notify } from "~/hooks/use-notify";
import { use_presence_tick } from "~/hooks/use-presence-tick";
import { supabase } from "~/lib/supabase";
import { cache_get, cache_set } from "~/lib/query-cache";
import {
  effective_status,
  status_tone,
  type Profile,
} from "~/features/profile/lib/profile";
import {
  GithubIcon,
  UsersIcon,
  GitBranchIcon,
  CalendarIcon,
  ShieldIcon,
  ChevronIcon,
  ClockIcon,
  UserIcon,
  PencilIcon,
  SettingsIcon,
  CheckIcon,
  MapPinIcon,
  BriefcaseIcon,
  GlobeIcon,
  ActivityIcon,
  GridIcon,
} from "~/components/ui/icons";

const ActivityCharts = lazy(
  () => import("~/features/dashboard/components/activity-charts"),
);

const ease_out = [0.22, 1, 0.36, 1] as const;

export const meta = () => [
  { title: "Onyx Dev" },
  { name: "description", content: "Onyx Dev" },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_MEMBER_COUNT = "dashboard:member_count";
const CACHE_GITHUB = "dashboard:github";
const CACHE_ALL_MEMBERS = "dashboard:all_members";

const ROLE_LABEL: Record<string, string> = {
  root: "Owner",
  admin: "Admin",
  member: "Member",
};

const ROLE_CLS: Record<string, string> = {
  root: "bg-flag-red/10 text-flag-red",
  admin: "bg-amber-500/10 text-amber-500",
  member: "bg-line/60 text-muted",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt_date = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const fmt_rel = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return fmt_date(iso);
};

const completion_pct = (p: Profile | null) => {
  if (!p) return 0;
  const fields = [
    p.full_name,
    p.bio,
    p.avatar_url,
    p.location,
    p.company,
    p.github_url,
  ];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
};

export type MemberRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: string;
  status: string;
  created_at: string | null;
  last_seen_at: string | null;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const InfoRow = ({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) => (
  <div className="flex items-center gap-3">
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-line/40 text-muted">
      {icon}
    </span>
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="truncate text-xs font-medium text-ink">{value}</p>
    </div>
  </div>
);

const NavCard = ({
  to,
  icon,
  label,
  sub,
  badge,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  sub: string;
  badge?: ReactNode;
}) => (
  <Link
    to={to}
    className="surface group flex items-center gap-4 rounded-2xl p-4 transition-shadow hover:shadow-md"
  >
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-flag-red/10 text-flag-red transition-colors group-hover:bg-flag-red group-hover:text-white">
      {icon}
    </span>
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-ink">{label}</p>
        {badge}
      </div>
      <p className="truncate text-[11px] text-muted">{sub}</p>
    </div>
    <ChevronIcon
      size={14}
      className="-rotate-90 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-flag-red"
    />
  </Link>
);

const SH = ({ children }: { children: ReactNode }) => (
  <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted">
    {children}
  </p>
);

const RecentSignups = ({ members }: { members: MemberRow[] }) => {
  const tick = use_presence_tick();
  const recent = useMemo(
    () =>
      [...members]
        .filter((m) => m.created_at)
        .sort(
          (a, b) =>
            new Date(b.created_at!).getTime() -
            new Date(a.created_at!).getTime(),
        )
        .slice(0, 6),
    [members],
  );

  if (recent.length === 0) return null;

  return (
    <div className="surface rounded-2xl p-5">
      <SH>Recent signups</SH>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {recent.map((m) => {
          const name = m.full_name || m.username || "User";
          const tone =
            status_tone[
              effective_status(
                m.status as "active" | "away" | "busy" | "offline",
                m.last_seen_at,
              )
            ] ?? status_tone.offline;
          return (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-xl border border-line/50 p-3"
            >
              <div className="relative shrink-0">
                <AvatarUploader url={m.avatar_url} editing={false} size="sm" />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-card ${tone.dot}`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-ink">
                  {name}
                </p>
                {m.username && (
                  <p className="truncate text-[10px] text-muted">
                    @{m.username}
                  </p>
                )}
                <p className="mt-0.5 text-[10px] text-muted/60">
                  {m.created_at ? fmt_rel(m.created_at) : "—"}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-1.5 py-px text-[9px] font-semibold ${ROLE_CLS[m.role]}`}
              >
                {ROLE_LABEL[m.role] ?? m.role}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const Home = () => {
  const { user, loading } = useAuth();
  const { profile } = useProfile();
  const notify = use_notify();
  const [params, set_params] = useSearchParams();
  const greeted = useRef(false);
  use_presence_tick(30_000);

  const [member_count, set_member_count] = useState<number | null>(
    () => cache_get<number>(CACHE_MEMBER_COUNT) ?? null,
  );
  const [github_name, set_github_name] = useState<string | null>(
    () =>
      cache_get<{ name: string | null; synced: boolean }>(CACHE_GITHUB)?.name ??
      null,
  );
  const [github_synced, set_github_synced] = useState(
    () =>
      cache_get<{ name: string | null; synced: boolean }>(CACHE_GITHUB)
        ?.synced ?? false,
  );
  const [all_members, set_all_members] = useState<MemberRow[] | null>(
    () => cache_get<MemberRow[]>(CACHE_ALL_MEMBERS) ?? null,
  );

  // Welcome toast
  useEffect(() => {
    if (!user) return;
    const welcome = params.get("welcome");
    if (!welcome || greeted.current) return;
    greeted.current = true;
    notify({
      tone: "success",
      title: welcome === "up" ? "Account ready" : "Welcome back",
      message: `Signed in as ${user.email}`,
    });
    const next = new URLSearchParams(params);
    next.delete("welcome");
    set_params(next, { replace: true });
  }, [user]);

  // Member count + GitHub sync status — dispatched together so neither waits on the other
  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase
        .from("profiles")
        .select("github_username, github_token")
        .eq("id", user.id)
        .single(),
    ]).then(([count_res, github_res]) => {
      if (count_res.count !== null) {
        set_member_count(count_res.count);
        cache_set(CACHE_MEMBER_COUNT, count_res.count);
      }
      const d = github_res.data as {
        github_username: string | null;
        github_token: string | null;
      } | null;
      if (d) {
        set_github_name(d.github_username);
        set_github_synced(!!d.github_token);
        cache_set(CACHE_GITHUB, {
          name: d.github_username,
          synced: !!d.github_token,
        });
      }
    });
  }, [user?.id]);

  // Full member list — root only (used for activity charts)
  useEffect(() => {
    if (!profile || profile.role !== "root") return;
    supabase
      .from("profiles")
      .select(
        "id, full_name, username, avatar_url, role, status, created_at, last_seen_at",
      )
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const rows = (data as MemberRow[]) ?? [];
        set_all_members(rows);
        cache_set(CACHE_ALL_MEMBERS, rows);
      });
  }, [profile?.role]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const tone =
    status_tone[
      effective_status(
        profile?.status ?? "active",
        profile?.last_seen_at ?? null,
      )
    ];
  const role = profile?.role ?? "member";
  const display =
    profile?.full_name ||
    profile?.username ||
    user.email?.split("@")[0] ||
    "User";
  const pct = completion_pct(profile);
  const has_github = !!user.identities?.some((i) => i.provider === "github");

  const fade = (delay = 0) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: ease_out, delay },
  });

  return (
    <div className="flex h-full overflow-hidden">
      <SideRail />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden pt-14 lg:pt-0">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: ease_out }}
          className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line bg-card px-4 py-3 lg:px-6 lg:py-4"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-flag-red/10 text-flag-red">
              <GridIcon size={16} />
            </span>
            <div>
              <h1 className="text-sm font-bold text-ink">Dashboard</h1>
              <p className="text-[10px] text-muted">{today}</p>
            </div>
          </div>
        </motion.div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-6 sm:px-6 lg:gap-6 lg:px-8 lg:py-8">
          {/* ── Welcome card ── */}
          <motion.div {...fade(0)} className="surface rounded-2xl p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="relative w-fit shrink-0">
                <AvatarUploader
                  url={profile?.avatar_url}
                  editing={false}
                  size="lg"
                />
                <span
                  className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-card ${tone.dot}`}
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xl font-bold text-ink">
                  {greeting}, {display}.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ROLE_CLS[role]}`}
                  >
                    <ShieldIcon size={10} />
                    {ROLE_LABEL[role]}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] ${tone.text}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                    {tone.label}
                  </span>
                  {profile?.username && (
                    <span className="text-[11px] text-muted">
                      @{profile.username}
                    </span>
                  )}
                </div>
                {profile?.bio && (
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">
                    {profile.bio}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                  {(profile?.job_title || profile?.company) && (
                    <span className="flex items-center gap-1.5 text-[11px] text-muted">
                      <BriefcaseIcon size={11} />
                      {[
                        profile.job_title,
                        profile.company && `@ ${profile.company}`,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    </span>
                  )}
                  {profile?.location && (
                    <span className="flex items-center gap-1.5 text-[11px] text-muted">
                      <MapPinIcon size={11} />
                      {profile.location}
                    </span>
                  )}
                  {profile?.website && (
                    <a
                      href={
                        profile.website.startsWith("http")
                          ? profile.website
                          : `https://${profile.website}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-[11px] text-flag-red hover:underline"
                    >
                      <GlobeIcon size={11} />
                      {profile.website.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                </div>

                {pct < 100 && (
                  <div className="mt-4">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[10px] text-muted">
                        Profile completion
                      </span>
                      <span className="text-[10px] font-semibold text-ink">
                        {pct}%
                      </span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-line/50">
                      <div
                        className="h-full rounded-full bg-flag-red/60 transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <Link
                to="/profile"
                className="flex shrink-0 items-center gap-1.5 self-start rounded-xl border border-line bg-card/60 px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-flag-red/40 hover:text-ink"
              >
                <PencilIcon size={12} />
                Edit
              </Link>
            </div>
          </motion.div>

          {/* ── Info cards ── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Account */}
            <motion.div
              {...fade(0.07)}
              className="surface flex flex-col gap-4 rounded-2xl p-5"
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                Account
              </p>
              <div className="space-y-3">
                <InfoRow
                  icon={<UserIcon size={13} />}
                  label="Email"
                  value={user.email ?? "—"}
                />
                <InfoRow
                  icon={<CalendarIcon size={13} />}
                  label="Member since"
                  value={user.created_at ? fmt_date(user.created_at) : "—"}
                />
                <InfoRow
                  icon={<ClockIcon size={13} />}
                  label="Last sign in"
                  value={
                    user.last_sign_in_at ? fmt_rel(user.last_sign_in_at) : "—"
                  }
                />
                {profile?.timezone && (
                  <InfoRow
                    icon={<GlobeIcon size={13} />}
                    label="Timezone"
                    value={profile.timezone}
                  />
                )}
              </div>
            </motion.div>

            {/* GitHub */}
            <motion.div
              {...fade(0.12)}
              className="surface flex flex-col gap-4 rounded-2xl p-5"
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                GitHub
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${has_github ? "bg-flag-red/10 text-flag-red" : "bg-line/40 text-muted"}`}
                  >
                    <GithubIcon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    {github_name ? (
                      <>
                        <p className="truncate text-sm font-semibold text-ink">
                          @{github_name}
                        </p>
                        <p className="text-[10px] text-muted">
                          {github_synced
                            ? "Token stored · auto-load on"
                            : "Linked · no token stored"}
                        </p>
                      </>
                    ) : has_github ? (
                      <>
                        <p className="text-xs font-medium text-ink">
                          Account linked
                        </p>
                        <p className="text-[10px] text-muted">
                          Open Git page to sync data
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-medium text-muted">
                          Not connected
                        </p>
                        <p className="text-[10px] text-muted/60">
                          Link your GitHub account
                        </p>
                      </>
                    )}
                  </div>
                  {github_synced && (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-flag-red/10 text-flag-red">
                      <CheckIcon size={10} />
                    </span>
                  )}
                </div>

                <Link
                  to="/git"
                  className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-xs font-medium transition-colors ${
                    github_synced
                      ? "border-flag-red/30 bg-flag-red/5 text-flag-red hover:bg-flag-red/10"
                      : "border-line/60 text-muted hover:border-flag-red/30 hover:bg-flag-red/[0.02] hover:text-ink"
                  }`}
                >
                  {github_synced
                    ? "View GitHub data"
                    : has_github
                      ? "Sync GitHub data"
                      : "Connect GitHub"}
                  <ChevronIcon size={12} className="-rotate-90" />
                </Link>
              </div>
            </motion.div>

            {/* Workspace */}
            <motion.div
              {...fade(0.17)}
              className="surface flex flex-col gap-4 rounded-2xl p-5"
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                Workspace
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-line/40 text-muted">
                    <UsersIcon size={13} />
                  </span>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted">
                      Members
                    </p>
                    <p className="text-xs font-medium text-ink">
                      {member_count !== null
                        ? `${member_count} registered`
                        : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-line/40 text-muted">
                    <ShieldIcon size={13} />
                  </span>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted">
                      Your role
                    </p>
                    <p
                      className={`text-xs font-semibold ${ROLE_CLS[role].split(" ").find((c) => c.startsWith("text-"))}`}
                    >
                      {ROLE_LABEL[role]}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-line/40 text-muted">
                    <ActivityIcon size={13} />
                  </span>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted">
                      Status
                    </p>
                    <p className={`text-xs font-semibold ${tone.text}`}>
                      {tone.label}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* ── Quick nav ── */}
          <motion.div {...fade(0.22)} className="grid gap-3 sm:grid-cols-3">
            <NavCard
              to="/git"
              icon={<GitBranchIcon size={18} />}
              label="Git"
              sub={github_name ? `@${github_name}` : "Connect your GitHub"}
              badge={
                github_synced ? (
                  <span className="rounded-full bg-flag-red/10 px-1.5 py-px text-[9px] font-bold text-flag-red">
                    synced
                  </span>
                ) : undefined
              }
            />
            <NavCard
              to="/users"
              icon={<UsersIcon size={18} />}
              label={role === "root" ? "Users" : "Members"}
              sub={
                member_count !== null
                  ? `${member_count} registered`
                  : "View members"
              }
            />
            <NavCard
              to="/settings"
              icon={<SettingsIcon size={18} />}
              label="Settings"
              sub="Workspace preferences"
            />
          </motion.div>

          {/* ── Root-only activity charts ── */}
          {role === "root" && (
            <motion.section {...fade(0.27)} className="space-y-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                Member activity
              </p>

              {all_members ? (
                <>
                  <Suspense
                    fallback={
                      <div className="grid gap-4 lg:grid-cols-3">
                        <div className="surface h-64 animate-pulse rounded-2xl" />
                        <div className="surface h-64 animate-pulse rounded-2xl lg:col-span-2" />
                      </div>
                    }
                  >
                    <ActivityCharts members={all_members} />
                  </Suspense>
                  <RecentSignups members={all_members} />
                </>
              ) : (
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="surface h-64 animate-pulse rounded-2xl" />
                  <div className="surface h-64 animate-pulse rounded-2xl lg:col-span-2" />
                </div>
              )}
            </motion.section>
          )}
        </div>
      </main>
    </div>
  );
};

export default Home;
