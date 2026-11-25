import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, ClipboardList, Package } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffType } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { StatCard } from "@/components/ui-kit/stat-card";
import { StatusBadge } from "@/components/ui-kit/status-badge";

export const metadata: Metadata = { title: "Kartu Stok Obat" };

export default async function StockCardPage({
  searchParams,
}: {
  searchParams: Promise<{ medicineId?: string }>;
}) {
  await requireStaffType("PHARMACY");
  const { medicineId } = await searchParams;
  const medicine = medicineId
    ? await db.medicine.findUnique({
        where: { id: medicineId },
        select: { name: true, code: true, stock: true, unit: true },
      })
    : null;

  const logs =
    medicineId && medicine
      ? await db.stockLog.findMany({
          where: { medicineId },
          include: { batch: { select: { batchNumber: true } } },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 200,
        })
      : [];

  const totalIn = logs
    .filter((l) => l.type === "IN")
    .reduce((sum, l) => sum + l.quantity, 0);
  const totalOut = logs
    .filter((l) => l.type === "OUT")
    .reduce((sum, l) => sum + l.quantity, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kartu Stok"
        description={
          medicine
            ? `${medicine.name} (${medicine.code}), menampilkan hingga 200 transaksi stok terbaru.`
            : "Riwayat mutasi masuk dan keluar per batch obat."
        }
        actions={
          <Button asChild variant="outline">
            <Link href="/staf/farmasi/obat">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Kembali ke Master Obat
            </Link>
          </Button>
        }
      />

      {!medicine ? (
        <EmptyState
          icon={ClipboardList}
          title="Pilih obat terlebih dahulu"
          description="Buka halaman Master Obat lalu pilih Kartu Stok pada obat yang ingin diperiksa riwayatnya."
          action={
            <Button asChild>
              <Link href="/staf/farmasi/obat">Buka Master Obat</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Saldo saat ini"
              value={medicine.stock}
              icon={Package}
              hint={`Satuan: ${medicine.unit}`}
            />
            <StatCard
              label="Total stok masuk"
              value={totalIn}
              icon={ArrowDownLeft}
              hint="Dari riwayat yang ditampilkan"
            />
            <StatCard
              label="Total stok keluar"
              value={totalOut}
              icon={ArrowUpRight}
              hint="Dari riwayat yang ditampilkan"
            />
          </div>

          {logs.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Belum ada mutasi stok"
              description="Riwayat akan tercatat otomatis saat stok masuk dicatat atau e-resep diserahkan ke pasien."
            />
          ) : (
            <div className="border-line bg-surface shadow-card overflow-hidden rounded-2xl border">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-line bg-paper text-ink-soft border-b text-xs font-medium">
                    <tr>
                      <th className="px-5 py-3 whitespace-nowrap">Tanggal</th>
                      <th className="px-4 py-3 whitespace-nowrap">Batch</th>
                      <th className="px-4 py-3 whitespace-nowrap">Jenis</th>
                      <th className="px-4 py-3 whitespace-nowrap">Jumlah</th>
                      <th className="px-4 py-3 whitespace-nowrap">Saldo</th>
                      <th className="px-5 py-3 whitespace-nowrap">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-line divide-y">
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td className="tabular text-ink px-5 py-3 whitespace-nowrap">
                          {log.createdAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}
                        </td>
                        <td className="text-ink-strong px-4 py-3 font-mono text-xs">
                          {log.batch.batchNumber}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {log.type === "IN" ? (
                            <StatusBadge variant="success" icon={ArrowDownLeft}>
                              Masuk
                            </StatusBadge>
                          ) : (
                            <StatusBadge variant="warning" icon={ArrowUpRight}>
                              Keluar
                            </StatusBadge>
                          )}
                        </td>
                        <td className="tabular text-ink-strong px-4 py-3 font-semibold whitespace-nowrap">
                          {log.type === "IN" ? "+" : "-"}
                          {log.quantity}
                        </td>
                        <td className="tabular text-ink-strong px-4 py-3 font-bold">
                          {log.balanceAfter}
                        </td>
                        <td className="text-ink-muted px-5 py-3">{log.note ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
