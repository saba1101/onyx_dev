import { useEffect, useState } from "react"
import { Link } from "react-router"
import { cg, fmt_price, fmt_pct, pct_cls, type CoinMarket } from "~/features/crypto/lib/coingecko"
import { StarFilledIcon, StarIcon } from "~/components/ui/icons"
import type { Favorite } from "~/features/crypto/lib/favorites"

type Props = {
  favs:   Favorite[]
  ids:    Set<string>
  toggle: (coin: { id: string; name: string; symbol: string; image: string }) => Promise<void>
}

export const FavoritesPanel = ({ favs, ids, toggle }: Props) => {
  const [market, set_market] = useState<CoinMarket[]>([])
  const [loading, set_loading] = useState(false)

  useEffect(() => {
    if (favs.length === 0) { set_market([]); return }
    set_loading(true)
    cg.markets_by_ids(favs.map(f => f.coin_id)).then(data => {
      set_market(data ?? [])
      set_loading(false)
    })
  }, [favs])

  if (favs.length === 0) {
    return (
      <div className="surface flex flex-col items-center gap-3 rounded-2xl py-24 text-center">
        <StarIcon size={28} className="text-muted/30" />
        <p className="text-sm font-semibold text-muted">No favorites yet</p>
        <p className="text-xs text-muted/50">Star any coin from the market list or coin detail page</p>
      </div>
    )
  }

  return (
    <div className="surface rounded-2xl">
      <div className="flex items-center gap-2 border-b border-line/50 px-4 py-3">
        <StarFilledIcon size={12} className="text-amber-400" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          Favorites · {favs.length}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px]">
          <thead className="border-b border-line/40">
            <tr>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted">Coin</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-muted">Price</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-muted">24h</th>
              <th className="hidden px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-muted sm:table-cell">MCap</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line/25">
            {loading
              ? favs.map((_, i) => (
                <tr key={i}>
                  {[220, 90, 60, 100].map((w, j) => (
                    <td key={j} className="px-4 py-3.5">
                      <div className="h-3 animate-pulse rounded bg-line/40" style={{ width: w }} />
                    </td>
                  ))}
                  <td />
                </tr>
              ))
              : favs.map(fav => {
                const m = market.find(c => c.id === fav.coin_id)
                const pct24 = m?.price_change_percentage_24h ?? null

                return (
                  <tr key={fav.coin_id} className="group transition-colors hover:bg-line/20">
                    <td className="px-4 py-3">
                      <Link to={`/crypto/${fav.coin_id}`} className="flex items-center gap-2.5">
                        <img
                          src={m?.image ?? fav.image_url}
                          alt=""
                          className="h-7 w-7 shrink-0 rounded-full"
                        />
                        <div>
                          <p className="text-[12px] font-semibold text-ink transition-colors group-hover:text-flag-red">
                            {fav.name}
                          </p>
                          <p className="text-[10px] uppercase text-muted">{fav.symbol}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right text-[12px] font-semibold tabular-nums text-ink">
                      {m ? fmt_price(m.current_price) : "—"}
                    </td>
                    <td className={`px-4 py-3 text-right text-[11px] font-semibold tabular-nums ${pct_cls(pct24)}`}>
                      {fmt_pct(pct24)}
                    </td>
                    <td className="hidden px-4 py-3 text-right text-[11px] tabular-nums text-muted sm:table-cell">
                      {m ? `$${(m.market_cap / 1e9).toFixed(2)}B` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => toggle({ id: fav.coin_id, name: fav.name, symbol: fav.symbol, image: fav.image_url })}
                        className="rounded-lg p-1 text-amber-400 transition-colors hover:bg-line/40"
                        title="Remove from favorites"
                      >
                        <StarFilledIcon size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
