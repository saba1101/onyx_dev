import { useEffect, useState } from "react"
import { supabase } from "~/lib/supabase"

export type Favorite = {
  id:         string
  user_id:    string
  coin_id:    string
  name:       string
  symbol:     string
  image_url:  string
  created_at: string
}

type CoinInfo = { id: string; name: string; symbol: string; image: string }

const api = {
  list: (user_id: string) =>
    supabase.from("crypto_favorites").select("*").eq("user_id", user_id).order("created_at"),

  add: (user_id: string, coin: CoinInfo) =>
    supabase.from("crypto_favorites").insert({
      user_id,
      coin_id:   coin.id,
      name:      coin.name,
      symbol:    coin.symbol,
      image_url: coin.image,
    }),

  remove: (user_id: string, coin_id: string) =>
    supabase.from("crypto_favorites").delete().eq("user_id", user_id).eq("coin_id", coin_id),
}

export const useFavorites = (user_id: string) => {
  const [favs,    set_favs]    = useState<Favorite[]>([])
  const [loading, set_loading] = useState(true)

  useEffect(() => {
    api.list(user_id).then(({ data }) => {
      set_favs(data ?? [])
      set_loading(false)
    })
  }, [user_id])

  const toggle = async (coin: CoinInfo) => {
    const already = favs.some(f => f.coin_id === coin.id)
    if (already) {
      await api.remove(user_id, coin.id)
      set_favs(prev => prev.filter(f => f.coin_id !== coin.id))
    } else {
      await api.add(user_id, coin)
      set_favs(prev => [
        ...prev,
        {
          id:         crypto.randomUUID(),
          user_id,
          coin_id:    coin.id,
          name:       coin.name,
          symbol:     coin.symbol,
          image_url:  coin.image,
          created_at: new Date().toISOString(),
        },
      ])
    }
  }

  const ids = new Set(favs.map(f => f.coin_id))
  return { favs, ids, toggle, loading }
}
