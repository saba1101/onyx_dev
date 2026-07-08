import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router"
import { LineChart, Line, ResponsiveContainer } from "recharts"
import { SearchIcon, StarIcon, StarFilledIcon } from "~/components/ui/icons"
import { cg, fmt_price, fmt_large, fmt_pct, pct_cls, type CoinMarket, type CoinSearchResult } from "~/features/crypto/lib/coingecko"

type SortKey = "market_cap_rank" | "current_price" | "price_change_percentage_24h" | "market_cap" | "total_volume"
type SortDir  = "asc" | "desc"

const downsample = (arr: number[], n = 20): { p: number }[] => {
  if (!arr.length) return []
  const step = Math.max(1, Math.floor(arr.length / n))
  return Array.from({ length: Math.min(n, arr.length) }, (_, i) => ({
    p: arr[Math.min(i * step, arr.length - 1)],
  }))
}

type Props = {
  coins:          CoinMarket[]
  loading:        boolean
  loading_more:   boolean
  has_more:       boolean
  on_load_more:   () => void
  fav_ids:        Set<string>
  on_toggle_fav:  (coin: { id: string; name: string; symbol: string; image: string }) => Promise<void>
}

export const MarketTable = ({ coins, loading, loading_more, has_more, on_load_more, fav_ids, on_toggle_fav }: Props) => {
  const [q,            set_q]            = useState("")
  const [sort_key,     set_sort_key]     = useState<SortKey>("market_cap_rank")
  const [sort_dir,     set_sort_dir]     = useState<SortDir>("asc")
  const [search_res,   set_search_res]   = useState<CoinSearchResult[] | null>(null)
  const [searching,    set_searching]    = useState(false)
  const debounce_ref = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounce_ref.current) clearTimeout(debounce_ref.current)
    if (!q.trim()) {
      set_search_res(null)
      set_searching(false)
      return
    }
    set_searching(true)
    debounce_ref.current = setTimeout(async () => {
      const res = await cg.search(q.trim())
      set_search_res(res?.coins ?? [])
      set_searching(false)
    }, 400)
    return () => { if (debounce_ref.current) clearTimeout(debounce_ref.current) }
  }, [q])

  const filtered = useMemo(() => {
    if (q) return []
    return coins
  }, [coins, q])

  const sorted = useMemo(() => (
    [...filtered].sort((a, b) => {
      const av = (a[sort_key] ?? 0) as number
      const bv = (b[sort_key] ?? 0) as number
      return sort_dir === "asc" ? av - bv : bv - av
    })
  ), [filtered, sort_key, sort_dir])

  const toggle_sort = (key: SortKey) => {
    if (sort_key === key) set_sort_dir(d => d === "asc" ? "desc" : "asc")
    else { set_sort_key(key); set_sort_dir(key === "market_cap_rank" ? "asc" : "desc") }
  }

  const Th = ({ children, k, cls = "" }: { children: React.ReactNode; k: SortKey; cls?: string }) => (
    <th
      onClick={() => toggle_sort(k)}
      className={`cursor-pointer select-none whitespace-nowrap px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-muted hover:text-ink ${cls}`}
    >
      {children}
      <span className="ml-0.5">
        {sort_key === k
          ? <span className="text-flag-red">{sort_dir === "asc" ? " ↑" : " ↓"}</span>
          : <span className="text-muted/30"> ⇅</span>}
      </span>
    </th>
  )

  return (
    <div className="surface flex flex-col rounded-2xl">
      {/* Search bar */}
      <div className="border-b border-line/50 p-3 sm:p-4">
        <div className="relative max-w-xs">
          <SearchIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search coins…"
            value={q}
            onChange={e => set_q(e.target.value)}
            className="w-full rounded-xl border border-line bg-page py-2 pl-8 pr-3 text-xs text-ink placeholder:text-muted focus:border-flag-red/50 focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead className="border-b border-line/40">
            <tr>
              <th className="w-8 pl-3" />
              <Th k="market_cap_rank" cls="text-left w-10">#</Th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-muted">Coin</th>
              <Th k="current_price" cls="text-right">Price</Th>
              <Th k="price_change_percentage_24h" cls="text-right">24h</Th>
              <th className="hidden px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wide text-muted sm:table-cell">1h</th>
              <Th k="market_cap" cls="text-right hidden sm:table-cell">MCap</Th>
              <Th k="total_volume" cls="text-right hidden lg:table-cell">Volume</Th>
              <th className="hidden px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wide text-muted lg:table-cell">7d</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/25">
            {/* Loading skeleton */}
            {loading && !q && Array.from({ length: 12 }, (_, i) => (
              <tr key={i}>
                <td />
                {[80, 200, 100, 70, 70, 120, 100, 80].map((w, j) => (
                  <td key={j} className="px-4 py-3.5">
                    <div className="h-3 animate-pulse rounded bg-line/40" style={{ width: w }} />
                  </td>
                ))}
              </tr>
            ))}

            {/* API search results */}
            {q && (searching
              ? Array.from({ length: 6 }, (_, i) => (
                <tr key={i}>
                  {[40, 220, 100, 70, 70, 120, 100, 80].map((w, j) => (
                    <td key={j} className="px-4 py-3.5">
                      <div className="h-3 animate-pulse rounded bg-line/40" style={{ width: w }} />
                    </td>
                  ))}
                </tr>
              ))
              : search_res?.map(coin => (
                <tr
                  key={coin.id}
                  onClick={() => { window.location.href = `/crypto/${coin.id}` }}
                  className="group cursor-pointer transition-colors hover:bg-line/20"
                >
                  <td className="px-4 py-3.5 text-[11px] tabular-nums text-muted">
                    {coin.market_cap_rank ?? "—"}
                  </td>
                  <td className="px-4 py-3.5" colSpan={7}>
                    <Link
                      to={`/crypto/${coin.id}`}
                      onClick={e => e.stopPropagation()}
                      className="flex items-center gap-2.5"
                    >
                      <img src={coin.thumb} alt="" className="h-6 w-6 rounded-full" />
                      <div>
                        <p className="text-[12px] font-semibold text-ink transition-colors group-hover:text-flag-red">
                          {coin.name}
                        </p>
                        <p className="text-[10px] uppercase text-muted">{coin.symbol}</p>
                      </div>
                    </Link>
                  </td>
                </tr>
              ))
            )}

            {/* Normal market rows */}
            {!q && sorted.map(coin => {
              const pct24  = coin.price_change_percentage_24h
              const pct1h  = coin.price_change_percentage_1h_in_currency
              const pct7d  = coin.price_change_percentage_7d_in_currency
              const spark  = downsample(coin.sparkline_in_7d?.price ?? [])
              const s_clr  = (pct7d ?? 0) >= 0 ? "var(--color-light-green)" : "var(--color-flag-red)"
              const is_fav = fav_ids.has(coin.id)

              return (
                <tr
                  key={coin.id}
                  onClick={() => { window.location.href = `/crypto/${coin.id}` }}
                  className="group cursor-pointer transition-colors hover:bg-line/20"
                >
                  <td className="pl-3 py-3.5">
                    <button
                      onClick={e => { e.stopPropagation(); on_toggle_fav({ id: coin.id, name: coin.name, symbol: coin.symbol, image: coin.image }) }}
                      className={`rounded-lg p-1.5 transition-colors hover:bg-line/40 ${is_fav ? "text-amber-400" : "text-muted/30 opacity-0 group-hover:opacity-100"}`}
                      title={is_fav ? "Remove from favorites" : "Add to favorites"}
                    >
                      {is_fav ? <StarFilledIcon size={13} /> : <StarIcon size={13} />}
                    </button>
                  </td>
                  <td className="px-4 py-3.5 text-[11px] tabular-nums text-muted">{coin.market_cap_rank}</td>
                  <td className="px-4 py-3.5">
                    <Link
                      to={`/crypto/${coin.id}`}
                      onClick={e => e.stopPropagation()}
                      className="flex items-center gap-2.5"
                    >
                      <img src={coin.image} alt="" className="h-6 w-6 rounded-full" />
                      <div>
                        <p className="text-[12px] font-semibold text-ink transition-colors group-hover:text-flag-red">
                          {coin.name}
                        </p>
                        <p className="text-[10px] uppercase text-muted">{coin.symbol}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-right text-[12px] font-semibold tabular-nums text-ink">
                    {fmt_price(coin.current_price)}
                  </td>
                  <td className={`px-4 py-3.5 text-right text-[11px] font-semibold tabular-nums ${pct_cls(pct24)}`}>
                    {fmt_pct(pct24)}
                  </td>
                  <td className={`hidden px-4 py-3.5 text-right text-[11px] font-semibold tabular-nums sm:table-cell ${pct_cls(pct1h)}`}>
                    {fmt_pct(pct1h)}
                  </td>
                  <td className="hidden px-4 py-3.5 text-right text-[11px] tabular-nums text-muted sm:table-cell">
                    {fmt_large(coin.market_cap)}
                  </td>
                  <td className="hidden px-4 py-3.5 text-right text-[11px] tabular-nums text-orange-400 lg:table-cell">
                    {fmt_large(coin.total_volume)}
                  </td>
                  <td className="hidden px-4 py-3.5 lg:table-cell">
                    {spark.length > 0 && (
                      <div className="flex justify-end">
                        <ResponsiveContainer width={72} height={28}>
                          <LineChart data={spark}>
                            <Line type="monotone" dataKey="p" dot={false} strokeWidth={1.5} stroke={s_clr} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {q && !searching && search_res?.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">No coins found for "{q}"</p>
        )}
      </div>

      {/* Load more */}
      {!q && has_more && (
        <div className="border-t border-line/40 p-4 text-center">
          <button
            onClick={on_load_more}
            disabled={loading_more}
            className="rounded-xl border border-line/60 px-6 py-2 text-xs font-semibold text-muted transition-colors hover:border-flag-red/40 hover:text-ink disabled:opacity-40"
          >
            {loading_more ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-flag-red" />
                Loading more…
              </span>
            ) : `Load more · showing ${coins.length}`}
          </button>
        </div>
      )}
    </div>
  )
}
