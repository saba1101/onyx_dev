import { redirect } from "react-router"
import { get_supabase } from "./supabase.server"

export const get_account = async (request: Request) => {
  const { supabase, headers } = get_supabase(request)
  const { data } = await supabase.auth.getUser()
  return { account: data.user, supabase, headers }
}

export const require_account = async (request: Request) => {
  const { account, supabase, headers } = await get_account(request)
  if (!account) throw redirect("/login")
  return { account, supabase, headers }
}

export const block_when_signed_in = async (request: Request) => {
  const { account } = await get_account(request)
  if (account) throw redirect("/")
}
