"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { jakartaTodayStr, parseDateOnlyUtc } from "@/lib/date";
import { type ActionResult, firstErrors } from "@/lib/action-result";
import {
  updateScheduleSchema,
  type UpdateScheduleInput,
  saveSoapRecordSchema,
  type SaveSoapRecordInput,
} from "./schemas";
import { Prisma, type AppointmentStatus } from "@prisma/client";

function revalidateDoctorAndQueuePages(appointmentId?: string) {
  revalidatePath("/dokter");
  revalidatePath("/dokter/periksa");
  revalidatePath("/dokter/pasien");
  revalidatePath("/staf/pendaftaran/antrean");
  revalidatePath("/staf/pendaftaran");
  revalidatePath("/pasien/antrean");
  revalidatePath("/pasien");
  if (appointmentId) {
    revalidatePath(`/dokter/periksa/${appointmentId}`);
  }
}

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

  revalidateDoctorAndQueuePages(appointmentId);
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

  revalidateDoctorAndQueuePages(appointmentId);
  return { ok: true, message: `Status antrean diubah ke ${status}.` };
}

export async function startExaminationAction(appointmentId: string): Promise<ActionResult> {
  const doctor = await requireRole("DOCTOR");
  const appointment = await db.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: { select: { name: true } } },
  });

  if (!appointment || appointment.doctorId !== doctor.id) {
    return { ok: false, message: "Janji temu tidak ditemukan atau akses ditolak." };
  }

  if (appointment.status === "PENDING") {
    return { ok: false, message: "Janji temu belum dikonfirmasi oleh staf pendaftaran." };
  }

  if (appointment.status === "IN_PROGRESS") {
    if (!appointment.calledAt) {
      await db.appointment.update({
        where: { id: appointmentId },
        data: { calledAt: new Date() },
      });
    }
    revalidateDoctorAndQueuePages(appointmentId);
    return { ok: true, message: `Pasien ${appointment.patient.name} sudah dalam pemeriksaan.` };
  }

  if (appointment.status !== "CONFIRMED") {
    return {
      ok: false,
      message: `Status janji temu sudah ${appointment.status} dan tidak dapat dipanggil.`,
    };
  }

  await db.$transaction(async (tx) => {
    await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        status: "IN_PROGRESS",
        calledAt: appointment.calledAt ?? new Date(),
      },
    });

    await tx.appointmentHistory.create({
      data: {
        appointmentId,
        status: "IN_PROGRESS",
        notes: `Pasien ${appointment.patient.name} dipanggil ke ruang pemeriksaan oleh dr. ${doctor.name}`,
        changedByUserId: doctor.id,
      },
    });
  });

  revalidateDoctorAndQueuePages(appointmentId);
  return { ok: true, message: `Pemeriksaan pasien ${appointment.patient.name} dimulai.` };
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

  // Validasi: Diagnosis (Assessment) wajib diisi bila menyelesaikan sesi pemeriksaan
  if (markCompleted && (!assessment || !assessment.trim())) {
    return {
      ok: false,
      message: "Diagnosis (Assessment / ICD-10) wajib diisi sebelum menyelesaikan pemeriksaan pasien.",
    };
  }

  const appointment = await db.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment || appointment.doctorId !== doctor.id) {
    return { ok: false, message: "Janji temu tidak ditemukan atau akses ditolak." };
  }

  try {
    await db.$transaction(async (tx) => {
      // 1. Cek apakah resep sudah dikunci/diproses oleh staf farmasi
      const existing = await tx.medicalRecord.findUnique({
        where: { appointmentId },
        select: { pharmacyStatus: true },
      });
      if (existing && existing.pharmacyStatus !== "WAITING") {
        throw new Error("PHARMACY_LOCKED");
      }

      // 2. Validasi stok obat yang siap diserahkan (batch aktif, belum kedaluwarsa, & sudah diverifikasi)
      if (prescriptions && prescriptions.length > 0) {
        const requestedTotals = new Map<string, number>();
        for (const item of prescriptions) {
          requestedTotals.set(
            item.medicineId,
            (requestedTotals.get(item.medicineId) ?? 0) + item.quantity,
          );
        }

        const todayUtc = parseDateOnlyUtc(jakartaTodayStr());
        const medicineIds = [...requestedTotals.keys()];
        const medicinesInDb = await tx.medicine.findMany({
          where: { id: { in: medicineIds } },
          include: {
            batches: {
              where: {
                quantity: { gt: 0 },
                expiryDate: { gte: todayUtc },
                batchNumber: { not: "LEGACY-PERLU-VERIFIKASI" },
              },
              select: { quantity: true },
            },
          },
        });
        const medMap = new Map(medicinesInDb.map((m) => [m.id, m]));

        for (const [medicineId, totalQty] of requestedTotals.entries()) {
          const med = medMap.get(medicineId);
          if (!med) {
            throw new Error(`MEDICINE_NOT_FOUND:${medicineId}`);
          }
          if (!med.isActive) {
            throw new Error(`MEDICINE_INACTIVE:${med.name}`);
          }
          const dispensableStock = Math.min(
            med.stock,
            med.batches.reduce((sum, b) => sum + b.quantity, 0),
          );
          if (markCompleted && dispensableStock < totalQty) {
            throw new Error(`INSUFFICIENT_STOCK:${med.name}:${dispensableStock}:${totalQty}`);
          }
        }
      }

      // 3. Upsert Rekam Medis
      const record = await tx.medicalRecord.upsert({
        where: { appointmentId },
        create: {
          appointmentId,
          patientId: appointment.patientId,
          doctorId: doctor.id,
          pharmacyStatus: "WAITING",
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

      // 4. Update resep obat
      if (prescriptions !== undefined) {
        await tx.prescriptionItem.deleteMany({
          where: { medicalRecordId: record.id },
        });

        if (prescriptions.length > 0) {
          await tx.prescriptionItem.createMany({
            data: prescriptions.map((p) => ({
              medicalRecordId: record.id,
              medicineId: p.medicineId,
              quantity: p.quantity,
              dosageInstructions: p.dosageInstructions,
              notes: p.notes || null,
            })),
          });
        }
      }

      // 5. Update status appointment & riwayat alur pemeriksaan
      if (markCompleted) {
        if (appointment.status !== "COMPLETED") {
          await tx.appointment.update({
            where: { id: appointmentId },
            data: { status: "COMPLETED" },
          });

          const presCount = prescriptions?.length || 0;
          await tx.appointmentHistory.create({
            data: {
              appointmentId,
              status: "COMPLETED",
              notes: `Pemeriksaan selesai & rekam medis disimpan oleh dr. ${doctor.name}${
                presCount > 0 ? ` (E-Resep ${presCount} obat diteruskan ke Farmasi)` : ""
              }`,
              changedByUserId: doctor.id,
            },
          });
        }
      } else {
        // Jika disimpan sebagai draf dan status masih CONFIRMED, pindahkan ke IN_PROGRESS
        if (appointment.status === "CONFIRMED") {
          await tx.appointment.update({
            where: { id: appointmentId },
            data: {
              status: "IN_PROGRESS",
              calledAt: appointment.calledAt ?? new Date(),
            },
          });

          await tx.appointmentHistory.create({
            data: {
              appointmentId,
              status: "IN_PROGRESS",
              notes: `Pemeriksaan dimulai oleh dr. ${doctor.name}`,
              changedByUserId: doctor.id,
            },
          });
        }
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PHARMACY_LOCKED") {
        return {
          ok: false,
          message: "Resep sedang diproses/telah diserahkan oleh farmasi. Hubungi staf farmasi jika memerlukan koreksi.",
        };
      }
      if (error.message.startsWith("INSUFFICIENT_STOCK:")) {
        const [, name, stock, req] = error.message.split(":");
        return {
          ok: false,
          message: `Stok obat "${name}" tidak mencukupi (Tersedia: ${stock}, Diminta: ${req}). Silakan sesuaikan resep.`,
        };
      }
      if (error.message.startsWith("MEDICINE_INACTIVE:")) {
        const [, name] = error.message.split(":");
        return {
          ok: false,
          message: `Obat "${name}" berstatus nonaktif di inventaris dan tidak dapat diresepkan.`,
        };
      }
    }
    return { ok: false, message: "Gagal menyimpan rekam medis. Silakan coba lagi." };
  }

  revalidatePath("/staf/farmasi");
  revalidatePath("/staf/farmasi/obat");
  revalidateDoctorAndQueuePages(appointmentId);
  return {
    ok: true,
    message: markCompleted
      ? "Pemeriksaan selesai. Rekam medis tersimpan dan e-resep berhasil diteruskan ke Farmasi."
      : "Draf rekam medis berhasil disimpan.",
  };
}
