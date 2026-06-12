import { useEffect, useRef, useState } from "react"

export const AvatarUploader = ({
  url,
  editing,
  size = "lg",
  on_file_select,
}: {
  url?: string | null
  editing: boolean
  size?: "sm" | "lg"
  on_file_select?: (file: File) => void
}) => {
  const [preview, set_preview] = useState<string | null>(null)
  const preview_ref = useRef<string | null>(null)
  const input_ref = useRef<HTMLInputElement>(null)

  const dim = size === "sm" ? "h-10 w-10" : "h-16 w-16"
  const display = preview ?? url

  useEffect(() => {
    // revoke object URL on unmount (e.g. cancel edit)
    return () => {
      if (preview_ref.current) URL.revokeObjectURL(preview_ref.current)
    }
  }, [])

  const handle_file = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (preview_ref.current) URL.revokeObjectURL(preview_ref.current)
    const obj_url = URL.createObjectURL(file)
    preview_ref.current = obj_url
    set_preview(obj_url)
    on_file_select?.(file)
    e.target.value = ""
  }

  return (
    <div className={`shrink-0 ${dim}`}>
      <div
        onClick={() => editing && input_ref.current?.click()}
        className={`relative ${dim} overflow-hidden rounded-full border border-line bg-line/30 ${editing ? "cursor-pointer" : ""}`}
      >
        {display && (
          <img src={display} alt="Avatar" className="h-full w-full object-cover" />
        )}

        {editing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity hover:opacity-100">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
        )}
      </div>

      <input
        ref={input_ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handle_file}
      />
    </div>
  )
}
