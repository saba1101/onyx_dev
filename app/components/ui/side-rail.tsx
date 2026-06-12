import { Form, Link, useLocation } from "react-router";

export const LogoMark = () => (
  <img
    src="/onyx.png"
    alt="Onyx"
    className="h-7 w-7 rounded-lg object-contain"
  />
);

export const SideRail = () => {
  const location = useLocation();

  const rail_items = [
    { to: "/", label: "Home", icon: GridIcon },
    { to: "/", label: "Activity", icon: PulseIcon },
    { to: "/", label: "Reports", icon: ChartIcon },
    { to: "/", label: "Settings", icon: GearIcon },
  ];

  return (
    <aside className="flex w-14 shrink-0 flex-col items-center gap-2 border-r border-line bg-card/60 py-4 backdrop-blur">
      <div className="mb-3">
        <LogoMark />
      </div>

      <nav className="flex flex-1 flex-col items-center gap-1">
        {rail_items.map((item, slot) => {
          const active = slot === 0 && location.pathname === item.to;
          return (
            <Link
              key={item.label}
              to={item.to}
              aria-label={item.label}
              className={`grid h-9 w-9 place-items-center rounded-lg transition-colors duration-200 ${
                active
                  ? "bg-flag-red/15 text-flag-red"
                  : "text-muted hover:bg-line/50 hover:text-ink"
              }`}
            >
              <item.icon />
            </Link>
          );
        })}
      </nav>

      <Form method="post" action="/logout">
        <button
          type="submit"
          aria-label="Sign out"
          className="grid cursor-pointer h-8 w-8 place-items-center rounded-lg bg-flag-red text-white transition-opacity hover:opacity-80"
        >
          <LogOutIcon />
        </button>
      </Form>
    </aside>
  );
};

const icon_props = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const GridIcon = () => (
  <svg {...icon_props}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

const PulseIcon = () => (
  <svg {...icon_props}>
    <path d="M3 12h4l2 6 4-14 2 8h6" />
  </svg>
);

const ChartIcon = () => (
  <svg {...icon_props}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
);

const GearIcon = () => (
  <svg {...icon_props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47V21a2 2 0 1 1-4 0v-.11a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-.97H3a2 2 0 1 1 0-4h.11a1.6 1.6 0 0 0 1.47-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.6 1.6 0 0 0 1.77.32H9a1.6 1.6 0 0 0 .97-1.47V3a2 2 0 1 1 4 0v.11a1.6 1.6 0 0 0 .97 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.32 1.77V9a1.6 1.6 0 0 0 1.47.97H21a2 2 0 1 1 0 4h-.11a1.6 1.6 0 0 0-1.47.97z" />
  </svg>
);

const LogOutIcon = () => (
  <svg {...icon_props}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
