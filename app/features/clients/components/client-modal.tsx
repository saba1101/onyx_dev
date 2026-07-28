import { useEffect, useState } from "react";
import { Modal } from "~/components/ui/modal";
import { Dropdown } from "~/components/ui/dropdown";
import { DatePicker } from "~/components/ui/date-picker";
import { use_notify } from "~/hooks/use-notify";
import {
  CheckIcon,
  TrashIcon,
  ChevronIcon,
  RefreshIcon,
} from "~/components/ui/icons";
import {
  api,
  fetch_place,
  STATUS_ORDER,
  STATUS_META,
  SERVICE_SUGGESTIONS,
  type Client,
  type ClientStatus,
} from "~/features/clients/lib/clients";

const field_cls =
  "w-full rounded-lg border border-line bg-page/60 px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted/40 focus:border-flag-red/50";

const today = () => new Date().toISOString().slice(0, 10);

type Props = {
  open: boolean;
  editing: Client | null;
  user_id: string;
  on_close: () => void;
  on_saved: (c: Client) => void;
  on_deleted: (id: string) => void;
};

export const ClientModal = ({
  open,
  editing,
  user_id,
  on_close,
  on_saved,
  on_deleted,
}: Props) => {
  const notify = use_notify();
  const is_new = editing === null;

  const [company_name, set_company_name] = useState("");
  const [contact_name, set_contact_name] = useState("");
  const [email, set_email] = useState("");
  const [phone, set_phone] = useState("");
  const [website, set_website] = useState("");
  const [social_url, set_social_url] = useState("");
  const [maps_url, set_maps_url] = useState("");
  const [address, set_address] = useState("");
  const [fetching_place, set_fetching_place] = useState(false);
  const [service_offered, set_service_offered] = useState("");
  const [payment_amount, set_payment_amount] = useState("");
  const [status, set_status] = useState<ClientStatus>("not_contacted");
  const [last_contact_at, set_last_contact_at] = useState<string>("");
  const [follow_up_at, set_follow_up_at] = useState<string>("");
  const [conversation, set_conversation] = useState("");
  const [saving, set_saving] = useState(false);
  const [deleting, set_deleting] = useState(false);
  const [confirm, set_confirm] = useState(false);

  useEffect(() => {
    if (!open) {
      set_confirm(false);
      return;
    }
    set_company_name(editing?.company_name ?? "");
    set_contact_name(editing?.contact_name ?? "");
    set_email(editing?.email ?? "");
    set_phone(editing?.phone ?? "");
    set_website(editing?.website ?? "");
    set_social_url(editing?.social_url ?? "");
    set_maps_url(editing?.maps_url ?? "");
    set_address(editing?.address ?? "");
    set_service_offered(editing?.service_offered ?? "");
    set_payment_amount(
      editing?.payment_amount != null ? String(editing.payment_amount) : "",
    );
    set_status(editing?.status ?? "not_contacted");
    set_last_contact_at(editing?.last_contact_at ?? "");
    set_follow_up_at(editing?.follow_up_at ?? "");
    set_conversation(editing?.conversation ?? "");
  }, [open, editing?.id]);

  const save = async () => {
    if (!company_name.trim() || saving) return;
    set_saving(true);
    const patch = {
      company_name: company_name.trim(),
      contact_name: contact_name.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      website: website.trim() || null,
      social_url: social_url.trim() || null,
      maps_url: maps_url.trim() || null,
      address: address.trim() || null,
      service_offered: service_offered.trim() || null,
      payment_amount: payment_amount.trim() ? Number(payment_amount) : null,
      status,
      last_contact_at: last_contact_at || null,
      follow_up_at: follow_up_at || null,
      conversation: conversation.trim() || null,
    };

    if (is_new) {
      const { data, error } = await api.create({ user_id, ...patch });
      if (error)
        notify({
          tone: "error",
          title: "Failed to add client",
          message: error.message,
        });
      else {
        on_saved(data as Client);
        on_close();
      }
    } else {
      const { data, error } = await api.update(editing!.id, patch);
      if (error)
        notify({
          tone: "error",
          title: "Failed to save",
          message: error.message,
        });
      else {
        on_saved(data as Client);
        on_close();
      }
    }
    set_saving(false);
  };

  const autofetch = async () => {
    if (!maps_url.trim() || fetching_place) return;
    set_fetching_place(true);
    const { data, error } = await fetch_place(maps_url.trim());
    if (error || data?.error) {
      notify({
        tone: "error",
        title: "Couldn't read that Maps link",
        message: data?.error ?? error?.message,
      });
    } else {
      if (data?.name) set_company_name(data.name);
      if (data?.address) set_address(data.address);
      if (!data?.name && !data?.address) {
        notify({ tone: "info", title: "Nothing usable found on that page" });
      } else {
        notify({ tone: "success", title: "Filled in from Maps link" });
      }
    }
    set_fetching_place(false);
  };

  const remove = async () => {
    if (!editing || deleting) return;
    set_deleting(true);
    const { error } = await api.remove(editing.id);
    if (error)
      notify({
        tone: "error",
        title: "Failed to delete",
        message: error.message,
      });
    else {
      on_deleted(editing.id);
      on_close();
    }
    set_deleting(false);
  };

  return (
    <Modal
      open={open}
      on_close={on_close}
      title={is_new ? "New client" : "Edit client"}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Company name
            </label>
            <input
              autoFocus
              value={company_name}
              onChange={(e) => set_company_name(e.target.value)}
              placeholder="Acme Co"
              maxLength={80}
              className={field_cls}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Contact person
            </label>
            <input
              value={contact_name}
              onChange={(e) => set_contact_name(e.target.value)}
              placeholder="Who you're talking to"
              maxLength={80}
              className={field_cls}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Email
            </label>
            <input
              value={email}
              onChange={(e) => set_email(e.target.value)}
              placeholder="name@company.com"
              className={field_cls}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Phone
            </label>
            <input
              value={phone}
              onChange={(e) => set_phone(e.target.value)}
              placeholder="+1 555 000 0000"
              className={field_cls}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Website
            </label>
            <input
              value={website}
              onChange={(e) => set_website(e.target.value)}
              placeholder="company.com"
              className={field_cls}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Social media link
            </label>
            <input
              value={social_url}
              onChange={(e) => set_social_url(e.target.value)}
              placeholder="instagram.com/company"
              className={field_cls}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Google Maps link
            </label>
            <div className="flex gap-1.5">
              <input
                value={maps_url}
                onChange={(e) => set_maps_url(e.target.value)}
                placeholder="maps.app.goo.gl/…"
                className={field_cls}
              />
              <button
                type="button"
                onClick={autofetch}
                disabled={!maps_url.trim() || fetching_place}
                title="Fill in company name and address from this link"
                className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-page/60 px-2.5 text-xs font-medium text-muted transition-colors hover:border-flag-red/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RefreshIcon
                  size={12}
                  className={fetching_place ? "animate-spin" : ""}
                />
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Address
            </label>
            <input
              value={address}
              onChange={(e) => set_address(e.target.value)}
              placeholder="Filled in by Autofetch, or type your own"
              className={field_cls}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Service offered
            </label>
            <input
              value={service_offered}
              onChange={(e) => set_service_offered(e.target.value)}
              placeholder="e.g. Website"
              list="service-suggestions"
              maxLength={40}
              className={field_cls}
            />
            <datalist id="service-suggestions">
              {SERVICE_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Payment amount
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted">
                $
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={payment_amount}
                onChange={(e) => set_payment_amount(e.target.value)}
                placeholder="1500"
                className={`${field_cls} pl-6`}
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Status
          </label>
          <Dropdown
            value={status}
            options={STATUS_ORDER.map((s) => ({
              value: s,
              label: STATUS_META[s].label,
              dot: STATUS_META[s].dot,
            }))}
            on_select={(v) => set_status(v as ClientStatus)}
            trigger_class={`${field_cls} flex items-center justify-between`}
          >
            {({ selected }) => (
              <>
                <span className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${STATUS_META[status].dot}`}
                  />
                  {selected?.label ?? STATUS_META[status].label}
                </span>
                <ChevronIcon size={14} className="text-muted" />
              </>
            )}
          </Dropdown>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Last contacted
            </label>
            <DatePicker
              value={last_contact_at || today()}
              max={today()}
              onChange={set_last_contact_at}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Follow up on (optional)
            </label>
            <DatePicker
              value={follow_up_at || today()}
              onChange={set_follow_up_at}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Conversation
          </label>
          <textarea
            value={conversation}
            onChange={(e) => set_conversation(e.target.value)}
            placeholder="Paste the full conversation here…"
            rows={10}
            className={`${field_cls} resize-none font-mono text-[12.5px] leading-relaxed`}
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={save}
            disabled={!company_name.trim() || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-flag-red px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <CheckIcon size={14} />
            {saving ? "Saving…" : is_new ? "Add client" : "Save"}
          </button>
          <button
            onClick={on_close}
            className="rounded-lg border border-line bg-card/60 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-line/40"
          >
            Cancel
          </button>

          {!is_new && !confirm && (
            <button
              onClick={() => set_confirm(true)}
              className="ml-auto rounded-lg border border-line px-3 py-2 text-sm text-muted transition-colors hover:border-flag-red/40 hover:text-flag-red"
            >
              <TrashIcon size={14} />
            </button>
          )}
          {!is_new && confirm && (
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={remove}
                disabled={deleting}
                className="rounded-lg bg-flag-red px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {deleting ? "…" : "Delete"}
              </button>
              <button
                onClick={() => set_confirm(false)}
                className="rounded-lg border border-line px-3 py-2 text-xs text-muted hover:text-ink"
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
