import { type ReactNode } from "react"
import { motion } from "motion/react"
import { LogoMark } from "./side-rail"

type auth_shell_props = {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}

export const AuthShell = ({ title, subtitle, children, footer }: auth_shell_props) => (
  <motion.section
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    className="relative overflow-hidden rounded-xl border border-line bg-card"
  >
    <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-flag-red via-royal-gold to-flag-red" />

    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LogoMark />
          <span className="text-sm font-semibold">
            onyx <span className="text-royal-gold">dev</span>
          </span>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-light-green" />
          secure
        </span>
      </div>

      <p className="text-[11px] uppercase tracking-wider text-flag-red">// access</p>
      <h1 className="mt-1 text-lg font-semibold tracking-tight">{title}</h1>
      <p className="mb-6 mt-0.5 text-xs text-muted">{subtitle}</p>

      {children}

      <footer className="mt-6 border-t border-line pt-4 text-center text-xs text-muted">
        {footer}
      </footer>
    </div>
  </motion.section>
)
