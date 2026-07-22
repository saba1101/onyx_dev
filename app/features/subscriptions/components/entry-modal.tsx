import { useEffect, useState } from "react"
import { Modal } from "~/components/ui/modal"
import { use_notify } from "~/hooks/use-notify"
import { CheckIcon, TrashIcon } from "~/components/ui/icons"
import { api, type Entry, type EntryKind } from "~/features/subscriptions/lib/subscriptions"

const field_cls =
  "w-full rounded-lg border border-line bg-page/60 px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted/40 focus:border-flag-red/50"

const today = () => new Date().toISOString().slice(0, 10)

type Props = {
  open:        boolean
  service_id:  string | null
  user_id:     string
  editing:     Entry | null
  default_kind?: EntryKind
  on_close:    () => void
  on_saved:    (e: Entry) => void
  on_deleted:  (id: string) => void
}

export const EntryModal = ({ open, service_id, user_id, editing, default_kind, on_close, on_saved, on_deleted }: Props) => {
  const notify = use_notify()
  const is_new = editing === null

  const [kind,   set_kind]   = useState<EntryKind>("expense")
  const [amount, set_amount] = useState("")
  const [date,   set_date]   = useState(today())
  const [note,   set_note]   = useState("")
  const [saving, set_saving] = useState(false)
  const [deleting, set_deleting] = useState(false)
  const [confirm, set_confirm]   = useState(false)

  useEffect(() => {
    if (!open) { set_confirm(false); return }
    set_kind(editing?.kind ?? default_kind ?? "expense")
    set_amount(editing ? String(editing.amount) : "")
    set_date(editing?.occurred_on ?? today())
    set_note(editing?.note ?? "")
  }, [open, editing?.id, default_kind])

  const save = async () => {
    const n = Number(amount)
    if (!n || n <= 0 || saving) return
    set_saving(true)

    if (is_new) {
      if (!service_id) { set_saving(false); return }
      const { data, error } = await api.entries.create({
        user_id, service_id, kind, amount: n, occurred_on: date, note: note.trim() || null,
      })
      if (error) notify({ tone: "error", title: "Failed to log entry", message: error.message })
      else { on_saved(data as Entry); on_close() }
    } else {
      const { data, error } = await api.entries.update(editing!.id, {
        kind, amount: n, occurred_on: date, note: note.trim() || null,
      })
      if (error) notify({ tone: "error", title: "Failed to save", message: error.message })
      else { on_saved(data as Entry); on_close() }
    }
    set_saving(false)
  }

  const remove = async () => {
    if (!editing || deleting) return
    set_deleting(true)
    const { error } = await api.entries.remove(editing.id)
    if (error) notify({ tone: "error", title: "Failed to delete", message: error.message })
    else { on_deleted(editing.id); on_close() }
    set_deleting(false)
  }

  return (
    <Modal
      open={open}
      on_close={on_close}
      title={is_new ? "Log an entry" : "Edit entry"}
      description="// ledger"
      size="sm"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-1 rounded-lg border border-line bg-line/20 p-0.5">
          {([
            { value: "expense", label: "Spend" },
            { value: "income",  label: "Gain" },
          ] as const).map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set_kind(opt.value)}
              className={`flex-1 cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all duration-150
                ${kind === opt.value
                  ? opt.value === "income" ? "bg-light-green/15 text-light-green shadow-sm" : "bg-flag-red/10 text-flag-red shadow-sm"
                  : "text-muted hover:text-ink"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted">Amount</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted">$</span>
              <input
                autoFocus
                type="number" min="0" step="0.01"
                value={amount}
                onChange={e => set_amount(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") save() }}
                placeholder="0.00"
                className={`${field_cls} pl-6`}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted">Date</label>
            <input type="date" value={date} onChange={e => set_date(e.target.value)} className={field_cls} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted">Note (optional)</label>
          <input
            value={note}
            onChange={e => set_note(e.target.value)}
            placeholder={kind === "income" ? "What did this come from?" : "What was this for?"}
            maxLength={140}
            className={field_cls}
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={save}
            disabled={!amount || Number(amount) <= 0 || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-flag-red px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <CheckIcon size={14} />
            {saving ? "Saving…" : is_new ? "Log entry" : "Save"}
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
              <button onClick={() => set_confirm(false)} className="rounded-lg border border-line px-3 py-2 text-xs text-muted hover:text-ink">
                No
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
