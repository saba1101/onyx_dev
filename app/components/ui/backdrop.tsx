const grain =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E"

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

    {/* light: warm red blush via multiply */}
    <div
      className="absolute inset-0 opacity-[0.12] mix-blend-multiply dark:hidden"
      style={{ background: red_glow }}
    />
    {/* dark: subtle glow without expensive blend mode */}
    <div
      className="absolute inset-0 hidden opacity-[0.18] dark:block"
      style={{ background: red_glow }}
    />

    {/* single full-screen noise layer — replaces per-element grain on .surface */}
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 mix-blend-overlay"
      style={{
        backgroundImage: `url("${grain}")`,
        opacity: 0.55,
        pointerEvents: "none",
      }}
    />
  </div>
)
