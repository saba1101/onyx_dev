import { useEffect, useState, type ReactNode } from "react"
import { motion } from "motion/react"
import type { Route } from "./+types/settings"
import { require_account } from "~/lib/auth.server"
import { SideRail } from "~/components/ui/side-rail"
import { Toggle } from "~/components/ui/toggle"

export const meta = () => [{ title: "Settings — Onyx Dev" }]

export const loader = async ({ request }: Route.LoaderArgs) => {
  await require_account(request)
  return null
}

const INTRO_KEY = "disable_intro"

const Settings = () => {
  const [disable_intro, set_disable_intro] = useState(false)

  useEffect(() => {
    set_disable_intro(localStorage.getItem(INTRO_KEY) === "true")
  }, [])

  const handle_intro = (value: boolean) => {
    set_disable_intro(value)
    if (value) {
      localStorage.setItem(INTRO_KEY, "true")
    } else {
      localStorage.removeItem(INTRO_KEY)
    }
    // reflect change in DOM immediately for the inline-script check
    if (value) {
      document.documentElement.setAttribute("data-no-intro", "")
    } else {
      document.documentElement.removeAttribute("data-no-intro")
    }
  }

  return (
    <div className="flex min-h-screen">
      <SideRail />
      <main className="flex flex-1 flex-col gap-10 p-8">

        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-[11px] uppercase tracking-widest text-flag-red">// config</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-xs text-muted">Manage your workspace preferences</p>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
        >
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-muted">
            Appearance
          </p>

          <div className="divide-y divide-line overflow-hidden rounded-2xl bg-card/80 shadow-sm shadow-carbon-black/5 backdrop-blur">
            <SettingRow
              label="Disable intro animation"
              description="Skip the typewriter animation on each page load"
            >
              <Toggle checked={disable_intro} onChange={handle_intro} />
            </SettingRow>
          </div>
        </motion.section>

      </main>
    </div>
  )
}

const SettingRow = ({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: ReactNode
}) => (
  <div className="flex items-center gap-4 px-5 py-4">
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-ink">{label}</p>
      <p className="mt-0.5 text-[11px] text-muted">{description}</p>
    </div>
    {children}
  </div>
)


export default Settings
