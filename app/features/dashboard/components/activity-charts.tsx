import { useMemo, type ReactNode } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
} from "recharts";
import { AvatarUploader } from "~/features/profile/components/avatar-uploader";
import { use_presence_tick } from "~/hooks/use-presence-tick";
import { effective_status } from "~/features/profile/lib/profile";
import type { MemberRow } from "~/features/dashboard/routes/home";

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

const STATUS_HEX: Record<string, string> = {
  active: "hsl(113 63% 66%)",
  away: "hsl(49 93% 67%)",
  busy: "hsl(355 81% 47%)",
  offline: "#6b7280",
};

const SH = ({ children }: { children: ReactNode }) => (
  <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted">
    {children}
  </p>
);

// Recharts tooltip
const CT = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-2 text-xs shadow-xl">
      {label && (
        <p className="mb-1 text-[10px] uppercase tracking-wide text-muted">
          {label}
        </p>
      )}
      {payload.map((p, i) => (
        <p key={i} className="font-semibold text-ink">
          {p.value} {p.name}
        </p>
      ))}
    </div>
  );
};

const StatusChart = ({ members }: { members: MemberRow[] }) => {
  const tick = use_presence_tick();

  const data = useMemo(() => {
    const counts: Record<string, number> = {
      active: 0,
      away: 0,
      busy: 0,
      offline: 0,
    };
    for (const m of members) {
      const s = effective_status(
        m.status as "active" | "away" | "busy" | "offline",
        m.last_seen_at,
      );
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return Object.entries(counts).map(([status, count]) => ({
      status,
      count,
      color: STATUS_HEX[status] ?? "#6b7280",
    }));
  }, [members, tick]);

  const active_members = useMemo(
    () =>
      members
        .filter(
          (m) =>
            effective_status(
              m.status as "active" | "away" | "busy" | "offline",
              m.last_seen_at,
            ) === "active",
        )
        .slice(0, 5),
    [members, tick],
  );

  return (
    <div className="surface flex flex-col rounded-2xl p-5">
      <SH>Status breakdown</SH>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={42}
            outerRadius={70}
            paddingAngle={3}
            dataKey="count"
            nameKey="status"
          >
            {data.map(({ status, color }) => (
              <Cell key={status} fill={color} strokeWidth={0} />
            ))}
          </Pie>
          <RTooltip content={<CT />} />
        </PieChart>
      </ResponsiveContainer>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
        {data
          .filter((d) => d.count > 0)
          .map(({ status, count, color }) => (
            <div
              key={status}
              className="flex items-center justify-between gap-2"
            >
              <span className="flex items-center gap-1.5 text-[11px] capitalize text-muted">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: color }}
                />
                {status}
              </span>
              <span className="text-[11px] font-semibold tabular-nums text-ink">
                {count}
              </span>
            </div>
          ))}
      </div>

      {active_members.length > 0 && (
        <div className="mt-4 border-t border-line/40 pt-4">
          <p className="mb-2 text-[10px] uppercase tracking-wide text-muted">
            Online now
          </p>
          <div className="space-y-2">
            {active_members.map((m) => {
              const name = m.full_name || m.username || "User";
              return (
                <div key={m.id} className="flex items-center gap-2.5">
                  <div className="relative">
                    <AvatarUploader
                      url={m.avatar_url}
                      editing={false}
                      size="sm"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-card bg-light-green" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium text-ink">
                      {name}
                    </p>
                    {m.username && (
                      <p className="truncate text-[10px] text-muted">
                        @{m.username}
                      </p>
                    )}
                  </div>
                  <span
                    className={`ml-auto shrink-0 rounded-full px-1.5 py-px text-[9px] font-semibold ${ROLE_CLS[m.role]}`}
                  >
                    {ROLE_LABEL[m.role] ?? m.role}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const GrowthChart = ({ members }: { members: MemberRow[] }) => {
  const data = useMemo(() => {
    const months = new Map<string, number>();
    for (const m of members) {
      if (!m.created_at) continue;
      const d = new Date(m.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.set(key, (months.get(key) ?? 0) + 1);
    }
    let running = 0;
    return [...months.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => {
        running += count;
        return {
          month: new Date(key + "-01").toLocaleDateString(undefined, {
            month: "short",
            year: "2-digit",
          }),
          total: running,
          new: count,
        };
      });
  }, [members]);

  const total = members.length;
  const this_month = data[data.length - 1]?.new ?? 0;

  return (
    <div className="surface flex flex-col rounded-2xl p-5 lg:col-span-2">
      <div className="mb-4 flex items-center justify-between">
        <SH>Member growth</SH>
        <div className="flex gap-4 text-right">
          <div>
            <p className="text-lg font-bold tabular-nums text-ink">{total}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted">
              Total
            </p>
          </div>
          {this_month > 0 && (
            <div>
              <p className="text-lg font-bold tabular-nums text-light-green">
                +{this_month}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-muted">
                This month
              </p>
            </div>
          )}
        </div>
      </div>

      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart
            data={data}
            margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
          >
            <defs>
              <linearGradient id="growth_fill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-light-green)"
                  stopOpacity={0.25}
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-light-green)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-line)"
              strokeOpacity={0.5}
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: "var(--color-muted)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: "var(--color-muted)" }}
              tickLine={false}
              axisLine={false}
            />
            <RTooltip
              content={<CT />}
              cursor={{
                stroke: "var(--color-light-green)",
                strokeWidth: 1,
                strokeDasharray: "4 2",
              }}
            />
            <Area
              type="monotone"
              dataKey="total"
              name="members"
              stroke="var(--color-light-green)"
              strokeWidth={2}
              fill="url(#growth_fill)"
              dot={false}
              activeDot={{
                r: 4,
                fill: "var(--color-light-green)",
                stroke: "var(--color-card)",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex flex-1 items-center justify-center py-10">
          <p className="text-sm text-muted">No data yet</p>
        </div>
      )}
    </div>
  );
};

const ActivityCharts = ({ members }: { members: MemberRow[] }) => (
  <div className="grid gap-4 lg:grid-cols-3">
    <StatusChart members={members} />
    <GrowthChart members={members} />
  </div>
);

export default ActivityCharts;
