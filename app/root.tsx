import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import { SplashIntro } from "~/components/ui/splash-intro";
import { Loader } from "~/components/ui/loader";
import { NotificationProvider } from "~/components/ui/notifications";
import { Backdrop } from "~/components/ui/backdrop";
import { ThemeToggle } from "~/components/ui/theme-toggle";
import { use_theme_palette } from "~/hooks/use-theme-palette";
import theme_palettes from "~/hooks/theme-palettes.json";
import { AuthProvider } from "~/features/auth/lib/auth";
import { ProfileProvider } from "~/features/profile/lib/profile-context";
import { PermissionsProvider } from "~/features/permissions/lib/permissions-context";
import { LocationSharingSync } from "~/features/locations/lib/location-sharing-sync";
import { ChatWidget } from "~/features/chat/components/chat-widget";
import { UpdateNotice } from "~/components/ui/update-notice";
import { NotFoundPage } from "~/components/ui/not-found";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/png", href: "/onyx.png" },
  { rel: "apple-touch-icon", href: "/onyx.png" },
];

const appearance_setup = `(() => {
  // Theme
  const t = localStorage.getItem("theme") ?? "system"
  const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.toggle("dark", dark)

  // Intro
  if (localStorage.getItem("disable_intro") === "true")
    document.documentElement.setAttribute("data-no-intro", "")

  // Theme palette (accent + background/text tint) — palettes object below is
  // theme-palettes.json itself (imported and inlined at build time), so this
  // and the runtime hook in use-theme-palette.ts read the exact same source.
  const palettes = ${JSON.stringify(theme_palettes)}
  const p = palettes[localStorage.getItem("theme_palette")] || palettes.onyx
  const v = dark ? p.dark : p.light
  const el = document.documentElement.style
  el.setProperty("--color-flag-red", "hsl(" + p.accent + ")")
  el.setProperty("--color-primary",  "hsl(" + p.accent + ")")
  el.setProperty("--color-page",  "hsl(" + v.page + ")")
  el.setProperty("--color-card",  "hsl(" + v.card + ")")
  el.setProperty("--color-ink",   "hsl(" + v.ink + ")")
  el.setProperty("--color-muted", "hsl(" + v.muted + ")")
  el.setProperty("--color-line",  "hsl(" + v.line + ")")

  // Font size
  const sizes = { compact: "13px", default: "16px", comfortable: "18px" }
  document.documentElement.style.fontSize =
    sizes[localStorage.getItem("font_size")] || "16px"
})()`;

export const Layout = ({ children }: { children: React.ReactNode }) => {
  // Mounted app-wide (not just on /settings) so the palette's page/card/ink/
  // muted/line overrides — inline styles, which beat the .dark class rules
  // in app.css — actually re-apply their other variant when dark/light is
  // toggled from anywhere, e.g. the floating ThemeToggle button below.
  use_theme_palette();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script dangerouslySetInnerHTML={{ __html: appearance_setup }} />
      </head>
      <body>
        <Backdrop />
        <SplashIntro />
        <NotificationProvider>
          {children}
          <ThemeToggle />
        </NotificationProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
};

const App = () => (
  <AuthProvider>
    <ProfileProvider>
      <PermissionsProvider>
        <LocationSharingSync />
        <ChatWidget />
        <UpdateNotice />
        <Outlet />
      </PermissionsProvider>
    </ProfileProvider>
  </AuthProvider>
);
export default App;

// Rendered in the static SPA-mode HTML before JS has loaded/hydrated —
// replaces the otherwise blank background with a visible loading state.
export const HydrateFallback = () => (
  <div className="fixed inset-0 z-[90] grid place-items-center">
    <Loader size={28} />
  </div>
);

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundPage />;
  }

  let title = "Error";
  let msg = "Something went wrong.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    title = "Error";
    msg = error.statusText || msg;
  } else if (import.meta.env.DEV && error instanceof Error) {
    msg = error.message;
    stack = error.stack;
  }

  return (
    <main className="p-8">
      <h1>{title}</h1>
      <p>{msg}</p>
      {stack && (
        <pre className="overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
};
