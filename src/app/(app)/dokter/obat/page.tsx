import type { Metadata } from "next";
import { Pill } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { getMedicinesList } from "@/features/doctor/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Stok Obat · Dokter" };

export default async function DoctorMedicinesPage() {
  await requireRole("DOCTOR");
  const medicines = await getMedicinesList();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-strong">Katalog &amp; Stok Obat</h1>
        <p className="text-sm text-ink-soft">
          Informasi ketersediaan obat dan sediaan farmasi (hanya-baca untuk dokter dalam meresepkan).
        </p>
      </div>

      {medicines.length === 0 ? (
        <Card className="border-line border-dashed bg-paper/40 py-16 text-center">
          <CardContent>
            <Pill className="mx-auto size-12 text-ink-muted mb-3" />
            <h3 className="text-base font-semibold text-ink-strong">Katalog Obat Kosong</h3>
            <p className="text-sm text-ink-soft max-w-sm mx-auto mt-1">
              Belum ada data obat yang terdaftar di sistem farmasi klinik.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-line bg-surface">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-line bg-paper/60">
                  <TableHead className="w-[120px] font-semibold text-ink-strong">Kode</TableHead>
                  <TableHead className="font-semibold text-ink-strong">Nama Obat</TableHead>
                  <TableHead className="font-semibold text-ink-strong">Kategori</TableHead>
                  <TableHead className="font-semibold text-ink-strong">Bentuk Sediaan</TableHead>
                  <TableHead className="font-semibold text-ink-strong">Satuan</TableHead>
                  <TableHead className="text-right font-semibold text-ink-strong">Sisa Stok</TableHead>
                  <TableHead className="w-[120px] text-center font-semibold text-ink-strong">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {medicines.map((m) => {
                  const isOutOfStock = m.stock <= 0;
                  const isLowStock = m.stock > 0 && m.stock <= 10;

                  return (
                    <TableRow key={m.id} className="border-line hover:bg-paper/40">
                      <TableCell className="font-mono text-xs font-medium text-ink-muted">
                        {m.code}
                      </TableCell>
                      <TableCell className="font-semibold text-ink-strong text-sm">
                        {m.name}
                      </TableCell>
                      <TableCell className="text-xs text-ink-soft">
                        {m.category || "-"}
                      </TableCell>
                      <TableCell className="text-xs text-ink-soft">
                        {m.dosageForm}
                      </TableCell>
                      <TableCell className="text-xs text-ink-soft">
                        {m.unit}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-sm">
                        <span
                          className={
                            isOutOfStock
                              ? "text-danger-ink"
                              : isLowStock
                                ? "text-warning-ink"
                                : "text-ink-strong"
                          }
                        >
                          {m.stock}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {isOutOfStock ? (
                          <Badge className="bg-danger-soft text-danger-ink border-danger/20 text-[10px]">
                            Habis
                          </Badge>
                        ) : isLowStock ? (
                          <Badge className="bg-warning-soft text-warning-ink border-warning/20 text-[10px]">
                            Menipis
                          </Badge>
                        ) : (
                          <Badge className="bg-success-soft text-success-ink border-success/20 text-[10px]">
                            Tersedia
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
