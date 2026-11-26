import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FlaskConical,
  Package,
  PackageCheck,
  Pill,
  Search,
  TriangleAlert,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffType } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { NativeSelect } from "@/components/ui-kit/native-select";
import { PageHeader } from "@/components/ui-kit/page-header";
import { StatusBadge, type StatusVariant } from "@/components/ui-kit/status-badge";
import { advancePrescription } from "@/features/pharmacy/actions";
import { PrescriptionLabels } from "@/features/pharmacy/label";

export const metadata: Metadata = { title: "Farmasi" };

const STATUSES = ["WAITING", "PROCESSING", "READY", "DISPENSED"] as const;
type PharmacyStatusKey = (typeof STATUSES)[number];

const STATUS_LABEL: Record<PharmacyStatusKey, string> = {
  WAITING: "Menunggu",
  PROCESSING: "Diproses",
  READY: "Siap diserahkan",
  DISPENSED: "Selesai",
};

const STATUS_VARIANT: Record<PharmacyStatusKey, StatusVariant> = {
  WAITING: "warning",
  PROCESSING: "info",
  READY: "info",
  DISPENSED: "success",
};

const STATUS_ICON: Record<PharmacyStatusKey, typeof Clock> = {
  WAITING: Clock,
  PROCESSING: FlaskConical,
  READY: PackageCheck,
  DISPENSED: CheckCircle2,
};

const NEXT_ACTION: Record<PharmacyStatusKey, readonly [string, string] | null> = {
  WAITING: ["PROCESSING", "Terima E-Resep"],
  PROCESSING: ["READY", "Tandai Siap"],
  READY: ["DISPENSED", "Konfirmasi Penyerahan"],
  DISPENSED: null,
};

const ERRORS: Record<string, string> = {
  legacy: "Stok lama belum memiliki data kedaluwarsa valid. Verifikasi batch fisik sebelum penyerahan.",
  verification: "Konfirmasi pemeriksaan obat dan identitas pasien terlebih dahulu.",
  stock: "Stok tidak cukup atau obat tidak aktif. Penyerahan dibatalkan.",
  state: "Status resep sudah berubah. Muat ulang halaman.",
  quantity: "Jumlah obat tidak valid.",
  invalid: "Permintaan tidak valid.",
  retry: "Gagal menyimpan. Coba lagi.",
};

export default async function PharmacyPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; error?: string; success?: string }>;
}) {
  await requireStaffType("PHARMACY");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const status = STATUSES.find((s) => s === params.status);

  const [counts, records, activeMedicines] = await Promise.all([
    db.medicalRecord.groupBy({
      by: ["pharmacyStatus"],
      where: { prescriptions: { some: {} }, appointment: { status: "COMPLETED" } },
      _count: { _all: true },
    }),
    db.medicalRecord.findMany({
      where: {
        prescriptions: { some: {} },
        appointment: { status: "COMPLETED" },
        ...(status ? { pharmacyStatus: status } : {}),
        ...(q
          ? {
              OR: [
                { patient: { name: { contains: q } } },
                { patient: { medicalRecordNumber: { contains: q } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        createdAt: true,
        pharmacyStatus: true,
        pharmacyDispensedAt: true,
        patient: { select: { name: true, medicalRecordNumber: true, allergies: true } },
        doctor: { select: { name: true } },
        prescriptions: {
          select: {
            id: true,
            quantity: true,
            dosageInstructions: true,
            notes: true,
            medicine: { select: { name: true, stock: true, unit: true, isActive: true } },
          },
        },
      },
    }),
    db.medicine.findMany({
      where: { isActive: true },
      select: { stock: true, minimumStock: true },
    }),
  ]);
  const lowStock = activeMedicines.filter((m) => m.stock <= m.minimumStock).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Farmasi"
        description="Kelola antrean e-resep, cetak etiket obat, dan verifikasi penyerahan dengan metode FEFO."
        actions={
          <Button asChild variant="outline">
            <Link href="/staf/farmasi/obat">
              <Package aria-hidden="true" className="size-4" />
              Master Obat &amp; Stok
            </Link>
          </Button>
        }
      />

      {params.error ? (
        <div
          role="alert"
          className="border-danger/30 bg-danger-soft text-danger-ink flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{ERRORS[params.error] ?? "Terjadi kesalahan."}</span>
        </div>
      ) : null}

      {params.success ? (
        <div
          role="status"
          className="border-success/30 bg-success-soft text-success-ink flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium"
        >
          <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
          <span>Status resep berhasil diperbarui.</span>
        </div>
      ) : null}

      {/* Ringkasan KPI & Filter Cepat */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {STATUSES.map((s) => {
          const count = counts.find((c) => c.pharmacyStatus === s)?._count._all ?? 0;
          const Icon = STATUS_ICON[s];
          const isSelected = status === s;
          const href = isSelected
            ? q
              ? `?q=${encodeURIComponent(q)}`
              : "/staf/farmasi"
            : q
              ? `?status=${s}&q=${encodeURIComponent(q)}`
              : `?status=${s}`;

          return (
            <Link
              key={s}
              href={href}
              aria-current={isSelected ? "true" : undefined}
              className={
                isSelected
                  ? "border-primary-700 bg-primary-50/60 ring-primary-700 shadow-card flex flex-col gap-3 rounded-xl border p-5 ring-1 transition-colors"
                  : "border-line bg-surface hover:border-primary-300 shadow-card flex flex-col gap-3 rounded-xl border p-5 transition-colors"
              }
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-ink-soft text-sm font-medium whitespace-nowrap">
                  {STATUS_LABEL[s]}
                </p>
                <Icon aria-hidden="true" className="text-primary-700 size-5 shrink-0" />
              </div>
              <p className="tabular text-ink-strong text-3xl font-bold">{count}</p>
              <p className="text-ink-muted text-xs">
                {isSelected ? "Filter aktif (klik untuk reset)" : "Klik untuk menyaring"}
              </p>
            </Link>
          );
        })}

        <Link
          href="/staf/farmasi/obat"
          className="border-line bg-surface hover:border-primary-300 shadow-card flex flex-col gap-3 rounded-xl border p-5 transition-colors"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-ink-soft text-sm font-medium whitespace-nowrap">Stok menipis</p>
            <AlertTriangle aria-hidden="true" className="text-warning-ink size-5 shrink-0" />
          </div>
          <p className="tabular text-ink-strong text-3xl font-bold">{lowStock}</p>
          <p className="text-ink-muted text-xs">Obat aktif di bawah / sama dengan stok minimum</p>
        </Link>
      </div>

      {/* Pencarian & Antrean E-Resep */}
      <section aria-labelledby="heading-antrean-eresep" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="heading-antrean-eresep" className="text-ink-strong text-lg font-bold">
            Antrean e-resep
          </h2>
          <p className="text-ink-muted text-xs">
            Menampilkan {records.length} resep terbaru (maksimal 100 sesuai filter)
          </p>
        </div>

        <form className="border-line bg-surface shadow-card flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center">
          <Input
            name="q"
            defaultValue={q}
            placeholder="Cari nama pasien atau nomor RM"
            aria-label="Cari pasien"
            className="sm:flex-1"
          />
          <div className="sm:w-52">
            <NativeSelect name="status" defaultValue={status ?? ""} aria-label="Status resep">
              <option value="">Semua status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" variant="outline">
              <Search aria-hidden="true" className="size-4" />
              Cari
            </Button>
            {q || status ? (
              <Button asChild variant="ghost">
                <Link href="/staf/farmasi">Reset</Link>
              </Button>
            ) : null}
          </div>
        </form>

        {records.length === 0 ? (
          <EmptyState
            icon={Pill}
            title="Belum ada e-resep yang sesuai"
            description="Resep akan muncul setelah dokter menyelesaikan pemeriksaan dan menyimpan resep."
            action={
              q || status ? (
                <Button asChild variant="outline">
                  <Link href="/staf/farmasi">Tampilkan Semua Resep</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-4">
            {records.map((r) => {
              const action = NEXT_ACTION[r.pharmacyStatus];
              const StatusIcon = STATUS_ICON[r.pharmacyStatus];

              return (
                <article
                  key={r.id}
                  className="border-line bg-surface shadow-card overflow-hidden rounded-2xl border"
                >
                  <div className="border-line flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
                    <div className="min-w-0 space-y-1">
                      <h3 className="text-ink-strong text-base font-bold">{r.patient.name}</h3>
                      <p className="text-ink-muted text-sm">
                        <span className="font-mono">{r.patient.medicalRecordNumber}</span>,{" "}
                        {r.doctor.name},{" "}
                        {r.createdAt.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}
                      </p>
                    </div>
                    <StatusBadge variant={STATUS_VARIANT[r.pharmacyStatus]} icon={StatusIcon}>
                      {STATUS_LABEL[r.pharmacyStatus]}
                    </StatusBadge>
                  </div>

                  {r.patient.allergies ? (
                    <div className="border-warning/30 bg-warning-soft text-warning-ink flex items-start gap-2.5 border-b px-5 py-3 text-sm">
                      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                      <span>
                        <span className="font-semibold">Alergi tercatat:</span>{" "}
                        {r.patient.allergies}. Verifikasi sebelum penyerahan.
                      </span>
                    </div>
                  ) : null}

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-line bg-paper text-ink-soft border-b text-xs font-medium">
                        <tr>
                          <th className="px-5 py-2.5 whitespace-nowrap">Obat</th>
                          <th className="px-4 py-2.5 whitespace-nowrap">Jumlah</th>
                          <th className="px-4 py-2.5 whitespace-nowrap">Aturan pakai / catatan</th>
                          <th className="px-5 py-2.5 whitespace-nowrap">Stok saat ini</th>
                        </tr>
                      </thead>
                      <tbody className="divide-line divide-y">
                        {r.prescriptions.map((i) => {
                          const isOut = !i.medicine.isActive || i.medicine.stock < i.quantity;
                          return (
                            <tr key={i.id}>
                              <td className="text-ink-strong px-5 py-3 font-medium">
                                {i.medicine.name}
                              </td>
                              <td className="tabular text-ink px-4 py-3 whitespace-nowrap">
                                {i.quantity} {i.medicine.unit}
                              </td>
                              <td className="text-ink px-4 py-3">
                                <p>{i.dosageInstructions}</p>
                                {i.notes ? (
                                  <p className="text-ink-muted mt-0.5 text-xs">{i.notes}</p>
                                ) : null}
                              </td>
                              <td className="tabular px-5 py-3 whitespace-nowrap">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={isOut ? "text-danger-ink font-semibold" : "text-ink"}>
                                    {i.medicine.stock}
                                  </span>
                                  {!i.medicine.isActive ? (
                                    <StatusBadge variant="neutral">Nonaktif</StatusBadge>
                                  ) : i.medicine.stock < i.quantity ? (
                                    <StatusBadge variant="danger" icon={AlertTriangle}>
                                      Stok kurang
                                    </StatusBadge>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="border-line bg-paper flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-3">
                      {r.pharmacyStatus !== "WAITING" ? (
                        <PrescriptionLabels
                          patient={r.patient.name}
                          doctor={r.doctor.name}
                          recordId={r.id}
                          items={r.prescriptions.map((i) => ({
                            id: i.id,
                            name: i.medicine.name,
                            quantity: i.quantity,
                            unit: i.medicine.unit,
                            instructions: i.dosageInstructions,
                            notes: i.notes,
                          }))}
                        />
                      ) : null}

                      {r.pharmacyDispensedAt ? (
                        <p className="tabular text-ink-muted text-xs">
                          Diserahkan:{" "}
                          {r.pharmacyDispensedAt.toLocaleString("id-ID", {
                            timeZone: "Asia/Jakarta",
                          })}
                        </p>
                      ) : null}
                    </div>

                    {action ? (
                      <form
                        action={advancePrescription}
                        className="flex flex-wrap items-center gap-3"
                      >
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="target" value={action[0]} />
                        {r.pharmacyStatus === "READY" ? (
                          <label className="text-ink inline-flex cursor-pointer items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              name="verified"
                              value="yes"
                              required
                              className="accent-primary-700 size-4 rounded"
                            />
                            <span>Obat dan identitas pasien sudah diperiksa</span>
                          </label>
                        ) : null}
                        <Button type="submit" size="sm">
                          {action[1]}
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
