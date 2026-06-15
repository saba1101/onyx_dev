import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  index("features/dashboard/routes/home.tsx"),
  layout("features/auth/routes/layout.tsx", [
    route("login", "features/auth/routes/login.tsx"),
    route("signup", "features/auth/routes/signup.tsx"),
  ]),
  route("logout", "features/auth/routes/logout.tsx"),
  route("settings", "features/settings/routes/settings.tsx"),
  route("profile", "features/profile/routes/profile.tsx"),
  route("users", "features/users/routes/users.tsx"),
  route("git",    "features/git/routes/git.tsx"),
  route("system",      "features/system/routes/system.tsx"),
  route("workspace",   "features/workspace/routes/workspace.tsx"),
  route("permissions", "features/permissions/routes/permissions.tsx"),
] satisfies RouteConfig;
