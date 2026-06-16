const grain =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.3'/%3E%3C/svg%3E"

const red_glow =
  "radial-gradient(80% 55% at 50% 0%, var(--color-flag-red) 0%, transparent 65%)"

export const Backdrop = () => (
  <div
    aria-hidden
    className="pointer-events-none fixed inset-0 -z-10"
    style={{ background: "var(--backdrop-base)" }}
  >
    <div
      className="absolute inset-0"
      style={{ background: "var(--backdrop-radial)" }}
    />

    {/* light: warm red blush at top via multiply */}
    <div
      className="absolute inset-0 opacity-[0.12] mix-blend-multiply dark:hidden"
      style={{ background: red_glow }}
    />
    {/* dark: vivid glow at top via screen */}
    <div
      className="absolute inset-0 hidden opacity-30 mix-blend-screen dark:block"
      style={{ background: red_glow }}
    />

    <div
      className="pointer-events-none absolute inset-0 mix-blend-overlay"
      style={{
        backgroundImage: `url("${grain}")`,
        opacity: "var(--grain-opacity)",
      }}
    />
  </div>
)
