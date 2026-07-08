import { useEffect, useState } from "react"
import { Navigate, Link, useParams } from "react-router"
import { motion } from "motion/react"
import { useAuth } from "~/features/auth/lib/auth"
import { SideRail } from "~/components/ui/side-rail"
import { cg, fmt_price, fmt_large, fmt_pct, fmt_supply, pct_cls, type CoinDetail } from "~/features/crypto/lib/coingecko"
import { useFavorites } from "~/features/crypto/lib/favorites"
import { CoinChart } from "~/features/crypto/components/coin-chart"
import { ChevronIcon, ArrowUpIcon, ArrowDownIcon, StarIcon, StarFilledIcon } from "~/components/ui/icons"

export const meta = ({ params }: { params: Record<string, string> }) => [
  { title: `${params.id ?? "Coin"} · Crypto · Onyx Dev` },
]

// ─── Stat row ─────────────────────────────────────────────────────────────────

const StatRow = ({ label, value, value_cls }: { label: string; value: string; value_cls?: string }) => (
  <div className="flex items-center justify-between gap-3 py-2.5">
    <span className="text-[11px] text-muted">{label}</span>
    <span className={`text-[11px] font-semibold tabular-nums ${value_cls ?? "text-ink"}`}>{value}</span>
  </div>
)

// ─── Page ─────────────────────────────────────────────────────────────────────

const CoinDetailPage = () => {
  const { user, loading } = useAuth()
  const { id }            = useParams<{ id: string }>()
  const { ids: fav_ids, toggle: toggle_fav } = useFavorites(user?.id ?? "")

  const [coin,      set_coin]      = useState<CoinDetail | null>(null)
  const [error,     set_error]     = useState(false)
  const [show_desc, set_show_desc] = useState(false)

  useEffect(() => {
    if (!id) return
    set_coin(null)
    set_error(false)
    cg.coin(id).then(d => {
      if (!d) { set_error(true); return }
      set_coin(d)
    })
  }, [id])

  if (loading) return null
  if (!user)   return <Navigate to="/login" replace />

  const md     = coin?.market_data
  const pct24  = md?.price_change_percentage_24h ?? null
  const is_pos = (pct24 ?? 0) >= 0

  const plain_desc = (html: string) =>
    html.replace(/<[^>]*>/g, "").replace(/\n{3,}/g, "\n\n").trim()

  const fade = (delay = 0) => ({
    initial:    { opacity: 0, y: 10 },
    animate:    { opacity: 1, y: 0  },
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const, delay },
  })

  return (
    <div className="flex min-h-screen">
      <SideRail />
      <main className="flex min-w-0 flex-1 flex-col pt-14 lg:pt-0">

        {/* Top navigation bar */}
        <div className="flex items-center gap-2 border-b border-line/40 px-4 py-2.5 sm:px-6 lg:px-8">
          <Link
            to="/crypto"
            className="group flex items-center gap-1.5 rounded-lg border border-line/60 bg-card/60 px-2.5 py-1.5 text-[11px] font-medium text-muted transition-all hover:border-flag-red/30 hover:bg-flag-red/5 hover:text-ink"
          >
            <ChevronIcon size={11} className="rotate-90 transition-transform group-hover:-translate-x-0.5" />
            Markets
          </Link>
          {coin && (
            <>
              <span className="text-muted/40">/</span>
              <div className="flex items-center gap-1.5">
                <img src={coin.image.large} alt="" className="h-4 w-4 rounded-full" />
                <span className="text-[11px] font-medium text-ink">{coin.name}</span>
                <span className="text-[10px] uppercase text-muted">({coin.symbol})</span>
              </div>
            </>
          )}
        </div>

        {/* Page content */}
        <div className="flex flex-col gap-4 px-4 pb-12 pt-4 sm:px-6 lg:gap-5 lg:px-8 lg:pb-8">

          {error ? (
            <div className="surface flex flex-col items-center gap-4 rounded-2xl py-20 text-center">
              <p className="text-sm font-medium text-muted">Coin not found</p>
              <Link
                to="/crypto"
                className="flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-xs font-medium text-muted hover:text-ink"
              >
                <ChevronIcon size={11} className="rotate-90" />
                Back to markets
              </Link>
            </div>

          ) : !coin ? (
            // Skeleton
            <>
              <div className="grid gap-4 lg:grid-cols-5">
                <div className="flex flex-col gap-4 lg:col-span-3">
                  <div className="surface h-36 animate-pulse rounded-2xl" />
                  <div className="surface h-80 animate-pulse rounded-2xl" />
                </div>
                <div className="surface h-96 animate-pulse rounded-2xl lg:col-span-2" />
              </div>
            </>

          ) : (
            <>
              {/* Main 2-col layout */}
              <div className="grid gap-4 lg:grid-cols-5">

                {/* ── Left column: hero + chart ── */}
                <div className="flex flex-col gap-4 lg:col-span-3">

                  {/* Hero card */}
                  <motion.div {...fade(0)} className="surface rounded-2xl p-5">
                    <div className="flex items-start gap-4">
                      <img src={coin.image.large} alt={coin.name} className="h-14 w-14 shrink-0 rounded-2xl sm:h-16 sm:w-16" />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h1 className="text-lg font-bold text-ink sm:text-xl">{coin.name}</h1>
                          <span className="rounded-lg bg-line/40 px-2 py-0.5 text-[10px] font-semibold uppercase text-muted">
                            {coin.symbol}
                          </span>
                          {coin.market_cap_rank && (
                            <span className="rounded-lg bg-flag-red/10 px-2 py-0.5 text-[10px] font-bold text-flag-red">
                              #{coin.market_cap_rank}
                            </span>
                          )}
                          <button
                            onClick={() => toggle_fav({ id: coin.id, name: coin.name, symbol: coin.symbol, image: coin.image.large })}
                            className={`ml-1 rounded-lg p-1.5 transition-colors hover:bg-line/40 ${fav_ids.has(coin.id) ? "text-amber-400" : "text-muted/40 hover:text-muted"}`}
                            title={fav_ids.has(coin.id) ? "Remove from favorites" : "Add to favorites"}
                          >
                            {fav_ids.has(coin.id) ? <StarFilledIcon size={15} /> : <StarIcon size={15} />}
                          </button>
                        </div>

                        <div className="mt-2 flex flex-wrap items-end gap-3">
                          <p className="text-2xl font-bold tabular-nums text-ink sm:text-3xl">
                            {fmt_price(md?.current_price.usd ?? 0)}
                          </p>
                          <div className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-sm font-bold ${
                            is_pos ? "bg-light-green/15 text-light-green" : "bg-flag-red/15 text-flag-red"
                          }`}>
                            {is_pos ? <ArrowUpIcon size={12} /> : <ArrowDownIcon size={12} />}
                            {fmt_pct(pct24)}
                            <span className="text-[10px] font-normal opacity-70">24h</span>
                          </div>
                        </div>

                        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
                          {[
                            { label: "7d",  v: md?.price_change_percentage_7d  },
                            { label: "30d", v: md?.price_change_percentage_30d },
                            { label: "1y",  v: md?.price_change_percentage_1y  },
                          ].map(({ label, v }) => (
                            <span key={label} className="text-[11px] text-muted">
                              {label} <span className={`font-semibold ${pct_cls(v)}`}>{fmt_pct(v)}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Chart */}
                  <motion.div {...fade(0.07)}>
                    <CoinChart coin_id={coin.id} positive={is_pos} />
                  </motion.div>
                </div>

                {/* ── Right column: stats ── */}
                <motion.div {...fade(0.05)} className="lg:col-span-2">
                  <div className="surface sticky top-4 rounded-2xl p-5">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted">Market stats</p>

                    <div className="divide-y divide-line/40">
                      <StatRow label="Market cap"        value={fmt_large(md?.market_cap.usd ?? 0)} />
                      <StatRow label="Volume (24h)"      value={fmt_large(md?.total_volume.usd ?? 0)} value_cls="text-orange-400" />
                      <StatRow label="Market rank"       value={coin.market_cap_rank ? `#${coin.market_cap_rank}` : "—"} />
                      <StatRow
                        label="Circulating supply"
                        value={md?.circulating_supply ? `${fmt_supply(md.circulating_supply)} ${coin.symbol.toUpperCase()}` : "—"}
                      />
                      <StatRow
                        label="Max supply"
                        value={md?.max_supply ? `${fmt_supply(md.max_supply)} ${coin.symbol.toUpperCase()}` : "∞"}
                      />
                      <StatRow
                        label="Total supply"
                        value={md?.total_supply ? `${fmt_supply(md.total_supply)} ${coin.symbol.toUpperCase()}` : "—"}
                      />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line/40 pt-4">
                      <div className="rounded-xl bg-light-green/8 p-3">
                        <p className="text-[10px] text-muted">All-time high</p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums text-ink">{fmt_price(md?.ath.usd ?? 0)}</p>
                        <p className={`mt-0.5 text-[10px] font-semibold ${pct_cls(md?.ath_change_percentage.usd)}`}>
                          {fmt_pct(md?.ath_change_percentage.usd)} from ATH
                        </p>
                      </div>
                      <div className="rounded-xl bg-flag-red/8 p-3">
                        <p className="text-[10px] text-muted">All-time low</p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums text-ink">{fmt_price(md?.atl.usd ?? 0)}</p>
                        <p className={`mt-0.5 text-[10px] font-semibold ${pct_cls(md?.atl_change_percentage.usd)}`}>
                          {fmt_pct(md?.atl_change_percentage.usd)} from ATL
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Description */}
              {coin.description?.en && (
                <motion.div {...fade(0.15)} className="surface rounded-2xl p-5">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted">
                    About {coin.name}
                  </p>
                  <div
                    className={`overflow-hidden text-xs leading-relaxed text-muted transition-all duration-300 ${
                      show_desc ? "max-h-[800px]" : "max-h-20"
                    }`}
                  >
                    {plain_desc(coin.description.en)}
                  </div>
                  <button
                    onClick={() => set_show_desc(v => !v)}
                    className="mt-2 text-[11px] font-semibold text-flag-red hover:underline"
                  >
                    {show_desc ? "Show less ↑" : "Show more ↓"}
                  </button>
                </motion.div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default CoinDetailPage
