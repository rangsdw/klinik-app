"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { type ActionResult, firstErrors } from "@/lib/action-result";
import {
  updateScheduleSchema,
  type UpdateScheduleInput,
  saveSoapRecordSchema,
  type SaveSoapRecordInput,
} from "./schemas";
import { Prisma, type AppointmentStatus } from "@prisma/client";

export async function updateScheduleAction(
  appointmentId: string,
  input: UpdateScheduleInput,
): Promise<ActionResult> {
  const doctor = await requireRole("DOCTOR");
  const parsed = updateScheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: firstErrors(parsed.error.flatten().fieldErrors) };
  }

  const appointment = await db.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment || appointment.doctorId !== doctor.id) {
    return { ok: false, message: "Janji temu tidak ditemukan atau Anda tidak memiliki akses." };
  }

  const newDate = new Date(`${parsed.data.appointmentDate}T00:00:00.000Z`);

  await db.$transaction(async (tx) => {
    await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        appointmentDate: newDate,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        status: parsed.data.status,
      },
    });

    if (appointment.status !== parsed.data.status) {
      await tx.appointmentHistory.create({
        data: {
          appointmentId,
          status: parsed.data.status,
          notes: `Jadwal diubah oleh dr. ${doctor.name} ke ${parsed.data.appointmentDate} ${parsed.data.startTime}-${parsed.data.endTime}`,
          changedByUserId: doctor.id,
        },
      });
    }
  });

  revalidatePath("/dokter");
  return { ok: true, message: "Jadwal appointment berhasil diperbarui." };
}

export async function setAppointmentStatusAction(
  appointmentId: string,
  status: AppointmentStatus,
): Promise<ActionResult> {
  const doctor = await requireRole("DOCTOR");

  const appointment = await db.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment || appointment.doctorId !== doctor.id) {
    return { ok: false, message: "Akses tidak sah." };
  }

  await db.$transaction(async (tx) => {
    await tx.appointment.update({
      where: { id: appointmentId },
      data: { status },
    });

    await tx.appointmentHistory.create({
      data: {
        appointmentId,
        status,
        notes: `Status diubah menjadi ${status} oleh dr. ${doctor.name}`,
        changedByUserId: doctor.id,
      },
    });
  });

  revalidatePath("/dokter");
  return { ok: true, message: `Status antrean diubah ke ${status}.` };
}

export async function saveSoapRecordAction(
  input: SaveSoapRecordInput,
): Promise<ActionResult> {
  const doctor = await requireRole("DOCTOR");
  const parsed = saveSoapRecordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: firstErrors(parsed.error.flatten().fieldErrors) };
  }

  const {
    appointmentId,
    subjective,
    objective,
    assessment,
    plan,
    bloodPressure,
    bodyTemperature,
    bodyWeight,
    pulseRate,
    prescriptions,
    markCompleted,
  } = parsed.data;

  const appointment = await db.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment || appointment.doctorId !== doctor.id) {
    return { ok: false, message: "Janji temu tidak ditemukan atau akses ditolak." };
  }

  try {
  await db.$transaction(async (tx) => {
    const existing = await tx.medicalRecord.findUnique({ where: { appointmentId }, select: { pharmacyStatus: true } });
    if (existing && existing.pharmacyStatus !== "WAITING") throw new Error("PHARMACY_LOCKED");
    // 1. Upsert Medical Record
    const record = await tx.medicalRecord.upsert({
      where: { appointmentId },
      create: {
        appointmentId,
        patientId: appointment.patientId,
        doctorId: doctor.id,
        subjective: subjective || null,
        objective: objective || null,
        assessment: assessment || null,
        plan: plan || null,
        bloodPressure: bloodPressure || null,
        bodyTemperature: bodyTemperature ?? null,
        bodyWeight: bodyWeight ?? null,
        pulseRate: pulseRate ?? null,
      },
      update: {
        subjective: subjective || null,
        objective: objective || null,
        assessment: assessment || null,
        plan: plan || null,
        bloodPressure: bloodPressure || null,
        bodyTemperature: bodyTemperature ?? null,
        bodyWeight: bodyWeight ?? null,
        pulseRate: pulseRate ?? null,
      },
    });

    // 2. Handle prescriptions
    if (prescriptions !== undefined) {
      await tx.prescriptionItem.deleteMany({
        where: { medicalRecordId: record.id },
      });

      if (prescriptions.length > 0) await tx.prescriptionItem.createMany({
        data: prescriptions.map((p) => ({
          medicalRecordId: record.id,
          medicineId: p.medicineId,
          quantity: p.quantity,
          dosageInstructions: p.dosageInstructions,
          notes: p.notes || null,
        })),
      });
    }

    // 3. Mark appointment completed if requested
    if (markCompleted && appointment.status !== "COMPLETED") {
      await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: "COMPLETED" },
      });

      await tx.appointmentHistory.create({
        data: {
          appointmentId,
          status: "COMPLETED",
          notes: `Pemeriksaan selesai & rekam medis disimpan oleh dr. ${doctor.name}`,
          changedByUserId: doctor.id,
        },
      });
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    return { ok: false, message: error instanceof Error && error.message === "PHARMACY_LOCKED" ? "Resep sudah diterima farmasi; hubungi staf farmasi sebelum melakukan koreksi." : "Gagal menyimpan rekam medis. Coba lagi." };
  }

  revalidatePath("/staf/farmasi");
  revalidatePath("/dokter");
  revalidatePath("/dokter/pasien");
  return { ok: true, message: "Catatan rekam medis & resep berhasil disimpan." };
}
