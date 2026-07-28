import { useEffect, useState } from "react"
import { Modal } from "~/components/ui/modal"
import { Dropdown } from "~/components/ui/dropdown"
import { use_notify } from "~/hooks/use-notify"
import { CheckIcon, TrashIcon, LockIcon, GlobeIcon, BriefcaseIcon, ChevronIcon } from "~/components/ui/icons"
import {
  api, STATUS_COLORS, COLOR_OPTIONS,
  type WProject, type StatusColor, type ProjectVisibility,
} from "~/features/workspace/lib/workspace"
import { api as clients_api, type Client } from "~/features/clients/lib/clients"

// Seeded onto every new project so a board is immediately usable instead of
// starting empty — the same three-stage flow ("To Do" / "In Progress" /
// "Done") every Kanban tool defaults to. Colors match STATUS_COLORS; "Done"
// is green so is_done_status()'s name check (board.tsx) and the completed-
// task styling line up out of the box.
const DEFAULT_STATUSES: { name: string; color: StatusColor }[] = [
  { name: "To Do",       color: "gray"  },
  { name: "In Progress", color: "blue"  },
  { name: "Done",        color: "green" },
]

type Props = {
  open:       boolean
  editing:    WProject | null
  owner_id:   string
  on_close:   () => void
  on_saved:   (p: WProject) => void
  on_deleted: (id: string) => void
}

export const ProjectModal = ({ open, editing, owner_id, on_close, on_saved, on_deleted }: Props) => {
  const notify = use_notify()
  const is_new = editing === null

  const [name,        set_name]        = useState("")
  const [description, set_description] = useState("")
  const [color,       set_color]       = useState<StatusColor>("red")
  const [visibility,  set_visibility]  = useState<ProjectVisibility>("private")
  const [client_id,   set_client_id]   = useState<string | null>(null)
  const [clients,     set_clients]     = useState<Client[]>([])
  const [saving,      set_saving]      = useState(false)
  const [deleting,    set_deleting]    = useState(false)
  const [confirm,     set_confirm]     = useState(false)

  useEffect(() => {
    if (!open) { set_confirm(false); return }
    set_name(editing?.name ?? "")
    set_description(editing?.description ?? "")
    set_color(editing?.color ?? "red")
    set_visibility(editing?.visibility ?? "private")
    set_client_id(editing?.client_id ?? null)
    clients_api.list().then(({ data }) => set_clients((data as Client[]) ?? []))
  }, [open, editing?.id])

  const save = async () => {
    if (!name.trim() || saving) return
    set_saving(true)
    if (is_new) {
      const { data, error } = await api.projects.create({
        name: name.trim(), description: description.trim() || null,
        color, visibility, owner_id, client_id,
      })
      if (error) {
        notify({ tone: "error", title: "Failed to create project", message: error.message })
      } else {
        const project = data as WProject
        const seeded = await Promise.all(
          DEFAULT_STATUSES.map((s, i) => api.statuses.create(project.id, s.name, s.color, i)),
        )
        if (seeded.some(r => r.error)) {
          notify({ tone: "error", title: "Project created", message: "Default columns couldn't be added — add them from the board." })
        }
        on_saved(project)
        on_close()
      }
    } else {
      const { data, error } = await api.projects.update(editing!.id, {
        name: name.trim(), description: description.trim() || null, color, visibility, client_id,
      })
      if (error) notify({ tone: "error", title: "Failed to save", message: error.message })
      else { on_saved(data as WProject); on_close() }
    }
    set_saving(false)
  }

  const remove = async () => {
    if (!editing || deleting) return
    set_deleting(true)
    const { error } = await api.projects.remove(editing.id)
    if (error) notify({ tone: "error", title: "Failed to delete", message: error.message })
    else { on_deleted(editing.id); on_close() }
    set_deleting(false)
  }

  return (
    <Modal
      open={open}
      on_close={on_close}
      title={is_new ? "New project" : "Edit project"}
      size="sm"
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted">Name</label>
          <input
            autoFocus
            value={name}
            onChange={e => set_name(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") save() }}
            placeholder="e.g. Mobile redesign"
            maxLength={60}
            className="w-full rounded-lg border border-line bg-page/60 px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted/40 focus:border-flag-red/50"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted">Description</label>
          <textarea
            value={description}
            onChange={e => set_description(e.target.value)}
            placeholder="What's this project for? (optional)"
            rows={2}
            maxLength={280}
            className="w-full resize-none rounded-lg border border-line bg-page/60 px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted/40 focus:border-flag-red/50"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted">Color</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => set_color(c)}
                className={`h-7 w-7 rounded-full transition-all ${STATUS_COLORS[c].dot}
                  ${color === c ? "scale-110 ring-2 ring-current ring-offset-2 ring-offset-card" : "opacity-60 hover:opacity-100"}`}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted">Visibility</label>
          <div className="flex items-center gap-1 rounded-lg border border-line bg-line/20 p-0.5">
            {([
              { value: "private", label: "Private", icon: <LockIcon size={12} /> },
              { value: "public",  label: "Public",   icon: <GlobeIcon size={12} /> },
            ] as const).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set_visibility(opt.value)}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all duration-150
                  ${visibility === opt.value ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"}`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted/70">
            {visibility === "private" ? "Only you (and root) can see this project." : "Any signed-in teammate can view and use this project."}
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted">Link to client</label>
          <Dropdown
            value={client_id ?? ""}
            options={[
              { value: "", label: "No client" },
              ...clients.map(c => ({ value: c.id, label: c.company_name })),
            ]}
            on_select={v => set_client_id(v || null)}
            menu_width="w-56"
            trigger_class="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-line bg-page/60 px-3 py-2 text-sm text-ink outline-none transition-colors hover:border-flag-red/40"
          >
            {({ open }) => (
              <>
                <BriefcaseIcon size={13} className="shrink-0 text-muted" />
                <span className="flex-1 truncate text-left">
                  {client_id ? clients.find(c => c.id === client_id)?.company_name ?? "…" : "No client"}
                </span>
                <ChevronIcon size={12} className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
              </>
            )}
          </Dropdown>
          <p className="text-[11px] text-muted/70">Ties this project to a client's outreach record on the Clients page.</p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={save}
            disabled={!name.trim() || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-flag-red px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <CheckIcon size={14} />
            {saving ? "Saving…" : is_new ? "Create project" : "Save"}
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
