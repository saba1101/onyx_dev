import { useMemo } from "react"
import { Link } from "react-router"
import { useCoincapPrices } from "~/features/crypto/lib/coincap-ws"
import { fmt_price, fmt_pct, pct_cls, type CoinMarket } from "~/features/crypto/lib/coingecko"

type Props = { coins: CoinMarket[] }

export const LiveTicker = ({ coins }: Props) => {
  const top = useMemo(() => coins.slice(0, 12), [coins])
  const ids  = useMemo(() => top.map(c => c.id), [top])
  const live = useCoincapPrices(ids)

  if (!top.length) return null

  const items = [...top, ...top]

  return (
    <div className="sticky top-14 lg:top-0 z-20 relative overflow-hidden border-b border-line/60 bg-card/70 backdrop-blur-sm">
      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0) }
          100% { transform: translateX(-50%) }
        }
        .ticker-track {
          display: flex;
          width: max-content;
          animation: ticker-scroll 40s linear infinite;
        }
        .ticker-track:hover { animation-play-state: paused }
      `}</style>

      <div className="ticker-track">
        {items.map((coin, i) => {
          const price   = live[coin.id] ?? coin.current_price
          const pct     = coin.price_change_percentage_24h
          const cls     = pct_cls(pct)

          return (
            <Link
              key={`${coin.id}-${i}`}
              to={`/crypto/${coin.id}`}
              className="flex shrink-0 items-center gap-2 border-r border-line/40 px-4 py-2 transition-colors hover:bg-line/20"
            >
              <img src={coin.image} alt={coin.symbol} className="h-4 w-4 shrink-0 rounded-full" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink">
                {coin.symbol}
              </span>
              <span className="text-[11px] tabular-nums text-ink">{fmt_price(price)}</span>
              <span className={`text-[10px] font-medium ${cls}`}>{fmt_pct(pct)}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
