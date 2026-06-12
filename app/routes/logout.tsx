import { Navigate } from "react-router"
import type { Route } from "./+types/logout"
import { supabase } from "~/lib/supabase"
import { useAuth } from "~/lib/auth"

export const clientAction = async (_: Route.ClientActionArgs) => {
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
