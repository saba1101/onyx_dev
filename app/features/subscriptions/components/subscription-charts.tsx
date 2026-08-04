import {
  AreaChart,
  Area,
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts"
import { fmt_money, fmt_date } from "~/features/subscriptions/lib/subscriptions"

// ── Sparkline (mini, no axes) ──────────────────────────────────────────────────

export const Sparkline = ({
  points,
}: {
  points: { date: string; balance: number }[]
}) => {
  if (points.length < 2) {
    return <div className="flex h-7 items-center text-[10px] italic text-muted/50">No entries yet</div>
  }
  const positive = points[points.length - 1].balance >= 0
  const color = positive ? "var(--color-light-green)" : "var(--color-loss)"
  return (
    <ResponsiveContainer width="100%" height={28}>
      <AreaChart data={points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <Area type="monotone" dataKey="balance" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Running-balance chart (detail modal) ───────────────────────────────────────

const ChartTip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  const v = payload[0].value
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-2 text-xs shadow-xl">
      {label && <p className="mb-1 text-[10px] uppercase tracking-wide text-muted/60">{fmt_date(label)}</p>}
      <p className={`font-semibold ${v >= 0 ? "text-light-green" : "text-loss"}`}>{fmt_money(v)}</p>
    </div>
  )
}

export const BalanceChart = ({
  chart,
  net,
}: {
  chart: { date: string; balance: number }[]
  net: number
}) => (
  <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={chart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
      <defs>
        <linearGradient id="net_fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={net >= 0 ? "var(--color-light-green)" : "var(--color-loss)"} stopOpacity={0.25} />
          <stop offset="95%" stopColor={net >= 0 ? "var(--color-light-green)" : "var(--color-loss)"} stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid stroke="var(--color-line)" strokeOpacity={0.5} strokeDasharray="3 3" />
      <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--color-muted)" }} axisLine={false} tickLine={false} tickFormatter={d => fmt_date(d).replace(/, \d+$/, "")} />
      <YAxis tick={{ fontSize: 9, fill: "var(--color-muted)" }} axisLine={false} tickLine={false} />
      <Tooltip content={<ChartTip />} />
      <Area type="monotone" dataKey="balance" stroke={net >= 0 ? "var(--color-light-green)" : "var(--color-loss)"} strokeWidth={2} fill="url(#net_fill)" dot={false} />
    </AreaChart>
  </ResponsiveContainer>
)
