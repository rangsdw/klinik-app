import { Check, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Janji dibuat", done: true },
  { label: "Disetujui klinik", done: true },
  { label: "Check-in dengan QR", current: true },
  { label: "Diperiksa dokter" },
];

/**
 * Contoh tampilan tiket antrean di portal pasien (produk dibangun di slot, belum ada data nyata).
 * Signature halaman: tiket di HP pasien adalah janji klinik "tanpa menunggu lama".
 */
export function QueueTicket() {
  return (
    <figure data-slot="hero-product" className="w-full max-w-[540px] lg:justify-self-start">
      <div className="border-primary-200 bg-surface shadow-ticket overflow-hidden rounded-[1.75rem] border">
        <div className="bg-primary-700 text-surface px-8 pt-8 pb-10">
          <p className="text-primary-100 text-sm">Nomor antrean Anda</p>
          <p className="tabular mt-1 text-[6.5rem] leading-none font-bold tracking-tight sm:text-[8rem]">
            A-07
          </p>
          <p className="text-primary-50 mt-4 text-base">Poli umum, berobat untuk anak Anda</p>
        </div>
        <div className="relative px-8 py-8">
          <span
            aria-hidden="true"
            className="bg-paper absolute -top-3 -left-3 size-6 rounded-full"
          />
          <span
            aria-hidden="true"
            className="bg-paper absolute -top-3 -right-3 size-6 rounded-full"
          />
          <ol className="space-y-4" aria-label="Status kunjungan">
            {STEPS.map((s) => (
              <li key={s.label} className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                    s.done && "border-primary-700 bg-primary-700 text-surface",
                    s.current && "border-primary-700 bg-primary-50 text-primary-800",
                    !s.done && !s.current && "border-line-strong text-ink-muted",
                  )}
                >
                  {s.done ? (
                    <Check aria-hidden="true" className="size-4" />
                  ) : s.current ? (
                    <QrCode aria-hidden="true" className="size-4" />
                  ) : null}
                </span>
                <span
                  className={cn(
                    "text-base",
                    s.current
                      ? "text-ink-strong font-semibold"
                      : s.done
                        ? "text-ink-soft"
                        : "text-ink-muted",
                  )}
                >
                  {s.label}
                  {s.current ? <span className="sr-only"> (langkah sekarang)</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <figcaption className="text-ink-muted mt-4 text-center text-sm">
        Contoh tampilan antrean di portal pasien
      </figcaption>
    </figure>
  );
}
