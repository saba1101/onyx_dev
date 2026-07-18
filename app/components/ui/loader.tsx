type loader_props = {
  size?: number
  className?: string
}

// Plain CSS animation (not motion/react) so it spins from first paint —
// this renders in the static SPA-mode HTML before any JS has run.
export const Loader = ({ size = 22, className = "" }: loader_props) => (
  <span
    role="status"
    aria-label="Loading"
    className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent text-flag-red ${className}`}
    style={{ width: size, height: size }}
  />
)
