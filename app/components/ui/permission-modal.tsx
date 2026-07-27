import { Modal } from "~/components/ui/modal"
import { LockIcon } from "~/components/ui/icons"

export const PermissionModal = ({
  open, action, on_close,
}: {
  open:     boolean
  action:   string   // e.g. "edit this task"
  on_close: () => void
}) => (
  <Modal
    open={open}
    on_close={on_close}
    title="Access denied"
    size="sm"
  >
    <div className="flex flex-col items-center gap-5 pb-2 pt-1 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-flag-red/10">
        <LockIcon size={24} className="text-flag-red" />
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-ink">
          You don't have permission to {action}.
        </p>
        <p className="text-xs leading-relaxed text-muted/70">
          Contact your administrator to request access.
        </p>
      </div>

      <button
        onClick={on_close}
        className="cursor-pointer rounded-lg border border-line bg-card px-6 py-2 text-sm font-medium text-ink transition-colors hover:bg-line/40"
      >
        Got it
      </button>
    </div>
  </Modal>
)
