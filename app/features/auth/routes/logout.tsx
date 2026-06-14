import { Navigate } from "react-router"
import type { Route } from "./+types/logout"
import { supabase } from "~/lib/supabase"
import { useAuth } from "~/features/auth/lib/auth"

export const clientAction = async (_: Route.ClientActionArgs) => {
  // Mark offline first while the session is still valid, then sign out
  await supabase.rpc("set_self_offline")
  await supabase.auth.signOut()
  return null
}

const Logout = () => {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return null
}

export default Logout
