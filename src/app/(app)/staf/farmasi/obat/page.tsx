import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Package,
  PackagePlus,
  Pencil,
  Pill,
  Search,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffType } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { NativeSelect } from "@/components/ui-kit/native-select";
import { PageHeader } from "@/components/ui-kit/page-header";
import { StatCard } from "@/components/ui-kit/stat-card";
import { StatusBadge } from "@/components/ui-kit/status-badge";
import {
  receiveStock,
  saveMedicine,
  setMedicineActive,
} from "@/features/pharmacy/inventory-actions";

export const metadata: Metadata = { title: "Master Obat & Stok" };

const ERRORS: Record<string, string> = {
  invalid: "Input tidak valid. Periksa data dan ulangi.",
  duplicate: "Kode obat sudah dipakai.",
  notfound: "Obat tidak ditemukan.",
  failed: "Gagal menyimpan data.",
};

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; q?: string; error?: string; success?: string }>;
}) {
  await requireStaffType("PHARMACY");
  const p = await searchParams;
  const q = (p.q ?? "").trim().slice(0, 100);

  const medicines = await db.medicine.findMany({
    where: q ? { OR: [{ name: { contains: q } }, { code: { contains: q } }] } : {},
    orderBy: { name: "asc" },
    take: 200,
    include: { batches: { where: { quantity: { gt: 0 } }, orderBy: { expiryDate: "asc" } } },
  });

  const edit = p.edit ? await db.medicine.findUnique({ where: { id: p.edit } }) : null;
  const now = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const soon = new Date(now.getTime() + 30 * 86400000);

  const lowStockCount = medicines.filter((m) => m.stock <= m.minimumStock).length;
  const expiringCount = medicines
    .flatMap((m) => m.batches)
    .filter((b) => b.expiryDate <= soon && b.batchNumber !== "LEGACY-PERLU-VERIFIKASI").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Obat, Batch & Stok"
        description="Stok keluar saat resep diserahkan menggunakan FEFO (kedaluwarsa terdekat lebih dulu)."
        actions={
          <Button asChild variant="outline">
            <Link href="/staf/farmasi">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Kembali ke E-Resep
            </Link>
          </Button>
        }
      />

      {p.error ? (
        <div
          role="alert"
          className="border-danger/30 bg-danger-soft text-danger-ink flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{ERRORS[p.error] ?? "Periksa data dan ulangi."}</span>
        </div>
      ) : null}

      {p.success ? (
        <div
          role="status"
          className="border-success/30 bg-success-soft text-success-ink flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium"
        >
          <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
          <span>Data obat dan stok berhasil disimpan.</span>
        </div>
      ) : null}

      {/* KPI Ringkasan Inventaris */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Obat ditampilkan"
          value={medicines.length}
          icon={Pill}
          hint={q ? `Hasil filter "${q}"` : "Katalog master obat terdaftar"}
        />
        <StatCard
          label="Stok menipis"
          value={lowStockCount}
          icon={AlertTriangle}
          hint="Stok saat ini mencapai atau di bawah minimum"
        />
        <StatCard
          label="Batch kedaluwarsa / segera"
          value={expiringCount}
          icon={CalendarClock}
          hint="Batch aktif kedaluwarsa dalam 30 hari"
        />
      </div>

      {/* Form Master Obat & Stok Masuk */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          className={
            edit
              ? "border-primary-700 bg-surface shadow-card ring-primary-700/20 border ring-1"
              : "border-line bg-surface shadow-card border"
          }
        >
          <CardHeader className="border-line flex flex-row items-center justify-between gap-3 border-b">
            <CardTitle className="text-ink-strong flex items-center gap-2 text-base font-semibold">
              <Package aria-hidden="true" className="text-primary-700 size-5" />
              {edit ? "Edit Master Obat" : "Tambah Master Obat"}
            </CardTitle>
            {edit ? <StatusBadge variant="info">Mode edit</StatusBadge> : null}
          </CardHeader>
          <CardContent className="p-5">
            <form action={saveMedicine} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={edit?.id ?? ""} />

              <div className="space-y-1.5">
                <Label htmlFor="med-code">Kode obat</Label>
                <Input
                  id="med-code"
                  required
                  name="code"
                  defaultValue={edit?.code ?? ""}
                  placeholder="Contoh: MED-006"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="med-name">Nama obat</Label>
                <Input
                  id="med-name"
                  required
                  name="name"
                  defaultValue={edit?.name ?? ""}
                  placeholder="Contoh: Paracetamol 500mg"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="med-category">Kategori</Label>
                <Input
                  id="med-category"
                  name="category"
                  defaultValue={edit?.category ?? ""}
                  placeholder="Opsional (mis. Analgesik)"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="med-form">Bentuk sediaan</Label>
                <Input
                  id="med-form"
                  required
                  name="dosageForm"
                  defaultValue={edit?.dosageForm ?? ""}
                  placeholder="Tablet, Kapsul, Sirup"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="med-unit">Satuan</Label>
                <Input
                  id="med-unit"
                  required
                  name="unit"
                  defaultValue={edit?.unit ?? ""}
                  placeholder="Strip, Botol, Tube"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="med-price">Harga (Rp)</Label>
                <Input
                  id="med-price"
                  required
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={edit ? Number(edit.price) : 0}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="med-min-stock">Stok minimum</Label>
                <Input
                  id="med-min-stock"
                  required
                  name="minimumStock"
                  type="number"
                  min="0"
                  defaultValue={edit?.minimumStock ?? 10}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1 sm:col-span-2">
                <Button type="submit">{edit ? "Simpan Perubahan" : "Simpan Master Obat"}</Button>
                {edit ? (
                  <Button asChild variant="outline">
                    <Link href="/staf/farmasi/obat">Batal</Link>
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-line bg-surface shadow-card border">
          <CardHeader className="border-line border-b">
            <CardTitle className="text-ink-strong flex items-center gap-2 text-base font-semibold">
              <PackagePlus aria-hidden="true" className="text-primary-700 size-5" />
              Stok Masuk / Batch Baru
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <form action={receiveStock} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="batch-medicine">Pilih obat aktif</Label>
                <NativeSelect id="batch-medicine" required name="medicineId" defaultValue="">
                  <option value="" disabled>
                    Pilih obat aktif
                  </option>
                  {medicines
                    .filter((m) => m.isActive)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.code}: {m.name}
                      </option>
                    ))}
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="batch-number">No. batch</Label>
                <Input
                  id="batch-number"
                  required
                  name="batchNumber"
                  placeholder="Contoh: B202611A"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="batch-expiry">Tanggal kedaluwarsa</Label>
                <Input id="batch-expiry" required name="expiryDate" type="date" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="batch-qty">Jumlah masuk</Label>
                <Input
                  id="batch-qty"
                  required
                  name="quantity"
                  type="number"
                  min="1"
                  placeholder="Jumlah"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="batch-note">Keterangan</Label>
                <Input id="batch-note" name="note" placeholder="Opsional (mis. Faktur PBF)" />
              </div>

              <div className="pt-1 sm:col-span-2">
                <Button type="submit" variant="secondary" className="border-primary-200 border">
                  Catat Stok Masuk
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Daftar Obat & Batch */}
      <section aria-labelledby="heading-daftar-obat" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="heading-daftar-obat" className="text-ink-strong text-lg font-bold">
            Daftar obat
          </h2>
          <p className="text-ink-muted text-xs">Menampilkan maksimal 200 obat</p>
        </div>

        <form className="border-line bg-surface shadow-card flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center">
          <Input
            name="q"
            placeholder="Cari kode atau nama obat"
            aria-label="Cari kode atau nama obat"
            defaultValue={q}
            className="sm:flex-1"
          />
          <div className="flex items-center gap-2">
            <Button type="submit" variant="outline">
              <Search aria-hidden="true" className="size-4" />
              Cari
            </Button>
            {q ? (
              <Button asChild variant="ghost">
                <Link href="/staf/farmasi/obat">Reset</Link>
              </Button>
            ) : null}
          </div>
        </form>

        {medicines.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Obat tidak ditemukan"
            description={
              q
                ? `Tidak ada obat yang cocok dengan kata kunci "${q}".`
                : "Tambahkan master obat baru menggunakan formulir di atas."
            }
            action={
              q ? (
                <Button asChild variant="outline">
                  <Link href="/staf/farmasi/obat">Tampilkan Semua Obat</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-4">
            {medicines.map((m) => {
              const isLow = m.stock <= m.minimumStock;

              return (
                <article
                  key={m.id}
                  className="border-line bg-surface shadow-card overflow-hidden rounded-2xl border"
                >
                  <div className="border-line flex flex-wrap items-start justify-between gap-4 border-b px-5 py-4">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-ink-strong text-base font-bold">{m.name}</h3>
                        <span className="border-line bg-paper text-ink-soft rounded-md border px-2 py-0.5 font-mono text-xs">
                          {m.code}
                        </span>
                        {!m.isActive ? <StatusBadge variant="neutral">Nonaktif</StatusBadge> : null}
                        {isLow ? (
                          <StatusBadge variant="danger" icon={AlertTriangle}>
                            Stok menipis
                          </StatusBadge>
                        ) : null}
                      </div>

                      <p className="text-ink-soft text-sm">
                        {m.category || "Tanpa kategori"}, {m.dosageForm}, {m.unit}, Rp
                        {Number(m.price).toLocaleString("id-ID")}
                      </p>

                      <p className="tabular text-ink-muted text-sm">
                        Stok saat ini:{" "}
                        <span className={isLow ? "text-danger-ink font-bold" : "text-ink-strong font-bold"}>
                          {m.stock}
                        </span>
                        {", "}Minimum: {m.minimumStock}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`?edit=${m.id}`}>
                          <Pencil aria-hidden="true" className="size-3.5" />
                          Edit
                        </Link>
                      </Button>

                      <Button asChild variant="outline" size="sm">
                        <Link href={`/staf/farmasi/obat/kartu-stok?medicineId=${m.id}`}>
                          <ClipboardList aria-hidden="true" className="size-3.5" />
                          Kartu Stok
                        </Link>
                      </Button>

                      <form action={setMedicineActive}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="active" value={m.isActive ? "no" : "yes"} />
                        <Button
                          type="submit"
                          variant={m.isActive ? "destructive-outline" : "secondary"}
                          size="sm"
                        >
                          {m.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                      </form>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-line bg-paper text-ink-soft border-b text-xs font-medium">
                        <tr>
                          <th className="px-5 py-2.5 whitespace-nowrap">Batch</th>
                          <th className="px-4 py-2.5 whitespace-nowrap">Kedaluwarsa</th>
                          <th className="px-4 py-2.5 whitespace-nowrap">Jumlah</th>
                          <th className="px-5 py-2.5 whitespace-nowrap">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-line divide-y">
                        {m.batches.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-ink-muted px-5 py-3 text-xs">
                              Belum ada stok batch aktif.
                            </td>
                          </tr>
                        ) : (
                          m.batches.map((b) => {
                            const legacy = b.batchNumber === "LEGACY-PERLU-VERIFIKASI";
                            const isExpired = !legacy && b.expiryDate < now;
                            const isSoon = !legacy && !isExpired && b.expiryDate <= soon;

                            return (
                              <tr key={b.id}>
                                <td className="text-ink-strong px-5 py-2.5 font-mono text-xs">
                                  {b.batchNumber}
                                </td>
                                <td className="tabular text-ink px-4 py-2.5 whitespace-nowrap">
                                  {legacy
                                    ? "Belum diverifikasi"
                                    : b.expiryDate.toLocaleDateString("id-ID", { timeZone: "UTC" })}
                                </td>
                                <td className="tabular text-ink-strong px-4 py-2.5 font-medium">
                                  {b.quantity}
                                </td>
                                <td className="px-5 py-2.5 whitespace-nowrap">
                                  {legacy ? (
                                    <StatusBadge variant="warning" icon={AlertTriangle}>
                                      Perlu verifikasi
                                    </StatusBadge>
                                  ) : isExpired ? (
                                    <StatusBadge variant="danger" icon={AlertCircle}>
                                      Kedaluwarsa
                                    </StatusBadge>
                                  ) : isSoon ? (
                                    <StatusBadge variant="warning" icon={Clock}>
                                      Segera kedaluwarsa
                                    </StatusBadge>
                                  ) : (
                                    <StatusBadge variant="success" icon={CheckCircle2}>
                                      Aman
                                    </StatusBadge>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
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
