const grain =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E"

export const Backdrop = () => (
  <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-[#16100e]">
    <div
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(130% 90% at 50% -10%, #2a211d 0%, #1c1513 48%, #130d0c 100%)",
      }}
    />
    <div
      className="absolute inset-0 opacity-30 mix-blend-screen"
      style={{
        background:
          "radial-gradient(80% 55% at 50% 0%, var(--color-flag-red) 0%, transparent 65%)",
      }}
    />
    <div
      className="absolute inset-0 opacity-[0.18] mix-blend-overlay"
      style={{ backgroundImage: `url("${grain}")`, backgroundSize: "160px 160px" }}
    />
  </div>
)
