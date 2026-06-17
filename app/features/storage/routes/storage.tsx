import { useState, useEffect, useRef, useCallback } from "react"
import { Navigate } from "react-router"
import { motion, AnimatePresence } from "motion/react"
import { useAuth } from "~/features/auth/lib/auth"
import { useProfile } from "~/features/profile/lib/profile-context"
import { SideRail } from "~/components/ui/side-rail"
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
  full_path:  string
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

// ── File row (left panel) ─────────────────────────────────────────────────────

const FileRow = ({
  file, bucket, is_public, active, on_select,
}: {
  file:      StorageFile
  bucket:    string
  is_public: boolean
  active:    boolean
  on_select: () => void
}) => {
  const [thumb, set_thumb] = useState<string | null>(null)

  useEffect(() => {
    if (!is_image(file)) return
    if (is_public) {
      supabase.storage.from(bucket).getPublicUrl(file.full_path).data.publicUrl
        && set_thumb(supabase.storage.from(bucket).getPublicUrl(file.full_path).data.publicUrl)
    }
    // private buckets: skip thumbnail in list (avoid N signed-URL calls)
  }, [file, bucket, is_public])

  return (
    <button
      type="button"
      onClick={on_select}
      className={`flex w-full items-center gap-3 border-b border-line/30 px-4 py-3 text-left transition-colors ${
        active
          ? "bg-flag-red/8 border-l-2 border-l-flag-red"
          : "hover:bg-line/20"
      }`}
    >
      {/* Mini thumbnail or icon */}
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-line/40 bg-line/20 flex items-center justify-center">
        {thumb ? (
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <FileTypeIcon mime={file.metadata?.mimetype ?? ""} size={16} />
        )}
      </div>

      {/* Name + meta */}
      <div className="min-w-0 flex-1">
        <p className={`truncate text-xs font-semibold ${active ? "text-flag-red" : "text-ink"}`}>
          {file.name}
        </p>
        <p className="mt-0.5 font-mono text-[9px] text-muted/50 truncate">{file.full_path}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          {file.metadata?.size != null && (
            <span className="text-[9px] text-muted">{fmt_bytes(file.metadata.size)}</span>
          )}
          {file.created_at && (
            <>
              <span className="text-muted/30">·</span>
              <span className="text-[9px] text-muted/50">{fmt_date(file.created_at)}</span>
            </>
          )}
        </div>
      </div>
    </button>
  )
}

// ── Details panel (right side) ────────────────────────────────────────────────

const DetailsPanel = ({
  file, url, is_public, bucket, copied, uploading,
  on_copy, on_reupload, on_delete,
}: {
  file:       StorageFile
  url:        string | null
  is_public:  boolean
  bucket:     string
  copied:     boolean
  uploading:  boolean
  on_copy:    () => void
  on_reupload:() => void
  on_delete:  () => void
}) => {
  const [confirm, set_confirm] = useState(false)

  useEffect(() => { set_confirm(false) }, [file.full_path])

  const img = is_image(file)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Preview area */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-line/5">
        <AnimatePresence mode="wait">
          {img && url ? (
            <motion.img
              key={url}
              src={url}
              alt={file.name}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: ease_out }}
              className="max-h-full max-w-full object-contain p-6"
            />
          ) : (
            <motion.div
              key="icon"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-4 py-16"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-line/40 bg-line/20">
                <FileTypeIcon mime={file.metadata?.mimetype ?? ""} size={36} />
              </div>
              <span className="font-mono text-xs text-muted">{file.metadata?.mimetype ?? "unknown type"}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Badge: public / private */}
        <span className={`absolute right-4 top-4 rounded-full px-2.5 py-1 text-[9px] font-bold ${
          is_public ? "bg-light-green/15 text-light-green" : "bg-line/40 text-muted"
        }`}>
          {is_public ? "public" : "private"}
        </span>
      </div>

      {/* Metadata + actions */}
      <div className="shrink-0 border-t border-line bg-card px-5 py-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">{file.name}</p>
            <p className="mt-0.5 truncate font-mono text-[10px] text-muted">{file.full_path}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-[9px] text-muted">
            {file.metadata?.size != null && (
              <span className="rounded-md border border-line/50 bg-line/20 px-2 py-1 font-mono">
                {fmt_bytes(file.metadata.size)}
              </span>
            )}
            {file.metadata?.mimetype && (
              <span className="rounded-md border border-line/50 bg-line/20 px-2 py-1 font-mono">
                {file.metadata.mimetype.split("/")[1]}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {/* Copy URL */}
          <button
            type="button"
            onClick={on_copy}
            disabled={!url}
            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all disabled:opacity-30 ${
              copied
                ? "border-light-green/30 bg-light-green/10 text-light-green"
                : "border-line bg-line/20 text-muted hover:text-ink"
            }`}
          >
            {copied ? <CheckIcon size={12} /> : <ExternalLinkIcon size={12} />}
            {copied ? "Copied" : "Copy URL"}
          </button>

          {/* Replace */}
          <button
            type="button"
            onClick={on_reupload}
            disabled={uploading}
            className="flex items-center justify-center gap-2 rounded-xl border border-line bg-line/20 px-3 py-2 text-xs font-medium text-muted transition-colors hover:text-ink disabled:opacity-40"
          >
            {uploading
              ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted/30 border-t-muted" />
              : <UploadIcon size={12} />
            }
            Replace
          </button>

          {/* Delete */}
          {!confirm ? (
            <button
              type="button"
              onClick={() => set_confirm(true)}
              className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-flag-red/20 bg-flag-red/8 px-3 py-2 text-xs font-medium text-flag-red transition-colors hover:bg-flag-red/15 sm:col-span-2"
            >
              <TrashIcon size={12} /> Delete file
            </button>
          ) : (
            <div className="col-span-2 flex gap-2 sm:col-span-2">
              <button
                type="button"
                onClick={() => set_confirm(false)}
                className="flex-1 rounded-xl border border-line py-2 text-xs font-medium text-muted transition-colors hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={on_delete}
                className="flex-1 rounded-xl bg-flag-red py-2 text-xs font-medium text-white transition-opacity hover:opacity-80"
              >
                Confirm delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StoragePage() {
  const { user }    = useAuth()
  const { profile } = useProfile()
  const notify      = use_notify()

  const [buckets,       set_buckets]       = useState<Bucket[]>([])
  const [active_bucket, set_active_bucket] = useState<string>("")
  const [files,         set_files]         = useState<StorageFile[]>([])
  const [loading,       set_loading]       = useState(true)
  const [files_loading, set_files_loading] = useState(false)
  const [search,        set_search]        = useState("")
  const [selected,      set_selected]      = useState<StorageFile | null>(null)
  const [selected_url,  set_selected_url]  = useState<string | null>(null)
  const [copied,        set_copied]        = useState(false)
  const [uploading,     set_uploading]     = useState(false)

  const upload_ref    = useRef<HTMLInputElement>(null)
  const reupload_file = useRef<StorageFile | null>(null)

  if (!user) return <Navigate to="/login" replace />
  if (profile && profile.role !== "root") return <Navigate to="/" replace />

  const active_bucket_obj = buckets.find(b => b.id === active_bucket)
  const is_public = active_bucket_obj?.public ?? false

  // listBuckets() requires service-role key — hardcode known buckets
  useEffect(() => {
    const known: Bucket[] = [
      { id: "avatars",  name: "avatars",  public: true,  file_size_limit: 2097152 },
      { id: "profiles", name: "profiles", public: false, file_size_limit: 2097152 },
    ]
    set_buckets(known)
    set_active_bucket(known[0].id)
    set_loading(false)
  }, [])

  const fetch_files = useCallback(async (bucket_id: string) => {
    set_files_loading(true)
    const result = await list_bucket_files(bucket_id)
    set_files(result)
    set_files_loading(false)
  }, [])

  useEffect(() => {
    if (!active_bucket) return
    fetch_files(active_bucket)
    set_selected(null)
  }, [active_bucket, fetch_files])

  // Fetch URL when selected file changes
  useEffect(() => {
    if (!selected) { set_selected_url(null); return }
    get_url(active_bucket, is_public, selected.full_path).then(set_selected_url)
  }, [selected, active_bucket, is_public])

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handle_delete = async (file: StorageFile) => {
    const { data, error } = await supabase.storage.from(active_bucket).remove([file.full_path])
    if (error) { notify({ tone: "error", title: "Delete failed", message: error.message }); return }
    if (!data || data.length === 0) {
      notify({ tone: "error", title: "Delete failed", message: "Permission denied or file not found." })
      return
    }
    notify({ tone: "success", title: "File deleted" })
    set_files(prev => prev.filter(f => f.full_path !== file.full_path))
    set_selected(null)
    set_selected_url(null)
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
    await fetch_files(active_bucket)
  }

  const handle_copy_url = async () => {
    if (!selected_url) return
    await navigator.clipboard.writeText(selected_url)
    set_copied(true)
    setTimeout(() => set_copied(false), 2000)
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

        {/* Split-panel content */}
        {loading || files_loading ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-flag-red/20 border-t-flag-red" />
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">

            {/* Left panel — file list */}
            <div className="w-72 shrink-0 overflow-y-auto border-r border-line">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-line/30 text-muted">
                    <BucketIcon size={18} />
                  </span>
                  <p className="text-xs font-semibold text-ink">
                    {search ? "No matches" : "Empty bucket"}
                  </p>
                  {!search && (
                    <button
                      type="button"
                      onClick={() => trigger_upload(null)}
                      className="text-[11px] text-flag-red underline underline-offset-2"
                    >
                      Upload first file
                    </button>
                  )}
                </div>
              ) : (
                <AnimatePresence mode="popLayout" initial={false}>
                  {filtered.map(file => (
                    <motion.div
                      key={file.full_path}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.15 }}
                    >
                      <FileRow
                        file={file}
                        bucket={active_bucket}
                        is_public={is_public}
                        active={selected?.full_path === file.full_path}
                        on_select={() => set_selected(file)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Right panel — preview / empty state */}
            <div className="flex flex-1 overflow-hidden">
              <AnimatePresence mode="wait">
                {selected ? (
                  <motion.div
                    key={selected.full_path}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-1 flex-col overflow-hidden"
                  >
                    <DetailsPanel
                      file={selected}
                      url={selected_url}
                      is_public={is_public}
                      bucket={active_bucket}
                      copied={copied}
                      uploading={uploading}
                      on_copy={handle_copy_url}
                      on_reupload={() => trigger_upload(selected)}
                      on_delete={() => handle_delete(selected)}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-1 flex-col items-center justify-center gap-3 text-center"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line/40 bg-line/20 text-muted">
                      <BucketIcon size={24} />
                    </div>
                    <p className="text-sm font-semibold text-ink">Select a file</p>
                    <p className="text-xs text-muted">
                      Click any file in the list to preview it
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        )}
      </main>

      {/* Hidden file input */}
      <input
        ref={upload_ref}
        type="file"
        className="hidden"
        onChange={handle_file_select}
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
