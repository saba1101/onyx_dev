import { supabase } from "~/lib/supabase"

export type TableStat = {
  name:        string
  size_bytes:  number
  table_bytes: number
  index_bytes: number
}

export type BucketStat = {
  name:            string
  public:          boolean
  file_size_limit: number | null
  object_count:    number
  total_bytes:     number
}

export type SystemStats = {
  db: {
    size_bytes:         number
    active_connections: number
    total_connections:  number
    cache_hit_rate:     number | null
  }
  tables:  TableStat[]
  storage: BucketStat[]
}

export const fetch_system_stats = async (): Promise<{ data: SystemStats | null; error: string | null }> => {
  const { data, error } = await supabase.rpc("get_system_stats")
  if (error) return { data: null, error: error.message }
  return { data: data as SystemStats, error: null }
}

export const fmt_bytes = (bytes: number): string => {
  if (bytes === 0) return "0 B"
  if (bytes < 1_024) return `${bytes} B`
  if (bytes < 1_024 * 1_024) return `${(bytes / 1_024).toFixed(1)} KB`
  if (bytes < 1_024 * 1_024 * 1_024) return `${(bytes / (1_024 * 1_024)).toFixed(1)} MB`
  return `${(bytes / (1_024 * 1_024 * 1_024)).toFixed(2)} GB`
}
