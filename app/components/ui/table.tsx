import type { ReactNode } from "react"

export type TableColumn<T> = {
  key:        string
  header:     ReactNode
  align?:     "left" | "right"
  className?: string
  cell:       (row: T) => ReactNode
}

type TableProps<T> = {
  columns:       TableColumn<T>[]
  rows:          T[]
  row_key:       (row: T) => string
  on_row_click?: (row: T) => void
  empty?:        ReactNode
}

// Shared data table — striped rows, sticky-style header, optional click-through.
export function Table<T>({ columns, rows, row_key, on_row_click, empty }: TableProps<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>

  return (
    <div className="surface overflow-hidden rounded-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-line/60 text-[10px] uppercase tracking-widest text-muted">
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`px-4 py-2.5 font-medium ${col.align === "right" ? "text-right" : ""} ${col.className ?? ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr
                key={row_key(row)}
                onClick={on_row_click ? () => on_row_click(row) : undefined}
                className={`group border-b border-line/50 transition-colors last:border-0 even:bg-muted/[0.08] ${
                  on_row_click ? "cursor-pointer hover:bg-flag-red/[0.04] dark:hover:bg-flag-red/[0.06]" : ""
                }`}
              >
                {columns.map(col => (
                  <td key={col.key} className={`px-4 py-3 ${col.align === "right" ? "text-right" : ""} ${col.className ?? ""}`}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
