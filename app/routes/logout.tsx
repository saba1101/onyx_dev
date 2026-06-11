import { redirect } from "react-router"
import type { Route } from "./+types/logout"
import { get_supabase } from "~/lib/supabase.server"

export const action = async ({ request }: Route.ActionArgs) => {
  const { supabase, headers } = get_supabase(request)
  await supabase.auth.signOut()
  return redirect("/login", { headers })
}

export const loader = () => redirect("/")
