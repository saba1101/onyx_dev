import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { useAuth } from "~/features/auth/lib/auth";
import { SideRail } from "~/components/ui/side-rail";
import { use_notify } from "~/hooks/use-notify";
import { SearchInput } from "~/components/ui/search-input";
import { Dropdown } from "~/components/ui/dropdown";
import { Modal } from "~/components/ui/modal";
import { Table, type TableColumn } from "~/components/ui/table";
import { ConfirmPopover } from "~/components/ui/confirm-popover";
import { supabase } from "~/lib/supabase";
import { ClientModal } from "~/features/clients/components/client-modal";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  BriefcaseIcon,
  ChevronIcon,
  LinkIcon,
  XIcon,
  ExternalLinkIcon,
  MailIcon,
  PhoneIcon,
  GlobeIcon,
  MapPinIcon,
  AtSignIcon,
  ClockIcon,
  CalendarIcon,
  TrendingUpIcon,
} from "~/components/ui/icons";
import {
  api,
  STATUS_ORDER,
  STATUS_META,
  fmt_money,
  fmt_date,
  fmt_last_contact,
  is_stale,
  is_follow_up_due,
  type Client,
  type ClientStatus,
} from "~/features/clients/lib/clients";
import {
  api as workspace_api,
  type WProject,
} from "~/features/workspace/lib/workspace";
import { cache_get, cache_set } from "~/lib/query-cache";

const CACHE_CLIENTS = "clients:list";
const CACHE_PROJECTS = "workspace:projects";

type SortKey = "company" | "status" | "amount" | "last_contact" | null;

export const meta = () => [{ title: "Clients — Onyx Dev" }];

const ease_out = [0.22, 1, 0.36, 1] as const;

const initials = (name: string) => name.trim().slice(0, 2).toUpperCase() || "?";

const norm_url = (raw: string) =>
  /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

// ── Table columns ────────────────────────────────────────────────────────────

const SortHeader = ({
  label,
  active,
  dir,
  on_click,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  on_click: () => void;
}) => (
  <button
    type="button"
    onClick={on_click}
    className={`inline-flex cursor-pointer items-center gap-1 transition-colors hover:text-ink ${active ? "text-ink" : ""}`}
  >
    {label}
    <ChevronIcon
      size={10}
      className={`transition-transform ${active ? (dir === "asc" ? "rotate-180" : "") : "opacity-30"}`}
    />
  </button>
);

const build_client_columns = (opts: {
  sort_key: SortKey;
  sort_dir: "asc" | "desc";
  on_sort: (key: SortKey) => void;
  on_status_change: (id: string, status: ClientStatus) => void;
  on_edit: (c: Client) => void;
  deleting_id: string | null;
  on_confirm_delete: (id: string) => void;
  projects: WProject[];
  on_open_project: (project_id: string) => void;
}): TableColumn<Client>[] => {
  const {
    sort_key,
    sort_dir,
    on_sort,
    on_status_change,
    on_edit,
    deleting_id,
    on_confirm_delete,
    projects,
    on_open_project,
  } = opts;
  const sort_header = (key: SortKey, label: string) => (
    <SortHeader
      label={label}
      active={sort_key === key}
      dir={sort_dir}
      on_click={() => on_sort(key)}
    />
  );
  const linked_projects = (c: Client) =>
    projects.filter((p) => p.client_id === c.id);

  return [
    {
      key: "company",
      header: sort_header("company", "Company"),
      cell: (c) => {
        const linked = linked_projects(c);
        return (
          <div className="flex items-center gap-3">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${STATUS_META[c.status].badge}`}
            >
              {initials(c.company_name)}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-medium text-ink">
                  {c.company_name}
                </p>
                {linked.length > 0 && (
                  <span
                    title={`Linked to ${linked.map((p) => p.name).join(", ")}`}
                    className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-flag-red/10 text-flag-red"
                  >
                    <LinkIcon size={9} />
                  </span>
                )}
              </div>
              <p className="truncate text-[10px] text-muted">
                {c.contact_name || "No contact name"}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: "status",
      header: sort_header("status", "Status"),
      className: "hidden sm:table-cell",
      cell: (c) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Dropdown
            value={c.status}
            options={STATUS_ORDER.map((s) => ({
              value: s,
              label: STATUS_META[s].label,
              dot: STATUS_META[s].dot,
            }))}
            on_select={(v) => on_status_change(c.id, v as ClientStatus)}
            menu_width="w-40"
            trigger_class={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-opacity hover:opacity-75 ${STATUS_META[c.status].badge}`}
          >
            {() => (
              <>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${STATUS_META[c.status].dot}`}
                />
                {STATUS_META[c.status].label}
                <ChevronIcon size={9} />
              </>
            )}
          </Dropdown>
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      className: "hidden md:table-cell",
      cell: (c) =>
        c.email ? (
          <a
            href={`mailto:${c.email}`}
            onClick={(e) => e.stopPropagation()}
            className="block max-w-[180px] truncate text-xs text-ink transition-colors hover:text-flag-red hover:underline"
          >
            {c.email}
          </a>
        ) : (
          <span className="text-xs text-muted/40">—</span>
        ),
    },
    {
      key: "phone",
      header: "Phone",
      className: "hidden lg:table-cell",
      cell: (c) =>
        c.phone ? (
          <a
            href={`tel:${c.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-ink transition-colors hover:text-flag-red hover:underline"
          >
            {c.phone}
          </a>
        ) : (
          <span className="text-xs text-muted/40">—</span>
        ),
    },
    {
      key: "service",
      header: "Service",
      className: "hidden text-xs text-muted xl:table-cell",
      cell: (c) =>
        c.service_offered || <span className="text-muted/40">—</span>,
    },
    {
      key: "project",
      header: "Project",
      className: "hidden xl:table-cell",
      cell: (c) => {
        const linked = linked_projects(c);
        if (linked.length === 0)
          return <span className="text-xs text-muted/40">—</span>;
        return (
          <div className="flex flex-wrap items-center gap-1">
            {linked.slice(0, 2).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  on_open_project(p.id);
                }}
                title="Open in workspace"
                className="inline-flex max-w-[120px] cursor-pointer items-center gap-1 rounded-full bg-flag-red/10 px-2 py-0.5 text-[10px] font-medium text-flag-red transition-opacity hover:opacity-75"
              >
                <BriefcaseIcon size={9} className="shrink-0" />
                <span className="truncate">{p.name}</span>
              </button>
            ))}
            {linked.length > 2 && (
              <span className="text-[10px] text-muted">
                +{linked.length - 2}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "amount",
      header: sort_header("amount", "Amount"),
      align: "right",
      className: "hidden sm:table-cell",
      cell: (c) =>
        c.payment_amount != null ? (
          <span
            className={`text-sm font-semibold tabular-nums ${c.status === "won" ? "text-light-green" : c.status === "lost" ? "text-loss" : "text-ink"}`}
          >
            {fmt_money(c.payment_amount)}
          </span>
        ) : (
          <span className="text-xs text-muted/40">—</span>
        ),
    },
    {
      key: "timeline",
      header: sort_header("last_contact", "Timeline"),
      className: "hidden lg:table-cell",
      cell: (c) => (
        <div className="space-y-0.5">
          <p
            className={`text-xs ${is_stale(c) ? "font-semibold text-orange-400" : "text-muted"}`}
          >
            {fmt_last_contact(c.last_contact_at)}
          </p>
          {c.follow_up_at && (
            <p
              className={`text-[10px] ${is_follow_up_due(c) ? "font-semibold text-royal-gold" : "text-muted/60"}`}
            >
              Follow up {fmt_date(c.follow_up_at)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "w-16",
      cell: (c) => (
        <div className="flex items-center justify-end gap-0.5 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              on_edit(c);
            }}
            title="Edit client"
            className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-muted transition-colors hover:bg-line/50 hover:text-ink"
          >
            <PencilIcon size={12} />
          </button>
          <ConfirmPopover
            message={`Delete "${c.company_name}"? This removes the record and conversation.`}
            busy={deleting_id === c.id}
            on_confirm={() => on_confirm_delete(c.id)}
            trigger={({ onClick }) => (
              <button
                type="button"
                onClick={onClick}
                title="Delete client"
                className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-loss/60 transition-colors hover:bg-loss/10 hover:text-loss"
              >
                <TrashIcon size={12} />
              </button>
            )}
          />
        </div>
      ),
    },
  ];
};

// ── Detail modal ───────────────────────────────────────────────────────────────

const InfoRow = ({
  icon,
  label,
  value,
  href,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  href?: string;
  sub?: string | null;
}) => (
  <div className="flex items-center gap-2.5 rounded-lg border border-line/40 bg-page/40 px-3 py-2">
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-line/30 text-muted">
      {icon}
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-[9.5px] uppercase tracking-wide text-muted">{label}</p>
      {value ? (
        href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-xs text-ink hover:text-flag-red hover:underline"
          >
            {value}
          </a>
        ) : (
          <p className="truncate text-xs text-ink">{value}</p>
        )
      ) : (
        <p className="truncate text-xs text-muted/40">Not set</p>
      )}
      {sub && <p className="mt-0.5 truncate text-[10.5px] text-muted">{sub}</p>}
    </div>
  </div>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-2 text-[9.5px] font-semibold uppercase tracking-widest text-muted">
    {children}
  </p>
);

const VitalCard = ({
  icon,
  label,
  value,
  warn,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  warn?: boolean;
}) => (
  <div className="surface flex items-center gap-2.5 rounded-xl p-3">
    <span
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${warn ? "bg-orange-400/10 text-orange-400" : "bg-line/40 text-muted"}`}
    >
      {icon}
    </span>
    <div className="min-w-0">
      <p className="text-[9px] uppercase tracking-wide text-muted">{label}</p>
      <p
        className={`truncate text-xs font-semibold ${warn ? "text-orange-400" : "text-ink"}`}
      >
        {value}
      </p>
    </div>
  </div>
);

const DetailModal = ({
  client,
  projects,
  on_close,
  on_edit,
  on_status_change,
  on_link_project,
  on_unlink_project,
  on_open_project,
}: {
  client: Client | null;
  projects: WProject[];
  on_close: () => void;
  on_edit: () => void;
  on_status_change: (id: string, status: ClientStatus) => void;
  on_link_project: (project_id: string) => void;
  on_unlink_project: (project_id: string) => void;
  on_open_project: (project_id: string) => void;
}) => {
  if (!client) return null;
  const meta = STATUS_META[client.status];
  const stale = is_stale(client);
  const follow_up_due = is_follow_up_due(client);
  const linked = projects.filter((p) => p.client_id === client.id);
  const linkable = projects.filter((p) => p.client_id !== client.id);

  return (
    <Modal open={!!client} on_close={on_close} size="2xl">
      {/* Hero */}
      <div
        className={`mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 ${meta.wash}`}
      >
        <div className="flex items-center gap-3.5">
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-bold ${meta.badge}`}
          >
            {initials(client.company_name)}
          </span>
          <div>
            <h3 className="text-base font-bold leading-tight text-ink">
              {client.company_name}
            </h3>
            <p className="text-[11px] text-muted">
              {client.contact_name || "No contact name"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {stale && (
            <span className="rounded-full bg-orange-400/10 px-2 py-0.5 text-[9px] font-semibold uppercase text-orange-400">
              Needs follow-up
            </span>
          )}
          {follow_up_due && (
            <span className="rounded-full bg-royal-gold/10 px-2 py-0.5 text-[9px] font-semibold uppercase text-royal-gold">
              Follow-up due
            </span>
          )}

          <Dropdown
            value={client.status}
            options={STATUS_ORDER.map((s) => ({
              value: s,
              label: STATUS_META[s].label,
              dot: STATUS_META[s].dot,
            }))}
            on_select={(v) => on_status_change(client.id, v as ClientStatus)}
            menu_width="w-40"
            trigger_class={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-opacity hover:opacity-80 ${meta.badge}`}
          >
            {() => (
              <>
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                {meta.label}
                <ChevronIcon size={10} />
              </>
            )}
          </Dropdown>

          <button
            onClick={on_edit}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-card text-muted transition-colors hover:bg-line/40 hover:text-ink"
            title="Edit client"
          >
            <PencilIcon size={13} />
          </button>
        </div>
      </div>

      {/* Vitals */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <VitalCard
          icon={<TrendingUpIcon size={14} />}
          label="Amount"
          value={
            client.payment_amount != null
              ? fmt_money(client.payment_amount)
              : "Not set"
          }
        />
        <VitalCard
          icon={<ClockIcon size={14} />}
          label="Last contact"
          value={fmt_last_contact(client.last_contact_at)}
          warn={stale}
        />
        <VitalCard
          icon={<CalendarIcon size={14} />}
          label="Follow up"
          value={
            client.follow_up_at ? fmt_date(client.follow_up_at) : "Not set"
          }
          warn={follow_up_due}
        />
        <VitalCard
          icon={<BriefcaseIcon size={14} />}
          label="Service"
          value={client.service_offered || "Not set"}
        />
      </div>

      {/* Body */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-1">
          <SectionLabel>Contact & links</SectionLabel>
          <InfoRow
            icon={<MailIcon size={13} />}
            label="Email"
            value={client.email}
            href={client.email ? `mailto:${client.email}` : undefined}
          />
          <InfoRow
            icon={<PhoneIcon size={13} />}
            label="Phone"
            value={client.phone}
            href={client.phone ? `tel:${client.phone}` : undefined}
          />
          <InfoRow
            icon={<GlobeIcon size={13} />}
            label="Website"
            value={client.website}
            href={client.website ? norm_url(client.website) : undefined}
          />
          <InfoRow
            icon={<AtSignIcon size={13} />}
            label="Social"
            value={client.social_url}
            href={client.social_url ? norm_url(client.social_url) : undefined}
          />
          <InfoRow
            icon={<MapPinIcon size={13} />}
            label="Maps"
            value={client.maps_url}
            href={client.maps_url ? norm_url(client.maps_url) : undefined}
            sub={client.address}
          />

          <div className="pt-2">
            <SectionLabel>Linked projects</SectionLabel>
            <div className="space-y-1.5">
              {linked.length === 0 && (
                <p className="rounded-lg border border-line/40 bg-page/40 px-3 py-2 text-[11px] text-muted/60">
                  No project linked yet.
                </p>
              )}
              {linked.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg border border-line/40 bg-page/40 px-3 py-2"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-line/30 text-muted">
                    <BriefcaseIcon size={12} />
                  </span>
                  <button
                    type="button"
                    onClick={() => on_open_project(p.id)}
                    className="min-w-0 flex-1 truncate text-left text-xs text-ink transition-colors hover:text-flag-red hover:underline"
                    title="Open in workspace"
                  >
                    {p.name}
                  </button>
                  <ExternalLinkIcon
                    size={11}
                    className="shrink-0 text-muted/50"
                  />
                  <button
                    type="button"
                    onClick={() => on_unlink_project(p.id)}
                    title="Unlink project"
                    className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-loss/10 hover:text-loss"
                  >
                    <XIcon size={11} />
                  </button>
                </div>
              ))}

              {linkable.length > 0 && (
                <Dropdown
                  value=""
                  options={linkable.map((p) => ({
                    value: p.id,
                    label: p.name,
                  }))}
                  on_select={on_link_project}
                  menu_width="w-56"
                  trigger_class="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2 text-xs text-muted transition-colors hover:border-flag-red/40 hover:text-ink"
                >
                  {() => (
                    <>
                      <LinkIcon size={12} />
                      Link to project
                    </>
                  )}
                </Dropdown>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <SectionLabel>Conversation</SectionLabel>
          <div className="h-[420px] overflow-y-auto whitespace-pre-wrap rounded-xl border border-line/40 bg-page/50 p-4 font-mono text-[12.5px] leading-relaxed text-ink">
            {client.conversation || (
              <span className="italic text-muted/40">
                No conversation saved yet.
              </span>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

// ── Pipeline insight bar ──────────────────────────────────────────────────────
// Compact, data-dense replacement for the old 4-tile stat grid — a slim strip
// of headline numbers plus a per-status breakdown of the whole pipeline, which
// surfaces more information (every stage's count) in far less vertical space.

const MiniStat = ({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "gain";
  hint?: string;
}) => (
  <div className="flex items-baseline gap-1.5" title={hint}>
    <span
      className={`text-base font-bold tabular-nums ${tone === "gain" ? "text-light-green" : "text-ink"}`}
    >
      {value}
    </span>
    <span className="text-[10px] uppercase tracking-wide text-muted">
      {label}
    </span>
  </div>
);

const PipelineBar = ({ clients }: { clients: Client[] }) => {
  const total = clients.length;
  const counts = STATUS_ORDER.map((status) => ({
    status,
    count: clients.filter((c) => c.status === status).length,
  }));

  return (
    <div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-line/30">
        {total > 0 &&
          counts.map(
            ({ status, count }) =>
              count > 0 && (
                <div
                  key={status}
                  className={STATUS_META[status].dot}
                  style={{ width: `${(count / total) * 100}%` }}
                  title={`${STATUS_META[status].label}: ${count}`}
                />
              ),
          )}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-4">
        {counts.map(({ status, count }) => (
          <span
            key={status}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-1 text-[10.5px] text-muted"
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_META[status].dot}`}
            />
            {STATUS_META[status].label}{" "}
            <span className="font-semibold text-ink">{count}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const { user } = useAuth();
  const notify = use_notify();
  const navigate = useNavigate();

  const [clients, set_clients] = useState<Client[]>(
    () => cache_get<Client[]>(CACHE_CLIENTS) ?? [],
  );
  const [projects, set_projects] = useState<WProject[]>(
    () => cache_get<WProject[]>(CACHE_PROJECTS) ?? [],
  );
  const [fetching, set_fetching] = useState(
    () => !cache_get<Client[]>(CACHE_CLIENTS),
  );

  const [search, set_search] = useState("");
  const [status_f, set_status_f] = useState("all");
  const [sort_key, set_sort_key] = useState<SortKey>(null);
  const [sort_dir, set_sort_dir] = useState<"asc" | "desc">("asc");
  const [selected_id, set_selected_id] = useState<string | null>(null);
  const [deleting_id, set_deleting_id] = useState<string | null>(null);

  const [modal_open, set_modal_open] = useState(false);
  const [editing, set_editing] = useState<Client | null>(null);

  // Every mutation goes through these instead of the raw setters, so the
  // query-cache stays in sync — otherwise a revisit to this page hydrates
  // from the stale cached array (e.g. a just-deleted client reappearing)
  // until the background load() refetch overwrites it a moment later.
  const update_clients = (
    updater: Client[] | ((prev: Client[]) => Client[]),
  ) => {
    set_clients((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      cache_set(CACHE_CLIENTS, next);
      return next;
    });
  };

  const update_projects = (
    updater: WProject[] | ((prev: WProject[]) => WProject[]),
  ) => {
    set_projects((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      cache_set(CACHE_PROJECTS, next);
      return next;
    });
  };

  const load = async () => {
    const [{ data, error }, { data: proj_data }] = await Promise.all([
      api.list(),
      workspace_api.projects.list(),
    ]);
    if (error)
      notify({
        tone: "error",
        title: "Failed to load clients",
        message: error.message,
      });
    const clients_data = (data as Client[]) ?? [];
    const projects_data = (proj_data as WProject[]) ?? [];
    update_clients(clients_data);
    update_projects(projects_data);
    set_fetching(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`clients_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "clients",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          api.list().then(({ data }) => {
            if (data) update_clients(data as Client[]);
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  const q = search.trim().toLowerCase();
  const filtered = clients.filter((c) => {
    if (
      q &&
      !c.company_name.toLowerCase().includes(q) &&
      !c.contact_name?.toLowerCase().includes(q) &&
      !c.service_offered?.toLowerCase().includes(q)
    )
      return false;
    if (status_f !== "all" && c.status !== status_f) return false;
    return true;
  });

  const on_sort = (key: SortKey) => {
    if (sort_key === key) set_sort_dir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      set_sort_key(key);
      set_sort_dir("asc");
    }
  };

  const sorted = useMemo(() => {
    if (!sort_key) return filtered;
    const dir = sort_dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort_key === "company")
        return a.company_name.localeCompare(b.company_name) * dir;
      if (sort_key === "status")
        return (
          (STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)) *
          dir
        );
      if (sort_key === "amount")
        return ((a.payment_amount ?? -1) - (b.payment_amount ?? -1)) * dir;
      return (
        (a.last_contact_at ?? "").localeCompare(b.last_contact_at ?? "") * dir
      );
    });
  }, [filtered, sort_key, sort_dir]);

  // Table rows are within a border-collapsed <table>, so a per-row border-left
  // doesn't reliably render — a background tint does, without fighting the
  // shared Table component's own hover/stripe classes.
  const row_class = (c: Client) =>
    is_stale(c)
      ? "bg-orange-400/[0.05]"
      : c.status === "won"
        ? "bg-light-green/[0.04]"
        : c.status === "lost"
          ? "bg-loss/[0.04]"
          : "";

  const won_clients = clients.filter((c) => c.status === "won");
  const ongoing_revenue = won_clients.reduce(
    (sum, c) => sum + (c.payment_amount ?? 0),
    0,
  );
  const engaged = clients.filter((c) => c.status !== "not_contacted");
  const responded = clients.filter(
    (c) =>
      c.status === "replied" ||
      c.status === "negotiating" ||
      c.status === "won" ||
      c.status === "lost",
  );
  const response_rate = engaged.length
    ? Math.round((responded.length / engaged.length) * 100)
    : 0;

  const selected = clients.find((c) => c.id === selected_id) ?? null;

  const open_create = () => {
    set_editing(null);
    set_modal_open(true);
  };
  const open_edit = (c: Client) => {
    set_editing(c);
    set_modal_open(true);
  };

  const on_saved = (c: Client) => {
    update_clients((prev) => {
      const idx = prev.findIndex((x) => x.id === c.id);
      return idx >= 0 ? prev.map((x) => (x.id === c.id ? c : x)) : [c, ...prev];
    });
    set_selected_id((prev) => prev ?? c.id);
  };
  const on_deleted = (id: string) => {
    update_clients((prev) => prev.filter((c) => c.id !== id));
    set_selected_id((prev) => (prev === id ? null : prev));
  };

  const delete_row = async (id: string) => {
    set_deleting_id(id);
    const { error } = await api.remove(id);
    if (error)
      notify({
        tone: "error",
        title: "Failed to delete",
        message: error.message,
      });
    else on_deleted(id);
    set_deleting_id(null);
  };

  const on_status_change = async (id: string, status: ClientStatus) => {
    const prev = clients;
    update_clients((cs) => cs.map((c) => (c.id === id ? { ...c, status } : c)));
    const { error } = await api.update(id, { status });
    if (error) {
      notify({
        tone: "error",
        title: "Failed to update status",
        message: error.message,
      });
      update_clients(prev);
    }
  };

  const set_project_client = async (
    project_id: string,
    client_id: string | null,
  ) => {
    const prev = projects;
    update_projects((ps) =>
      ps.map((p) => (p.id === project_id ? { ...p, client_id } : p)),
    );
    const { error } = await workspace_api.projects.update(project_id, {
      client_id,
    });
    if (error) {
      notify({
        tone: "error",
        title: "Failed to update link",
        message: error.message,
      });
      update_projects(prev);
    }
  };

  const on_link_project = (project_id: string) =>
    selected && set_project_client(project_id, selected.id);
  const on_unlink_project = (project_id: string) =>
    set_project_client(project_id, null);
  const on_open_project = (project_id: string) =>
    navigate(`/workspace/${project_id}`);

  if (!user) return null;

  const status_opts = [
    { value: "all", label: "All statuses" },
    ...STATUS_ORDER.map((s) => ({
      value: s,
      label: STATUS_META[s].label,
      dot: STATUS_META[s].dot,
    })),
  ];

  return (
    <div className="flex h-full overflow-hidden">
      <SideRail />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden pt-14 lg:pt-0">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: ease_out }}
          className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line bg-card px-4 py-3 lg:px-6 lg:py-4"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-flag-red/10 text-flag-red">
              <BriefcaseIcon size={16} />
            </span>
            <div>
              <h1 className="text-sm font-bold text-ink">Clients</h1>
              <p className="text-[10px] text-muted">
                {fetching
                  ? "Loading…"
                  : sorted.length !== clients.length
                    ? `${sorted.length} of ${clients.length} client${clients.length !== 1 ? "s" : ""}`
                    : `${clients.length} client${clients.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              on_change={set_search}
              placeholder="Search…"
              class_name="w-36 lg:w-48"
            />

            <Dropdown
              value={status_f}
              options={status_opts}
              on_select={set_status_f}
              menu_width="w-44"
              trigger_class="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card/60 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-flag-red/40 hover:text-ink"
            >
              {({ open }) => (
                <>
                  {status_opts.find((o) => o.value === status_f)?.label}
                  <ChevronIcon
                    size={11}
                    className={`transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </>
              )}
            </Dropdown>

            {(search || status_f !== "all") && (
              <button
                type="button"
                onClick={() => {
                  set_search("");
                  set_status_f("all");
                }}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-flag-red"
              >
                Clear
              </button>
            )}

            <button
              type="button"
              onClick={open_create}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-flag-red px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-80"
            >
              <PlusIcon size={12} />
              New client
            </button>
          </div>
        </motion.div>

        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          {!fetching && clients.length > 0 && (
            <div className="surface mb-5 rounded-2xl p-4">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <MiniStat label="Total" value={String(clients.length)} />
                <span className="h-6 w-px bg-line/60" />
                <MiniStat
                  label="Won"
                  value={String(won_clients.length)}
                  tone="gain"
                  hint="Ongoing projects"
                />
                <span className="h-6 w-px bg-line/60" />
                <MiniStat
                  label="Revenue"
                  value={fmt_money(ongoing_revenue)}
                  tone="gain"
                />
                <span className="h-6 w-px bg-line/60" />
                <MiniStat
                  label="Response rate"
                  value={`${response_rate}%`}
                  hint={`${responded.length} of ${engaged.length} contacted`}
                />
              </div>
              <div className="mt-3.5 border-t border-line/40 pt-3.5">
                <PipelineBar clients={clients} />
              </div>
            </div>
          )}

          {fetching ? (
            <div className="surface overflow-hidden rounded-2xl">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 border-b border-line/50 px-4 py-3 last:border-0"
                >
                  <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-line/40" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 w-32 animate-pulse rounded bg-line/40" />
                    <div className="h-2 w-20 animate-pulse rounded bg-line/30" />
                  </div>
                  <div className="h-4 w-16 animate-pulse rounded bg-line/30" />
                </div>
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="surface flex flex-col items-center gap-4 rounded-2xl px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-line/40 text-muted">
                <BriefcaseIcon size={22} />
              </div>
              {clients.length === 0 ? (
                <>
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      No clients yet
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Add a company you've reached out to, or plan to
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={open_create}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-flag-red px-3.5 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-80"
                  >
                    <PlusIcon size={12} /> New client
                  </button>
                </>
              ) : (
                <p className="text-sm text-muted">
                  No clients match your filters.
                </p>
              )}
            </div>
          ) : (
            <Table
              columns={build_client_columns({
                sort_key,
                sort_dir,
                on_sort,
                on_status_change,
                on_edit: open_edit,
                deleting_id,
                on_confirm_delete: delete_row,
                projects,
                on_open_project,
              })}
              rows={sorted}
              row_key={(c) => c.id}
              row_class={row_class}
              on_row_click={(c) => set_selected_id(c.id)}
            />
          )}
        </div>
      </main>

      <DetailModal
        client={selected}
        projects={projects}
        on_close={() => set_selected_id(null)}
        on_edit={() => selected && open_edit(selected)}
        on_status_change={on_status_change}
        on_link_project={on_link_project}
        on_unlink_project={on_unlink_project}
        on_open_project={on_open_project}
      />

      <ClientModal
        open={modal_open}
        editing={editing}
        user_id={user.id}
        on_close={() => set_modal_open(false)}
        on_saved={on_saved}
        on_deleted={on_deleted}
      />
    </div>
  );
}
