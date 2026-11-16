import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  /** Angka nyata, atau null bila datanya belum tersedia (ditampilkan "—"). */
  value: number | string | null;
  icon?: LucideIcon;
  hint?: string;
  className?: string;
};

/** Angka + label + keterangan. Angka memakai tabular numerals. */
export function StatCard({ label, value, icon: Icon, hint, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "border-line bg-surface shadow-card flex flex-col gap-3 rounded-xl border p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-ink-soft text-sm font-medium whitespace-nowrap">{label}</p>
        {Icon ? <Icon aria-hidden="true" className="text-primary-700 size-5" /> : null}
      </div>
      <p className="tabular text-ink-strong text-3xl font-bold">
        {value === null ? <span className="text-ink-muted">-</span> : value}
      </p>
      {hint ? <p className="text-ink-muted text-sm">{hint}</p> : null}
    </div>
  );
}
