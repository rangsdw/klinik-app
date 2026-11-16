import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
  /** Kolom utama: jadi judul kartu di mobile. */
  primary?: boolean;
  /** Kolom aksi: diletakkan di bawah kartu di mobile. */
  actions?: boolean;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption?: string;
  empty?: React.ReactNode;
  className?: string;
};

/**
 * Tabel sederhana yang responsif: tabel penuh di >= md, berubah menjadi daftar kartu di mobile.
 * Kepala tabel sentence case, garis horizontal saja.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  empty,
  className,
}: DataTableProps<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  const primary = columns.find((c) => c.primary) ?? columns[0];
  const actions = columns.filter((c) => c.actions);
  const rest = columns.filter((c) => c !== primary && !c.actions);

  return (
    <div className={cn("border-line bg-surface rounded-xl border", className)}>
      {/* Desktop */}
      <table className="hidden w-full text-left text-sm md:table">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-line border-b">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  "text-ink-soft px-4 py-3 font-semibold whitespace-nowrap",
                  c.actions && "text-right",
                  c.className,
                )}
              >
                {c.actions ? <span className="sr-only">{c.header}</span> : c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-line hover:bg-paper border-b last:border-0">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    "text-ink px-4 py-3 align-middle",
                    c.actions && "text-right",
                    c.className,
                  )}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile: kartu berlabel */}
      <ul className="divide-line divide-y md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={rowKey(row)} className="flex flex-col gap-3 p-4">
            <div className="text-ink-strong font-semibold">{primary?.cell(row)}</div>
            {rest.length > 0 ? (
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
                {rest.map((c) => (
                  <div key={c.key} className="contents">
                    <dt className="text-ink-muted">{c.header}</dt>
                    <dd className="text-ink min-w-0">{c.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {actions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {actions.map((c) => (
                  <div key={c.key}>{c.cell(row)}</div>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
