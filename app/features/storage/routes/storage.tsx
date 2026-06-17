import { useState, useEffect, useRef, useCallback } from "react"
import { Navigate } from "react-router"
import { motion, AnimatePresence } from "motion/react"
import { useAuth } from "~/features/auth/lib/auth"
import { useProfile } from "~/features/profile/lib/profile-context"
import { SideRail } from "~/components/ui/side-rail"
import { Modal } from "~/components/ui/modal"
import { use_notify } from "~/hooks/use-notify"
import { supabase } from "~/lib/supabase"
import {
  TrashIcon, UploadIcon, XIcon, ExternalLinkIcon,
  CheckIcon, SearchIcon,
} from "~/components/ui/icons"

export const meta = () => [{ title: "Storage — Onyx Dev" }]

const ease_out = [0.22, 1, 0.36, 1] as const

// ── Types ─────────────────────────────────────────────────────────────────────

type Bucket = {
  id:              string
  name:            string
  public:          boolean
  file_size_limit: number | null
}

type FileMeta = {
  size:         number
  mimetype:     string
  lastModified: string
}

type StorageFile = {
  name:       string
  id:         string | null
  metadata:   FileMeta | null
  created_at: string
  updated_at: string
  full_path:  string   // path relative to bucket root
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt_bytes = (b: number): string => {
  if (b < 1024)         return `${b} B`
  if (b < 1024 * 1024)  return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

const fmt_date = (s: string) => {
  try { return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }
  catch { return s }
}

const ext = (name: string) => name.split(".").pop()?.toLowerCase() ?? ""

const is_image = (file: StorageFile) => {
  const mime = file.metadata?.mimetype ?? ""
  return mime.startsWith("image/") || ["jpg","jpeg","png","gif","webp","svg","avif"].includes(ext(file.name))
}

// ── Recursive list (handles one level of subfolders) ─────────────────────────

const list_bucket_files = async (bucket: string): Promise<StorageFile[]> => {
  const { data: root } = await supabase.storage.from(bucket).list("", {
    limit: 200, sortBy: { column: "created_at", order: "desc" },
  })
  if (!root) return []

  const files: StorageFile[] = []

  await Promise.all(root.map(async item => {
    if (!item.id && !item.metadata) {
      // subfolder — list its contents
      const { data: children } = await supabase.storage.from(bucket).list(item.name, {
        limit: 200, sortBy: { column: "created_at", order: "desc" },
      })
      ;(children ?? []).forEach(child => {
        if (child.id || child.metadata) {
          files.push({
            name:       child.name,
            id:         child.id,
            metadata:   child.metadata as FileMeta | null,
            created_at: child.created_at ?? "",
            updated_at: child.updated_at ?? "",
            full_path:  `${item.name}/${child.name}`,
          })
        }
      })
    } else {
      files.push({
        name:       item.name,
        id:         item.id,
        metadata:   item.metadata as FileMeta | null,
        created_at: item.created_at ?? "",
        updated_at: item.updated_at ?? "",
        full_path:  item.name,
      })
    }
  }))

  return files.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

const get_url = async (bucket_name: string, is_public: boolean, path: string): Promise<string | null> => {
  if (is_public) {
    const { data } = supabase.storage.from(bucket_name).getPublicUrl(path)
    return data.publicUrl
  }
  const { data } = await supabase.storage.from(bucket_name).createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

// ── File card ─────────────────────────────────────────────────────────────────

const FileCard = ({
  file, bucket, is_public, on_preview, on_delete, on_reupload,
}: {
  file:        StorageFile
  bucket:      string
  is_public:   boolean
  on_preview:  (f: StorageFile) => void
  on_delete:   (f: StorageFile) => void
  on_reupload: (f: StorageFile) => void
}) => {
  const [thumb_url, set_thumb_url] = useState<string | null>(null)

  useEffect(() => {
    if (!is_image(file)) return
    get_url(bucket, is_public, file.full_path).then(url => set_thumb_url(url))
  }, [file, bucket, is_public])

  const file_ext = ext(file.full_path)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative overflow-hidden rounded-2xl border border-line/50 bg-card transition-all hover:border-line hover:shadow-lg"
    >
      {/* Thumbnail / icon */}
      <button
        type="button"
        onClick={() => on_preview(file)}
        className="block w-full"
      >
        <div className="relative flex h-40 w-full items-center justify-center overflow-hidden bg-line/10">
          {thumb_url ? (
            <img
              src={thumb_url}
              alt={file.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center gap-2">
              <FileTypeIcon mime={file.metadata?.mimetype ?? ""} />
              {file_ext && (
                <span className="rounded-md bg-line/40 px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-muted">
                  .{file_ext}
                </span>
              )}
            </div>
          )}
          {/* Hover overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-carbon-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            <EyeIcon />
          </div>
        </div>
      </button>

      {/* Info */}
      <div className="px-3 py-2.5">
        <p className="truncate text-[11px] font-semibold text-ink" title={file.full_path}>
          {file.name}
        </p>
        <p className="mt-0.5 truncate font-mono text-[9px] text-muted/60">{file.full_path}</p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {file.metadata?.size != null && (
              <span className="text-[9px] text-muted">{fmt_bytes(file.metadata.size)}</span>
            )}
            {file.metadata?.mimetype && (
              <>
                <span className="text-muted/30">·</span>
                <span className="text-[9px] text-muted/60">{file.metadata.mimetype.split("/")[1]}</span>
              </>
            )}
          </div>
          <span className="text-[9px] text-muted/40">{fmt_date(file.created_at)}</span>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-1 border-t border-line/30 px-3 py-2 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => on_preview(file)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-muted transition-colors hover:bg-line/40 hover:text-ink"
          title="Preview"
        >
          <EyeIcon size={11} /> View
        </button>
        <button
          type="button"
          onClick={() => on_reupload(file)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-muted transition-colors hover:bg-line/40 hover:text-ink"
          title="Replace file"
        >
          <UploadIcon size={11} /> Replace
        </button>
        <button
          type="button"
          onClick={() => on_delete(file)}
          className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-muted transition-colors hover:bg-flag-red/10 hover:text-flag-red"
          title="Delete"
        >
          <TrashIcon size={11} />
        </button>
      </div>
    </motion.div>
  )
}

// ── Preview modal ─────────────────────────────────────────────────────────────

const PreviewModal = ({
  file, bucket, is_public, open, on_close, on_delete, on_reupload,
}: {
  file:        StorageFile | null
  bucket:      string
  is_public:   boolean
  open:        boolean
  on_close:    () => void
  on_delete:   () => void
  on_reupload: () => void
}) => {
  const [url,             set_url]             = useState<string | null>(null)
  const [copied,          set_copied]          = useState(false)
  const [confirm_delete,  set_confirm_delete]  = useState(false)

  useEffect(() => {
    if (!open || !file) { set_url(null); set_confirm_delete(false); return }
    get_url(bucket, is_public, file.full_path).then(set_url)
  }, [open, file, bucket, is_public])

  const copy_url = async () => {
    if (!url) return
    await navigator.clipboard.writeText(url)
    set_copied(true)
    setTimeout(() => set_copied(false), 2000)
  }

  if (!file) return null

  const img = is_image(file)

  return (
    <Modal open={open} on_close={on_close} title={file.name} description={bucket} size="lg">
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Preview pane */}
        <div className="flex min-h-[200px] flex-1 items-center justify-center overflow-hidden rounded-xl border border-line/30 bg-line/10">
          {img && url ? (
            <img src={url} alt={file.name} className="max-h-[360px] w-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-3 py-12">
              <FileTypeIcon mime={file.metadata?.mimetype ?? ""} size={48} />
              <span className="font-mono text-xs text-muted">{file.metadata?.mimetype ?? "unknown"}</span>
            </div>
          )}
        </div>

        {/* Metadata + actions */}
        <div className="flex w-full flex-col gap-3 lg:w-56">
          <div className="space-y-2 rounded-xl border border-line/30 bg-line/10 p-3">
            <MetaRow label="File" value={file.name} />
            <MetaRow label="Path" value={file.full_path} mono />
            <MetaRow label="Type" value={file.metadata?.mimetype ?? "—"} />
            <MetaRow label="Size" value={file.metadata?.size != null ? fmt_bytes(file.metadata.size) : "—"} />
            <MetaRow label="Bucket" value={bucket} />
            <MetaRow label="Access" value={is_public ? "Public" : "Private"} />
            <MetaRow label="Uploaded" value={fmt_date(file.created_at)} />
          </div>

          {/* URL copy */}
          {url && (
            <button
              type="button"
              onClick={copy_url}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium transition-all ${
                copied
                  ? "border-light-green/30 bg-light-green/10 text-light-green"
                  : "border-line bg-line/20 text-muted hover:text-ink"
              }`}
            >
              {copied ? <CheckIcon size={12} /> : <ExternalLinkIcon size={12} />}
              {copied ? "Copied!" : "Copy URL"}
            </button>
          )}

          {/* Re-upload */}
          <button
            type="button"
            onClick={on_reupload}
            className="flex items-center gap-2 rounded-xl border border-line bg-line/20 px-3 py-2.5 text-xs font-medium text-muted transition-colors hover:text-ink"
          >
            <UploadIcon size={12} /> Replace file
          </button>

          {/* Delete */}
          {!confirm_delete ? (
            <button
              type="button"
              onClick={() => set_confirm_delete(true)}
              className="flex items-center gap-2 rounded-xl border border-flag-red/20 bg-flag-red/8 px-3 py-2.5 text-xs font-medium text-flag-red transition-colors hover:bg-flag-red/15"
            >
              <TrashIcon size={12} /> Delete file
            </button>
          ) : (
            <div className="flex flex-col gap-1.5">
              <p className="text-center text-[10px] text-muted">Permanently delete?</p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => set_confirm_delete(false)}
                  className="flex-1 rounded-xl border border-line py-2 text-[10px] font-medium text-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={on_delete}
                  className="flex-1 rounded-xl bg-flag-red py-2 text-[10px] font-medium text-white"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

const MetaRow = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div>
    <p className="text-[8px] font-bold uppercase tracking-wider text-muted/40">{label}</p>
    <p className={`mt-0.5 truncate text-[10px] text-ink ${mono ? "font-mono" : ""}`}>{value}</p>
  </div>
)

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StoragePage() {
  const { user }    = useAuth()
  const { profile } = useProfile()
  const notify      = use_notify()

  const [buckets,        set_buckets]        = useState<Bucket[]>([])
  const [active_bucket,  set_active_bucket]  = useState<string>("")
  const [files,          set_files]          = useState<StorageFile[]>([])
  const [loading,        set_loading]        = useState(true)
  const [files_loading,  set_files_loading]  = useState(false)
  const [search,         set_search]         = useState("")
  const [preview_file,   set_preview_file]   = useState<StorageFile | null>(null)
  const [uploading,      set_uploading]      = useState(false)

  const upload_ref    = useRef<HTMLInputElement>(null)
  const reupload_file = useRef<StorageFile | null>(null)

  if (!user) return <Navigate to="/login" replace />
  if (profile && profile.role !== "root") return <Navigate to="/" replace />

  const active_bucket_obj = buckets.find(b => b.id === active_bucket)

  // ── Fetch buckets ──────────────────────────────────────────────────────────

  // listBuckets() requires service-role key — hardcode known buckets instead
  useEffect(() => {
    const known: Bucket[] = [
      { id: "avatars",  name: "avatars",  public: true,  file_size_limit: 2097152 },
      { id: "profiles", name: "profiles", public: false, file_size_limit: 2097152 },
    ]
    set_buckets(known)
    set_active_bucket(known[0].id)
    set_loading(false)
  }, [])

  // ── Fetch files on bucket change ───────────────────────────────────────────

  const fetch_files = useCallback(async (bucket_id: string) => {
    set_files_loading(true)
    const result = await list_bucket_files(bucket_id)
    set_files(result)
    set_files_loading(false)
  }, [])

  useEffect(() => {
    if (!active_bucket) return
    fetch_files(active_bucket)
  }, [active_bucket, fetch_files])

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handle_delete = async (file: StorageFile) => {
    const { error } = await supabase.storage.from(active_bucket).remove([file.full_path])
    if (error) { notify({ tone: "error", title: "Delete failed", message: error.message }); return }
    notify({ tone: "success", title: "File deleted" })
    set_preview_file(null)
    fetch_files(active_bucket)
  }

  // ── Upload / re-upload ─────────────────────────────────────────────────────

  const trigger_upload = (replace_file: StorageFile | null = null) => {
    reupload_file.current = replace_file
    upload_ref.current?.click()
  }

  const handle_file_select = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""

    const replace = reupload_file.current
    const path = replace ? replace.full_path : file.name

    set_uploading(true)
    const { error } = await supabase.storage.from(active_bucket).upload(path, file, {
      upsert: !!replace,
      cacheControl: "3600",
    })
    set_uploading(false)

    if (error) { notify({ tone: "error", title: "Upload failed", message: error.message }); return }
    notify({ tone: "success", title: replace ? "File replaced" : "File uploaded" })
    if (preview_file && replace && preview_file.full_path === replace.full_path) {
      set_preview_file(null)
    }
    fetch_files(active_bucket)
  }

  // ── Filtered files ─────────────────────────────────────────────────────────

  const filtered = search
    ? files.filter(f => f.full_path.toLowerCase().includes(search.toLowerCase()))
    : files

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden">
      <SideRail />
      <main className="flex flex-1 flex-col overflow-hidden pt-14 lg:pt-0">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: ease_out }}
          className="flex shrink-0 flex-col gap-3 border-b border-line bg-card px-4 py-3 lg:px-6 lg:py-4"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-flag-red/10 text-flag-red">
              <BucketIcon />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-bold text-ink">Storage</h1>
              <p className="text-[10px] text-muted">
                {buckets.length} bucket{buckets.length !== 1 ? "s" : ""} · browse, preview, replace and delete files
              </p>
            </div>

            {/* Search */}
            <div className="relative hidden sm:block">
              <SearchIcon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search files…"
                value={search}
                onChange={e => set_search(e.target.value)}
                className="w-44 rounded-xl border border-line bg-line/20 py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-muted/40 focus:border-flag-red/40 focus:outline-none focus:ring-1 focus:ring-flag-red/20"
              />
              {search && (
                <button type="button" onClick={() => set_search("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
                  <XIcon size={10} />
                </button>
              )}
            </div>

            {/* Upload */}
            <button
              type="button"
              onClick={() => trigger_upload(null)}
              disabled={!active_bucket || uploading}
              className="flex items-center gap-2 rounded-xl bg-flag-red px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {uploading
                ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                : <UploadIcon size={12} />
              }
              Upload
            </button>
          </div>

          {/* Bucket tabs */}
          {!loading && (
            <div className="flex items-center gap-1">
              {buckets.map(b => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => set_active_bucket(b.id)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                    active_bucket === b.id
                      ? "border-flag-red/30 bg-flag-red/10 text-flag-red"
                      : "border-line bg-line/20 text-muted hover:text-ink"
                  }`}
                >
                  <BucketIcon size={11} />
                  {b.name}
                  <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${
                    b.public
                      ? "bg-light-green/15 text-light-green"
                      : "bg-line/40 text-muted"
                  }`}>
                    {b.public ? "public" : "private"}
                  </span>
                  {active_bucket === b.id && !files_loading && (
                    <span className="rounded-full bg-flag-red/20 px-1.5 text-[8px] font-bold text-flag-red">
                      {filtered.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </motion.div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {loading || files_loading ? (
            <div className="flex h-48 items-center justify-center">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-flag-red/20 border-t-flag-red" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-line/40 text-muted">
                <BucketIcon size={20} />
              </span>
              <p className="text-sm font-semibold text-ink">
                {search ? "No files match your search" : "No files in this bucket"}
              </p>
              {!search && (
                <button
                  type="button"
                  onClick={() => trigger_upload(null)}
                  className="text-xs text-flag-red underline underline-offset-2"
                >
                  Upload the first file
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              <AnimatePresence mode="popLayout">
                {filtered.map((file, i) => (
                  <motion.div
                    key={file.full_path}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15, delay: i * 0.02 }}
                  >
                    <FileCard
                      file={file}
                      bucket={active_bucket}
                      is_public={active_bucket_obj?.public ?? false}
                      on_preview={f => set_preview_file(f)}
                      on_delete={f => handle_delete(f)}
                      on_reupload={f => trigger_upload(f)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      {/* Hidden file input */}
      <input
        ref={upload_ref}
        type="file"
        className="hidden"
        onChange={handle_file_select}
      />

      {/* Preview modal */}
      <PreviewModal
        file={preview_file}
        bucket={active_bucket}
        is_public={active_bucket_obj?.public ?? false}
        open={!!preview_file}
        on_close={() => set_preview_file(null)}
        on_delete={() => preview_file && handle_delete(preview_file)}
        on_reupload={() => { if (preview_file) { set_preview_file(null); trigger_upload(preview_file) } }}
      />
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const ip = (size = 16) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.8,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
})

const EyeIcon = ({ size = 16 }: { size?: number }) => (
  <svg {...ip(size)}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const BucketIcon = ({ size = 16 }: { size?: number }) => (
  <svg {...ip(size)}>
    <path d="M22 8.5c0 2.485-4.477 4.5-10 4.5S2 10.985 2 8.5 6.477 4 12 4s10 2.015 10 4.5z" />
    <path d="M2 8.5v7C2 17.985 6.477 20 12 20s10-2.015 10-4.5v-7" />
    <path d="M2 12c0 2.485 4.477 4.5 10 4.5s10-2.015 10-4.5" />
  </svg>
)

const FileTypeIcon = ({ mime, size = 32 }: { mime: string; size?: number }) => {
  if (mime.startsWith("image/")) return (
    <svg {...ip(size)}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
  )
  if (mime.startsWith("video/")) return (
    <svg {...ip(size)}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
  )
  if (mime.startsWith("audio/")) return (
    <svg {...ip(size)}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
  )
  return (
    <svg {...ip(size)}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
  )
}
