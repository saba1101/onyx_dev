import { LineChart, Line, ResponsiveContainer } from "recharts"

export const MarketSparkline = ({
  data,
  color,
}: {
  data: { p: number }[]
  color: string
}) => (
  <ResponsiveContainer width={72} height={28}>
    <LineChart data={data}>
      <Line type="monotone" dataKey="p" dot={false} strokeWidth={1.5} stroke={color} />
    </LineChart>
  </ResponsiveContainer>
)
