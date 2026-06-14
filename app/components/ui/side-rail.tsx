import { useEffect, useState } from "react";
import { Form, Link, useLocation } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "~/features/auth/lib/auth";
import { useProfile } from "~/features/profile/lib/profile-context";
import { status_tone } from "~/features/profile/lib/profile";
import { AvatarUploader } from "~/features/profile/components/avatar-uploader";
import { PencilIcon, MenuIcon, ChevronsLeftIcon, UsersIcon } from "~/components/ui/icons";

const COLLAPSE_KEY = "rail_collapsed";

const read_collapsed = () =>
  typeof window !== "undefined" && localStorage.getItem(COLLAPSE_KEY) === "true";

export const LogoMark = () => (
  <img src="/onyx.png" alt="Onyx" className="h-7 w-7 rounded-lg object-contain" />
);

const Brand = ({ hidden }: { hidden: string }) => (
  <Link to="/" className="flex items-center gap-2.5">
    <LogoMark />
    <span className={`inline-flex items-center text-sm font-bold tracking-tight ${hidden}`}>
      <span className="bg-flag-red px-1.5 py-0.5 text-white">onyx</span>
      <span className="text-flag-red">_dev</span>
    </span>
  </Link>
);

const UserCard = ({ collapsed }: { collapsed: boolean }) => {
  const { user } = useAuth();
  const { profile } = useProfile();

  if (!user) return null;

  const display_name =
    profile?.full_name || profile?.username || user.email?.split("@")[0] || "User";
  const tone = status_tone[profile?.status ?? "active"];
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

      <Link to="/profile" className={`relative block w-fit ${collapsed ? "" : "mb-2.5"}`}>
        <AvatarUploader url={profile?.avatar_url} editing={false} size="sm" />
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${tone.dot}`}
        />
      </Link>

      <div className={label_hidden}>
        <p className="truncate pr-12 text-xs font-semibold text-ink">{display_name}</p>
        <p className="truncate text-[10px] text-muted">{user.email}</p>
        {profile?.role && (
          <span className={`mt-1.5 inline-flex items-center gap-1.5 text-[10px] ${tone.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
            {profile.role} · {tone.label}
          </span>
        )}
      </div>
    </div>
  );
};

export const SideRail = () => {
  const location = useLocation();
  const { profile } = useProfile();
  const [collapsed, set_collapsed] = useState(read_collapsed);
  const [mobile_open, set_mobile_open] = useState(false);

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

  const rail_items = [
    { to: "/",        label: "Dashboard", icon: GridIcon  },
    ...(profile?.role === "root" ? [{ to: "/users", label: "Users", icon: UsersIcon }] : []),
    { to: "/settings", label: "Settings", icon: GearIcon  },
  ];

  const label_hidden = collapsed ? "lg:hidden" : "";
  const center = collapsed ? "lg:justify-center lg:px-0" : "";

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-30 flex items-center gap-3 border-b border-line bg-card/90 px-4 py-2.5 backdrop-blur-xl lg:hidden">
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

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col gap-1 border-r border-line bg-card px-3 py-5 transition-[transform,width] duration-300 ease-out lg:static lg:z-auto lg:translate-x-0 lg:bg-card/50 lg:backdrop-blur-xl ${
          mobile_open ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-[72px]" : "lg:w-52"}`}
      >
        <div className={`mb-4 flex items-center justify-between gap-2.5 px-2 ${center}`}>
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
