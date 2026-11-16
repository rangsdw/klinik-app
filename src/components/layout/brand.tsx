import Link from "next/link";
import { Cross } from "lucide-react";
import { cn } from "@/lib/utils";

/** Wordmark klinik. Nama selalu dikirim dari clinicConfig (server). */
export function Brand({
  name,
  href = "/",
  className,
}: {
  name: string;
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={`${name}, ke beranda`}
      className={cn(
        "text-ink-strong inline-flex items-center gap-2.5 rounded-lg font-bold",
        className,
      )}
    >
      <span className="bg-primary-700 text-surface grid size-9 place-items-center rounded-lg">
        <Cross aria-hidden="true" className="size-5" strokeWidth={2.5} />
      </span>
      <span className="text-base whitespace-nowrap">{name}</span>
    </Link>
  );
}
