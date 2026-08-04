import {
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { fmt_bytes, type TableStat } from "~/features/system/lib/system-stats";

export const ConnRing = ({
  active,
  total,
}: {
  active: number;
  total: number;
}) => {
  const idle = Math.max(0, total - active);
  const data = [
    { name: "Active", value: active, color: "hsl(113 63% 66%)" },
    { name: "Idle", value: idle, color: "hsl(220 9% 60% / 0.4)" },
  ];
  const pct_active = total > 0 ? Math.round((active / total) * 100) : 0;

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-28 w-28 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={36}
              outerRadius={52}
              dataKey="value"
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-lg font-bold tabular-nums text-ink">
            {pct_active}%
          </p>
          <p className="text-[9px] uppercase tracking-wide text-muted">
            active
          </p>
        </div>
      </div>
      <div className="space-y-2.5">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: d.color }}
            />
            <div>
              <p className="text-[11px] font-medium text-ink">{d.name}</p>
              <p className="text-[11px] tabular-nums text-muted">
                {d.value} connection{d.value !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        ))}
        <p className="text-[10px] text-muted/60">Total pool: {total}</p>
      </div>
    </div>
  );
};

// ─── Table chart — radial bars in green ──────────────────────────────────────

// Shades of light-green (hsl 113 63%) from full to dimmer for data vs index
const GREEN_DATA = "var(--color-light-green)"; // hsl(113 63% 66%)
const GREEN_IDX = "hsl(113 63% 66% / 0.35)";

const TableTip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { label: string } }[];
}) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-xl border border-line bg-card px-3.5 py-2.5 text-xs shadow-xl">
      <p className="mb-1.5 font-semibold text-ink">{row.label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-muted">
          {p.name}:{" "}
          <span className="font-medium text-ink">{fmt_bytes(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

const TICK = { fontSize: 10, fill: "var(--color-muted)" } as const;
const GRID = {
  stroke: "var(--color-line)",
  strokeOpacity: 0.5,
  strokeDasharray: "3 3",
} as const;

const trunc_name = (name: string, max = 16) =>
  name.length > max ? `${name.slice(0, max - 1)}…` : name;

// One row per table at a fixed height — the chart's own height still grows
// with the table count (so bars never get uncomfortably thin), but that
// growth is capped by an outer scroll area instead of pushing the rest of
// the page down, which is what a table-count-many radial chart used to do.
const ROW_H = 28;
const MAX_H = 288;

export const TableChart = ({ tables }: { tables: TableStat[] }) => {
  if (tables.length === 0)
    return (
      <p className="py-8 text-center text-sm text-muted">No public tables</p>
    );

  const sorted = [...tables].sort((a, b) => b.size_bytes - a.size_bytes);
  const data = sorted.map((t) => ({
    label: t.name,
    Data: t.table_bytes,
    Index: t.index_bytes,
  }));
  const chart_h = Math.max(MAX_H, data.length * ROW_H + 24);
  const total_size = tables.reduce((sum, t) => sum + t.size_bytes, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] text-muted">
          {tables.length} table{tables.length !== 1 ? "s" : ""} · sorted by size
        </p>
        <p className="text-[11px] font-medium tabular-nums text-ink">
          {fmt_bytes(total_size)} total
        </p>
      </div>

      <div className="overflow-y-auto pr-1" style={{ maxHeight: MAX_H }}>
        <div style={{ height: chart_h }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
              barCategoryGap={8}
            >
              <CartesianGrid horizontal={false} {...GRID} />
              <XAxis
                type="number"
                tickFormatter={fmt_bytes}
                tick={TICK}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={104}
                tick={TICK}
                tickFormatter={trunc_name}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<TableTip />}
                cursor={{ fill: "var(--color-line)", fillOpacity: 0.25 }}
              />
              <Bar
                dataKey="Data"
                stackId="sz"
                fill={GREEN_DATA}
                radius={[3, 0, 0, 3]}
                maxBarSize={16}
              />
              <Bar
                dataKey="Index"
                stackId="sz"
                fill={GREEN_IDX}
                radius={[0, 3, 3, 0]}
                maxBarSize={16}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-5 border-t border-line/40 pt-3">
        <span className="flex items-center gap-1.5 text-[10px] text-muted">
          <span
            className="h-2 w-3 rounded-sm"
            style={{ background: GREEN_DATA }}
          />{" "}
          Data
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-muted">
          <span
            className="h-2 w-3 rounded-sm"
            style={{ background: GREEN_IDX }}
          />{" "}
          Indexes
        </span>
      </div>
    </div>
  );
};
