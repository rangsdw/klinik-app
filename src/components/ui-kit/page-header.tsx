import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

/** Judul halaman + subjudul + slot aksi. Dipakai di semua area. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-ink-strong text-2xl font-bold tracking-tight sm:text-[1.75rem]">
          {title}
        </h1>
        {description ? <p className="text-ink-muted max-w-prose">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
