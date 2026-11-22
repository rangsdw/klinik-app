import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaffType } from "@/lib/rbac";

export default async function StockCardPage({ searchParams }: { searchParams: Promise<{ medicineId?: string }> }) {
  await requireStaffType("PHARMACY");
  const { medicineId } = await searchParams;
  const medicine = medicineId ? await db.medicine.findUnique({ where: { id: medicineId }, select: { name: true, code: true, stock: true } }) : null;
  const logs = medicineId && medicine ? await db.stockLog.findMany({ where: { medicineId }, include: { batch: { select: { batchNumber: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 200 }) : [];
  return <main className="space-y-5"><Link href="/staf/farmasi/obat" className="text-teal-700">← Master obat</Link><h1 className="text-3xl font-bold">Kartu stok</h1>{medicine ? <><p>{medicine.name} ({medicine.code}) · Saldo saat ini: <b>{medicine.stock}</b></p><p className="text-sm text-ink-muted">Menampilkan 200 transaksi stok terbaru; saldo dihitung setiap transaksi.</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Tanggal</th><th className="p-2">Batch</th><th className="p-2">Jenis</th><th className="p-2">Jumlah</th><th className="p-2">Saldo</th><th className="p-2">Keterangan</th></tr></thead><tbody>{logs.map(log => <tr key={log.id} className="border-b"><td className="p-2">{log.createdAt.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</td><td className="p-2">{log.batch.batchNumber}</td><td className="p-2">{log.type === "IN" ? "Masuk" : "Keluar"}</td><td className="p-2">{log.type === "IN" ? "+" : "-"}{log.quantity}</td><td className="p-2">{log.balanceAfter}</td><td className="p-2">{log.note ?? "-"}</td></tr>)}</tbody></table></div></> : <p>Silakan pilih obat dari halaman master obat.</p>}</main>;
}
