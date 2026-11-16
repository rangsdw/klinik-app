import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

/** Empty state yang ramah: ikon, judul, deskripsi, aksi opsional. */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "border-line-strong bg-surface flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      <span className="bg-primary-50 text-primary-700 mb-4 grid size-14 place-items-center rounded-full">
        <Icon aria-hidden="true" className="size-7" />
      </span>
      <h2 className="text-ink-strong text-lg font-semibold">{title}</h2>
      {description ? (
        <p className="text-ink-muted mt-1.5 max-w-sm text-sm leading-relaxed">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
