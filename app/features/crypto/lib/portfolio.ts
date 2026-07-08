import { supabase } from "~/lib/supabase"

export type PortfolioHolding = {
  id:            string
  user_id:       string
  coin_id:       string
  symbol:        string
  name:          string
  image_url:     string | null
  amount:        number
  avg_buy_price: number | null
  created_at:    string
}

type InsertHolding = Omit<PortfolioHolding, "id" | "created_at">

export const portfolio_api = {
  list: (user_id: string) =>
    supabase
      .from("crypto_portfolio")
      .select("*")
      .eq("user_id", user_id)
      .order("created_at"),

  upsert: (data: InsertHolding) =>
    supabase
      .from("crypto_portfolio")
      .upsert(data, { onConflict: "user_id,coin_id" })
      .select()
      .single(),

  update: (id: string, patch: { amount?: number; avg_buy_price?: number | null }) =>
    supabase
      .from("crypto_portfolio")
      .update(patch)
      .eq("id", id)
      .select()
      .single(),

  remove: (id: string) =>
    supabase.from("crypto_portfolio").delete().eq("id", id),
}
