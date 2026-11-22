"use server";

import { db } from "@/lib/db";
import { requireStaffType } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const base = "/staf/farmasi/obat";
const formText = (fd: FormData, key: string, max = 150) => String(fd.get(key) ?? "").trim().slice(0, max);
const number = (fd: FormData, key: string) => Number(fd.get(key));
function errorMessage(error: unknown) {
  if (error instanceof Error && ["invalid", "duplicate", "notfound", "expired", "legacy", "stock"].includes(error.message)) return error.message;
  return "failed";
}

export async function saveMedicine(fd: FormData): Promise<void> {
  await requireStaffType("PHARMACY");
  const id = formText(fd, "id");
  const code = formText(fd, "code", 50).toUpperCase();
  const name = formText(fd, "name");
  const category = formText(fd, "category", 100);
  const dosageForm = formText(fd, "dosageForm", 50);
  const unit = formText(fd, "unit", 50);
  const price = number(fd, "price");
  const minimumStock = number(fd, "minimumStock");
  if (!code || !name || !dosageForm || !unit || !Number.isFinite(price) || price < 0 || price > 9999999999 || !Number.isSafeInteger(minimumStock) || minimumStock < 0 || minimumStock > 1000000) redirect(`${base}?error=invalid`);
  try {
    const data = { code, name, category: category || null, dosageForm, unit, price: new Prisma.Decimal(price.toFixed(2)), minimumStock };
    if (id) {
      const result = await db.medicine.updateMany({ where: { id }, data });
      if (!result.count) throw new Error("notfound");
    } else {
      await db.medicine.create({ data: { ...data, stock: 0 } });
    }
  } catch (e) {
    redirect(`${base}?error=${e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" ? "duplicate" : errorMessage(e)}`);
  }
  revalidatePath(base);
  redirect(`${base}?success=1`);
}

export async function setMedicineActive(fd: FormData): Promise<void> {
  await requireStaffType("PHARMACY");
  const id = formText(fd, "id");
  const active = formText(fd, "active") === "yes";
  if (!id) redirect(`${base}?error=invalid`);
  await db.medicine.updateMany({ where: { id }, data: { isActive: active } });
  revalidatePath(base);
  redirect(`${base}?success=1`);
}

export async function receiveStock(fd: FormData): Promise<void> {
  const user = await requireStaffType("PHARMACY");
  const medicineId = formText(fd, "medicineId");
  const batchNumber = formText(fd, "batchNumber", 100).toUpperCase();
  const expiryText = formText(fd, "expiryDate", 10);
  const quantity = number(fd, "quantity");
  const note = formText(fd, "note", 255);
  const expiryDate = new Date(`${expiryText}T00:00:00.000Z`);
  if (!medicineId || !batchNumber || !/^\d{4}-\d{2}-\d{2}$/.test(expiryText) || Number.isNaN(expiryDate.getTime()) || expiryDate.toISOString().slice(0, 10) !== expiryText || expiryDate <= new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z") || !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 1000000) redirect(`${base}?error=invalid`);
  try {
    await db.$transaction(async tx => {
      const medicine = await tx.medicine.findFirst({ where: { id: medicineId, isActive: true } });
      if (!medicine) throw new Error("notfound");
      const batch = await tx.medicineBatch.upsert({
        where: { medicineId_batchNumber: { medicineId, batchNumber } },
        create: { medicineId, batchNumber, expiryDate, quantity },
        update: { quantity: { increment: quantity } },
      });
      if (batch.expiryDate.toISOString().slice(0, 10) !== expiryText) throw new Error("invalid");
      const updated = await tx.medicine.update({ where: { id: medicineId }, data: { stock: { increment: quantity } } });
      await tx.stockLog.create({ data: { medicineId, batchId: batch.id, type: "IN", quantity, balanceAfter: updated.stock, actorId: user.id, note: note || "Penerimaan stok" } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (e) { redirect(`${base}?error=${errorMessage(e)}`); }
  revalidatePath(base);
  revalidatePath("/staf/farmasi");
  redirect(`${base}?success=1`);
}
