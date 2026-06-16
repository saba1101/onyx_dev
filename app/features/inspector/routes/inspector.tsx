import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SideRail } from "~/components/ui/side-rail";
import { use_notify } from "~/hooks/use-notify";
import { supabase } from "~/lib/supabase";
import {
  GlobeIcon,
  SearchIcon,
  ShieldIcon,
  CodeIcon,
  TwitterIcon,
  FileTextIcon,
  ExternalLinkIcon,
  GithubIcon,
  LinkedinIcon,
} from "~/components/ui/icons";

export const meta = () => [{ title: "Scanner — Onyx Dev" }];

const ease_out = [0.22, 1, 0.36, 1] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

type ParseResult = {
  url: string;
  final_url: string;
  status: number;
  time_ms: number;
  size_bytes: number;
  redirected: boolean;
  title: string | null;
  description: string | null;
  keywords: string | null;
  author: string | null;
  lang: string | null;
  charset: string | null;
  favicon: string | null;
  canonical: string | null;
  robots: string | null;
  viewport: string | null;
  theme_color: string | null;
  generator: string | null;
  mobile_friendly: boolean;
  has_rss: boolean;
  rss_url: string | null;
  has_amp: boolean;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  og_type: string | null;
  og_site_name: string | null;
  tw_card: string | null;
  tw_title: string | null;
  tw_description: string | null;
  tw_image: string | null;
  server: string | null;
  powered_by: string | null;
  content_type: string | null;
  https: boolean;
  hsts: boolean;
  x_frame: string | null;
  csp: boolean;
  h1_count: number;
  h2_count: number;
  h3_count: number;
  link_count: number;
  img_count: number;
  script_count: number;
  word_count: number;
  h1_text: string | null;
  jsonld_type: string | null;
  social_links: Record<string, string>;
  techs: string[];
  category: string;
};

// ── Scan messages ─────────────────────────────────────────────────────────────

const SCAN_MSGS = [
  "Connecting to server...",
  "Fetching page content...",
  "Parsing HTML structure...",
  "Analyzing metadata & social tags...",
  "Detecting technologies...",
  "Running security checks...",
  "Building your report...",
];

// ── Tech category colours ─────────────────────────────────────────────────────

const TECH_CAT: Record<string, string> = {
  "Next.js": "fw",
  "Nuxt.js": "fw",
  Gatsby: "fw",
  Astro: "fw",
  Remix: "fw",
  SvelteKit: "fw",
  React: "fw",
  "Vue.js": "fw",
  Angular: "fw",
  Svelte: "fw",
  WordPress: "cms",
  WooCommerce: "cms",
  Shopify: "cms",
  Wix: "cms",
  Squarespace: "cms",
  Webflow: "cms",
  Ghost: "cms",
  Drupal: "cms",
  Joomla: "cms",
  Magento: "cms",
  PHP: "be",
  "ASP.NET": "be",
  Express: "be",
  Django: "be",
  Laravel: "be",
  "Ruby on Rails": "be",
  Nginx: "infra",
  Apache: "infra",
  Cloudflare: "infra",
  Vercel: "infra",
  AWS: "infra",
  Akamai: "infra",
  Fastly: "infra",
  Bootstrap: "ui",
  "Tailwind CSS": "ui",
  jQuery: "ui",
  "Google Tag Manager": "analytics",
  "Google Analytics": "analytics",
  HubSpot: "analytics",
  "Google Fonts": "other",
  Intercom: "other",
  Stripe: "other",
  reCAPTCHA: "other",
  Cloudinary: "other",
};
const TECH_CLS: Record<string, string> = {
  fw: "bg-blue-400/10   text-blue-400   border-blue-400/20",
  cms: "bg-purple-400/10 text-purple-400 border-purple-400/20",
  be: "bg-flag-red/10   text-flag-red   border-flag-red/20",
  infra: "bg-orange-400/10 text-orange-400 border-orange-400/20",
  ui: "bg-light-green/10 text-light-green border-light-green/20",
  analytics: "bg-royal-gold/10 text-royal-gold border-royal-gold/20",
  other: "bg-line/40       text-muted      border-line",
};

// ── Primitives ────────────────────────────────────────────────────────────────

type Tone = "good" | "warn" | "bad" | "neutral";
const TONE_CLS: Record<Tone, string> = {
  good: "bg-light-green/10 text-light-green border-light-green/20",
  warn: "bg-royal-gold/10  text-royal-gold  border-royal-gold/20",
  bad: "bg-flag-red/10    text-flag-red    border-flag-red/20",
  neutral: "bg-line/40        text-muted       border-line",
};

const Badge = ({ label, tone = "neutral" }: { label: string; tone?: Tone }) => (
  <span
    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TONE_CLS[tone]}`}
  >
    {label}
  </span>
);

const Check = ({ ok, label }: { ok: boolean; label: string }) => (
  <div className="flex items-start gap-2">
    <span
      className={`mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold
      ${ok ? "bg-light-green/15 text-light-green" : "bg-flag-red/15 text-flag-red"}`}
    >
      {ok ? "✓" : "✗"}
    </span>
    <span
      className={`text-xs leading-relaxed ${ok ? "text-ink" : "text-muted/60"}`}
    >
      {label}
    </span>
  </div>
);

const ScoreBar = ({
  score,
  max,
  tone,
}: {
  score: number;
  max: number;
  tone: Tone;
}) => {
  const bar: Record<Tone, string> = {
    good: "bg-light-green",
    warn: "bg-royal-gold",
    bad: "bg-flag-red",
    neutral: "bg-muted/40",
  };
  return (
    <div className="h-1.5 w-full rounded-full bg-line/40">
      <div
        className={`h-1.5 rounded-full transition-all duration-700 ${bar[tone]}`}
        style={{ width: `${(score / max) * 100}%` }}
      />
    </div>
  );
};

const Card = ({
  title,
  icon,
  children,
  className = "",
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`surface flex flex-col gap-3 rounded-2xl p-4 ${className}`}>
    <div className="flex items-center gap-2">
      <span className="text-flag-red">{icon}</span>
      <span className="text-[9px] font-bold uppercase tracking-widest text-muted/50">
        {title}
      </span>
    </div>
    {children}
  </div>
);

const StatCell = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => (
  <div className="rounded-xl bg-line/20 px-3 py-2.5">
    <p className="text-[9px] font-bold uppercase tracking-wider text-muted/50">
      {label}
    </p>
    <p className="mt-0.5 text-lg font-bold text-ink tabular-nums">{value}</p>
  </div>
);

const Row = ({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) =>
  value ? (
    <div className="flex items-baseline gap-3">
      <span className="w-24 shrink-0 text-[9px] font-bold uppercase tracking-wider text-muted/40">
        {label}
      </span>
      <span className="min-w-0 truncate text-xs text-ink">{value}</span>
    </div>
  ) : null;

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InspectorPage() {
  const notify = use_notify();
  const [url, set_url] = useState("");
  const [loading, set_loading] = useState(false);
  const [msg_idx, set_msg_idx] = useState(0);
  const [result, set_result] = useState<ParseResult | null>(null);
  const [err_msg, set_err_msg] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(
      () => set_msg_idx((i) => Math.min(i + 1, SCAN_MSGS.length - 1)),
      1600,
    );
    return () => clearInterval(t);
  }, [loading]);

  const inspect = async () => {
    const target = url.trim();
    if (!target) return;
    set_loading(true);
    set_err_msg(null);
    set_result(null);
    set_msg_idx(0);
    const { data, error } = await supabase.functions.invoke("parse-website", {
      body: { url: target },
    });
    set_loading(false);
    if (error || data?.error) {
      const msg = data?.error ?? error?.message ?? "Failed to parse";
      set_err_msg(msg);
      notify({ tone: "error", title: "Inspection failed", message: msg });
      return;
    }
    set_result(data as ParseResult);
  };

  // ── Scores ───────────────────────────────────────────────────────────────

  const seo_checks = result
    ? [
        !!result.title,
        !!result.description,
        !!result.canonical,
        !result.robots?.toLowerCase().includes("noindex"),
        !!result.og_title,
        !!result.og_image,
        !!result.tw_card,
        result.h1_count >= 1,
        !!result.lang,
        !!result.mobile_friendly,
      ]
    : [];
  const seo_score = seo_checks.filter(Boolean).length;

  const sec_checks = result
    ? [result.https, result.hsts, !!result.x_frame, result.csp]
    : [];
  const sec_score = sec_checks.filter(Boolean).length;

  const score_tone = (s: number, max: number): Tone =>
    s / max >= 0.8 ? "good" : s / max >= 0.5 ? "warn" : "bad";
  const status_tone = (s: number): Tone =>
    s < 300 ? "good" : s < 400 ? "warn" : "bad";
  const time_tone = (ms: number): Tone =>
    ms < 800 ? "good" : ms < 2500 ? "warn" : "bad";

  const resolve_favicon = (r: ParseResult) => {
    if (!r.favicon) return null;
    if (/^https?:\/\//i.test(r.favicon)) return r.favicon;
    if (r.favicon.startsWith("//")) return "https:" + r.favicon;
    try {
      const b = new URL(r.final_url);
      return b.origin + (r.favicon.startsWith("/") ? "" : "/") + r.favicon;
    } catch {
      return null;
    }
  };

  const fmt_size = (b: number) =>
    b > 1_000_000
      ? `${(b / 1_000_000).toFixed(1)} MB`
      : `${(b / 1_000).toFixed(0)} KB`;

  const recommendations = result
    ? ([
        !result.description &&
          "Add a meta description — improves click-through rates in search results",
        !result.og_image &&
          "Set og:image — enables rich previews when shared on social media",
        !result.canonical &&
          "Add a canonical URL — prevents duplicate content penalties",
        !result.hsts &&
          result.https &&
          "Enable HSTS — enforces HTTPS at the browser level",
        !result.csp &&
          "Add a Content-Security-Policy header — mitigates XSS attacks",
        !result.mobile_friendly &&
          "Set a responsive viewport meta tag — required for mobile-friendly ranking",
        result.h1_count === 0 &&
          "Add an H1 tag — every page should have exactly one primary heading",
        result.h1_count > 1 &&
          `Multiple H1 tags detected (${result.h1_count}) — use only one per page`,
        !result.lang &&
          'Declare the language on <html lang="…"> — helps search engines and screen readers',
        result.robots?.toLowerCase().includes("noindex") &&
          "Page is marked noindex — it will not appear in search results",
      ].filter(Boolean) as string[])
    : [];

  const keywords_list = result?.keywords
    ? result.keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, 20)
    : [];

  const social_entries = result ? Object.entries(result.social_links) : [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden">
      <SideRail />
      <main className="flex flex-1 flex-col overflow-hidden pt-14 lg:pt-0 min-h-0">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: ease_out }}
          className="flex shrink-0 items-center gap-3 border-b border-line bg-card/50 px-4 py-3 backdrop-blur-xl lg:px-6 lg:py-4"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-flag-red/10 text-flag-red">
            <GlobeIcon size={15} />
          </span>
          <div>
            <h1 className="text-sm font-bold text-ink">Scanner</h1>
            <p className="text-[10px] text-muted">
              Parse any URL and visualize its data
            </p>
          </div>
        </motion.div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 py-6 lg:px-6">
            {/* URL input */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: ease_out }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted/50">
                  <LinkIcon />
                </span>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => set_url(e.target.value)}
                  spellCheck={false}
                  onKeyDown={(e) => e.key === "Enter" && !loading && inspect()}
                  placeholder="https://example.com"
                  className="w-full rounded-xl border border-line bg-card py-3 pl-10 pr-4 text-sm text-ink outline-none transition-colors placeholder:text-muted/40 focus:border-flag-red/60"
                />
              </div>
              <button
                type="button"
                onClick={inspect}
                disabled={loading || !url.trim()}
                className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-flag-red px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <SearchIcon size={14} />
                )}
                {loading ? "Parsing…" : "Inspect"}
              </button>
            </motion.div>

            {/* Loading */}
            <AnimatePresence>
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="mt-20 flex flex-col items-center gap-6 text-center"
                >
                  <div className="relative h-20 w-20">
                    <div className="absolute inset-0 rounded-full border-2 border-line/30" />
                    <div
                      className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-flag-red"
                      style={{ animationDuration: "0.9s" }}
                    />
                    <div
                      className="absolute inset-3 animate-spin rounded-full border border-transparent border-t-flag-red/40"
                      style={{
                        animationDuration: "1.4s",
                        animationDirection: "reverse",
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-flag-red/60">
                      <GlobeIcon size={18} />
                    </div>
                  </div>
                  <div>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={msg_idx}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.18 }}
                        className="text-sm font-semibold text-ink"
                      >
                        {SCAN_MSGS[msg_idx]}
                      </motion.p>
                    </AnimatePresence>
                    <p className="mt-1 max-w-xs truncate text-xs text-muted/50">
                      {url}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <motion.span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-flag-red/40"
                        animate={{ opacity: [0.2, 1, 0.2] }}
                        transition={{
                          duration: 1.2,
                          repeat: Infinity,
                          delay: i * 0.18,
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            <AnimatePresence>
              {err_msg && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-8 rounded-2xl border border-flag-red/20 bg-flag-red/5 p-5"
                >
                  <p className="text-sm font-semibold text-flag-red">
                    Inspection failed
                  </p>
                  <p className="mt-1 text-xs text-muted">{err_msg}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Empty state */}
            {!loading && !result && !err_msg && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="mt-20 flex flex-col items-center gap-3 text-center"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-line/30 text-muted/50">
                  <GlobeIcon size={26} />
                </div>
                <p className="text-sm font-medium text-muted">
                  Paste any URL above and click Inspect
                </p>
                <p className="text-xs text-muted/40">
                  SEO · OG · Security · Tech stack · Content · Social links
                </p>
              </motion.div>
            )}

            {/* Results */}
            <AnimatePresence>
              {result && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: ease_out }}
                  className="mt-6 flex flex-col gap-4"
                >
                  {/* ── Overview ── */}
                  <div className="surface rounded-2xl p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-line/30 text-muted/40">
                        {resolve_favicon(result) ? (
                          <img
                            src={resolve_favicon(result)!}
                            alt=""
                            className="h-8 w-8 object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        ) : (
                          <GlobeIcon size={20} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-base font-bold text-ink">
                            {result.title ??
                              (() => {
                                try {
                                  return new URL(result.final_url).hostname;
                                } catch {
                                  return result.final_url;
                                }
                              })()}
                          </h2>
                          <Badge label={result.category} tone="neutral" />
                          {result.jsonld_type && (
                            <Badge label={result.jsonld_type} tone="neutral" />
                          )}
                        </div>
                        {result.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted">
                            {result.description}
                          </p>
                        )}
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <a
                            href={result.final_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] text-muted/60 hover:text-flag-red transition-colors truncate max-w-[260px]"
                          >
                            <ExternalLinkIcon size={10} />
                            {result.final_url}
                          </a>
                          <Badge
                            label={`${result.status}`}
                            tone={status_tone(result.status)}
                          />
                          <Badge
                            label={`${result.time_ms}ms`}
                            tone={time_tone(result.time_ms)}
                          />
                          <Badge
                            label={fmt_size(result.size_bytes)}
                            tone="neutral"
                          />
                          {result.lang && (
                            <Badge
                              label={result.lang.toUpperCase()}
                              tone="neutral"
                            />
                          )}
                          {result.mobile_friendly && (
                            <Badge label="Mobile-friendly" tone="good" />
                          )}
                          {result.redirected && (
                            <Badge label="Redirected" tone="warn" />
                          )}
                          {result.has_amp && (
                            <Badge label="AMP" tone="neutral" />
                          )}
                          {result.has_rss && (
                            <Badge label="RSS" tone="neutral" />
                          )}
                          {result.theme_color && (
                            <span className="flex items-center gap-1 rounded-full border border-line bg-line/40 px-2 py-0.5 text-[10px] font-semibold text-muted">
                              <span
                                className="h-2.5 w-2.5 rounded-full border border-white/20"
                                style={{ background: result.theme_color }}
                              />
                              {result.theme_color}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Scores grid ── */}
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {/* SEO */}
                    <Card title="SEO" icon={<SearchIcon size={13} />}>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-ink">
                          {seo_score}
                        </span>
                        <span className="text-sm text-muted">/ 10</span>
                        <div className="ml-auto">
                          <Badge
                            label={
                              seo_score >= 8
                                ? "Good"
                                : seo_score >= 5
                                  ? "Fair"
                                  : "Poor"
                            }
                            tone={score_tone(seo_score, 10)}
                          />
                        </div>
                      </div>
                      <ScoreBar
                        score={seo_score}
                        max={10}
                        tone={score_tone(seo_score, 10)}
                      />
                      <div className="flex flex-col gap-1.5 pt-1">
                        <Check ok={!!result.title} label="Title tag" />
                        <Check
                          ok={!!result.description}
                          label="Meta description"
                        />
                        <Check ok={!!result.canonical} label="Canonical URL" />
                        <Check ok={!!result.lang} label="Language declared" />
                        <Check
                          ok={result.h1_count === 1}
                          label="Single H1 tag"
                        />
                        <Check
                          ok={result.mobile_friendly}
                          label="Viewport / mobile"
                        />
                        <Check
                          ok={!result.robots?.toLowerCase().includes("noindex")}
                          label="Not noindexed"
                        />
                      </div>
                    </Card>

                    {/* Security */}
                    <Card title="Security" icon={<ShieldIcon size={13} />}>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-ink">
                          {sec_score}
                        </span>
                        <span className="text-sm text-muted">/ 4</span>
                        <div className="ml-auto">
                          <Badge
                            label={
                              sec_score === 4
                                ? "Secure"
                                : sec_score >= 2
                                  ? "Partial"
                                  : "Weak"
                            }
                            tone={score_tone(sec_score, 4)}
                          />
                        </div>
                      </div>
                      <ScoreBar
                        score={sec_score}
                        max={4}
                        tone={score_tone(sec_score, 4)}
                      />
                      <div className="flex flex-col gap-1.5 pt-1">
                        <Check ok={result.https} label="HTTPS" />
                        <Check ok={result.hsts} label="HSTS header" />
                        <Check ok={!!result.x_frame} label="X-Frame-Options" />
                        <Check
                          ok={result.csp}
                          label="Content-Security-Policy"
                        />
                      </div>
                      {result.x_frame && (
                        <p className="text-[10px] text-muted">
                          X-Frame:{" "}
                          <span className="text-ink">{result.x_frame}</span>
                        </p>
                      )}
                    </Card>

                    {/* Open Graph — rendered as social card preview */}
                    <Card
                      title="Open Graph"
                      icon={<ShareIcon />}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col gap-1.5">
                        <Check ok={!!result.og_title} label="og:title" />
                        <Check
                          ok={!!result.og_description}
                          label="og:description"
                        />
                        <Check ok={!!result.og_image} label="og:image" />
                        <Check ok={!!result.og_type} label="og:type" />
                        <Check
                          ok={!!result.og_site_name}
                          label="og:site_name"
                        />
                      </div>
                      {(result.og_image || result.og_title) && (
                        <div className="overflow-hidden rounded-xl border border-line/50 bg-card">
                          {result.og_image && (
                            <img
                              src={result.og_image}
                              alt=""
                              className="h-28 w-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          )}
                          <div className="px-3 py-2">
                            {result.og_site_name && (
                              <p className="text-[9px] uppercase tracking-widest text-muted/50">
                                {result.og_site_name}
                              </p>
                            )}
                            {result.og_title && (
                              <p className="truncate text-xs font-semibold text-ink">
                                {result.og_title}
                              </p>
                            )}
                            {result.og_description && (
                              <p className="mt-0.5 line-clamp-2 text-[10px] text-muted">
                                {result.og_description}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </Card>

                    {/* Content */}
                    <Card title="Content" icon={<FileTextIcon size={13} />}>
                      {result.h1_text && (
                        <div className="rounded-lg border border-line/40 bg-line/10 px-3 py-2">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-muted/40">
                            H1
                          </p>
                          <p className="mt-0.5 text-xs font-medium text-ink line-clamp-2">
                            {result.h1_text}
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <StatCell
                          label="Words"
                          value={result.word_count.toLocaleString()}
                        />
                        <StatCell label="Links" value={result.link_count} />
                        <StatCell label="Images" value={result.img_count} />
                        <StatCell label="Scripts" value={result.script_count} />
                        <StatCell label="H1" value={result.h1_count} />
                        <StatCell label="H2" value={result.h2_count} />
                        <StatCell label="H3" value={result.h3_count} />
                      </div>
                    </Card>
                  </div>

                  {/* ── Tech + Server ── */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Card
                      title="Technologies Detected"
                      icon={<CodeIcon size={13} />}
                    >
                      {result.techs.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {result.techs.map((t) => (
                            <span
                              key={t}
                              className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${TECH_CLS[TECH_CAT[t] ?? "other"]}`}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted">
                          No technologies detected
                        </p>
                      )}
                      {result.techs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 border-t border-line/30 pt-2">
                          {(
                            [
                              "fw",
                              "cms",
                              "be",
                              "infra",
                              "ui",
                              "analytics",
                              "other",
                            ] as const
                          )
                            .filter((cat) =>
                              result.techs.some(
                                (t) => (TECH_CAT[t] ?? "other") === cat,
                              ),
                            )
                            .map((cat) => {
                              const labels: Record<string, string> = {
                                fw: "Framework",
                                cms: "CMS",
                                be: "Backend",
                                infra: "Infra / CDN",
                                ui: "UI / CSS",
                                analytics: "Analytics",
                                other: "Other",
                              };
                              return (
                                <span
                                  key={cat}
                                  className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${TECH_CLS[cat]}`}
                                >
                                  {labels[cat]}
                                </span>
                              );
                            })}
                        </div>
                      )}
                    </Card>

                    <Card title="Server & Meta" icon={<ServerIcon />}>
                      <div className="flex flex-col gap-2">
                        <Row label="Server" value={result.server} />
                        <Row label="Powered by" value={result.powered_by} />
                        <Row
                          label="Content-Type"
                          value={result.content_type?.split(";")[0]}
                        />
                        <Row label="Generator" value={result.generator} />
                        <Row label="Author" value={result.author} />
                        <Row label="Robots" value={result.robots} />
                        <Row label="Charset" value={result.charset} />
                        <Row label="Viewport" value={result.viewport} />
                        <Row label="JSON-LD type" value={result.jsonld_type} />
                      </div>
                    </Card>
                  </div>

                  {/* ── Keywords ── */}
                  {keywords_list.length > 0 && (
                    <Card title="Keywords" icon={<TagIcon />}>
                      <div className="flex flex-wrap gap-1.5">
                        {keywords_list.map((kw) => (
                          <span
                            key={kw}
                            className="rounded-lg border border-line bg-line/20 px-2.5 py-1 text-xs text-ink"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* ── Social links ── */}
                  {social_entries.length > 0 && (
                    <Card title="Social Profiles Detected" icon={<ShareIcon />}>
                      <div className="flex flex-wrap gap-2">
                        {social_entries.map(([name, href]) => (
                          <a
                            key={name}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-xl border border-line bg-line/20 px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-flag-red/30 hover:text-flag-red"
                          >
                            <span className="text-muted">
                              {SOCIAL_ICON[name] ?? <GlobeIcon size={13} />}
                            </span>
                            <span className="capitalize">{name}</span>
                            <ExternalLinkIcon
                              size={10}
                              className="text-muted/40"
                            />
                          </a>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* ── Twitter card ── */}
                  {(result.tw_card || result.tw_title) && (
                    <Card
                      title="Twitter / X Card"
                      icon={<TwitterIcon size={13} />}
                    >
                      <div className="flex flex-col gap-1.5 sm:flex-row sm:gap-8">
                        <div className="flex flex-col gap-1.5">
                          <Check
                            ok={!!result.tw_card}
                            label={`Card type: ${result.tw_card ?? "not set"}`}
                          />
                          <Check ok={!!result.tw_title} label="twitter:title" />
                          <Check
                            ok={!!result.tw_description}
                            label="twitter:description"
                          />
                          <Check ok={!!result.tw_image} label="twitter:image" />
                        </div>
                        {result.tw_image && (
                          <div className="overflow-hidden rounded-xl border border-line/40 sm:w-48">
                            <img
                              src={result.tw_image}
                              alt=""
                              className="h-24 w-full object-cover"
                              onError={(e) => {
                                (
                                  e.target as HTMLImageElement
                                ).parentElement!.style.display = "none";
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </Card>
                  )}

                  {/* ── Recommendations ── */}
                  {recommendations.length > 0 && (
                    <Card title="Quick Wins" icon={<LightbulbIcon />}>
                      <div className="flex flex-col gap-2">
                        {recommendations.map((rec, i) => (
                          <div key={i} className="flex items-start gap-2.5">
                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-royal-gold/15 text-[9px] font-bold text-royal-gold">
                              !
                            </span>
                            <p className="text-xs text-muted">{rec}</p>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Inline icons ──────────────────────────────────────────────────────────────

const ip = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const LinkIcon = () => (
  <svg {...ip}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const ShareIcon = () => (
  <svg {...ip}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
  </svg>
);

const ServerIcon = () => (
  <svg {...ip}>
    <rect x="2" y="3" width="20" height="6" rx="1.5" />
    <rect x="2" y="12" width="20" height="6" rx="1.5" />
    <circle cx="6.5" cy="6" r="1" fill="currentColor" stroke="none" />
    <circle cx="6.5" cy="15" r="1" fill="currentColor" stroke="none" />
    <line x1="10" y1="6" x2="14" y2="6" />
    <line x1="10" y1="15" x2="14" y2="15" />
  </svg>
);

const TagIcon = () => (
  <svg {...ip}>
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const LightbulbIcon = () => (
  <svg {...ip}>
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
    <path d="M9 18h6M10 22h4" />
  </svg>
);

const InstagramIcon = () => (
  <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
  </svg>
);

const FacebookIcon = () => (
  <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const YoutubeIcon = () => (
  <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
  </svg>
);

// ── Social icon map ───────────────────────────────────────────────────────────

const SOCIAL_ICON: Record<string, React.ReactNode> = {
  twitter: <TwitterIcon size={13} />,
  github: <GithubIcon size={13} />,
  linkedin: <LinkedinIcon size={13} />,
  instagram: <InstagramIcon />,
  facebook: <FacebookIcon />,
  youtube: <YoutubeIcon />,
};
