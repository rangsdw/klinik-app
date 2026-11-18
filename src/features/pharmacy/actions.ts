"use server";

import { db } from "@/lib/db";
import { requireStaffType } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, PharmacyStatus } from "@prisma/client";

const route = "/staf/farmasi";
export async function advancePrescription(formData: FormData): Promise<void> {
  const user = await requireStaffType("PHARMACY");
  const id = formData.get("id");
  const target = formData.get("target");
  if (typeof id !== "string" || !id || (target !== "PROCESSING" && target !== "READY" && target !== "DISPENSED")) redirect(`${route}?error=invalid`);
  if (target === "DISPENSED" && formData.get("verified") !== "yes") redirect(`${route}?error=verification`);
  const previous: Record<string, PharmacyStatus> = { PROCESSING: "WAITING", READY: "PROCESSING", DISPENSED: "READY" };
  let error = "";
  try {
    await db.$transaction(async (tx) => {
      const now = new Date();
      const updated = await tx.medicalRecord.updateMany({
        where: { id, pharmacyStatus: previous[target], prescriptions: { some: {} }, appointment: { status: "COMPLETED" } },
        data: { pharmacyStatus: target, ...(target === "PROCESSING" ? { pharmacyReceivedAt: now } : target === "READY" ? { pharmacyReadyAt: now } : { pharmacyDispensedAt: now, pharmacyDispensedBy: user.id }) },
      });
      if (updated.count !== 1) throw new Error("state");
      if (target === "DISPENSED") {
        const items = await tx.prescriptionItem.findMany({ where: { medicalRecordId: id }, select: { medicineId: true, quantity: true } });
        const totals = new Map<string, number>();
        for (const item of items) {
          if (!Number.isInteger(item.quantity) || item.quantity <= 0) throw new Error("quantity");
          totals.set(item.medicineId, (totals.get(item.medicineId) ?? 0) + item.quantity);
        }
        for (const [medicineId, quantity] of [...totals.entries()].sort(([a], [b]) => a.localeCompare(b))) {
          const result = await tx.medicine.updateMany({ where: { id: medicineId, isActive: true, stock: { gte: quantity } }, data: { stock: { decrement: quantity } } });
          if (result.count !== 1) throw new Error("stock");
        }
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (e) {
    error = e instanceof Error && ["state", "stock", "quantity"].includes(e.message) ? e.message : "retry";
  }
  revalidatePath(route);
  redirect(error ? `${route}?error=${error}` : `${route}?success=1`);
}
