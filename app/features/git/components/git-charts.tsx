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
  BarChart,
  Bar,
  Tooltip as RTooltip,
} from "recharts"
import { lang_color, fmt_bytes, type LangMap } from "~/features/git/lib/github"

const CT = ({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-2.5 text-xs shadow-xl">
      {label && <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="font-semibold text-ink">
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: p.color }} />
          {p.value.toLocaleString()} {p.name}
        </p>
      ))}
    </div>
  )
}

const SH = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-3 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted before:inline-block before:h-px before:w-3 before:bg-flag-red/60 before:content-['']">
    {children}
  </p>
)

// ─── Overview tab's language donut ────────────────────────────────────────────

export const LanguageDonut = ({
  lang_pie,
}: {
  lang_pie: { name: string; bytes: number; pct: number }[]
}) => (
  <>
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={lang_pie}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          dataKey="bytes"
          nameKey="name"
        >
          {lang_pie.map(({ name }) => (
            <Cell key={name} fill={lang_color(name)} strokeWidth={0} />
          ))}
        </Pie>
        <RTooltip content={<CT />} />
      </PieChart>
    </ResponsiveContainer>
    <div className="mt-1 space-y-2">
      {lang_pie.slice(0, 6).map(({ name, pct }) => (
        <div key={name} className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: lang_color(name) }} />
          <span className="min-w-0 flex-1 truncate text-xs text-ink">{name}</span>
          <span className="text-[11px] tabular-nums text-muted">{(pct * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  </>
)

// ─── Languages tab ─────────────────────────────────────────────────────────────

export const LanguagesTab = ({ languages }: { languages: LangMap }) => {
  const entries = Object.entries(languages).sort(([, a], [, b]) => b - a)
  const total   = entries.reduce((s, [, v]) => s + v, 0)
  const top10   = entries.slice(0, 10)
  const pie = top10.map(([name, bytes]) => ({ name, bytes }))
  const bar = top10.map(([name, bytes]) => ({ name, bytes, pct: ((bytes / total) * 100).toFixed(1) }))

  if (entries.length === 0) {
    return (
      <div className="surface rounded-2xl py-20 text-center">
        <p className="text-sm text-muted">No language data available.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="surface rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <SH>Language breakdown</SH>
          <p className="text-xs text-muted">{fmt_bytes(total)} of code across {entries.length} languages</p>
        </div>

        {/* Color bar */}
        <div className="mb-6 flex h-3 w-full overflow-hidden rounded-full">
          {top10.map(([name, bytes]) => (
            <div
              key={name}
              title={name}
              style={{ width: `${(bytes / total) * 100}%`, background: lang_color(name) }}
            />
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Donut */}
          <div>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pie}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={120}
                  paddingAngle={2}
                  dataKey="bytes"
                  nameKey="name"
                >
                  {pie.map(({ name }) => (
                    <Cell key={name} fill={lang_color(name)} strokeWidth={0} />
                  ))}
                </Pie>
                <RTooltip content={<CT />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Horizontal bar list */}
          <div className="space-y-3 py-2">
            {bar.map(({ name, bytes, pct }) => (
              <div key={name}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-medium text-ink">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: lang_color(name) }} />
                    {name}
                  </span>
                  <div className="flex gap-3 text-[11px] text-muted">
                    <span className="tabular-nums">{pct}%</span>
                    <span className="hidden sm:inline tabular-nums">{fmt_bytes(bytes)}</span>
                  </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-line/40">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: lang_color(name) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* All languages bar chart */}
      {entries.length > 3 && (
        <div className="surface rounded-2xl p-5">
          <SH>All languages — bytes of code</SH>
          <ResponsiveContainer width="100%" height={Math.min(entries.length * 32, 400)}>
            <BarChart
              layout="vertical"
              data={entries.slice(0, 15).map(([name, bytes]) => ({ name, bytes }))}
              margin={{ top: 0, right: 16, bottom: 0, left: 80 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={76}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickLine={false}
                axisLine={false}
              />
              <RTooltip content={<CT />} cursor={{ fill: "rgba(220,38,38,0.05)" }} />
              <Bar dataKey="bytes" name="bytes" radius={[0, 4, 4, 0]}>
                {entries.slice(0, 15).map(([name]) => (
                  <Cell key={name} fill={lang_color(name)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ─── Activity tab's commit chart ──────────────────────────────────────────────

export const CommitActivityChart = ({
  weekly,
}: {
  weekly: { week: string; commits: number }[]
}) =>
  weekly.length > 0 ? (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={weekly} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="commit_grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="var(--color-flag-red)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-flag-red)" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,100,100,0.1)" vertical={false} />
        <XAxis
          dataKey="week"
          tick={{ fontSize: 10, fill: "#6b7280" }}
          tickLine={false}
          axisLine={false}
          interval={7}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#6b7280" }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <RTooltip content={<CT />} cursor={{ stroke: "var(--color-flag-red)", strokeWidth: 1, strokeDasharray: "4 2" }} />
        <Area
          type="monotone"
          dataKey="commits"
          stroke="var(--color-flag-red)"
          strokeWidth={1.5}
          fill="url(#commit_grad)"
          dot={false}
          activeDot={{ r: 4, fill: "var(--color-flag-red)", strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  ) : (
    <p className="py-10 text-center text-sm text-muted">No commit data — stats may still be computing.</p>
  )
