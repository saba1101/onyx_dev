import { useEffect, useRef } from "react"
import { Navigate, useSearchParams } from "react-router"
import { motion } from "motion/react"
import { useAuth } from "~/features/auth/lib/auth"
import { SideRail } from "~/components/ui/side-rail"
import { use_notify } from "~/hooks/use-notify"

export const meta = () => [
  { title: "Onyx Dev" },
  { name: "description", content: "Onyx Dev" },
]

const Home = () => {
  const { user, loading } = useAuth()
  const notify = use_notify()
  const [params, set_params] = useSearchParams()
  const greeted = useRef(false)

  useEffect(() => {
    if (!user) return
    const welcome = params.get("welcome")
    if (!welcome || greeted.current) return
    greeted.current = true
    notify({
      tone: "success",
      title: welcome === "up" ? "Account ready" : "Welcome back",
      message: `Signed in as ${user.email}`,
    })
    const next = new URLSearchParams(params)
    next.delete("welcome")
    set_params(next, { replace: true })
  }, [user])

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="flex min-h-screen">
      <SideRail />
      <main className="flex min-w-0 flex-1 flex-col gap-6 px-4 pb-12 pt-20 sm:px-6 lg:p-8">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted">Workspace</p>
            <h1 className="text-xl font-semibold tracking-tight">Onyx Dev</h1>
          </div>
        </header>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="surface max-w-md rounded-2xl p-5"
        >
          <p className="text-xs text-muted">Signed in as</p>
          <p className="mt-0.5 text-sm font-semibold text-ink">{user.email}</p>
        </motion.section>
      </main>
    </div>
  )
}

export default Home
