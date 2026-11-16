import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Memuat daftar akun">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-11 w-full max-w-xl" />
      <div className="border-line bg-surface space-y-2 rounded-xl border p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    </div>
  );
}
