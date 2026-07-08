import { useCallback, useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { useCoincapPrices } from "~/features/crypto/lib/coincap-ws"
import { cg, fmt_price, fmt_large, fmt_pct, pct_cls, type CoinMarket } from "~/features/crypto/lib/coingecko"
import { portfolio_api, type PortfolioHolding } from "~/features/crypto/lib/portfolio"
import { PlusIcon, TrashIcon, XIcon, SearchIcon, WalletIcon } from "~/components/ui/icons"

type Props = { user_id: string }

const fmt_num = (n: number) =>
  n % 1 === 0 ? n.toFixed(0) : n.toFixed(n < 0.01 ? 6 : n < 1 ? 4 : 2)

export const PortfolioPanel = ({ user_id }: Props) => {
  const [holdings, set_holdings]   = useState<PortfolioHolding[]>([])
  const [loading,  set_loading]    = useState(true)
  const [adding,   set_adding]     = useState(false)
  const [del_id,   set_del_id]     = useState<string | null>(null)

  // Add-holding modal state
  const [search,     set_search]     = useState("")
  const [results,    set_results]    = useState<CoinMarket[]>([])
  const [picked,     set_picked]     = useState<CoinMarket | null>(null)
  const [amt,        set_amt]        = useState("")
  const [buy_price,  set_buy_price]  = useState("")
  const [saving,     set_saving]     = useState(false)

  const ids = useMemo(() => holdings.map(h => h.coin_id), [holdings])
  const live = useCoincapPrices(ids)

  const load = useCallback(async () => {
    const { data } = await portfolio_api.list(user_id)
    set_holdings((data as PortfolioHolding[]) ?? [])
    set_loading(false)
  }, [user_id])

  useEffect(() => { load() }, [load])

  // Live coin search for the add-modal
  useEffect(() => {
    if (!search || !adding) return
    const t = setTimeout(async () => {
      const data = await cg.markets(1)
      if (!data) return
      const q = search.toLowerCase()
      set_results(data.filter(c => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q)).slice(0, 6))
    }, 350)
    return () => clearTimeout(t)
  }, [search, adding])

  const open_add = () => {
    set_adding(true)
    set_search("")
    set_results([])
    set_picked(null)
    set_amt("")
    set_buy_price("")
  }

  const save_holding = async () => {
    if (!picked || !amt || isNaN(parseFloat(amt))) return
    set_saving(true)
    await portfolio_api.upsert({
      user_id,
      coin_id:       picked.id,
      symbol:        picked.symbol,
      name:          picked.name,
      image_url:     picked.image,
      amount:        parseFloat(amt),
      avg_buy_price: buy_price ? parseFloat(buy_price) : null,
    })
    await load()
    set_saving(false)
    set_adding(false)
  }

  const remove_holding = async (id: string) => {
    await portfolio_api.remove(id)
    set_holdings(prev => prev.filter(h => h.id !== id))
    set_del_id(null)
  }

  const { total_value, total_pnl, total_pnl_pct } = useMemo(() => {
    let val = 0, cost = 0
    for (const h of holdings) {
      const price = live[h.coin_id] ?? 0
      val  += price * h.amount
      cost += (h.avg_buy_price ?? 0) * h.amount
    }
    const pnl     = val - cost
    const pnl_pct = cost > 0 ? (pnl / cost) * 100 : 0
    return { total_value: val, total_pnl: pnl, total_pnl_pct: pnl_pct }
  }, [holdings, live])

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="surface h-16 animate-pulse rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <>
      {/* Summary bar */}
      {holdings.length > 0 && (
        <div className="surface mb-4 flex flex-wrap gap-5 rounded-2xl p-4">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted">Portfolio value</p>
            <p className="text-xl font-bold tabular-nums text-ink">{fmt_large(total_value)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted">Total P&L</p>
            <p className={`text-xl font-bold tabular-nums ${total_pnl >= 0 ? "text-light-green" : "text-flag-red"}`}>
              {total_pnl >= 0 ? "+" : ""}{fmt_large(total_pnl)}
              <span className="ml-1.5 text-sm">({fmt_pct(total_pnl_pct)})</span>
            </p>
          </div>
          <div className="ml-auto self-center">
            <p className="text-[10px] uppercase tracking-wide text-muted">{holdings.length} asset{holdings.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      )}

      {/* Holdings list */}
      <div className="surface overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-line/50 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">Holdings</p>
          <button
            onClick={open_add}
            className="flex items-center gap-1.5 rounded-xl bg-flag-red px-3 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-80"
          >
            <PlusIcon size={11} />
            Add coin
          </button>
        </div>

        {holdings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <WalletIcon size={32} className="text-muted/40" />
            <p className="text-sm font-medium text-muted">No holdings yet</p>
            <p className="text-xs text-muted/60">Add your first coin to start tracking</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead className="border-b border-line/40">
                <tr>
                  {["Coin", "Amount", "Avg buy", "Price", "Value", "P&L", ""].map((h, i) => (
                    <th key={i} className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted ${i > 1 ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/30">
                {holdings.map(h => {
                  const price   = live[h.coin_id] ?? 0
                  const value   = price * h.amount
                  const cost    = (h.avg_buy_price ?? 0) * h.amount
                  const pnl     = h.avg_buy_price != null ? value - cost : null
                  const pnl_pct = h.avg_buy_price != null && cost > 0 ? ((value - cost) / cost) * 100 : null
                  const confirming = del_id === h.id

                  return (
                    <tr key={h.id} className="group transition-colors hover:bg-line/20">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {h.image_url && <img src={h.image_url} alt={h.symbol} className="h-6 w-6 rounded-full" />}
                          <div>
                            <p className="text-[12px] font-semibold text-ink">{h.name}</p>
                            <p className="text-[10px] uppercase text-muted">{h.symbol}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-[11px] tabular-nums text-ink">
                        {fmt_num(h.amount)} <span className="uppercase text-muted">{h.symbol}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-[11px] tabular-nums text-muted">
                        {h.avg_buy_price != null ? fmt_price(h.avg_buy_price) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-[12px] font-semibold tabular-nums text-ink">
                        {price > 0 ? fmt_price(price) : <span className="text-muted">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-[12px] font-semibold tabular-nums text-ink">
                        {price > 0 ? fmt_large(value) : <span className="text-muted">—</span>}
                      </td>
                      <td className={`px-4 py-3 text-right text-[11px] font-semibold tabular-nums ${pct_cls(pnl_pct)}`}>
                        {pnl != null && price > 0 ? (
                          <span>
                            {pnl >= 0 ? "+" : ""}{fmt_large(Math.abs(pnl))}
                            <span className="ml-1 text-[10px]">({fmt_pct(pnl_pct)})</span>
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {confirming ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => remove_holding(h.id)}
                              className="rounded-lg bg-flag-red/10 px-2 py-0.5 text-[10px] font-semibold text-flag-red hover:bg-flag-red/20"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => set_del_id(null)}
                              className="rounded-lg bg-line/40 px-2 py-0.5 text-[10px] font-semibold text-muted hover:bg-line"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => set_del_id(h.id)}
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <TrashIcon size={13} className="text-flag-red/60 hover:text-flag-red" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add-holding modal */}
      <AnimatePresence>
        {adding && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => set_adding(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="surface fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-2xl p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">Add holding</p>
                <button onClick={() => set_adding(false)} className="text-muted hover:text-ink">
                  <XIcon size={16} />
                </button>
              </div>

              {!picked ? (
                <>
                  <div className="relative mb-3">
                    <SearchIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search coin (e.g. Bitcoin, ETH)…"
                      value={search}
                      onChange={e => set_search(e.target.value)}
                      className="w-full rounded-xl border border-line bg-page py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-flag-red/50 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    {results.map(coin => (
                      <button
                        key={coin.id}
                        onClick={() => { set_picked(coin); set_buy_price(String(coin.current_price)) }}
                        className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-line/30"
                      >
                        <img src={coin.image} alt={coin.name} className="h-7 w-7 rounded-full" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink">{coin.name}</p>
                          <p className="text-[10px] uppercase text-muted">{coin.symbol}</p>
                        </div>
                        <p className="text-[12px] font-semibold tabular-nums text-ink">{fmt_price(coin.current_price)}</p>
                      </button>
                    ))}
                    {search && results.length === 0 && (
                      <p className="py-4 text-center text-sm text-muted">No results for "{search}"</p>
                    )}
                    {!search && (
                      <p className="py-4 text-center text-xs text-muted">Type a coin name or symbol to search</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={() => set_picked(null)}
                    className="mb-4 flex items-center gap-2 text-[11px] text-muted hover:text-ink"
                  >
                    ← Back to search
                  </button>

                  <div className="mb-5 flex items-center gap-3 rounded-xl bg-line/20 p-3">
                    <img src={picked.image} alt={picked.name} className="h-8 w-8 rounded-full" />
                    <div>
                      <p className="font-semibold text-ink">{picked.name}</p>
                      <p className="text-[10px] uppercase text-muted">{picked.symbol} · {fmt_price(picked.current_price)}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-muted">
                        Amount held
                      </label>
                      <input
                        autoFocus
                        type="number"
                        placeholder={`e.g. 0.5 ${picked.symbol.toUpperCase()}`}
                        value={amt}
                        onChange={e => set_amt(e.target.value)}
                        className="w-full rounded-xl border border-line bg-page px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-flag-red/50 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-muted">
                        Avg buy price (optional)
                      </label>
                      <input
                        type="number"
                        placeholder="USD price per coin"
                        value={buy_price}
                        onChange={e => set_buy_price(e.target.value)}
                        className="w-full rounded-xl border border-line bg-page px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-flag-red/50 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    onClick={save_holding}
                    disabled={saving || !amt}
                    className="mt-5 w-full rounded-xl bg-flag-red py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-40"
                  >
                    {saving ? "Saving…" : "Add to portfolio"}
                  </button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
