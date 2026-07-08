import { useEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import { Navigate, useSearchParams } from "react-router"
import { Link } from "react-router"
import { useAuth } from "~/features/auth/lib/auth"
import { useProfile } from "~/features/profile/lib/profile-context"
import { SideRail } from "~/components/ui/side-rail"
import { cg, fmt_large, fmt_pct, pct_cls, type CoinMarket, type GlobalStats, type TrendingCoin } from "~/features/crypto/lib/coingecko"
import { useFavorites } from "~/features/crypto/lib/favorites"
import { LiveTicker } from "~/features/crypto/components/live-ticker"
import { MarketTable } from "~/features/crypto/components/market-table"
import { FavoritesPanel } from "~/features/crypto/components/favorites-panel"
import { RefreshIcon, TrendingUpIcon, StarIcon, StarFilledIcon } from "~/components/ui/icons"

export const meta = () => [{ title: "Crypto · Onyx Dev" }]

type Tab = "market" | "favorites" | "trending"

// ─── Global stats bar ─────────────────────────────────────────────────────────

const GlobalBar = ({ stats }: { stats: GlobalStats["data"] | null }) => {
  if (!stats) {
    return (
      <div className="flex flex-wrap gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-7 w-32 animate-pulse rounded-lg bg-line/40" />
        ))}
      </div>
    )
  }

  const items = [
    { label: "Market cap",    value: fmt_large(stats.total_market_cap.usd),  pct: stats.market_cap_change_percentage_24h_usd, cls: "text-ink" },
    { label: "Volume 24h",   value: fmt_large(stats.total_volume.usd),       pct: null, cls: "text-orange-400" },
    { label: "BTC dom",      value: `${(stats.market_cap_percentage.btc ?? 0).toFixed(1)}%`, pct: null, cls: "text-ink" },
    { label: "ETH dom",      value: `${(stats.market_cap_percentage.eth ?? 0).toFixed(1)}%`, pct: null, cls: "text-ink" },
    { label: "Active coins", value: stats.active_cryptocurrencies.toLocaleString(), pct: null, cls: "text-ink" },
  ]

  return (
    <div className="surface flex flex-wrap gap-x-5 gap-y-2 rounded-2xl px-4 py-3 sm:px-5">
      {items.map(({ label, value, pct, cls }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-muted">{label}</span>
          <span className={`text-[11px] font-semibold tabular-nums ${cls}`}>{value}</span>
          {pct != null && (
            <span className={`text-[10px] font-medium ${pct_cls(pct)}`}>{fmt_pct(pct)}</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Trending tab ──────────────────────────────────────────────────────────────

type TrendingTabProps = {
  coins:         TrendingCoin[] | null
  fav_ids:       Set<string>
  on_toggle_fav: (coin: { id: string; name: string; symbol: string; image: string }) => Promise<void>
}

const TrendingTab = ({ coins, fav_ids, on_toggle_fav }: TrendingTabProps) => {
  if (!coins) {
    return (
      <div className="surface rounded-2xl">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line/30 px-4 py-3 last:border-0">
            <div className="h-7 w-7 animate-pulse rounded-full bg-line/40" />
            <div className="h-4 flex-1 animate-pulse rounded bg-line/40" />
            <div className="h-4 w-16 animate-pulse rounded bg-line/40" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="surface rounded-2xl">
      <div className="flex items-center gap-2 border-b border-line/50 px-4 py-3">
        <TrendingUpIcon size={12} className="text-flag-red" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">Trending searches</p>
      </div>
      <div className="divide-y divide-line/25">
        {coins.map((entry, i) => {
          const c      = entry.item
          const pct    = c.data?.price_change_percentage_24h?.usd
          const is_fav = fav_ids.has(c.id)
          return (
            <div key={c.id} className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-line/20">
              <button
                onClick={() => on_toggle_fav({ id: c.id, name: c.name, symbol: c.symbol, image: c.thumb })}
                className={`shrink-0 rounded-lg p-1.5 transition-colors hover:bg-line/40 ${is_fav ? "text-amber-400" : "text-muted/30 opacity-0 group-hover:opacity-100"}`}
                title={is_fav ? "Remove from favorites" : "Add to favorites"}
              >
                {is_fav ? <StarFilledIcon size={13} /> : <StarIcon size={13} />}
              </button>
              <span className="w-5 shrink-0 text-center text-[11px] text-muted">{i + 1}</span>
              <Link to={`/crypto/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <img src={c.thumb} alt={c.name} className="h-7 w-7 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-ink">{c.name}</p>
                  <p className="text-[10px] uppercase text-muted">{c.symbol}</p>
                </div>
              </Link>
              {c.market_cap_rank && (
                <span className="hidden shrink-0 rounded-lg bg-line/40 px-2 py-0.5 text-[10px] text-muted sm:inline">
                  #{c.market_cap_rank}
                </span>
              )}
              {pct != null && (
                <span className={`shrink-0 text-[11px] font-semibold ${pct_cls(pct)}`}>{fmt_pct(pct)}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

const CryptoPage = () => {
  const { user, loading }               = useAuth()
  const { profile, loading: p_loading } = useProfile()
  const [params, set_params]            = useSearchParams()
  const tab                             = (params.get("tab") ?? "market") as Tab
  const { favs, ids: fav_ids, toggle: toggle_fav } = useFavorites(user?.id ?? "")

  const [coins,        set_coins]        = useState<CoinMarket[]>([])
  const [global_s,     set_global_s]     = useState<GlobalStats["data"] | null>(null)
  const [trending,     set_trending]     = useState<TrendingCoin[] | null>(null)
  const [page,         set_page]         = useState(1)
  const [loading_init, set_loading_init] = useState(true)
  const [loading_more, set_loading_more] = useState(false)
  const [has_more,     set_has_more]     = useState(true)
  const [last_updated, set_last_updated] = useState(0)
  const [refreshing,   set_refreshing]   = useState(false)

  const timer_ref = useRef<ReturnType<typeof setInterval> | null>(null)

  const set_tab = (t: Tab) => {
    const next = new URLSearchParams(params)
    next.set("tab", t)
    set_params(next, { replace: true })
  }

  const load_page = async (p: number, append = false) => {
    if (!append) set_loading_init(true)
    const data = await cg.markets(p)
    if (data) {
      set_coins(prev => append ? [...prev, ...data] : data)
      set_has_more(data.length === 50)
    }
    set_loading_init(false)
    set_last_updated(Date.now())
  }

  const refresh = async () => {
    set_refreshing(true)
    await load_page(1)
    set_page(1)
    set_refreshing(false)
  }

  const load_more = async () => {
    const next = page + 1
    set_loading_more(true)
    const data = await cg.markets(next)
    if (data && data.length > 0) {
      set_coins(prev => [...prev, ...data])
      set_page(next)
      set_has_more(data.length === 50)
    } else {
      set_has_more(false)
    }
    set_loading_more(false)
  }

  useEffect(() => {
    load_page(1)
    cg.global().then(d => { if (d) set_global_s(d.data) })
    cg.trending().then(d => { if (d) set_trending(d.coins) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-refresh market data every 90s (matches cache TTL)
  useEffect(() => {
    timer_ref.current = setInterval(refresh, 90_000)
    return () => { if (timer_ref.current) clearInterval(timer_ref.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading || p_loading) return null
  if (!user) return <Navigate to="/login" replace />

  const fade = (delay = 0) => ({
    initial:    { opacity: 0, y: 10 },
    animate:    { opacity: 1, y: 0  },
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const, delay },
  })

  const TABS: { key: Tab; label: string }[] = [
    { key: "market",    label: "Market"    },
    { key: "favorites", label: `Favorites${fav_ids.size ? ` · ${fav_ids.size}` : ""}` },
    { key: "trending",  label: "Trending"  },
  ]

  const updated_str = last_updated
    ? new Date(last_updated).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : null

  return (
    <div className="flex min-h-screen">
      <SideRail />
      <main className="flex min-w-0 flex-1 flex-col pt-14 lg:pt-0">

        {/* Live ticker */}
        {coins.length > 0 && <LiveTicker coins={coins} />}

        {/* Page content */}
        <div className="flex flex-col gap-4 px-4 pb-12 pt-4 sm:px-6 lg:gap-5 lg:px-8 lg:pb-8">

          {/* Date + last updated header */}
          <motion.div {...fade(0)} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted uppercase tracking-wide">
                {new Date().toLocaleDateString(undefined, { weekday: "long" })}
              </p>
              <p className="text-lg font-bold text-ink leading-tight">
                {new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {updated_str && (
                <div className="flex items-center gap-1.5 rounded-xl border border-line/60 bg-card/60 px-3 py-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-light-green animate-pulse" />
                  <span className="text-[11px] font-medium text-muted">
                    Updated <span className="font-semibold text-ink">{updated_str}</span>
                  </span>
                </div>
              )}
              <button
                onClick={refresh}
                disabled={refreshing || loading_init}
                className="flex items-center gap-1.5 rounded-xl border border-line/60 bg-card/60 px-3 py-1.5 text-[11px] font-semibold text-muted transition-colors hover:border-flag-red/30 hover:bg-flag-red/5 hover:text-ink disabled:opacity-40"
              >
                <RefreshIcon size={12} className={refreshing ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </motion.div>

          <motion.div {...fade(0.05)}>
            <GlobalBar stats={global_s} />
          </motion.div>

          {/* Tab bar */}
          <motion.div {...fade(0.1)} className="flex gap-1 rounded-xl border border-line/60 bg-card/60 p-1 sm:self-start">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => set_tab(t.key)}
                className={`rounded-lg px-4 py-1.5 text-[11px] font-semibold transition-colors ${
                  tab === t.key ? "bg-flag-red text-white shadow-sm" : "text-muted hover:bg-line/50 hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </motion.div>

          <motion.div {...fade(0.15)}>
            {tab === "market" && (
              <MarketTable
                coins={coins}
                loading={loading_init && coins.length === 0}
                loading_more={loading_more}
                has_more={has_more}
                on_load_more={load_more}
                fav_ids={fav_ids}
                on_toggle_fav={toggle_fav}
              />
            )}
            {tab === "favorites" && (
              <FavoritesPanel favs={favs} ids={fav_ids} toggle={toggle_fav} />
            )}
            {tab === "trending" && (
              <TrendingTab coins={trending} fav_ids={fav_ids} on_toggle_fav={toggle_fav} />
            )}
          </motion.div>
        </div>
      </main>
    </div>
  )
}

export default CryptoPage
