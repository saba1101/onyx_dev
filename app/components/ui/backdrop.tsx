const grain =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E"

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
