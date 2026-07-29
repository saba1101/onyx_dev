import { useEffect, useState } from "react";
import { Form, Link, useLocation } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "~/features/auth/lib/auth";
import { useProfile } from "~/features/profile/lib/profile-context";
import { effective_status, status_tone } from "~/features/profile/lib/profile";
import { use_presence_tick } from "~/hooks/use-presence-tick";
import { AvatarUploader } from "~/features/profile/components/avatar-uploader";
import {
  PencilIcon,
  MenuIcon,
  ChevronsLeftIcon,
  UsersIcon,
  GitBranchIcon,
  SlidersIcon,
  SearchIcon,
  MapPinIcon,
  WalletIcon,
  BriefcaseIcon,
} from "~/components/ui/icons";
import { usePermissionsStore } from "~/features/permissions/lib/permissions-store";
import { use_fullscreen } from "~/hooks/use-fullscreen";

const COLLAPSE_KEY = "rail_collapsed";

const read_collapsed = () =>
  typeof window !== "undefined" &&
  localStorage.getItem(COLLAPSE_KEY) === "true";

export const LogoMark = () => (
  <img
    src="/onyx.png"
    alt="Onyx"
    className="h-7 w-7 rounded-lg object-contain"
  />
);

const Brand = ({ hidden }: { hidden: string }) => (
  <Link to="/" prefetch="intent" className="flex items-center gap-2.5">
    <LogoMark />
    <span
      className={`inline-flex items-center text-sm font-bold tracking-tight ${hidden}`}
    >
      <span className="bg-flag-red px-1.5 py-0.5 text-white">onyx</span>
      <span className="text-flag-red">_dev</span>
    </span>
  </Link>
);

const UserCard = ({ collapsed }: { collapsed: boolean }) => {
  const { user } = useAuth();
  const { profile } = useProfile();
  use_presence_tick(30_000);

  if (!user) return null;

  const display_name =
    profile?.full_name ||
    profile?.username ||
    user.email?.split("@")[0] ||
    "User";
  const tone =
    status_tone[
      effective_status(
        profile?.status ?? "active",
        profile?.last_seen_at ?? null,
      )
    ];
  const label_hidden = collapsed ? "lg:hidden" : "";

  return (
    <div
      className={`surface relative mb-3 rounded-xl p-3 ${
        collapsed ? "lg:flex lg:justify-center lg:p-2" : ""
      }`}
    >
      <Link
        to="/profile"
        className={`absolute right-2.5 top-2.5 inline-flex items-center gap-1 text-[10px] font-light text-muted transition-colors hover:text-ink ${label_hidden}`}
      >
        <PencilIcon size={10} />
        Edit
      </Link>

      <Link
        to="/profile"
        className={`relative block w-fit ${collapsed ? "" : "mb-2.5"}`}
      >
        <AvatarUploader url={profile?.avatar_url} editing={false} size="sm" />
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${tone.dot}`}
        />
      </Link>

      <div className={label_hidden}>
        <p className="truncate pr-12 text-xs font-semibold text-ink">
          {display_name}
        </p>
        <p className="truncate text-[10px] text-muted">{user.email}</p>
        {profile?.role && (
          <span
            className={`mt-1.5 inline-flex items-center gap-1.5 text-[10px] ${tone.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
            {profile.role} · {tone.label}
          </span>
        )}
      </div>
    </div>
  );
};

const PAGE_PATH_TO_KEY: Record<string, string> = {
  "/": "dashboard",
  "/workspace": "workspace",
  "/git": "git",
  "/users": "users",
  "/inspector": "scanner",
  "/locations": "locations",
  "/planning": "planning",
  "/crypto": "crypto",
  "/subscriptions": "subscriptions",
  "/clients": "clients",
  "/settings": "settings",
};

export const SideRail = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { profile } = useProfile();
  const [collapsed, set_collapsed] = useState(read_collapsed);
  const [mobile_open, set_mobile_open] = useState(false);

  const is_root = profile?.role === "root";
  const loaded = usePermissionsStore((s) => s.loaded);
  const hidden_pages = usePermissionsStore((s) => s.hidden_pages);
  const { is_fullscreen, toggle: toggle_fullscreen } = use_fullscreen();

  useEffect(() => {
    set_mobile_open(false);
  }, [location.pathname]);

  const toggle_collapsed = () => {
    set_collapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, String(next));
      return next;
    });
  };

  const all_items = [
    { to: "/", label: "Dashboard", icon: GridIcon },
    { to: "/users", label: is_root ? "Users" : "Team", icon: UsersIcon },
    { to: "/git", label: "Git", icon: GitBranchIcon },
    { to: "/workspace", label: "Workspace", icon: SlidersIcon },
    { to: "/system", label: "System", icon: ServerIcon },
    { to: "/inspector", label: "Scanner", icon: SearchIcon },
    { to: "/locations", label: "Locations", icon: MapPinIcon },
    { to: "/planning", label: "Flow Map", icon: NetworkIcon },
    { to: "/crypto", label: "Crypto", icon: CryptoIcon },
    { to: "/subscriptions", label: "Subscriptions", icon: WalletIcon },
    { to: "/clients", label: "Clients", icon: BriefcaseIcon },
    { to: "/settings", label: "Settings", icon: GearIcon },
  ];

  const PRIVILEGED = new Set(["/system"]);
  const rail_items = is_root
    ? all_items
    : all_items.filter((item) => {
        if (PRIVILEGED.has(item.to)) return false;
        if (!loaded) return true;
        return !hidden_pages.includes(PAGE_PATH_TO_KEY[item.to] ?? "");
      });

  const label_hidden = collapsed ? "lg:hidden" : "";
  const center = collapsed ? "lg:justify-center lg:px-0" : "";

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-30 flex items-center gap-3 border-b border-line bg-card px-4 py-2.5 lg:hidden">
        <button
          type="button"
          onClick={() => set_mobile_open(true)}
          aria-label="Open menu"
          className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-line text-ink transition-colors hover:bg-line/50"
        >
          <MenuIcon size={18} />
        </button>
        <Brand hidden="" />
      </div>

      <AnimatePresence>
        {mobile_open && (
          <motion.button
            type="button"
            aria-label="Close menu"
            onClick={() => set_mobile_open(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-carbon-black/40 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      <div
        aria-hidden="true"
        className={`hidden shrink-0 transition-[width] duration-300 ease-out lg:block ${
          collapsed ? "w-[72px]" : "w-52"
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col gap-1 border-r border-line bg-card px-3 py-5 transition-[transform,width] duration-300 ease-out ${
          mobile_open ? "translate-x-0 w-64" : "-translate-x-full w-64"
        } lg:translate-x-0 ${collapsed ? "lg:w-[72px]" : "lg:w-52"}`}
      >
        <div
          className={`mb-4 flex items-center justify-between gap-2.5 px-2 ${center}`}
        >
          <Brand hidden={label_hidden} />
          <button
            type="button"
            onClick={toggle_collapsed}
            aria-label="Collapse sidebar"
            className={`hidden h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-line/50 hover:text-ink lg:grid ${label_hidden}`}
          >
            <ChevronsLeftIcon size={16} />
          </button>
        </div>

        <UserCard collapsed={collapsed} />

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
                title={item.label}
                prefetch="intent"
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${center} ${
                  active
                    ? "bg-flag-red/8 text-flag-red before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-flag-red"
                    : "text-muted hover:bg-line/40 hover:text-ink"
                }`}
              >
                <span className="shrink-0">
                  <item.icon />
                </span>
                <span className={label_hidden}>{item.label}</span>
              </Link>
            );
          })}

          {collapsed && (
            <button
              type="button"
              onClick={toggle_collapsed}
              aria-label="Expand sidebar"
              title="Expand"
              className="hidden cursor-pointer place-items-center rounded-lg px-3 py-2 text-muted transition-colors hover:bg-line/50 hover:text-ink lg:grid"
            >
              <ChevronsLeftIcon size={16} className="rotate-180" />
            </button>
          )}
        </nav>

        <button
          type="button"
          onClick={toggle_fullscreen}
          title={is_fullscreen ? "Exit fullscreen" : "Fullscreen"}
          className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-line/40 hover:text-ink ${center}`}
        >
          <span className="shrink-0">
            {is_fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
          </span>
          <span className={label_hidden}>
            {is_fullscreen ? "Exit fullscreen" : "Fullscreen"}
          </span>
        </button>

        <Form method="post" action="/logout">
          <button
            type="submit"
            title="Sign out"
            className={`flex w-full cursor-pointer items-center gap-3 rounded-lg bg-flag-red px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80 ${center}`}
          >
            <span className="shrink-0">
              <LogOutIcon />
            </span>
            <span className={label_hidden}>Sign out</span>
          </button>
        </Form>
      </aside>
    </>
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

const BarChartIcon = () => (
  <svg {...icon_props}>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

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

const ServerIcon = () => (
  <svg {...icon_props}>
    <rect x="2" y="3" width="20" height="6" rx="1.5" />
    <rect x="2" y="12" width="20" height="6" rx="1.5" />
    <circle cx="6.5" cy="6" r="1" fill="currentColor" stroke="none" />
    <circle cx="6.5" cy="15" r="1" fill="currentColor" stroke="none" />
    <line x1="10" y1="6" x2="14" y2="6" />
    <line x1="10" y1="15" x2="14" y2="15" />
  </svg>
);

const FullscreenIcon = () => (
  <svg {...icon_props}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
  </svg>
);

const ExitFullscreenIcon = () => (
  <svg {...icon_props}>
    <path d="M8 3v3a2 2 0 0 1-2 2H3" />
    <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
    <path d="M3 16h3a2 2 0 0 1 2 2v3" />
    <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
  </svg>
);

const NetworkIcon = () => (
  <svg {...icon_props}>
    <circle cx="12" cy="5" r="2" />
    <circle cx="5" cy="19" r="2" />
    <circle cx="19" cy="19" r="2" />
    <line x1="12" y1="7" x2="5" y2="17" />
    <line x1="12" y1="7" x2="19" y2="17" />
    <line x1="5" y1="19" x2="19" y2="19" />
  </svg>
);

const CryptoIcon = () => (
  <svg {...icon_props}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);
