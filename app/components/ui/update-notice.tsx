import { useEffect, useState } from "react";
import { useAuth } from "~/features/auth/lib/auth";
import { Modal } from "~/components/ui/modal";
import { CheckIcon } from "~/components/ui/icons";
import release_notes from "~/components/ui/release-notes.json";

const SEEN_KEY = "last_seen_version";

export const UpdateNotice = () => {
  const { user } = useAuth();
  const [open, set_open] = useState(false);

  useEffect(() => {
    if (!user) return;
    const seen = localStorage.getItem(SEEN_KEY);
    if (seen === release_notes.version) return;
    localStorage.setItem(SEEN_KEY, release_notes.version);
    if (seen !== null) set_open(true);
  }, [user]);

  return (
    <Modal
      open={open}
      on_close={() => set_open(false)}
      title={`Updated to v${release_notes.version}`}
      size="sm"
    >
      <ul className="flex flex-col gap-2.5">
        {release_notes.notes.map((note, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-muted">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-flag-red/10 text-flag-red">
              <CheckIcon size={10} />
            </span>
            {note}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => set_open(false)}
        className="mt-5 w-full rounded-lg bg-flag-red px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Got it
      </button>
    </Modal>
  );
};
