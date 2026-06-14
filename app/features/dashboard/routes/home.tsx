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
      <main className="relative flex min-w-0 flex-1 flex-col gap-4 px-4 pb-12 pt-20 sm:px-6 lg:gap-5 lg:px-8 lg:pb-8 lg:pt-12">
        <header className="flex items-center gap-2 lg:absolute lg:inset-x-8 lg:top-2 lg:z-10">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-flag-red">//</span>
          <h1 className="text-sm font-semibold tracking-tight text-ink">Dashboard</h1>
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
