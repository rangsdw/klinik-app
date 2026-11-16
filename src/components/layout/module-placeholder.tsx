import type { LucideIcon } from "lucide-react";
import { Construction } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/page-header";
import { StatCard } from "@/components/ui-kit/stat-card";
import { EmptyState } from "@/components/ui-kit/empty-state";

type Stat = { label: string; icon: LucideIcon; value?: number | string | null; hint?: string };

type Props = {
  title: string;
  description: string;
  stats: Stat[];
  moduleNote: string;
};

/**
 * Kerangka dashboard: PageHeader + StatCard + EmptyState "Modul sedang dikembangkan".
 * Angka yang belum punya sumber data ditampilkan "-" (tidak mengarang angka).
 */
export function ModulePlaceholder({ title, description, stats, moduleNote }: Props) {
  return (
    <div className="space-y-8">
      <PageHeader title={title} description={description} />
      <section aria-label="Ringkasan" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((s) => (
          <StatCard
            key={s.label}
            label={s.label}
            icon={s.icon}
            value={s.value ?? null}
            hint={s.hint}
          />
        ))}
      </section>
      <EmptyState icon={Construction} title="Modul sedang dikembangkan" description={moduleNote} />
    </div>
  );
}
