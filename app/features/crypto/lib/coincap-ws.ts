import { useEffect, useReducer, useRef } from "react"

type PriceMap = Record<string, number>

const reducer = (state: PriceMap, patch: Record<string, string>): PriceMap => {
  const next = { ...state }
  for (const [k, v] of Object.entries(patch)) next[k] = parseFloat(v)
  return next
}

export const useCoincapPrices = (ids: string[]): PriceMap => {
  const [prices, dispatch] = useReducer(reducer, {})
  const alive_ref = useRef(true)
  const ws_ref    = useRef<WebSocket | null>(null)
  const key       = [...ids].sort().join(",")

  useEffect(() => {
    if (!ids.length) return
    alive_ref.current = true

    const connect = () => {
      if (!alive_ref.current) return
      try {
        const ws = new WebSocket(`wss://ws.coincap.io/prices?assets=${ids.join(",")}`)
        ws_ref.current = ws

        ws.onmessage = (e: MessageEvent) => {
          try { dispatch(JSON.parse(e.data as string) as Record<string, string>) } catch { /* noop */ }
        }

        ws.onclose = () => {
          if (alive_ref.current) setTimeout(connect, 4_000)
        }

        ws.onerror = () => ws.close()
      } catch { /* noop */ }
    }

    connect()

    return () => {
      alive_ref.current = false
      ws_ref.current?.close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return prices
}
