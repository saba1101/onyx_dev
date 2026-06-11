import { useEffect, useRef } from "react"
import { Form, useSearchParams } from "react-router"
import { motion } from "motion/react"
import type { Route } from "./+types/home"
import { require_account } from "~/lib/auth.server"
import { SideRail } from "~/components/ui/side-rail"
import { use_notify } from "~/hooks/use-notify"

export const meta = ({}: Route.MetaArgs) => [
  { title: "Onyx Dev" },
  { name: "description", content: "Onyx Dev" },
]

export const loader = async ({ request }: Route.LoaderArgs) => {
  const { account } = await require_account(request)
  return { email: account.email }
}

const Home = ({ loaderData }: Route.ComponentProps) => {
  const notify = use_notify()
  const [params, set_params] = useSearchParams()
  const greeted = useRef(false)

  useEffect(() => {
    const welcome = params.get("welcome")
    if (!welcome || greeted.current) return
    greeted.current = true
    notify({
      tone: "success",
      title: welcome === "up" ? "Account ready" : "Welcome back",
      message: `Signed in as ${loaderData.email}`,
    })
    const next = new URLSearchParams(params)
    next.delete("welcome")
    set_params(next, { replace: true })
  }, [])

  return (
    <div className="flex min-h-screen bg-page">
      <SideRail />
      <main className="flex flex-1 flex-col gap-6 p-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted">Workspace</p>
            <h1 className="text-xl font-semibold tracking-tight">Onyx Dev</h1>
          </div>
          <Form method="post" action="/logout">
            <motion.button
              type="submit"
              whileTap={{ scale: 0.98 }}
              className="rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink"
            >
              Sign out
            </motion.button>
          </Form>
        </header>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-md rounded-2xl border border-line bg-card/80 p-5 shadow-lg shadow-carbon-black/5 backdrop-blur"
        >
          <p className="text-xs text-muted">Signed in as</p>
          <p className="mt-0.5 text-sm font-semibold text-ink">{loaderData.email}</p>
        </motion.section>
      </main>
    </div>
  )
}

export default Home
