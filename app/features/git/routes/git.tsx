import { useEffect, useRef, useState, useMemo, type ReactNode } from "react"
import { Navigate } from "react-router"
import { motion, AnimatePresence } from "motion/react"
import {
  ResponsiveContainer,
  PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
  Tooltip as RTooltip,
} from "recharts"
import { useAuth } from "~/features/auth/lib/auth"
import { SideRail } from "~/components/ui/side-rail"
import { Dropdown } from "~/components/ui/dropdown"
import {
  GithubIcon, StarIcon, GitForkIcon, ExternalLinkIcon,
  BookIcon, MapPinIcon, GlobeIcon, BriefcaseIcon,
  UsersIcon, CalendarIcon, SearchIcon, ChevronIcon,
  ActivityIcon, GitBranchIcon, CheckIcon, TrashIcon,
  UploadIcon, GitMergeIcon, CircleDotIcon, TagIcon,
  MessageSquareIcon, PlusCircleIcon,
  UserIcon, FileTextIcon, ArchiveIcon, AlertCircleIcon, CodeIcon,
} from "~/components/ui/icons"
import { supabase } from "~/lib/supabase"
import {
  get_github_token, get_stored_token, save_github_token, clear_github_token,
  connect_github,
  gh_user, gh_repos, gh_langs, gh_activity, gh_events,
  merge_langs, commit_heatmap, weekly_totals,
  lang_color, fmt_num, fmt_bytes, fmt_ago, EVENT_LABEL,
  type GHUser, type GHRepo, type GHEvent, type LangMap, type GHCommitWeek,
} from "~/features/git/lib/github"

export const meta = () => [{ title: "Git — Onyx Dev" }]

// ─── Types ───────────────────────────────────────────────────────────────────

type GitData = {
  gh_user:     GHUser
  repos:       GHRepo[]
  languages:   LangMap
  commit_days: number[]
  weekly:      { week: string; commits: number }[]
  events:      GHEvent[]
}

type PageState =
  | { phase: "idle" | "loading" | "disconnected" }
  | { phase: "ready"; data: GitData }
  | { phase: "error"; message: string }

type Tab = "overview" | "repos" | "languages" | "activity"

// ─── Chart tooltip ───────────────────────────────────────────────────────────

const CT = ({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-2.5 text-xs shadow-xl">
      {label && <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="font-semibold text-ink">
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: p.color }} />
          {p.value.toLocaleString()} {p.name}
        </p>
      ))}
    </div>
  )
}

// ─── Stat card ───────────────────────────────────────────────────────────────

const Stat = ({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) => (
  <div className="surface flex flex-col gap-2 rounded-2xl p-4">
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-flag-red/10 text-flag-red">{icon}</span>
    <p className="text-2xl font-bold tracking-tight text-ink">{value}</p>
    <p className="text-[10px] uppercase tracking-widest text-muted">{label}</p>
  </div>
)

// ─── Section header ──────────────────────────────────────────────────────────

const SH = ({ children }: { children: ReactNode }) => (
  <p className="mb-3 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted before:inline-block before:h-px before:w-3 before:bg-flag-red/60 before:content-['']">
    {children}
  </p>
)

// ─── Heatmap ─────────────────────────────────────────────────────────────────

const DAYS_SHORT = ["S", "M", "T", "W", "T", "F", "S"]

const Heatmap = ({ days }: { days: number[] }) => {
  const max = Math.max(...days, 1)
  const weeks = Array.from({ length: 52 }, (_, i) => days.slice(i * 7, i * 7 + 7))

  const cell_cls = (n: number) => {
    if (n === 0) return "bg-line/40 dark:bg-white/[0.06]"
    const lv = Math.min(4, Math.ceil((n / max) * 4))
    return (["bg-flag-red/20", "bg-flag-red/40", "bg-flag-red/65", "bg-flag-red"] as const)[lv - 1]
  }

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-[3px]">
        <div className="flex flex-col gap-[3px] pr-1">
          <div className="h-2.5 w-3 text-[9px]" />
          {DAYS_SHORT.map((d, i) => (
            <div key={i} className={`flex h-2.5 items-center text-[9px] leading-none text-muted ${i % 2 !== 0 ? "opacity-0" : ""}`}>
              {d}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            <div className="h-2.5 w-2.5" />
            {week.map((count, di) => (
              <div
                key={di}
                title={`${count} commit${count !== 1 ? "s" : ""}`}
                className={`h-2.5 w-2.5 rounded-[2px] transition-colors ${cell_cls(count)}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Repo card ───────────────────────────────────────────────────────────────

const RepoCard = ({ repo }: { repo: GHRepo }) => (
  <a
    href={repo.html_url}
    target="_blank"
    rel="noreferrer"
    className="surface group flex flex-col justify-between gap-3 rounded-2xl p-4 transition-shadow hover:shadow-lg"
  >
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <BookIcon size={13} className="shrink-0 text-muted" />
          <p className="truncate text-sm font-semibold text-ink group-hover:text-flag-red">{repo.name}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {repo.private && (
            <span className="rounded bg-line/40 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-muted">private</span>
          )}
          {repo.fork && (
            <span className="rounded bg-line/40 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-muted">fork</span>
          )}
          <ExternalLinkIcon size={12} className="text-muted opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </div>
      {repo.description && (
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">{repo.description}</p>
      )}
      {repo.topics.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {repo.topics.slice(0, 4).map(t => (
            <span key={t} className="rounded-md bg-flag-red/8 px-2 py-px text-[10px] text-flag-red/80">{t}</span>
          ))}
        </div>
      )}
    </div>

    <div className="flex items-center justify-between gap-2 border-t border-line/50 pt-3">
      {repo.language ? (
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: lang_color(repo.language) }} />
          {repo.language}
        </span>
      ) : <span />}
      <div className="flex items-center gap-3 text-[11px] text-muted">
        <span className="flex items-center gap-1"><StarIcon size={11} />{fmt_num(repo.stargazers_count)}</span>
        <span className="flex items-center gap-1"><GitForkIcon size={11} />{fmt_num(repo.forks_count)}</span>
        <span className="hidden sm:inline">{fmt_ago(repo.pushed_at)}</span>
      </div>
    </div>
  </a>
)

// ─── Activity feed helpers ────────────────────────────────────────────────────

const EV_ICON: Record<string, ReactNode> = {
  PushEvent:              <UploadIcon size={12} />,
  PullRequestEvent:       <GitMergeIcon size={12} />,
  PullRequestReviewEvent: <CheckIcon size={12} />,
  IssuesEvent:            <CircleDotIcon size={12} />,
  IssueCommentEvent:      <MessageSquareIcon size={12} />,
  WatchEvent:             <StarIcon size={12} />,
  ForkEvent:              <GitForkIcon size={12} />,
  CreateEvent:            <PlusCircleIcon size={12} />,
  DeleteEvent:            <TrashIcon size={12} />,
  ReleaseEvent:           <TagIcon size={12} />,
}

const CONTRIBUTION_EV = new Set([
  "PushEvent", "PullRequestEvent", "PullRequestReviewEvent", "CreateEvent", "ReleaseEvent",
])

const ev_detail = (ev: GHEvent): string | null => {
  const p = ev.payload
  if (ev.type === "PushEvent") {
    const n = Array.isArray(p.commits) ? p.commits.length : 0
    const branch = typeof p.ref === "string" ? p.ref.replace("refs/heads/", "") : ""
    return `${n} commit${n !== 1 ? "s" : ""}${branch ? ` → ${branch}` : ""}`
  }
  if (ev.type === "PullRequestEvent") {
    const pr = p.pull_request as { title?: string; number?: number } | undefined
    const action = typeof p.action === "string" ? p.action : ""
    return pr ? `${action} #${pr.number}: ${pr.title ?? ""}` : null
  }
  if (ev.type === "IssuesEvent") {
    const issue = p.issue as { title?: string; number?: number } | undefined
    const action = typeof p.action === "string" ? p.action : ""
    return issue ? `${action} #${issue.number}: ${issue.title ?? ""}` : null
  }
  if (ev.type === "IssueCommentEvent") {
    const issue = p.issue as { number?: number; title?: string } | undefined
    return issue ? `#${issue.number}: ${issue.title ?? ""}` : null
  }
  if (ev.type === "CreateEvent") {
    const rt = typeof p.ref_type === "string" ? p.ref_type : ""
    const ref = typeof p.ref === "string" ? p.ref : ""
    return `${rt}${ref ? `: ${ref}` : ""}`
  }
  if (ev.type === "ForkEvent") {
    const forkee = p.forkee as { full_name?: string } | undefined
    return forkee?.full_name ? `→ ${forkee.full_name}` : null
  }
  if (ev.type === "ReleaseEvent") {
    const release = p.release as { name?: string | null; tag_name?: string } | undefined
    return release ? (release.name || release.tag_name || null) : null
  }
  return null
}

const group_events = (events: GHEvent[]): [string, GHEvent[]][] => {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const groups: [string, GHEvent[]][] = []
  const idx = new Map<string, number>()
  for (const ev of events.slice(0, 30)) {
    const d = new Date(ev.created_at); d.setHours(0, 0, 0, 0)
    const key = d.getTime() === today.getTime()     ? "Today"
              : d.getTime() === yesterday.getTime() ? "Yesterday"
              : d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    if (!idx.has(key)) { idx.set(key, groups.length); groups.push([key, []]) }
    groups[idx.get(key)!][1].push(ev)
  }
  return groups
}

// ─── Stars ranking ────────────────────────────────────────────────────────────

const StarsRanking = ({ repos }: { repos: GHRepo[] }) => {
  const data = [...repos]
    .filter(r => r.stargazers_count > 0)
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 10)

  if (data.length === 0)
    return <p className="py-8 text-center text-sm text-muted">No starred repositories</p>

  const max = data[0].stargazers_count

  return (
    <div className="space-y-0.5">
      {data.map((r, i) => (
        <a
          key={r.id}
          href={r.html_url}
          target="_blank"
          rel="noreferrer"
          className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-flag-red/[0.04]"
        >
          <span className="w-5 shrink-0 text-right text-[11px] font-bold tabular-nums text-muted/40">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-medium text-ink transition-colors group-hover:text-flag-red">
                {r.name}
              </p>
              <span className="flex shrink-0 items-center gap-1 text-xs font-semibold tabular-nums text-flag-red">
                <StarIcon size={11} />
                {fmt_num(r.stargazers_count)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2.5">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-line/50">
                <div
                  className="h-full rounded-full bg-flag-red/60 transition-all duration-500"
                  style={{ width: `${(r.stargazers_count / max) * 100}%` }}
                />
              </div>
              {r.language && (
                <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: lang_color(r.language) }} />
                  {r.language}
                </span>
              )}
            </div>
          </div>
        </a>
      ))}
    </div>
  )
}

// ─── Activity feed ────────────────────────────────────────────────────────────

const ActivityFeed = ({ events }: { events: GHEvent[] }) => {
  const groups = group_events(events)
  if (groups.length === 0)
    return <p className="py-8 text-center text-sm text-muted">No recent activity</p>

  return (
    <div className="space-y-6">
      {groups.map(([date, evs]) => (
        <div key={date}>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted">{date}</p>
          <div className="relative space-y-0.5">
            <div className="absolute bottom-3 left-[14px] top-3 w-px bg-line/60" />
            {evs.map(ev => {
              const icon   = EV_ICON[ev.type] ?? <ActivityIcon size={12} />
              const badge  = CONTRIBUTION_EV.has(ev.type)
                ? "bg-flag-red/10 text-flag-red"
                : "bg-line/60 text-muted"
              const detail = ev_detail(ev)
              const verb   = EVENT_LABEL[ev.type] ?? "acted on"
              const repo   = ev.repo.name
              const slug   = repo.split("/")[1] ?? repo

              return (
                <div key={ev.id} className="flex items-start gap-3 rounded-xl px-1 py-1.5 transition-colors hover:bg-flag-red/[0.03]">
                  <span className={`relative z-10 flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-lg ${badge}`}>
                    {icon}
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-xs leading-snug text-muted">
                      <span>{verb} </span>
                      <a
                        href={`https://github.com/${repo}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-ink hover:text-flag-red"
                      >
                        {slug}
                      </a>
                    </p>
                    {detail && (
                      <p className="mt-0.5 truncate text-[10px] text-muted/60">{detail}</p>
                    )}
                  </div>
                  <span className="shrink-0 pt-0.5 text-[10px] tabular-nums text-muted/50">
                    {new Date(ev.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Topics cloud ────────────────────────────────────────────────────────────

const TopicsCloud = ({ repos }: { repos: GHRepo[] }) => {
  const freq = new Map<string, number>()
  for (const r of repos)
    for (const t of r.topics)
      freq.set(t, (freq.get(t) ?? 0) + 1)

  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50)
  if (sorted.length === 0) return null
  const max = sorted[0][1]

  return (
    <div className="surface rounded-2xl p-5">
      <SH>Topics</SH>
      <div className="flex flex-wrap gap-2">
        {sorted.map(([topic, count]) => {
          const w = count / max
          const cls = w === 1
            ? "bg-flag-red text-white text-xs font-semibold px-3 py-1"
            : w >= 0.5
            ? "bg-flag-red/12 text-flag-red text-xs font-medium px-2.5 py-0.5"
            : "bg-line/50 text-muted text-[11px] font-medium px-2 py-0.5"
          return (
            <span key={topic} className={`inline-flex items-center gap-1.5 rounded-full ${cls}`}>
              {topic}
              {count > 1 && <span className="text-[9px] opacity-60 tabular-nums">{count}</span>}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ─── Repo breakdown ───────────────────────────────────────────────────────────

const BreakdownPill = ({
  icon, label, value, accent,
}: { icon: ReactNode; label: string; value: string | number; accent?: boolean }) => (
  <div className="flex items-center gap-2.5">
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${accent ? "bg-flag-red/10 text-flag-red" : "bg-line/50 text-muted"}`}>
      {icon}
    </span>
    <div>
      <p className={`text-sm font-bold tabular-nums leading-none ${accent ? "text-flag-red" : "text-ink"}`}>{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">{label}</p>
    </div>
  </div>
)

// ─── Overview tab ────────────────────────────────────────────────────────────

const OverviewTab = ({ data }: { data: GitData }) => {
  const { gh_user: u, repos, languages } = data

  const {
    total_stars, total_forks, total_issues, total_size,
    n_original, n_fork, n_private, n_archived,
  } = useMemo(() => ({
    total_stars:  repos.reduce((s, r) => s + r.stargazers_count, 0),
    total_forks:  repos.reduce((s, r) => s + r.forks_count, 0),
    total_issues: repos.reduce((s, r) => s + r.open_issues_count, 0),
    total_size:   repos.reduce((s, r) => s + r.size, 0),
    n_original:   repos.filter(r => !r.fork).length,
    n_fork:       repos.filter(r => r.fork).length,
    n_private:    repos.filter(r => r.private).length,
    n_archived:   repos.filter(r => r.archived).length,
  }), [repos])

  const lang_pie = useMemo(() => {
    const top = Object.entries(languages).sort(([, a], [, b]) => b - a).slice(0, 8)
    const total = top.reduce((s, [, v]) => s + v, 0)
    return top.map(([name, bytes]) => ({ name, bytes, pct: bytes / total }))
  }, [languages])

  const top_repos = useMemo(() =>
    [...repos].filter(r => !r.fork).sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 5)
  , [repos])

  return (
    <div className="space-y-5">
      {/* Profile */}
      <div className="surface rounded-2xl p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <img
            src={u.avatar_url}
            alt={u.login}
            className="h-20 w-20 shrink-0 rounded-2xl border border-line object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-bold text-ink">{u.name || u.login}</h2>
              <a
                href={u.html_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-flag-red hover:underline"
              >
                @{u.login} <ExternalLinkIcon size={11} />
              </a>
            </div>
            {u.bio && <p className="mt-1 text-sm leading-relaxed text-muted">{u.bio}</p>}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {u.location && (
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <MapPinIcon size={12} />{u.location}
                </span>
              )}
              {u.company && (
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <BriefcaseIcon size={12} />{u.company}
                </span>
              )}
              {u.blog && (
                <a
                  href={u.blog.startsWith("http") ? u.blog : `https://${u.blog}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-flag-red hover:underline"
                >
                  <GlobeIcon size={12} />{u.blog.replace(/^https?:\/\//, "")}
                </a>
              )}
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <CalendarIcon size={12} />
                Joined {new Date(u.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat icon={<BookIcon size={15} />}     label="Repositories" value={u.public_repos} />
        <Stat icon={<StarIcon size={15} />}     label="Total stars"  value={fmt_num(total_stars)} />
        <Stat icon={<GitForkIcon size={15} />}  label="Total forks"  value={fmt_num(total_forks)} />
        <Stat icon={<UsersIcon size={15} />}    label="Followers"    value={fmt_num(u.followers)} />
        <Stat icon={<UserIcon size={15} />}     label="Following"    value={fmt_num(u.following)} />
        <Stat icon={<FileTextIcon size={15} />} label="Gists"        value={u.public_gists} />
      </div>

      {/* Repo breakdown */}
      <div className="surface grid grid-cols-2 gap-4 rounded-2xl px-5 py-4 sm:grid-cols-3 lg:grid-cols-6">
        <BreakdownPill icon={<BookIcon size={13} />}        label="Original"    value={n_original} />
        <BreakdownPill icon={<GitForkIcon size={13} />}     label="Forked"      value={n_fork} />
        <BreakdownPill icon={<CodeIcon size={13} />}        label="Private"     value={n_private} />
        <BreakdownPill icon={<ArchiveIcon size={13} />}     label="Archived"    value={n_archived} />
        <BreakdownPill icon={<AlertCircleIcon size={13} />} label="Open issues" value={total_issues} accent />
        <BreakdownPill icon={<ActivityIcon size={13} />}    label="Code"        value={fmt_bytes(total_size * 1024)} />
      </div>

      {/* Language donut + top repos */}
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="surface rounded-2xl p-5 lg:col-span-2">
          <SH>Languages</SH>
          {lang_pie.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={lang_pie}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="bytes"
                    nameKey="name"
                  >
                    {lang_pie.map(({ name }) => (
                      <Cell key={name} fill={lang_color(name)} strokeWidth={0} />
                    ))}
                  </Pie>
                  <RTooltip content={<CT />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-1 space-y-2">
                {lang_pie.slice(0, 6).map(({ name, pct }) => (
                  <div key={name} className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: lang_color(name) }} />
                    <span className="min-w-0 flex-1 truncate text-xs text-ink">{name}</span>
                    <span className="text-[11px] tabular-nums text-muted">{(pct * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="py-10 text-center text-sm text-muted">No language data</p>
          )}
        </div>

        <div className="surface rounded-2xl p-5 lg:col-span-3">
          <SH>Top repositories</SH>
          <div className="space-y-2.5">
            {top_repos.map(r => (
              <a
                key={r.id}
                href={r.html_url}
                target="_blank"
                rel="noreferrer"
                className="group flex items-start justify-between gap-3 rounded-xl border border-line/60 p-3 transition-colors hover:border-flag-red/30 hover:bg-flag-red/[0.02]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink group-hover:text-flag-red">{r.name}</p>
                  {r.description && <p className="mt-0.5 truncate text-xs text-muted">{r.description}</p>}
                  {r.language && (
                    <span className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-muted">
                      <span className="h-2 w-2 rounded-full" style={{ background: lang_color(r.language) }} />
                      {r.language}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-[11px] text-muted">
                  <span className="flex items-center gap-1"><StarIcon size={11} />{fmt_num(r.stargazers_count)}</span>
                  <span className="flex items-center gap-1"><GitForkIcon size={11} />{fmt_num(r.forks_count)}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Topics cloud */}
      <TopicsCloud repos={repos} />
    </div>
  )
}

// ─── Repos tab ───────────────────────────────────────────────────────────────

const SORT_OPTS = [
  { value: "stars",   label: "Most stars"   },
  { value: "updated", label: "Last updated" },
  { value: "name",    label: "Name A–Z"     },
  { value: "issues",  label: "Open issues"  },
]

const ReposTab = ({ repos }: { repos: GHRepo[] }) => {
  const [search,    set_search]    = useState("")
  const [lang_f,    set_lang_f]    = useState("all")
  const [sort,      set_sort]      = useState("stars")
  const [show_fork, set_show_fork] = useState(false)

  const lang_opts = useMemo(() => {
    const langs = [...new Set(repos.map(r => r.language).filter(Boolean) as string[])].sort()
    return [{ value: "all", label: "All languages" }, ...langs.map(l => ({ value: l, label: l }))]
  }, [repos])

  const filtered = useMemo(() => {
    let list = repos
    if (!show_fork) list = list.filter(r => !r.fork)
    if (lang_f !== "all") list = list.filter(r => r.language === lang_f)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r => r.name.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      if (sort === "stars")   return b.stargazers_count - a.stargazers_count
      if (sort === "name")    return a.name.localeCompare(b.name)
      if (sort === "issues")  return b.open_issues_count - a.open_issues_count
      return new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime()
    })
  }, [repos, search, lang_f, sort, show_fork])

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <SearchIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={e => set_search(e.target.value)}
            placeholder="Search repos…"
            className="w-full rounded-xl border border-line bg-card/60 py-2 pl-8 pr-3 text-xs text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-flag-red"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Dropdown value={lang_f} options={lang_opts} on_select={set_lang_f} menu_width="w-40"
            trigger_class="inline-flex items-center gap-1.5 rounded-xl border border-line bg-card/60 px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-flag-red/40 hover:text-ink"
          >
            {({ open }) => (
              <>
                {lang_opts.find(o => o.value === lang_f)?.label}
                <ChevronIcon size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
              </>
            )}
          </Dropdown>
          <Dropdown value={sort} options={SORT_OPTS} on_select={set_sort} menu_width="w-40"
            trigger_class="inline-flex items-center gap-1.5 rounded-xl border border-line bg-card/60 px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-flag-red/40 hover:text-ink"
          >
            {({ open }) => (
              <>
                {SORT_OPTS.find(o => o.value === sort)?.label}
                <ChevronIcon size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
              </>
            )}
          </Dropdown>
          <button
            type="button"
            onClick={() => set_show_fork(v => !v)}
            className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
              show_fork
                ? "border-flag-red/40 bg-flag-red/8 text-flag-red"
                : "border-line bg-card/60 text-muted hover:border-flag-red/30 hover:text-ink"
            }`}
          >
            Include forks
          </button>
        </div>
      </div>

      <p className="text-[11px] text-muted">
        Showing <span className="font-medium text-ink">{filtered.length}</span> of {repos.length} repos
      </p>

      {filtered.length === 0 ? (
        <div className="surface rounded-2xl py-16 text-center">
          <p className="text-sm text-muted">No repos match your filters.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(r => <RepoCard key={r.id} repo={r} />)}
        </div>
      )}
    </div>
  )
}

// ─── Languages tab ───────────────────────────────────────────────────────────

const LanguagesTab = ({ languages }: { languages: LangMap }) => {
  const { entries, total, top10, pie, bar } = useMemo(() => {
    const entries = Object.entries(languages).sort(([, a], [, b]) => b - a)
    const total   = entries.reduce((s, [, v]) => s + v, 0)
    const top10   = entries.slice(0, 10)
    return {
      entries,
      total,
      top10,
      pie: top10.map(([name, bytes]) => ({ name, bytes })),
      bar: top10.map(([name, bytes]) => ({ name, bytes, pct: ((bytes / total) * 100).toFixed(1) })),
    }
  }, [languages])

  if (entries.length === 0) {
    return (
      <div className="surface rounded-2xl py-20 text-center">
        <p className="text-sm text-muted">No language data available.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="surface rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <SH>Language breakdown</SH>
          <p className="text-xs text-muted">{fmt_bytes(total)} of code across {entries.length} languages</p>
        </div>

        {/* Color bar */}
        <div className="mb-6 flex h-3 w-full overflow-hidden rounded-full">
          {top10.map(([name, bytes]) => (
            <div
              key={name}
              title={name}
              style={{ width: `${(bytes / total) * 100}%`, background: lang_color(name) }}
            />
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Donut */}
          <div>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pie}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={120}
                  paddingAngle={2}
                  dataKey="bytes"
                  nameKey="name"
                >
                  {pie.map(({ name }) => (
                    <Cell key={name} fill={lang_color(name)} strokeWidth={0} />
                  ))}
                </Pie>
                <RTooltip content={<CT />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Horizontal bar list */}
          <div className="space-y-3 py-2">
            {bar.map(({ name, bytes, pct }) => (
              <div key={name}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-medium text-ink">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: lang_color(name) }} />
                    {name}
                  </span>
                  <div className="flex gap-3 text-[11px] text-muted">
                    <span className="tabular-nums">{pct}%</span>
                    <span className="hidden sm:inline tabular-nums">{fmt_bytes(bytes)}</span>
                  </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-line/40">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: lang_color(name) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* All languages bar chart */}
      {entries.length > 3 && (
        <div className="surface rounded-2xl p-5">
          <SH>All languages — bytes of code</SH>
          <ResponsiveContainer width="100%" height={Math.min(entries.length * 32, 400)}>
            <BarChart
              layout="vertical"
              data={entries.slice(0, 15).map(([name, bytes]) => ({ name, bytes }))}
              margin={{ top: 0, right: 16, bottom: 0, left: 80 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={76}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickLine={false}
                axisLine={false}
              />
              <RTooltip content={<CT />} cursor={{ fill: "rgba(220,38,38,0.05)" }} />
              <Bar dataKey="bytes" name="bytes" radius={[0, 4, 4, 0]}>
                {entries.slice(0, 15).map(([name]) => (
                  <Cell key={name} fill={lang_color(name)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ─── Activity tab ─────────────────────────────────────────────────────────────

const ActivityTab = ({ data }: { data: GitData }) => {
  const { weekly, commit_days, events, repos } = data
  const { total_commits, peak } = useMemo(() => ({
    total_commits: weekly.reduce((s, w) => s + w.commits, 0),
    peak: Math.max(...weekly.map(w => w.commits), 1),
  }), [weekly])

  return (
    <div className="space-y-5">
      {/* Commit area chart */}
      <div className="surface rounded-2xl p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <SH>Commit activity — last 52 weeks</SH>
          <p className="text-xs text-muted">
            <span className="font-semibold text-ink">{fmt_num(total_commits)}</span> total commits · peak{" "}
            <span className="font-semibold text-ink">{peak}</span>/week
          </p>
        </div>
        {weekly.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={weekly} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="commit_grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#dc2626" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,100,100,0.1)" vertical={false} />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 10, fill: "#6b7280" }}
                tickLine={false}
                axisLine={false}
                interval={7}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#6b7280" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <RTooltip content={<CT />} cursor={{ stroke: "#dc2626", strokeWidth: 1, strokeDasharray: "4 2" }} />
              <Area
                type="monotone"
                dataKey="commits"
                stroke="#dc2626"
                strokeWidth={1.5}
                fill="url(#commit_grad)"
                dot={false}
                activeDot={{ r: 4, fill: "#dc2626", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-10 text-center text-sm text-muted">No commit data — stats may still be computing.</p>
        )}
      </div>

      {/* Contribution heatmap */}
      <div className="surface rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <SH>Contribution heatmap</SH>
          <div className="flex items-center gap-1.5 text-[10px] text-muted">
            <span>Less</span>
            {(["bg-line/40 dark:bg-white/[0.06]", "bg-flag-red/20", "bg-flag-red/40", "bg-flag-red/65", "bg-flag-red"] as const).map(c => (
              <span key={c} className={`h-2.5 w-2.5 rounded-[2px] ${c}`} />
            ))}
            <span>More</span>
          </div>
        </div>
        <Heatmap days={commit_days} />
      </div>

      {/* Stars ranking */}
      {repos.some(r => r.stargazers_count > 0) && (
        <div className="surface rounded-2xl p-5">
          <SH>Stars by repository</SH>
          <StarsRanking repos={repos} />
        </div>
      )}

      {/* Activity feed */}
      {events.length > 0 && (
        <div className="surface rounded-2xl p-5">
          <SH>Recent activity</SH>
          <ActivityFeed events={events} />
        </div>
      )}
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

const Skeleton = () => (
  <div className="space-y-5">
    <div className="surface h-36 animate-pulse rounded-2xl" />
    <div className="flex flex-wrap gap-3">
      {[1, 2, 3, 4].map(i => <div key={i} className="surface h-24 min-w-[120px] flex-1 animate-pulse rounded-2xl" />)}
    </div>
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="surface h-72 animate-pulse rounded-2xl lg:col-span-2" />
      <div className="surface h-72 animate-pulse rounded-2xl lg:col-span-3" />
    </div>
  </div>
)

// ─── Connect card ─────────────────────────────────────────────────────────────

const ConnectCard = ({ on_connect, connecting }: { on_connect: () => void; connecting: boolean }) => (
  <div className="flex flex-1 items-center justify-center py-24">
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="surface flex max-w-sm w-full flex-col items-center rounded-3xl p-10 text-center"
    >
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-flag-red/10 text-flag-red">
        <GithubIcon size={30} />
      </div>
      <h2 className="text-xl font-bold text-ink">Connect GitHub</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Link your GitHub account to visualize repos, commit activity, language breakdown, and more.
      </p>
      <button
        onClick={on_connect}
        disabled={connecting}
        className="mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-flag-red px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <GithubIcon size={16} />
        {connecting ? "Redirecting to GitHub…" : "Connect GitHub"}
      </button>
      <p className="mt-4 text-[11px] text-muted">
        Read-only access · your data never leaves this app
      </p>
    </motion.div>
  </div>
)

// ─── Tab nav ─────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: "overview",   label: "Overview",   icon: <GithubIcon size={14} /> },
  { id: "repos",      label: "Repos",      icon: <BookIcon size={14} /> },
  { id: "languages",  label: "Languages",  icon: <GitBranchIcon size={14} /> },
  { id: "activity",   label: "Activity",   icon: <ActivityIcon size={14} /> },
]

const TabNav = ({
  tab, set_tab, repos,
}: { tab: Tab; set_tab: (t: Tab) => void; repos: GHRepo[] }) => (
  <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-line bg-card/40 p-1">
    {TABS.map(t => (
      <button
        key={t.id}
        type="button"
        onClick={() => set_tab(t.id)}
        className={`relative flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
          tab === t.id
            ? "bg-flag-red text-white shadow-sm"
            : "text-muted hover:bg-line/40 hover:text-ink"
        }`}
      >
        {t.icon}
        {t.label}
        {t.id === "repos" && (
          <span className={`rounded-md px-1.5 py-px text-[9px] font-bold ${tab === "repos" ? "bg-white/20" : "bg-line/40 text-muted"}`}>
            {repos.length}
          </span>
        )}
      </button>
    ))}
  </div>
)

// ─── Page ────────────────────────────────────────────────────────────────────

const Git = () => {
  const { user, loading: auth_loading } = useAuth()
  const [state,        set_state]      = useState<PageState>({ phase: "idle" })
  const [tab,          set_tab]        = useState<Tab>("overview")
  const [connecting,   set_connecting] = useState(false)
  const [auth_trigger, set_trigger]    = useState(0)

  // Always-current state reference — lets the load effect read phase without
  // adding `state` to its deps (which would cause an infinite loop).
  const state_ref   = useRef(state)
  state_ref.current = state

  // Tracks the last auth_trigger value the effect actually ran with, so we can
  // distinguish "a new OAuth flow just completed" from "supabase-js fired
  // SIGNED_IN during a silent session restore / tab-return token refresh".
  const prev_trigger = useRef(0)

  const has_github = !!(user?.identities?.some(i => i.provider === "github"))

  // Strip OAuth error params from URL so they don't persist on reload
  useEffect(() => {
    const u = new URL(window.location.href)
    if (u.searchParams.has("error")) {
      u.searchParams.delete("error")
      u.searchParams.delete("error_code")
      u.searchParams.delete("error_description")
      u.hash = ""
      window.history.replaceState({}, "", u.toString())
    }
  }, [])

  // Increment auth_trigger only when we receive a genuinely new provider_token
  // from GitHub OAuth. supabase-js can fire SIGNED_IN during silent token
  // refreshes on tab-return, so we guard against that by only reacting when
  // the token string itself changed from what we last loaded with.
  const last_provider_token = useRef<string | null>(null)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "SIGNED_IN" &&
        session?.provider_token &&
        session.provider_token !== last_provider_token.current
      ) {
        set_trigger(n => n + 1)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (auth_loading || !user) return

    const trigger_changed = auth_trigger !== prev_trigger.current
    prev_trigger.current  = auth_trigger

    // Already have data and nothing meaningful changed — tab return, silent
    // token refresh, or any other spurious re-render. Don't reload.
    if (state_ref.current.phase === "ready" && !trigger_changed) return

    const load = async () => {
      if (!has_github) {
        set_state({ phase: "disconnected" })
        return
      }

      // 1. Fresh OAuth token from current session
      // 2. Stored token saved from a previous OAuth session
      const session_token = await get_github_token()
      const token         = session_token ?? await get_stored_token(user.id)

      if (!token) {
        set_state({ phase: "disconnected" })
        return
      }

      set_state({ phase: "loading" })

      try {
        const [ghuser, repos] = await Promise.all([
          gh_user(token),
          gh_repos(token),
        ])

        // Persist the token and record it so the auth listener can tell whether
        // a future SIGNED_IN carries a genuinely new token or the same one.
        if (session_token) {
          last_provider_token.current = session_token
          save_github_token(user.id, session_token, ghuser.login)
        }

        const originals    = repos.filter(r => !r.fork)
        const with_lang    = originals.filter(r => r.language).slice(0, 25)
        const for_activity = repos.slice(0, 8)

        const [lang_maps, activity_sets, events] = await Promise.all([
          Promise.all(with_lang.map(r => gh_langs(token, r.full_name).catch(() => ({} as Record<string, number>)))),
          Promise.all(for_activity.map(r => gh_activity(token, r.full_name).catch(() => [] as GHCommitWeek[]))),
          gh_events(token, ghuser.login).catch(() => [] as GHEvent[]),
        ])

        set_state({
          phase: "ready",
          data: {
            gh_user:     ghuser,
            repos,
            languages:   merge_langs(lang_maps),
            commit_days: commit_heatmap(activity_sets),
            weekly:      weekly_totals(activity_sets),
            events,
          },
        })
      } catch (err) {
        // Token rejected by GitHub — clear it so we prompt reconnect
        if (String(err).includes("401")) {
          clear_github_token(user.id)
          set_state({ phase: "disconnected" })
        } else {
          set_state({ phase: "error", message: String(err) })
        }
      }
    }

    load()
  }, [user?.id, has_github, auth_trigger])

  const handle_connect = async () => {
    set_connecting(true)
    // Already linked → signInWithOAuth to get a fresh provider_token
    // Not linked yet → linkIdentity to link for the first time
    await connect_github(has_github)
  }

  if (auth_loading) return null
  if (!user)        return <Navigate to="/login" replace />

  const is_loading = state.phase === "idle" || state.phase === "loading"

  return (
    <div className="flex min-h-screen">
      <SideRail />
      <main className="relative flex min-w-0 flex-1 flex-col gap-4 px-4 pb-12 pt-20 sm:px-6 lg:gap-5 lg:px-8 lg:pb-8 lg:pt-12">

        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-between gap-4 lg:absolute lg:inset-x-8 lg:top-2 lg:z-10"
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-flag-red">//</span>
            <h1 className="text-sm font-semibold tracking-tight text-ink">GitHub</h1>
            {state.phase === "ready" && (
              <span className="text-[11px] text-muted">@{state.data.gh_user.login}</span>
            )}
          </div>
          {state.phase === "ready" && (
            <a
              href={state.data.gh_user.html_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-card/60 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-flag-red/40 hover:text-ink"
            >
              <GithubIcon size={13} /> View on GitHub <ExternalLinkIcon size={11} />
            </a>
          )}
        </motion.header>

        <AnimatePresence mode="wait">
          {state.phase === "disconnected" ? (
            <motion.div
              key="connect"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex min-w-0 flex-1"
            >
              <ConnectCard on_connect={handle_connect} connecting={connecting} />
            </motion.div>
          ) : state.phase === "error" ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="surface min-w-0 rounded-2xl px-6 py-12 text-center"
            >
              <p className="text-sm text-flag-red">{state.message}</p>
              <button
                onClick={() => set_state({ phase: "idle" })}
                className="mt-4 text-xs text-muted underline"
              >
                Retry
              </button>
            </motion.div>
          ) : is_loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-w-0">
              <Skeleton />
            </motion.div>
          ) : state.phase === "ready" ? (
            <motion.div
              key="ready"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="min-w-0 space-y-5"
            >
              <TabNav tab={tab} set_tab={set_tab} repos={state.data.repos} />

              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="min-w-0"
                >
                  {tab === "overview"  && <OverviewTab  data={state.data} />}
                  {tab === "repos"     && <ReposTab     repos={state.data.repos} />}
                  {tab === "languages" && <LanguagesTab languages={state.data.languages} />}
                  {tab === "activity"  && <ActivityTab  data={state.data} />}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          ) : null}
        </AnimatePresence>

      </main>
    </div>
  )
}

export default Git
