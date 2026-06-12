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
    { to: "/", label: "Dashboard", icon: GridIcon },
    { to: "/settings", label: "Settings", icon: GearIcon },
  ];

  return (
    <aside className="flex w-52 shrink-0 flex-col gap-1 border-r border-line bg-card/60 px-3 py-5 backdrop-blur">

      {/* Logo + wordmark */}
      <div className="mb-5 flex items-center gap-2.5 px-2">
        <LogoMark />
        <span className="inline-flex items-center text-sm font-bold tracking-tight">
          <span className="bg-flag-red px-1.5 py-0.5 text-white">onyx</span>
          <span className="text-flag-red">_dev</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5">
        {rail_items.map((item) => {
          const active =
            item.to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.label}
              to={item.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                active
                  ? "bg-flag-red/10 text-flag-red"
                  : "text-muted hover:bg-line/50 hover:text-ink"
              }`}
            >
              <item.icon />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <Form method="post" action="/logout">
        <button
          type="submit"
          className="flex w-full cursor-pointer items-center gap-3 rounded-lg bg-flag-red px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80"
        >
          <LogOutIcon />
          Sign out
        </button>
      </Form>
    </aside>
  );
};

const icon_props = {
  width: 16,
  height: 16,
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
