import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Navigate } from "react-router";
import { motion } from "motion/react";
import { useAuth } from "~/features/auth/lib/auth";
import { useProfile } from "~/features/profile/lib/profile-context";
import { SideRail } from "~/components/ui/side-rail";
import {
  ActivityIcon,
  ArchiveIcon,
  CodeIcon,
  ClockIcon,
  UsersIcon,
} from "~/components/ui/icons";
import {
  fetch_system_stats,
  fmt_bytes,
  type SystemStats,
  type BucketStat,
  type TableStat,
} from "~/features/system/lib/system-stats";
import { DatabaseTab } from "~/features/database/routes/database";
import { StorageTab } from "~/features/storage/routes/storage";
import { cache_get, cache_set } from "~/lib/query-cache";

const ConnRing = lazy(() =>
  import("~/features/system/components/system-charts").then((m) => ({
    default: m.ConnRing,
  })),
);
const TableChart = lazy(() =>
  import("~/features/system/components/system-charts").then((m) => ({
    default: m.TableChart,
  })),
);

const CACHE_STATS = "system:stats";

export const meta = () => [{ title: "System — Onyx Dev" }];

const ease_out = [0.22, 1, 0.36, 1] as const;
const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: ease_out, delay },
});

// Supabase free-plan reference limits (used only for progress bars)
const DB_LIMIT = 500 * 1_024 * 1_024;
const STOR_LIMIT = 1_024 * 1_024 * 1_024;

// ─── Shared primitives ────────────────────────────────────────────────────────

const SH = ({ children }: { children: ReactNode }) => (
  <p className="mb-4 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted before:inline-block before:h-px before:w-3 before:bg-flag-red/60 before:content-['']">
    {children}
  </p>
);

const Card = ({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) => <div className={`surface rounded-2xl p-5 ${className}`}>{children}</div>;

// ─── Stat tiles ───────────────────────────────────────────────────────────────

const Tile = ({
  icon,
  label,
  value,
  sub,
  pulse,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  pulse?: boolean;
}) => (
  <div className="surface flex flex-col gap-2.5 rounded-2xl p-5">
    <span
      className={`flex h-9 w-9 items-center justify-center rounded-xl bg-flag-red/10 text-flag-red ${pulse ? "animate-pulse" : ""}`}
    >
      {icon}
    </span>
    <p className="text-2xl font-bold tracking-tight text-ink">{value}</p>
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
        {label}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-muted/70">{sub}</p>}
    </div>
  </div>
);

// ─── Usage bar ────────────────────────────────────────────────────────────────

const UsageBar = ({
  used,
  total,
  label,
  sub,
}: {
  used: number;
  total: number;
  label: string;
  sub: string;
}) => {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const fill =
    pct > 85 ? "bg-flag-red" : pct > 65 ? "bg-royal-gold" : "bg-light-green";
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-ink">{label}</span>
        <span className="text-[11px] tabular-nums text-muted">{sub}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-line/40">
        <div
          className={`h-full rounded-full transition-all duration-700 ${fill}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-right text-[10px] tabular-nums text-muted/60">
        {pct.toFixed(1)}%
      </p>
    </div>
  );
};

// ─── Bucket card ──────────────────────────────────────────────────────────────

const BucketCard = ({ b }: { b: BucketStat }) => {
  const pct =
    STOR_LIMIT > 0 ? Math.min(100, (b.total_bytes / STOR_LIMIT) * 100) : 0;
  const fill =
    pct > 85 ? "bg-flag-red" : pct > 65 ? "bg-royal-gold" : "bg-light-green";

  return (
    <div className="rounded-xl border border-line/60 bg-line/5 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-flag-red/10 text-flag-red">
            <ArchiveIcon size={13} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">{b.name}</p>
            <p className="text-[10px] text-muted">
              {b.public ? "public" : "private"}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold tabular-nums text-ink">
            {fmt_bytes(b.total_bytes)}
          </p>
          <p className="text-[10px] text-muted">
            {b.object_count.toLocaleString()} file
            {b.object_count !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-line/30">
          <div
            className={`h-full rounded-full transition-all duration-700 ${fill}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted/60">
          <span>{pct.toFixed(2)}% of 1 GB</span>
          {b.file_size_limit && (
            <span>Max file: {fmt_bytes(b.file_size_limit)}</span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const Skeleton = () => (
  <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="surface h-32 animate-pulse rounded-2xl" />
      ))}
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="surface h-72 animate-pulse rounded-2xl" />
      <div className="surface h-72 animate-pulse rounded-2xl" />
    </div>
    <div className="surface h-56 animate-pulse rounded-2xl" />
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

const System = () => {
  const { user, loading: auth_loading } = useAuth();
  const { profile, loading: profile_loading } = useProfile();

  const [active_tab, set_active_tab] = useState<
    "health" | "database" | "storage"
  >("health");
  const [stats, set_stats] = useState<SystemStats | null>(
    () => cache_get<SystemStats>(CACHE_STATS) ?? null,
  );
  const [fetching, set_fetching] = useState(
    () => !cache_get<SystemStats>(CACHE_STATS),
  );
  const [error, set_error] = useState<string | null>(null);
  const [refreshed, set_refreshed] = useState<Date | null>(null);
  const [refreshing, set_refreshing] = useState(false);

  const load = useCallback(async (is_refresh = false) => {
    if (is_refresh) set_refreshing(true);
    else set_fetching(true);
    set_error(null);
    const { data, error } = await fetch_system_stats();
    if (error) set_error(error);
    else {
      set_stats(data);
      cache_set(CACHE_STATS, data);
      set_refreshed(new Date());
    }
    set_fetching(false);
    set_refreshing(false);
  }, []);

  useEffect(() => {
    load(!!cache_get<SystemStats>(CACHE_STATS));
  }, [load]);

  if (auth_loading || profile_loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.role !== "root") return <Navigate to="/" replace />;

  const total_storage =
    stats?.storage.reduce((s, b) => s + b.total_bytes, 0) ?? 0;
  const cache_rate = stats?.db.cache_hit_rate ?? null;

  return (
    <div className="flex h-screen overflow-hidden">
      <SideRail />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden pt-14 lg:pt-0">
        {/* Header */}
        <motion.div
          {...fade(0)}
          className="flex shrink-0 flex-col border-b border-line bg-card"
        >
          {/* Title row */}
          <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-6 lg:py-4">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight text-ink">
                System
              </h1>
              <span className="hidden text-[11px] text-muted sm:block">
                Supabase infrastructure
              </span>
            </div>

            <div className="flex items-center gap-3">
              {refreshed && active_tab === "health" && (
                <span className="hidden text-[10px] text-muted sm:block">
                  Updated{" "}
                  {refreshed.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              )}
              {active_tab === "health" && (
                <button
                  type="button"
                  onClick={() => load(true)}
                  disabled={refreshing || fetching}
                  className="inline-flex items-center gap-2 rounded-lg border border-line bg-card/60 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-line/50 disabled:opacity-50"
                >
                  <RefreshIcon spinning={refreshing} />
                  Refresh
                </button>
              )}
            </div>
          </div>

          {/* Tab row */}
          <div className="px-4 pb-3 lg:px-6">
            <div className="inline-flex items-center gap-0.5 rounded-xl bg-line/30 p-1">
              {(
                [
                  { key: "health", label: "Health", icon: <TabHealthIcon /> },
                  { key: "database", label: "Database", icon: <TabDbIcon /> },
                  {
                    key: "storage",
                    label: "Storage",
                    icon: <TabArchiveIcon />,
                  },
                ] as const
              ).map(({ key, label, icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => set_active_tab(key)}
                  className={`relative rounded-lg px-3.5 py-1.5 text-[11px] font-semibold transition-colors duration-150 ${
                    active_tab === key
                      ? "text-flag-red"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {active_tab === key && (
                    <motion.span
                      layoutId="sys_tab_bg"
                      className="absolute inset-0 rounded-lg bg-card shadow-sm"
                      transition={{
                        type: "spring",
                        bounce: 0.2,
                        duration: 0.3,
                      }}
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
        </motion.div>

        {/* Database / Storage tabs */}
        {active_tab === "database" && <DatabaseTab />}
        {active_tab === "storage" && <StorageTab />}

        {/* Health content */}
        {active_tab === "health" && (
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
            {fetching && <Skeleton />}

            {error && (
              <motion.div
                {...fade(0.05)}
                className="rounded-xl border border-flag-red/30 bg-flag-red/5 px-5 py-4 text-sm text-flag-red"
              >
                Failed to load system stats: {error}
              </motion.div>
            )}

            {stats && (
              <div className="space-y-6">
                {/* ── Stat tiles ── */}
                <motion.div
                  {...fade(0.05)}
                  className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
                >
                  <Tile
                    icon={<CodeIcon size={18} />}
                    label="Database size"
                    value={fmt_bytes(stats.db.size_bytes)}
                    sub={`${((stats.db.size_bytes / DB_LIMIT) * 100).toFixed(2)}% of 500 MB`}
                  />
                  <Tile
                    icon={<ActivityIcon size={18} />}
                    label="Cache hit rate"
                    value={cache_rate !== null ? `${cache_rate}%` : "—"}
                    sub="Heap buffer efficiency"
                  />
                  <Tile
                    icon={<UsersIcon size={18} />}
                    label="Connections"
                    value={`${stats.db.active_connections} active`}
                    sub={`${stats.db.total_connections} total in pool`}
                  />
                  <Tile
                    icon={<ArchiveIcon size={18} />}
                    label="Storage used"
                    value={fmt_bytes(total_storage)}
                    sub={`across ${stats.storage.length} bucket${stats.storage.length !== 1 ? "s" : ""}`}
                  />
                </motion.div>

                {/* ── DB + Storage ── */}
                <motion.div
                  {...fade(0.1)}
                  className="grid gap-4 lg:grid-cols-2"
                >
                  {/* Database card */}
                  <Card className="space-y-6">
                    <SH>
                      <CodeIcon size={12} />
                      Database
                    </SH>

                    <UsageBar
                      used={stats.db.size_bytes}
                      total={DB_LIMIT}
                      label="Storage used"
                      sub={`${fmt_bytes(stats.db.size_bytes)} of 500 MB`}
                    />

                    {cache_rate !== null && (
                      <div className="space-y-1.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-medium text-ink">
                            Cache hit rate
                          </span>
                          <span className="text-[11px] tabular-nums text-muted">
                            {cache_rate}%
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-line/40">
                          <div
                            className="h-full rounded-full bg-light-green transition-all duration-700"
                            style={{ width: `${cache_rate}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-muted/60">
                          Higher is better — 99%+ is ideal
                        </p>
                      </div>
                    )}

                    <div>
                      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted">
                        Connection pool
                      </p>
                      <Suspense
                        fallback={
                          <div className="h-28 animate-pulse rounded-2xl bg-line/20" />
                        }
                      >
                        <ConnRing
                          active={stats.db.active_connections}
                          total={stats.db.total_connections}
                        />
                      </Suspense>
                    </div>
                  </Card>

                  {/* Storage card */}
                  <Card className="space-y-6">
                    <SH>
                      <ArchiveIcon size={12} />
                      Storage
                    </SH>

                    <UsageBar
                      used={total_storage}
                      total={STOR_LIMIT}
                      label="Total used"
                      sub={`${fmt_bytes(total_storage)} of 1 GB`}
                    />

                    <div className="space-y-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                        Buckets
                      </p>
                      {stats.storage.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted">
                          No buckets configured
                        </p>
                      ) : (
                        stats.storage.map((b) => (
                          <BucketCard key={b.name} b={b} />
                        ))
                      )}
                    </div>
                  </Card>
                </motion.div>

                {/* ── Table breakdown ── */}
                {stats.tables.length > 0 && (
                  <motion.div {...fade(0.15)}>
                    <Card>
                      <SH>
                        <CodeIcon size={12} />
                        Table sizes
                      </SH>
                      <Suspense
                        fallback={
                          <div className="h-72 animate-pulse rounded-2xl bg-line/20" />
                        }
                      >
                        <TableChart tables={stats.tables} />
                      </Suspense>
                    </Card>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

const ti = {
  width: 12,
  height: 12,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
const TabHealthIcon = () => (
  <svg {...ti}>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);
const TabDbIcon = () => (
  <svg {...ti}>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
    <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
  </svg>
);
const TabArchiveIcon = () => (
  <svg {...ti}>
    <path d="M21 8v13H3V8" />
    <path d="M1 3h22v5H1z" />
    <path d="M10 12h4" />
  </svg>
);

const RefreshIcon = ({ spinning }: { spinning: boolean }) => (
  <svg
    width={13}
    height={13}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={spinning ? "animate-spin" : ""}
  >
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);

export default System;
