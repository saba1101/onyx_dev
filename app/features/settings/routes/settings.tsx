import { useEffect, useState } from "react"
import { Navigate } from "react-router"
import { motion } from "motion/react"
import { useAuth } from "~/features/auth/lib/auth"
import { SideRail } from "~/components/ui/side-rail"
import { Toggle } from "~/components/ui/toggle"
import { use_theme, type ThemeChoice } from "~/hooks/use-theme"
import { use_accent, ACCENT_OPTIONS, type AccentKey } from "~/hooks/use-accent"
import { use_font_size, FONT_SIZES, type FontSize } from "~/hooks/use-font-size"

export const meta = () => [{ title: "Settings — Onyx Dev" }]

const ease = [0.22, 1, 0.36, 1] as const
const INTRO_KEY = "disable_intro"

// ── Segment control ───────────────────────────────────────────────────────────

function Segment<T extends string>({
  options, value, on_change,
}: {
  options: { value: T; label: string; icon?: React.ReactNode }[]
  value: T
  on_change: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-xl border border-line bg-line/20 p-0.5">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => on_change(opt.value)}
          className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150
            ${value === opt.value
              ? "bg-card text-ink shadow-sm"
              : "text-muted hover:text-ink"}`}
        >
          {opt.icon && <span className="shrink-0">{opt.icon}</span>}
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── Setting row ───────────────────────────────────────────────────────────────

const Row = ({
  label, desc, children, stacked = false,
}: {
  label: string; desc: string; children: React.ReactNode; stacked?: boolean
}) => (
  <div className={`flex gap-4 px-5 py-4 ${stacked ? "flex-col" : "items-center"}`}>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-ink">{label}</p>
      <p className="mt-0.5 text-[11px] text-muted">{desc}</p>
    </div>
    <div className={stacked ? "" : "shrink-0"}>{children}</div>
  </div>
)

// ── Section ───────────────────────────────────────────────────────────────────

const Section = ({
  label, icon, children,
}: {
  label: string; icon: React.ReactNode; children: React.ReactNode
}) => (
  <motion.section
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, ease }}
  >
    <div className="mb-3 flex items-center gap-2">
      <span className="text-muted">{icon}</span>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">{label}</p>
    </div>
    <div className="surface divide-y divide-line/60 overflow-hidden rounded-2xl">
      {children}
    </div>
  </motion.section>
)

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { user, loading } = useAuth()
  const { choice: theme_choice, set: set_theme, mounted: theme_mounted } = use_theme()
  const { accent, set_accent, mounted: accent_mounted } = use_accent()
  const { size: font_size, set_size, mounted: font_mounted } = use_font_size()

  const [disable_intro, set_disable_intro] = useState(false)

  useEffect(() => {
    set_disable_intro(localStorage.getItem(INTRO_KEY) === "true")
  }, [])

  const handle_intro = (value: boolean) => {
    set_disable_intro(value)
    if (value) {
      localStorage.setItem(INTRO_KEY, "true")
      document.documentElement.setAttribute("data-no-intro", "")
    } else {
      localStorage.removeItem(INTRO_KEY)
      document.documentElement.removeAttribute("data-no-intro")
    }
  }

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

  const theme_opts: { value: ThemeChoice; label: string; icon: React.ReactNode }[] = [
    { value: "light",  label: "Light",  icon: <SunIcon /> },
    { value: "dark",   label: "Dark",   icon: <MoonIcon /> },
    { value: "system", label: "System", icon: <SystemIcon /> },
  ]

  const font_opts: { value: FontSize; label: string }[] = [
    { value: "compact",     label: "Compact" },
    { value: "default",     label: "Default" },
    { value: "comfortable", label: "Comfortable" },
  ]

  return (
    <div className="flex h-screen overflow-hidden">
      <SideRail />

      <main className="flex flex-1 flex-col overflow-hidden pt-14 lg:pt-0">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease }}
          className="flex shrink-0 items-center gap-3 border-b border-line bg-card px-4 py-3 lg:px-6 lg:py-4"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-flag-red/10 text-flag-red">
            <GearIcon />
          </span>
          <div>
            <h1 className="text-sm font-bold text-ink">Settings</h1>
            <p className="text-[10px] text-muted">Workspace preferences</p>
          </div>
        </motion.div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="space-y-6">

            {/* ── Appearance ── */}
            <Section label="Appearance" icon={<PaletteIcon />}>

              {/* Theme */}
              <Row label="Theme" desc="Choose light, dark, or follow your system preference">
                {theme_mounted ? (
                  <Segment options={theme_opts} value={theme_choice} on_change={set_theme} />
                ) : <SegmentSkeleton count={3} />}
              </Row>

              {/* Accent colour */}
              <Row label="Accent colour" desc="Used for buttons, highlights, and interactive elements">
                {accent_mounted ? (
                  <div className="flex flex-wrap gap-2">
                    {(Object.entries(ACCENT_OPTIONS) as [AccentKey, { label: string; hsl: string }][]).map(([key, opt]) => (
                      <button
                        key={key}
                        type="button"
                        title={opt.label}
                        onClick={() => set_accent(key)}
                        style={{
                          background: `hsl(${opt.hsl})`,
                          ...(accent === key ? { boxShadow: `0 0 0 2px var(--color-card), 0 0 0 4px hsl(${opt.hsl})` } : {}),
                        }}
                        className={`h-7 w-7 cursor-pointer rounded-full transition-all duration-150
                          ${accent === key ? "scale-110" : "opacity-60 hover:opacity-90 hover:scale-105"}`}
                      />
                    ))}
                  </div>
                ) : <div className="flex gap-2">{[...Array(6)].map((_, i) => <div key={i} className="h-7 w-7 animate-pulse rounded-full bg-line/40" />)}</div>}
              </Row>

              {/* Font size */}
              <Row
                label="Font size"
                desc={font_mounted ? FONT_SIZES[font_size].desc : "Adjust the base text size across the interface"}
                stacked={false}
              >
                {font_mounted ? (
                  <Segment options={font_opts} value={font_size} on_change={set_size} />
                ) : <SegmentSkeleton count={3} />}
              </Row>

              {/* Intro animation */}
              <Row label="Disable intro animation" desc="Skip the typewriter animation on each page load">
                <Toggle checked={disable_intro} onChange={handle_intro} />
              </Row>

            </Section>

          </div>
        </div>
      </main>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

const SegmentSkeleton = ({ count }: { count: number }) => (
  <div className="flex gap-0.5 rounded-xl border border-line bg-line/20 p-0.5">
    {[...Array(count)].map((_, i) => (
      <div key={i} className="h-7 w-24 animate-pulse rounded-lg bg-line/40" />
    ))}
  </div>
)

// ── Icons ─────────────────────────────────────────────────────────────────────

const ip = {
  width: 13, height: 13, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.8,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
}

const GearIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47V21a2 2 0 1 1-4 0v-.11a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-.97H3a2 2 0 1 1 0-4h.11a1.6 1.6 0 0 0 1.47-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.6 1.6 0 0 0 1.77.32H9a1.6 1.6 0 0 0 .97-1.47V3a2 2 0 1 1 4 0v.11a1.6 1.6 0 0 0 .97 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.32 1.77V9a1.6 1.6 0 0 0 1.47.97H21a2 2 0 1 1 0 4h-.11a1.6 1.6 0 0 0-1.47.97z" />
  </svg>
)

const PaletteIcon = () => (
  <svg {...ip}>
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" stroke="none" />
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" stroke="none" />
    <circle cx="8.5"  cy="7.5"  r=".5" fill="currentColor" stroke="none" />
    <circle cx="6.5"  cy="12.5" r=".5" fill="currentColor" stroke="none" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
  </svg>
)

const SunIcon = () => (
  <svg {...ip}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
)

const MoonIcon = () => (
  <svg {...ip}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)

const SystemIcon = () => (
  <svg {...ip}>
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
)
