import { useEffect, useRef, useState } from "react"
import {
  createChart,
  ColorType,
  CrosshairMode,
  AreaSeries,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type UTCTimestamp,
} from "lightweight-charts"
import { cg, fmt_price } from "~/features/crypto/lib/coingecko"

type Range    = "1" | "7" | "30" | "365"
type ChartMode = "area" | "candle"

const RANGES: { label: string; value: Range }[] = [
  { label: "1D",  value: "1"   },
  { label: "7D",  value: "7"   },
  { label: "30D", value: "30"  },
  { label: "1Y",  value: "365" },
]

const UP_COLOR   = "hsl(113, 63%, 60%)"
const DOWN_COLOR = "hsl(355, 81%, 52%)"
const UP_VOL     = "rgba(74, 197, 94, 0.35)"
const DOWN_VOL   = "rgba(198, 36, 56, 0.35)"

const is_dark = () =>
  typeof document !== "undefined" && document.documentElement.classList.contains("dark")

const chart_opts = () => ({
  layout: {
    background:  { type: ColorType.Solid, color: "transparent" },
    textColor:   is_dark() ? "#9ca3af" : "#6b7280",
    fontSize:    11,
  },
  grid: {
    vertLines: { color: is_dark() ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" },
    horzLines: { color: is_dark() ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" },
  },
  crosshair: { mode: CrosshairMode.Magnet },
  rightPriceScale: {
    borderVisible: false,
    scaleMargins:  { top: 0.08, bottom: 0.26 },
  },
  timeScale:  { borderVisible: false, timeVisible: true, secondsVisible: false },
  handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
  handleScale:  { mouseWheel: true, pinch: true },
})

type Props = { coin_id: string; positive: boolean }

export const CoinChart = ({ coin_id, positive }: Props) => {
  const container_ref = useRef<HTMLDivElement>(null)
  const chart_ref     = useRef<IChartApi | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const series_refs   = useRef<ISeriesApi<SeriesType, any>[]>([])

  const [range,      set_range]      = useState<Range>("7")
  const [mode,       set_mode]       = useState<ChartMode>("area")
  const [loading,    set_loading]    = useState(true)
  const [candle_ok,  set_candle_ok]  = useState(true)
  const [tooltip,    set_tooltip]    = useState<{ price: string; date: string } | null>(null)

  const line_color = positive ? UP_COLOR : DOWN_COLOR

  // Create chart once on mount
  useEffect(() => {
    const el = container_ref.current
    if (!el) return

    const chart = createChart(el, {
      ...chart_opts(),
      width:  el.clientWidth,
      height: 300,
    })
    chart_ref.current = chart

    // Subscribe to crosshair for custom tooltip
    chart.subscribeCrosshairMove(param => {
      if (!param.time || !series_refs.current[0]) {
        set_tooltip(null)
        return
      }
      const price = param.seriesData.get(series_refs.current[0])
      if (!price) { set_tooltip(null); return }
      // price is either { value } for area, or { open,high,low,close } for candle
      const val = "value" in price ? price.value as number : (price as { close: number }).close
      const ts  = (param.time as number) * 1000
      const date = new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
      set_tooltip({ price: fmt_price(val), date })
    })

    const ro = new ResizeObserver(() => {
      if (container_ref.current) chart.applyOptions({ width: container_ref.current.clientWidth })
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.remove()
      chart_ref.current = null
    }
  }, [])

  // Load data whenever coin / range / mode changes
  useEffect(() => {
    const chart = chart_ref.current
    if (!chart) return

    let cancelled = false

    // Clear old series
    series_refs.current.forEach(s => { try { chart.removeSeries(s) } catch { /* noop */ } })
    series_refs.current = []
    set_loading(true)
    set_tooltip(null)

    const load = async () => {
      if (mode === "candle") {
        const ohlc = await cg.ohlc(coin_id, range)
        if (cancelled) return

        if (ohlc && ohlc.length > 0) {
          const cs = chart.addSeries(CandlestickSeries, {
            upColor:          UP_COLOR,
            downColor:        DOWN_COLOR,
            borderUpColor:    UP_COLOR,
            borderDownColor:  DOWN_COLOR,
            wickUpColor:      UP_COLOR,
            wickDownColor:    DOWN_COLOR,
          })
          cs.setData(ohlc.map(([ts, o, h, l, c]) => ({
            time:  (ts / 1000) as UTCTimestamp,
            open:  o, high: h, low: l, close: c,
          })))
          series_refs.current = [cs]
          chart.timeScale().fitContent()
          set_loading(false)
          return
        }
        // OHLC failed (no key), fall back to area
        if (!cancelled) { set_candle_ok(false); set_mode("area") }
        return
      }

      // Area mode: price + volume
      const data = await cg.chart(coin_id, range)
      if (cancelled || !data) { set_loading(false); return }

      const area = chart.addSeries(AreaSeries, {
        lineColor:      line_color,
        topColor:       positive ? "rgba(74,197,94,0.25)"   : "rgba(198,36,56,0.25)",
        bottomColor:    "rgba(0,0,0,0)",
        lineWidth:      2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius:  5,
        priceScaleId:   "right",
      })
      area.setData(data.prices.map(([ts, p]) => ({
        time:  (ts / 1000) as UTCTimestamp,
        value: p,
      })))

      // Volume histogram in a separate sub-pane
      const vol = chart.addSeries(HistogramSeries, {
        priceFormat:   { type: "volume" },
        priceScaleId:  "vol",
      })
      vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
      vol.setData(data.total_volumes.map(([ts, v], i) => ({
        time:  (ts / 1000) as UTCTimestamp,
        value: v,
        color: (data.prices[i]?.[1] ?? 0) >= (data.prices[i > 0 ? i - 1 : 0]?.[1] ?? 0) ? UP_VOL : DOWN_VOL,
      })))

      series_refs.current = [area, vol]
      chart.timeScale().fitContent()
      set_loading(false)
    }

    void load()
    return () => { cancelled = true }
  }, [coin_id, range, mode, positive, line_color])

  return (
    <div className="surface flex flex-col rounded-2xl">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/50 px-4 py-3">
        {/* Tooltip or label */}
        <div className="min-w-0">
          {tooltip ? (
            <div>
              <p className="text-sm font-bold tabular-nums text-ink">{tooltip.price}</p>
              <p className="text-[10px] text-muted">{tooltip.date}</p>
            </div>
          ) : (
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">Price chart</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {/* Chart type toggle */}
          <div className="flex gap-0.5 rounded-lg border border-line/60 p-0.5">
            <button
              onClick={() => set_mode("area")}
              className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${mode === "area" ? "bg-flag-red text-white" : "text-muted hover:text-ink"}`}
            >
              Area
            </button>
            <button
              onClick={() => { if (candle_ok) set_mode("candle") }}
              title={candle_ok ? undefined : "Requires CoinGecko API key"}
              className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
                mode === "candle" ? "bg-flag-red text-white" : candle_ok ? "text-muted hover:text-ink" : "cursor-not-allowed opacity-30"
              }`}
            >
              Candle
            </button>
          </div>

          {/* Range */}
          <div className="flex gap-0.5">
            {RANGES.map(r => (
              <button
                key={r.value}
                onClick={() => set_range(r.value)}
                className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                  range === r.value ? "bg-ink/10 text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart container */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-b-2xl bg-card/60">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-flag-red" />
          </div>
        )}
        <div ref={container_ref} className="w-full" style={{ height: 300 }} />
      </div>
    </div>
  )
}
