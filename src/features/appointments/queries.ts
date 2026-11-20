import "server-only";
import type { AppointmentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { dayOfWeekFromDateStr, jakartaTodayStr, parseDateOnlyUtc, toDateInput } from "@/lib/date";
import { activePatientWhere } from "@/features/patients/queries";
import { ACTIVE_QUOTA_STATUSES, DATE_REGEX } from "@/features/appointments/schemas";
import { getQuotaStatus } from "@/features/appointments/service";

export type DoctorOption = {
  id: string;
  name: string;
};

export type DoctorScheduleRow = {
  id: string;
  doctorId: string;
  doctorName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  quota: number;
  isActive: boolean;
};

/** Daftar dokter aktif untuk pilihan form dan filter jadwal. */
export async function getDoctorOptions(): Promise<DoctorOption[]> {
  return db.user.findMany({
    where: { role: "DOCTOR", isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** Daftar seluruh jadwal praktik dokter untuk staf pendaftaran. */
export async function getDoctorSchedules(filters?: {
  doctorId?: string;
  dayOfWeek?: number;
}): Promise<DoctorScheduleRow[]> {
  const rows = await db.doctorSchedule.findMany({
    where: {
      ...(filters?.doctorId ? { doctorId: filters.doctorId } : {}),
      ...(typeof filters?.dayOfWeek === "number" ? { dayOfWeek: filters.dayOfWeek } : {}),
    },
    include: {
      doctor: { select: { name: true } },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }, { doctor: { name: "asc" } }],
  });

  return rows.map((r) => ({
    id: r.id,
    doctorId: r.doctorId,
    doctorName: r.doctor.name,
    dayOfWeek: r.dayOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
    quota: r.quota,
    isActive: r.isActive,
  }));
}

/** Jadwal aktif dokter untuk ditampilkan di landing page publik. */
export async function getPublicDoctorSchedules(): Promise<DoctorScheduleRow[]> {
  const rows = await db.doctorSchedule.findMany({
    where: {
      isActive: true,
      doctor: { isActive: true, role: "DOCTOR" },
    },
    include: {
      doctor: { select: { name: true } },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }, { doctor: { name: "asc" } }],
  });

  return rows.map((r) => ({
    id: r.id,
    doctorId: r.doctorId,
    doctorName: r.doctor.name,
    dayOfWeek: r.dayOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
    quota: r.quota,
    isActive: r.isActive,
  }));
}

export type AvailableSessionSlot = {
  scheduleId: string;
  doctorId: string;
  doctorName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  quota: number;
  used: number;
  remaining: number;
  percentage: number;
  quotaStatus: "AVAILABLE" | "ALMOST_FULL" | "FULL";
  quotaLabel: "Tersedia" | "Hampir Penuh" | "Penuh";
};

/** Ambil daftar sesi praktik aktif beserta sisa kuota untuk dokter & tanggal tertentu. */
export async function getAvailableSessionsForDate(
  doctorId: string,
  dateStr: string,
): Promise<AvailableSessionSlot[]> {
  if (!doctorId || !DATE_REGEX.test(dateStr)) return [];

  const dayOfWeek = dayOfWeekFromDateStr(dateStr);
  const targetDate = parseDateOnlyUtc(dateStr);

  const [schedules, bookedAppointments] = await Promise.all([
    db.doctorSchedule.findMany({
      where: {
        doctorId,
        dayOfWeek,
        isActive: true,
        doctor: { role: "DOCTOR", isActive: true },
      },
      include: { doctor: { select: { name: true } } },
      orderBy: { startTime: "asc" },
    }),
    db.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: targetDate,
        status: { in: [...ACTIVE_QUOTA_STATUSES] },
      },
      select: { id: true, scheduleId: true, startTime: true, endTime: true },
    }),
  ]);

  return schedules.map((s) => {
    const used = bookedAppointments.filter(
      (a) =>
        a.scheduleId === s.id ||
        (a.scheduleId === null && a.startTime === s.startTime && a.endTime === s.endTime),
    ).length;
    const summary = getQuotaStatus(used, s.quota);
    return {
      scheduleId: s.id,
      doctorId: s.doctorId,
      doctorName: s.doctor.name,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      quota: s.quota,
      used,
      remaining: summary.remaining,
      percentage: summary.percentage,
      quotaStatus: summary.status,
      quotaLabel: summary.label,
    };
  });
}

export type PatientAppointmentRow = {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  queueNumber: number | null;
  status: AppointmentStatus;
  chiefComplaint: string | null;
  rejectionReason: string | null;
  createdAt: Date;
};

/** Daftar janji temu milik pasien pada akun yang login (semua atau per pasien aktif). */
export async function listAppointmentsForAccount(
  accountUserId: string,
  patientId?: string,
): Promise<PatientAppointmentRow[]> {
  const rows = await db.appointment.findMany({
    where: {
      patient: activePatientWhere({
        accountUserId,
        ...(patientId ? { id: patientId } : {}),
      }),
    },
    include: {
      patient: { select: { name: true } },
      doctor: { select: { name: true } },
    },
    orderBy: [{ appointmentDate: "desc" }, { startTime: "desc" }, { createdAt: "desc" }],
  });

  return rows.map((r) => ({
    id: r.id,
    patientId: r.patientId,
    patientName: r.patient.name,
    doctorId: r.doctorId,
    doctorName: r.doctor.name,
    appointmentDate: toDateInput(r.appointmentDate),
    startTime: r.startTime,
    endTime: r.endTime,
    queueNumber: r.queueNumber,
    status: r.status,
    chiefComplaint: r.chiefComplaint,
    rejectionReason: r.rejectionReason,
    createdAt: r.createdAt,
  }));
}

export type StaffAppointmentStats = {
  pendingCount: number;
  confirmedCount: number;
  rejectedCount: number;
  todayTotalCount: number;
};

export type StaffAppointmentRequestRow = {
  id: string;
  patientId: string;
  patientName: string;
  medicalRecordNumber: string;
  doctorId: string;
  doctorName: string;
  scheduleId: string | null;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  queueNumber: number | null;
  status: AppointmentStatus;
  chiefComplaint: string | null;
  rejectionReason: string | null;
  createdAt: Date;
  sessionQuota: number | null;
  sessionUsed: number;
  sessionRemaining: number | null;
  sessionPercentage: number;
  sessionQuotaStatus: "AVAILABLE" | "ALMOST_FULL" | "FULL" | null;
  sessionQuotaLabel: "Tersedia" | "Hampir Penuh" | "Penuh" | null;
};

/** Ambil daftar permintaan janji temu dan ringkasan statistik untuk staf pendaftaran. */
export async function getStaffAppointmentRequestsData(
  todayStr: string = jakartaTodayStr(),
): Promise<{ stats: StaffAppointmentStats; requests: StaffAppointmentRequestRow[] }> {
  const rows = await db.appointment.findMany({
    where: {
      patient: activePatientWhere(),
    },
    include: {
      patient: { select: { name: true, medicalRecordNumber: true } },
      doctor: { select: { name: true } },
      schedule: { select: { id: true, quota: true, startTime: true, endTime: true } },
    },
    orderBy: [{ appointmentDate: "asc" }, { startTime: "asc" }, { createdAt: "asc" }],
  });

  const quotaSet = new Set<string>(ACTIVE_QUOTA_STATUSES);
  const usageMap = new Map<string, number>();

  let pendingCount = 0;
  let confirmedCount = 0;
  let rejectedCount = 0;
  let todayTotalCount = 0;

  for (const r of rows) {
    const dateStr = toDateInput(r.appointmentDate);
    if (r.status === "PENDING") pendingCount += 1;
    if (r.status === "CONFIRMED") confirmedCount += 1;
    if (r.status === "REJECTED") rejectedCount += 1;
    if (dateStr === todayStr) todayTotalCount += 1;

    if (quotaSet.has(r.status)) {
      const slotKey = r.scheduleId
        ? `${r.doctorId}|${dateStr}|id:${r.scheduleId}`
        : `${r.doctorId}|${dateStr}|time:${r.startTime}-${r.endTime}`;
      usageMap.set(slotKey, (usageMap.get(slotKey) ?? 0) + 1);
    }
  }

  const requests: StaffAppointmentRequestRow[] = rows.map((r) => {
    const dateStr = toDateInput(r.appointmentDate);
    const idKey = r.scheduleId ? `${r.doctorId}|${dateStr}|id:${r.scheduleId}` : null;
    const timeKey = `${r.doctorId}|${dateStr}|time:${r.startTime}-${r.endTime}`;
    const sessionUsed = (idKey ? (usageMap.get(idKey) ?? 0) : 0) + (usageMap.get(timeKey) ?? 0);

    const quota = r.schedule?.quota ?? null;
    const summary = quota !== null ? getQuotaStatus(sessionUsed, quota) : null;

    return {
      id: r.id,
      patientId: r.patientId,
      patientName: r.patient.name,
      medicalRecordNumber: r.patient.medicalRecordNumber,
      doctorId: r.doctorId,
      doctorName: r.doctor.name,
      scheduleId: r.scheduleId,
      appointmentDate: dateStr,
      startTime: r.startTime,
      endTime: r.endTime,
      queueNumber: r.queueNumber,
      status: r.status,
      chiefComplaint: r.chiefComplaint,
      rejectionReason: r.rejectionReason,
      createdAt: r.createdAt,
      sessionQuota: quota,
      sessionUsed,
      sessionRemaining: summary?.remaining ?? null,
      sessionPercentage: summary?.percentage ?? 0,
      sessionQuotaStatus: summary?.status ?? null,
      sessionQuotaLabel: summary?.label ?? null,
    };
  });

  return {
    stats: {
      pendingCount,
      confirmedCount,
      rejectedCount,
      todayTotalCount,
    },
    requests,
  };
}
