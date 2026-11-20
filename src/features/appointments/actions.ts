"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole, requireStaffType } from "@/lib/rbac";
import { firstErrors, type ActionResult } from "@/lib/action-result";
import {
  bookAppointmentSchema,
  doctorScheduleSchema,
  rejectAppointmentSchema,
  rescheduleAppointmentSchema,
  type BookAppointmentInput,
  type DoctorScheduleInput,
  type RejectAppointmentInput,
  type RescheduleAppointmentInput,
} from "@/features/appointments/schemas";
import {
  getAvailableSessionsForDate,
  type AvailableSessionSlot,
} from "@/features/appointments/queries";
import {
  approveAppointmentByStaff,
  assertValidScheduleSlot,
  bookAppointmentForPatient,
  cancelPatientAppointment,
  DuplicateAppointmentError,
  InvalidAppointmentStateError,
  InvalidBookingDateError,
  PatientNotOwnedError,
  QuotaFullError,
  rejectAppointmentByStaff,
  rescheduleAppointmentByStaff,
  ScheduleOverlapError,
  validateBookingDate,
} from "@/features/appointments/service";

async function ensureActiveDoctor(doctorId: string): Promise<boolean> {
  const doctor = await db.user.findUnique({
    where: { id: doctorId },
    select: { id: true, role: true, isActive: true },
  });
  return Boolean(doctor && doctor.role === "DOCTOR" && doctor.isActive);
}

function revalidateSchedulePages() {
  revalidatePath("/staf/pendaftaran");
  revalidatePath("/");
}

export async function createScheduleAction(
  input: DoctorScheduleInput,
): Promise<ActionResult<{ id: string }>> {
  await requireStaffType("REGISTRATION");

  const parsed = doctorScheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: firstErrors(parsed.error.flatten().fieldErrors) };
  }

  const data = parsed.data;
  if (!(await ensureActiveDoctor(data.doctorId))) {
    return { ok: false, fieldErrors: { doctorId: "Dokter tidak ditemukan atau nonaktif." } };
  }

  const existingSlots = await db.doctorSchedule.findMany({
    where: {
      doctorId: data.doctorId,
      dayOfWeek: data.dayOfWeek,
      isActive: true,
    },
    select: { id: true, startTime: true, endTime: true },
  });

  try {
    assertValidScheduleSlot(data, existingSlots);
  } catch (error) {
    if (error instanceof ScheduleOverlapError) {
      return { ok: false, fieldErrors: { startTime: error.message } };
    }
    return { ok: false, message: error instanceof Error ? error.message : "Data jadwal tidak valid." };
  }

  const created = await db.doctorSchedule.create({
    data: {
      doctorId: data.doctorId,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      quota: data.quota,
      isActive: true,
    },
    select: { id: true },
  });

  revalidateSchedulePages();
  return { ok: true, message: "Sesi jadwal dokter berhasil ditambahkan.", data: { id: created.id } };
}

export async function updateScheduleAction(
  scheduleId: string,
  input: DoctorScheduleInput,
): Promise<ActionResult> {
  await requireStaffType("REGISTRATION");

  const existing = await db.doctorSchedule.findUnique({
    where: { id: scheduleId },
    select: { id: true, isActive: true },
  });
  if (!existing) {
    return { ok: false, message: "Sesi jadwal tidak ditemukan." };
  }

  const parsed = doctorScheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: firstErrors(parsed.error.flatten().fieldErrors) };
  }

  const data = parsed.data;
  if (!(await ensureActiveDoctor(data.doctorId))) {
    return { ok: false, fieldErrors: { doctorId: "Dokter tidak ditemukan atau nonaktif." } };
  }

  if (existing.isActive) {
    const activeSlots = await db.doctorSchedule.findMany({
      where: {
        doctorId: data.doctorId,
        dayOfWeek: data.dayOfWeek,
        isActive: true,
      },
      select: { id: true, startTime: true, endTime: true },
    });

    try {
      assertValidScheduleSlot(data, activeSlots, scheduleId);
    } catch (error) {
      if (error instanceof ScheduleOverlapError) {
        return { ok: false, fieldErrors: { startTime: error.message } };
      }
      return { ok: false, message: error instanceof Error ? error.message : "Data jadwal tidak valid." };
    }
  }

  await db.doctorSchedule.update({
    where: { id: scheduleId },
    data: {
      doctorId: data.doctorId,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      quota: data.quota,
    },
  });

  revalidateSchedulePages();
  return { ok: true, message: "Sesi jadwal dokter diperbarui." };
}

export async function toggleScheduleStatusAction(
  scheduleId: string,
  nextActive: boolean,
): Promise<ActionResult> {
  await requireStaffType("REGISTRATION");

  const schedule = await db.doctorSchedule.findUnique({
    where: { id: scheduleId },
    select: {
      id: true,
      doctorId: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      quota: true,
      isActive: true,
    },
  });

  if (!schedule) {
    return { ok: false, message: "Sesi jadwal tidak ditemukan." };
  }

  if (nextActive && !schedule.isActive) {
    const activeSlots = await db.doctorSchedule.findMany({
      where: {
        doctorId: schedule.doctorId,
        dayOfWeek: schedule.dayOfWeek,
        isActive: true,
      },
      select: { id: true, startTime: true, endTime: true },
    });

    try {
      assertValidScheduleSlot(schedule, activeSlots, schedule.id);
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Tidak dapat mengaktifkan sesi karena bentrok dengan jadwal aktif lain.",
      };
    }
  }

  await db.doctorSchedule.update({
    where: { id: scheduleId },
    data: { isActive: nextActive },
  });

  revalidateSchedulePages();
  return {
    ok: true,
    message: nextActive ? "Sesi jadwal diaktifkan kembali." : "Sesi jadwal dinonaktifkan.",
  };
}

function revalidateAppointmentPages() {
  revalidatePath("/pasien/janji");
  revalidatePath("/pasien");
  revalidatePath("/staf/pendaftaran");
  revalidatePath("/dokter");
}

export async function getAvailableSessionsAction(
  doctorId: string,
  dateStr: string,
): Promise<ActionResult<AvailableSessionSlot[]>> {
  await requireRole("PATIENT");
  if (!doctorId) {
    return { ok: false, message: "Pilih dokter terlebih dahulu." };
  }
  try {
    validateBookingDate(dateStr);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Tanggal janji tidak valid.",
    };
  }

  const sessions = await getAvailableSessionsForDate(doctorId, dateStr);
  return { ok: true, data: sessions };
}

export async function bookAppointmentAction(
  input: BookAppointmentInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole("PATIENT");

  const parsed = bookAppointmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: firstErrors(parsed.error.flatten().fieldErrors) };
  }

  try {
    const created = await bookAppointmentForPatient(user.id, parsed.data);
    revalidateAppointmentPages();
    return {
      ok: true,
      message: "Janji temu berhasil diajukan (Menunggu Persetujuan).",
      data: { id: created.id },
    };
  } catch (error) {
    if (error instanceof PatientNotOwnedError) {
      notFound();
    }
    if (
      error instanceof QuotaFullError ||
      error instanceof DuplicateAppointmentError ||
      error instanceof InvalidBookingDateError
    ) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function cancelAppointmentAction(appointmentId: string): Promise<ActionResult> {
  const user = await requireRole("PATIENT");

  try {
    await cancelPatientAppointment(user.id, appointmentId);
    revalidateAppointmentPages();
    return {
      ok: true,
      message: "Janji temu dibatalkan dan kuota sesi telah dikembalikan.",
    };
  } catch (error) {
    if (error instanceof PatientNotOwnedError) {
      notFound();
    }
    if (error instanceof InvalidAppointmentStateError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function approveAppointmentAction(
  appointmentId: string,
): Promise<ActionResult<{ queueNumber: number; formattedQueueNumber: string }>> {
  const staff = await requireStaffType("REGISTRATION");

  try {
    const res = await approveAppointmentByStaff(staff.id, appointmentId);
    revalidateAppointmentPages();
    return {
      ok: true,
      message: `Janji disetujui. Nomor antrean: ${res.formattedQueueNumber}.`,
      data: {
        queueNumber: res.queueNumber,
        formattedQueueNumber: res.formattedQueueNumber,
      },
    };
  } catch (error) {
    if (error instanceof InvalidAppointmentStateError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function rejectAppointmentAction(
  input: RejectAppointmentInput,
): Promise<ActionResult> {
  const staff = await requireStaffType("REGISTRATION");

  const parsed = rejectAppointmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: firstErrors(parsed.error.flatten().fieldErrors) };
  }

  try {
    await rejectAppointmentByStaff(staff.id, parsed.data);
    revalidateAppointmentPages();
    return {
      ok: true,
      message: "Janji temu ditolak dan kuota sesi telah dikembalikan.",
    };
  } catch (error) {
    if (error instanceof InvalidAppointmentStateError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function getStaffAvailableSessionsAction(
  doctorId: string,
  dateStr: string,
): Promise<ActionResult<AvailableSessionSlot[]>> {
  await requireStaffType("REGISTRATION");
  if (!doctorId) {
    return { ok: false, message: "Pilih dokter terlebih dahulu." };
  }
  try {
    validateBookingDate(dateStr);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Tanggal janji tidak valid.",
    };
  }

  const sessions = await getAvailableSessionsForDate(doctorId, dateStr);
  return { ok: true, data: sessions };
}

export async function rescheduleAppointmentAction(
  input: RescheduleAppointmentInput,
): Promise<ActionResult<{ queueNumber: number | null; formattedQueueNumber: string | null }>> {
  const staff = await requireStaffType("REGISTRATION");

  const parsed = rescheduleAppointmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: firstErrors(parsed.error.flatten().fieldErrors) };
  }

  try {
    const res = await rescheduleAppointmentByStaff(staff.id, parsed.data);
    revalidateAppointmentPages();
    const queueInfo = res.formattedQueueNumber
      ? ` Nomor antrean baru: ${res.formattedQueueNumber}.`
      : "";
    return {
      ok: true,
      message: `Janji temu berhasil dijadwalkan ulang.${queueInfo}`,
      data: {
        queueNumber: res.queueNumber,
        formattedQueueNumber: res.formattedQueueNumber,
      },
    };
  } catch (error) {
    if (
      error instanceof QuotaFullError ||
      error instanceof DuplicateAppointmentError ||
      error instanceof InvalidBookingDateError ||
      error instanceof InvalidAppointmentStateError
    ) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}
