import { useEffect, useState, type ReactNode } from "react"
import { Navigate } from "react-router"
import { motion } from "motion/react"
import { useAuth } from "~/features/auth/lib/auth"
import { SideRail } from "~/components/ui/side-rail"
import { Toggle } from "~/components/ui/toggle"

export const meta = () => [{ title: "Settings — Onyx Dev" }]

const INTRO_KEY = "disable_intro"

const Settings = () => {
  const { user, loading } = useAuth()
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
    if (value) {
      document.documentElement.setAttribute("data-no-intro", "")
    } else {
      document.documentElement.removeAttribute("data-no-intro")
    }
  }

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="flex min-h-screen">
      <SideRail />
      <main className="relative flex min-w-0 flex-1 flex-col gap-4 px-4 pb-12 pt-20 sm:px-6 lg:gap-5 lg:px-8 lg:pb-8 lg:pt-12">

        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-2 lg:absolute lg:inset-x-8 lg:top-2 lg:z-10"
        >
          <span className="text-[10px] font-semibold uppercase tracking-widest text-flag-red">//</span>
          <h1 className="text-sm font-semibold tracking-tight text-ink">Settings</h1>
          <span className="text-[11px] text-muted">Workspace preferences</span>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
        >
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-muted">
            Appearance
          </p>

          <div className="surface divide-y divide-line overflow-hidden rounded-2xl">
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
