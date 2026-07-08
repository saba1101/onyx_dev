const BASE = "https://api.coingecko.com/api/v3"
const KEY  = (import.meta.env as Record<string, string | undefined>)["VITE_COINGECKO_KEY"]

const cg_headers = (): HeadersInit =>
  KEY ? { "x-cg-demo-api-key": KEY } : {}

// ─── Persistence cache (localStorage) ─────────────────────────────────────────

const LS_PREFIX = "onyx_cg:"

const ls_read = <T>(url: string): { data: T; ts: number } | null => {
  try {
    const raw = localStorage.getItem(LS_PREFIX + url)
    return raw ? (JSON.parse(raw) as { data: T; ts: number }) : null
  } catch { return null }
}

const ls_write = (url: string, data: unknown): void => {
  try {
    localStorage.setItem(LS_PREFIX + url, JSON.stringify({ data, ts: Date.now() }))
  } catch { /* storage quota — ignore */ }
}

// ─── In-memory layer + dedup ──────────────────────────────────────────────────

type CacheEntry = { data: unknown; expires: number }
const mem_cache: Map<string, CacheEntry>       = new Map()
const in_flight: Map<string, Promise<unknown>> = new Map()

// ─── Types ────────────────────────────────────────────────────────────────────

export type CoinMarket = {
  id:                                     string
  symbol:                                 string
  name:                                   string
  image:                                  string
  current_price:                          number
  market_cap:                             number
  market_cap_rank:                        number
  total_volume:                           number
  price_change_percentage_24h:            number | null
  price_change_percentage_1h_in_currency: number | null
  price_change_percentage_7d_in_currency: number | null
  sparkline_in_7d:                        { price: number[] }
  circulating_supply:                     number
  max_supply:                             number | null
  ath:                                    number
  ath_change_percentage:                  number
  atl:                                    number
  atl_change_percentage:                  number
}

export type GlobalStats = {
  data: {
    total_market_cap:                     { usd: number }
    total_volume:                         { usd: number }
    market_cap_percentage:                { btc?: number; eth?: number }
    market_cap_change_percentage_24h_usd: number
    active_cryptocurrencies:              number
  }
}

export type TrendingCoin = {
  item: {
    id:              string
    name:            string
    symbol:          string
    thumb:           string
    market_cap_rank: number | null
    data: {
      price:                       number
      price_change_percentage_24h: { usd: number }
      market_cap:                  string
    }
  }
}

export type CoinDetail = {
  id:              string
  name:            string
  symbol:          string
  image:           { large: string }
  market_cap_rank: number
  description:     { en: string }
  market_data: {
    current_price:               { usd: number }
    price_change_percentage_24h:  number
    price_change_percentage_7d:   number
    price_change_percentage_30d:  number
    price_change_percentage_1y:   number
    market_cap:                  { usd: number }
    total_volume:                { usd: number }
    circulating_supply:           number
    max_supply:                   number | null
    total_supply:                 number | null
    ath:                         { usd: number }
    ath_change_percentage:       { usd: number }
    atl:                         { usd: number }
    atl_change_percentage:       { usd: number }
  }
}

export type ChartData = {
  prices:        [number, number][]
  total_volumes: [number, number][]
}

// [timestamp_ms, open, high, low, close]
export type OHLCPoint = [number, number, number, number, number]

export type CoinSearchResult = {
  id:              string
  name:            string
  symbol:          string
  thumb:           string
  large:           string
  market_cap_rank: number | null
}

// ─── Core fetch with 3-layer cache ────────────────────────────────────────────

/**
 * Layer 1: in-memory (fastest, lost on reload)
 * Layer 2: localStorage (persists across reloads, checked before fetching)
 * Layer 3: API fetch (only when both caches are stale)
 *
 * On 429 → always serve stale cache rather than failing.
 * Deduplicates concurrent calls to the same URL.
 */
const cg_get = <T>(path: string, params: Record<string, string> = {}, ttl = 60_000): Promise<T | null> => {
  const url = new URL(`${BASE}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const key = url.toString()

  // Layer 1: in-memory (unexpired)
  const mem = mem_cache.get(key)
  if (mem && mem.expires > Date.now()) return Promise.resolve(mem.data as T)

  // Layer 2: localStorage (check freshness before deciding to fetch)
  const ls = ls_read<T>(key)
  if (ls && Date.now() - ls.ts < ttl) {
    mem_cache.set(key, { data: ls.data, expires: ls.ts + ttl })
    return Promise.resolve(ls.data)
  }

  // Deduplicate concurrent requests for the same URL
  const inflight = in_flight.get(key)
  if (inflight) return inflight as Promise<T | null>

  const promise = fetch(url.toString(), { headers: cg_headers() })
    .then(async res => {
      in_flight.delete(key)
      if (res.status === 429) {
        // Rate-limited — serve stale cache (mem or ls) rather than returning null
        if (mem) return mem.data as T
        if (ls)  return ls.data
        return null
      }
      if (!res.ok) return null
      const data = (await res.json()) as T
      mem_cache.set(key, { data, expires: Date.now() + ttl })
      ls_write(key, data)
      return data
    })
    .catch(() => {
      in_flight.delete(key)
      if (mem) return mem.data as T
      if (ls)  return ls.data
      return null
    })

  in_flight.set(key, promise)
  return promise
}

// ─── API endpoints ────────────────────────────────────────────────────────────

export const cg = {
  markets: (page = 1) =>
    cg_get<CoinMarket[]>("/coins/markets", {
      vs_currency:             "usd",
      order:                   "market_cap_desc",
      per_page:                "50",
      page:                    String(page),
      sparkline:               "true",
      price_change_percentage: "1h,7d",
    }, 90_000),

  global: () =>
    cg_get<GlobalStats>("/global", {}, 120_000),

  trending: () =>
    cg_get<{ coins: TrendingCoin[] }>("/search/trending", {}, 300_000),

  search: (query: string) =>
    cg_get<{ coins: CoinSearchResult[] }>("/search", { query }, 60_000),

  markets_by_ids: (ids: string[]) =>
    cg_get<CoinMarket[]>("/coins/markets", {
      vs_currency:             "usd",
      ids:                     ids.join(","),
      order:                   "market_cap_desc",
      per_page:                "250",
      page:                    "1",
      sparkline:               "false",
      price_change_percentage: "24h",
    }, 90_000),

  coin: (id: string) =>
    cg_get<CoinDetail>(`/coins/${id}`, {
      localization:   "false",
      tickers:        "false",
      community_data: "false",
      developer_data: "false",
      sparkline:      "false",
    }, 90_000),

  chart: (id: string, days: string) =>
    cg_get<ChartData>(`/coins/${id}/market_chart`, {
      vs_currency: "usd",
      days,
      interval:    days === "1" ? "hourly" : "daily",
    }, 180_000),

  ohlc: (id: string, days: string) =>
    cg_get<OHLCPoint[]>(`/coins/${id}/ohlc`, {
      vs_currency: "usd",
      days,
    }, 180_000),
}

// ─── Formatters ───────────────────────────────────────────────────────────────

export const fmt_price = (n: number): string => {
  if (n === 0) return "$0.00"
  if (n >= 1_000) return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (n >= 1)     return `$${n.toFixed(4)}`
  if (n >= 0.01)  return `$${n.toFixed(5)}`
  return `$${n.toFixed(8)}`
}

export const fmt_large = (n: number): string => {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`
  return `$${n.toLocaleString()}`
}

export const fmt_supply = (n: number): string => {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toFixed(2)
}

export const fmt_pct = (n: number | null | undefined): string => {
  if (n == null) return "—"
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`
}

export const pct_cls = (n: number | null | undefined): string =>
  n == null ? "text-muted" : n >= 0 ? "text-light-green" : "text-flag-red"
