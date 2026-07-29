import { supabase } from "~/lib/supabase";

const GH = "https://api.github.com";

// ─── Types ───────────────────────────────────────────────────────────────────

export type GHUser = {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  bio: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
};

export type GHRepo = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  size: number;
  topics: string[];
  pushed_at: string;
  created_at: string;
  fork: boolean;
  private: boolean;
  archived: boolean;
  default_branch: string;
};

export type GHCommitWeek = {
  days: number[];
  total: number;
  week: number;
};

export type GHEvent = {
  id: string;
  type: string;
  created_at: string;
  repo: { name: string; url: string };
  payload: Record<string, unknown>;
};

export type LangMap = Record<string, number>;

// ─── Auth ────────────────────────────────────────────────────────────────────

export const get_github_token = async (): Promise<string | null> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.provider_token ?? null;
};

export const get_stored_token = async (
  user_id: string,
): Promise<string | null> => {
  const { data } = await supabase
    .from("profiles")
    .select("github_token")
    .eq("id", user_id)
    .single();
  return (data as { github_token: string | null } | null)?.github_token ?? null;
};

export const save_github_token = (
  user_id: string,
  token: string,
  username: string,
) =>
  supabase
    .from("profiles")
    .update({
      github_token: token,
      github_username: username,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user_id);

export const clear_github_token = (user_id: string) =>
  supabase
    .from("profiles")
    .update({ github_token: null, github_username: null })
    .eq("id", user_id);

// already_linked=true → signInWithOAuth (re-auth to get fresh provider_token)
// already_linked=false → linkIdentity (first-time link)
export const connect_github = (
  already_linked = false,
  redirect_path = "/git",
) =>
  already_linked
    ? supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          scopes: "read:user repo",
          redirectTo: `${window.location.origin}${redirect_path}`,
        },
      })
    : supabase.auth.linkIdentity({
        provider: "github",
        options: {
          scopes: "read:user repo",
          redirectTo: `${window.location.origin}${redirect_path}`,
        },
      });

// ─── Fetch ───────────────────────────────────────────────────────────────────

const gh = async <T>(path: string, token: string): Promise<T> => {
  const res = await fetch(`${GH}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${path}`);
  return res.json() as Promise<T>;
};

export const gh_user = (t: string) => gh<GHUser>("/user", t);
export const gh_repos = (t: string) =>
  gh<GHRepo[]>(
    "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
    t,
  );
export const gh_langs = (t: string, full: string) =>
  gh<LangMap>(`/repos/${full}/languages`, t);
export const gh_activity = (t: string, full: string) =>
  gh<GHCommitWeek[]>(`/repos/${full}/stats/commit_activity`, t);
export const gh_events = (t: string, login: string) =>
  gh<GHEvent[]>(`/users/${login}/events?per_page=50`, t);

// ─── Data transforms ─────────────────────────────────────────────────────────

export const merge_langs = (maps: LangMap[]): LangMap => {
  const out: LangMap = {};
  for (const m of maps)
    for (const [k, v] of Object.entries(m)) out[k] = (out[k] ?? 0) + v;
  return out;
};

// 52 weeks × 7 days flat array, index 0 = oldest day
export const commit_heatmap = (week_sets: GHCommitWeek[][]): number[] => {
  const grid = Array<number>(52 * 7).fill(0);
  for (const weeks of week_sets) {
    if (!Array.isArray(weeks)) continue;
    weeks.slice(-52).forEach((w, wi) =>
      w.days.forEach((c, di) => {
        grid[wi * 7 + di] += c;
      }),
    );
  }
  return grid;
};

export const weekly_totals = (
  week_sets: GHCommitWeek[][],
): { week: string; commits: number }[] => {
  const agg = new Map<number, number>();
  for (const weeks of week_sets) {
    if (!Array.isArray(weeks)) continue;
    weeks
      .slice(-52)
      .forEach((w) => agg.set(w.week, (agg.get(w.week) ?? 0) + w.total));
  }
  return [...agg.entries()]
    .sort(([a], [b]) => a - b)
    .map(([ts, commits]) => ({
      week: new Date(ts * 1000).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      commits,
    }));
};

// ─── Language colors ─────────────────────────────────────────────────────────

export const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f7df1e",
  Python: "#3572A5",
  Rust: "#dea584",
  Go: "#00ADD8",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  HTML: "#e34c26",
  CSS: "#563d7c",
  SCSS: "#c6538c",
  Shell: "#89e051",
  Bash: "#89e051",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Dart: "#00B4AB",
  Elixir: "#6e4a7e",
  Haskell: "#5e5086",
  Lua: "#000080",
  R: "#198CE7",
  Dockerfile: "#384d54",
  Nix: "#7e7eff",
  Zig: "#ec915c",
  OCaml: "#3be133",
  Clojure: "#db5855",
  Scala: "#c22d40",
  Perl: "#0298c3",
  "F#": "#b845fc",
  MDX: "#1B1F24",
};

export const lang_color = (name: string) => LANG_COLORS[name] ?? "#6b7280";

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const fmt_num = (n: number): string =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(1)}k`
      : String(n);

export const fmt_bytes = (n: number): string =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)} MB`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(1)} kB`
      : `${n} B`;

export const fmt_ago = (iso: string): string => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  const m = Math.floor(d / 30);
  if (m < 12) return `${m}mo ago`;
  return `${Math.floor(m / 12)}y ago`;
};

export const EVENT_LABEL: Record<string, string> = {
  PushEvent: "pushed to",
  PullRequestEvent: "opened PR on",
  IssuesEvent: "opened issue on",
  WatchEvent: "starred",
  ForkEvent: "forked",
  CreateEvent: "created",
  DeleteEvent: "deleted from",
  ReleaseEvent: "released on",
  IssueCommentEvent: "commented on",
  PullRequestReviewEvent: "reviewed PR on",
  GollumEvent: "edited wiki on",
  MemberEvent: "added collaborator to",
};
