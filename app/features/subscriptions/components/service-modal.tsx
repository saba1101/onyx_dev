import { useEffect, useState } from "react"
import { Modal } from "~/components/ui/modal"
import { use_notify } from "~/hooks/use-notify"
import { CheckIcon, TrashIcon } from "~/components/ui/icons"
import { DatePicker } from "~/features/subscriptions/components/date-picker"
import {
  api, COLOR_OPTIONS, COLOR_TONE,
  type Service, type ServiceColor, type ServiceStatus, type RecurringCycle,
} from "~/features/subscriptions/lib/subscriptions"

const field_cls =
  "w-full rounded-lg border border-line bg-page/60 px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted/40 focus:border-flag-red/50"

const CATEGORY_SUGGESTIONS = [
  "Freelance", "Software", "Cloud & Hosting", "AI Tools", "Entertainment",
  "Utilities", "Productivity", "Education", "Health & Fitness", "Finance",
  "Marketing", "Gaming", "News & Media", "Other",
]

const STATUS_OPTS: { value: ServiceStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "cancelled", label: "Cancelled" },
]

const CYCLE_OPTS: { value: RecurringCycle; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
]

const today = () => new Date().toISOString().slice(0, 10)

type Props = {
  open:       boolean
  editing:    Service | null
  user_id:    string
  on_close:   () => void
  on_saved:   (s: Service) => void
  on_deleted: (id: string) => void
}

export const ServiceModal = ({ open, editing, user_id, on_close, on_saved, on_deleted }: Props) => {
  const notify = use_notify()
  const is_new = editing === null

  const [name,        set_name]        = useState("")
  const [category,    set_category]    = useState("")
  const [color,       set_color]       = useState<ServiceColor>("red")
  const [status,      set_status]      = useState<ServiceStatus>("active")
  const [recurring,   set_recurring]   = useState(false)
  const [amount,      set_amount]      = useState("")
  const [cycle,       set_cycle]       = useState<RecurringCycle>("monthly")
  const [start_date,  set_start_date]  = useState(today())
  const [url,         set_url]         = useState("")
  const [notes,       set_notes]       = useState("")
  const [saving,      set_saving]      = useState(false)
  const [deleting,    set_deleting]    = useState(false)
  const [confirm,     set_confirm]     = useState(false)

  useEffect(() => {
    if (!open) { set_confirm(false); return }
    set_name(editing?.name ?? "")
    set_category(editing?.category ?? "")
    set_color(editing?.color ?? "red")
    set_status(editing?.status ?? "active")
    set_recurring(!!editing?.recurring_amount)
    set_amount(editing?.recurring_amount ? String(editing.recurring_amount) : "")
    set_cycle(editing?.recurring_cycle ?? "monthly")
    set_start_date(editing?.start_date ?? today())
    set_url(editing?.url ?? "")
    set_notes(editing?.notes ?? "")
  }, [open, editing?.id])

  const save = async () => {
    if (!name.trim() || saving) return
    set_saving(true)
    const recurring_amount = recurring && amount.trim() ? Number(amount) : null
    const recurring_cycle  = recurring && amount.trim() ? cycle : null
    const start_date_val   = recurring && amount.trim() ? start_date : null

    if (is_new) {
      const { data, error } = await api.services.create({
        user_id, name: name.trim(), category: category.trim() || null, color,
        recurring_amount, recurring_cycle, start_date: start_date_val, url: url.trim() || null, notes: notes.trim() || null,
      })
      if (error) notify({ tone: "error", title: "Failed to create service", message: error.message })
      else { on_saved(data as Service); on_close() }
    } else {
      const { data, error } = await api.services.update(editing!.id, {
        name: name.trim(), category: category.trim() || null, color, status,
        recurring_amount, recurring_cycle, start_date: start_date_val, url: url.trim() || null, notes: notes.trim() || null,
      })
      if (error) notify({ tone: "error", title: "Failed to save", message: error.message })
      else { on_saved(data as Service); on_close() }
    }
    set_saving(false)
  }

  const remove = async () => {
    if (!editing || deleting) return
    set_deleting(true)
    const { error } = await api.services.remove(editing.id)
    if (error) notify({ tone: "error", title: "Failed to delete", message: error.message })
    else { on_deleted(editing.id); on_close() }
    set_deleting(false)
  }

  return (
    <Modal
      open={open}
      on_close={on_close}
      title={is_new ? "New service" : "Edit service"}
      description="// subscriptions"
      size="md"
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted">Name</label>
            <input
              autoFocus
              value={name}
              onChange={e => set_name(e.target.value)}
              placeholder="Service name"
              maxLength={60}
              className={field_cls}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted">Category</label>
            <input
              value={category}
              onChange={e => set_category(e.target.value)}
              placeholder="e.g. Freelance"
              list="category-suggestions"
              maxLength={40}
              className={field_cls}
            />
            <datalist id="category-suggestions">
              {CATEGORY_SUGGESTIONS.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted">Color</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => set_color(c)}
                className={`h-7 w-7 rounded-full transition-all ${COLOR_TONE[c].dot}
                  ${color === c ? "scale-110 ring-2 ring-current ring-offset-2 ring-offset-card" : "opacity-60 hover:opacity-100"}`}
              />
            ))}
          </div>
        </div>

        {!is_new && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted">Status</label>
            <div className="flex items-center gap-1 rounded-lg border border-line bg-line/20 p-0.5">
              {STATUS_OPTS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set_status(opt.value)}
                  className={`flex-1 cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all duration-150
                    ${status === opt.value ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2 rounded-xl border border-line/60 bg-line/10 p-3">
          <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-ink">
            <input type="checkbox" checked={recurring} onChange={e => set_recurring(e.target.checked)} className="h-3.5 w-3.5 accent-flag-red" />
            This has a recurring cost
          </label>
          {recurring ? (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted">$</span>
                  <input
                    type="number" min="0" step="0.01"
                    value={amount}
                    onChange={e => set_amount(e.target.value)}
                    placeholder="15.99"
                    className={`${field_cls} pl-6`}
                  />
                </div>
                <span className="text-xs text-muted">per</span>
                <select
                  value={cycle}
                  onChange={e => set_cycle(e.target.value as RecurringCycle)}
                  className="rounded-lg border border-line bg-page/60 px-2.5 py-2 text-sm text-ink outline-none focus:border-flag-red/50"
                >
                  {CYCLE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wide text-muted">Start date</label>
                <DatePicker value={start_date} max={today()} onChange={set_start_date} />
                <p className="text-[10.5px] text-muted/60">
                  When this subscription actually started — used to backfill past payments as spend entries.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-muted/70">Pay as you go — you'll log each spend and gain yourself.</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted">Link (optional)</label>
            <input value={url} onChange={e => set_url(e.target.value)} placeholder="example.com" className={field_cls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted">Notes (optional)</label>
            <input value={notes} onChange={e => set_notes(e.target.value)} placeholder="Anything worth remembering" maxLength={200} className={field_cls} />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={save}
            disabled={!name.trim() || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-flag-red px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <CheckIcon size={14} />
            {saving ? "Saving…" : is_new ? "Add service" : "Save"}
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
  )
}
