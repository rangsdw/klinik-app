import "server-only";
import type { AppointmentSource, AppointmentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import {
  dayOfWeekFromDateStr,
  jakartaCurrentTimeStr,
  jakartaTodayStr,
  parseDateOnlyUtc,
  toDateInput,
} from "@/lib/date";
import { activePatientWhere } from "@/features/patients/queries";
import {
  ACTIVE_QUOTA_STATUSES,
  DATE_REGEX,
  formatQueueNumber,
  type PatientQueueDisplayStatus,
  type QueueDisplayStatus,
} from "@/features/appointments/schemas";
import { getQuotaStatus, timeToMinutes } from "@/features/appointments/service";

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
        source: "ONLINE",
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
  rescheduledAt: Date | null;
  rescheduleNote: string | null;
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
    rescheduledAt: r.rescheduledAt,
    rescheduleNote: r.rescheduleNote,
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
  rescheduledAt: Date | null;
  rescheduleNote: string | null;
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

    if (r.source === "ONLINE" && quotaSet.has(r.status)) {
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
      rescheduledAt: r.rescheduledAt,
      rescheduleNote: r.rescheduleNote,
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

export type CheckInDashboardStats = {
  checkedInTodayCount: number;
  pendingCheckInTodayCount: number;
};

export type RecentCheckInRow = {
  id: string;
  patientName: string;
  medicalRecordNumber: string;
  doctorName: string;
  queueNumber: number | null;
  formattedQueueNumber: string | null;
  checkedInAt: Date;
};

/** Statistik dan daftar check-in terbaru hari ini untuk halaman staf pendaftaran. */
export async function getCheckInDashboardData(
  todayStr: string = jakartaTodayStr(),
): Promise<{ stats: CheckInDashboardStats; recentCheckIns: RecentCheckInRow[] }> {
  const todayDate = parseDateOnlyUtc(todayStr);

  const [checkedInTodayCount, pendingCheckInTodayCount, recentRows] = await Promise.all([
    db.appointment.count({
      where: {
        appointmentDate: todayDate,
        checkedInAt: { not: null },
        patient: activePatientWhere(),
      },
    }),
    db.appointment.count({
      where: {
        appointmentDate: todayDate,
        status: "CONFIRMED",
        checkedInAt: null,
        patient: activePatientWhere(),
      },
    }),
    db.appointment.findMany({
      where: {
        appointmentDate: todayDate,
        checkedInAt: { not: null },
        patient: activePatientWhere(),
      },
      select: {
        id: true,
        queueNumber: true,
        checkedInAt: true,
        patient: { select: { name: true, medicalRecordNumber: true } },
        doctor: { select: { name: true } },
      },
      orderBy: { checkedInAt: "desc" },
      take: 15,
    }),
  ]);

  return {
    stats: {
      checkedInTodayCount,
      pendingCheckInTodayCount,
    },
    recentCheckIns: recentRows.map((r) => ({
      id: r.id,
      patientName: r.patient.name,
      medicalRecordNumber: r.patient.medicalRecordNumber,
      doctorName: r.doctor.name,
      queueNumber: r.queueNumber,
      formattedQueueNumber: r.queueNumber !== null ? formatQueueNumber(r.queueNumber) : null,
      checkedInAt: r.checkedInAt!,
    })),
  };
}

export type TodayWalkInSessionOption = {
  scheduleId: string;
  doctorId: string;
  doctorName: string;
  startTime: string;
  endTime: string;
  currentQueueCount: number;
  walkInCount: number;
  isEnded: boolean;
};

/** Daftar sesi praktik dokter yang aktif hari ini beserta jumlah antrean untuk pendaftaran walk-in. */
export async function getTodayWalkInSessions(
  todayStr: string = jakartaTodayStr(),
  currentTimeStr: string = jakartaCurrentTimeStr(),
): Promise<TodayWalkInSessionOption[]> {
  const dayOfWeek = dayOfWeekFromDateStr(todayStr);
  const todayDate = parseDateOnlyUtc(todayStr);

  const [schedules, todayAppointments] = await Promise.all([
    db.doctorSchedule.findMany({
      where: {
        dayOfWeek,
        isActive: true,
        doctor: { role: "DOCTOR", isActive: true },
      },
      include: { doctor: { select: { name: true } } },
      orderBy: [{ startTime: "asc" }, { doctor: { name: "asc" } }],
    }),
    db.appointment.findMany({
      where: {
        appointmentDate: todayDate,
        status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] },
      },
      select: { doctorId: true, scheduleId: true, startTime: true, endTime: true, source: true },
    }),
  ]);

  const nowMinutes = timeToMinutes(currentTimeStr);

  return schedules.map((s) => {
    const matching = todayAppointments.filter(
      (a) =>
        a.doctorId === s.doctorId &&
        (a.scheduleId === s.id ||
          (a.scheduleId === null && a.startTime === s.startTime && a.endTime === s.endTime)),
    );
    return {
      scheduleId: s.id,
      doctorId: s.doctorId,
      doctorName: s.doctor.name,
      startTime: s.startTime,
      endTime: s.endTime,
      currentQueueCount: matching.length,
      walkInCount: matching.filter((a) => a.source === "WALK_IN").length,
      isEnded: nowMinutes > timeToMinutes(s.endTime),
    };
  });
}

export type DoctorQueueItem = {
  id: string;
  patientId: string;
  patientName: string;
  medicalRecordNumber: string;
  source: AppointmentSource;
  startTime: string;
  endTime: string;
  queueNumber: number | null;
  formattedQueueNumber: string | null;
  status: AppointmentStatus;
  displayStatus: QueueDisplayStatus;
  checkedInAt: string | null;
  calledAt: string | null;
};

export type DoctorQueueStats = {
  waiting: number;
  called: number;
  inService: number;
  calledOrInService: number;
  completed: number;
  walkIn: number;
  noShow: number;
  notArrived: number;
  total: number;
};

export type DoctorQueueSnapshot = {
  doctorId: string;
  doctorName: string;
  dateStr: string;
  currentAppointmentId: string | null;
  currentQueueNumber: number | null;
  formattedCurrentQueueNumber: string | null;
  items: DoctorQueueItem[];
  stats: DoctorQueueStats;
};

/**
 * Turunkan status tampilan antrean tanpa mengubah arti status dasar modul dokter:
 * - IN_PROGRESS -> Sedang dilayani (diset modul dokter)
 * - COMPLETED -> Selesai
 * - NO_SHOW -> Tidak hadir
 * - CONFIRMED + calledAt -> Dipanggil (staf)
 * - CONFIRMED + checkedInAt (tanpa calledAt) -> Menunggu
 * - CONFIRMED tanpa checkedInAt -> Belum datang
 */
export function deriveQueueDisplayStatus(row: {
  status: AppointmentStatus;
  checkedInAt: Date | null;
  calledAt: Date | null;
}): QueueDisplayStatus {
  if (row.status === "IN_PROGRESS") return "IN_SERVICE";
  if (row.status === "COMPLETED") return "COMPLETED";
  if (row.status === "NO_SHOW") return "NO_SHOW";
  if (row.calledAt !== null) return "CALLED";
  if (row.checkedInAt !== null) return "WAITING";
  return "NOT_ARRIVED";
}

type CurrentQueueCandidate = {
  id: string;
  queueNumber: number | null;
  status: AppointmentStatus;
  calledAt: Date | null;
  updatedAt: Date;
};

function resolveCurrentQueue(rows: CurrentQueueCandidate[]): {
  appointmentId: string;
  queueNumber: number;
  formattedQueueNumber: string;
} | null {
  const inProgress = rows
    .filter((r) => r.status === "IN_PROGRESS" && r.queueNumber !== null)
    .sort((a, b) => {
      const diff = b.updatedAt.getTime() - a.updatedAt.getTime();
      return diff !== 0 ? diff : (a.queueNumber ?? 0) - (b.queueNumber ?? 0);
    });

  if (inProgress[0] && inProgress[0].queueNumber !== null) {
    return {
      appointmentId: inProgress[0].id,
      queueNumber: inProgress[0].queueNumber,
      formattedQueueNumber: formatQueueNumber(inProgress[0].queueNumber),
    };
  }

  const called = rows
    .filter((r) => r.status === "CONFIRMED" && r.calledAt !== null && r.queueNumber !== null)
    .sort((a, b) => {
      const diff = (b.calledAt?.getTime() ?? 0) - (a.calledAt?.getTime() ?? 0);
      return diff !== 0 ? diff : (b.queueNumber ?? 0) - (a.queueNumber ?? 0);
    });

  if (called[0] && called[0].queueNumber !== null) {
    return {
      appointmentId: called[0].id,
      queueNumber: called[0].queueNumber,
      formattedQueueNumber: formatQueueNumber(called[0].queueNumber),
    };
  }

  return null;
}

/**
 * Query bersama antrean dokter untuk tanggal tertentu (default hari ini Asia/Jakarta).
 * Dipakai oleh papan antrean staf (`/staf/pendaftaran/antrean`) maupun integrasi modul dokter
 * tanpa mengubah arti status `IN_PROGRESS` / `COMPLETED`.
 *
 * Mengembalikan urutan item antrean berdasarkan `queueNumber` ascending, status tampilan
 * tiap nomor (`NOT_ARRIVED` | `WAITING` | `CALLED` | `IN_SERVICE` | `COMPLETED` | `NO_SHOW`),
 * nomor "Antrean Sekarang" (nomor `IN_PROGRESS`, atau bila tidak ada, nomor `CALLED` terbaru),
 * serta ringkasan statistik harian dokter. Mengembalikan `null` jika dokter tidak ditemukan.
 */
export async function getDoctorQueue(
  doctorId: string,
  dateStr: string = jakartaTodayStr(),
): Promise<DoctorQueueSnapshot | null> {
  if (!doctorId || !DATE_REGEX.test(dateStr)) return null;

  const targetDate = parseDateOnlyUtc(dateStr);

  const [doctor, rows] = await Promise.all([
    db.user.findUnique({
      where: { id: doctorId },
      select: { id: true, name: true, role: true },
    }),
    db.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: targetDate,
        status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED", "NO_SHOW"] },
        patient: activePatientWhere(),
      },
      select: {
        id: true,
        patientId: true,
        source: true,
        startTime: true,
        endTime: true,
        queueNumber: true,
        status: true,
        checkedInAt: true,
        calledAt: true,
        updatedAt: true,
        createdAt: true,
        patient: { select: { name: true, medicalRecordNumber: true } },
      },
      orderBy: [{ queueNumber: "asc" }, { startTime: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  if (!doctor || doctor.role !== "DOCTOR") return null;

  const sortedRows = [...rows].sort((a, b) => {
    if (a.queueNumber !== null && b.queueNumber !== null) {
      return a.queueNumber - b.queueNumber;
    }
    if (a.queueNumber !== null) return -1;
    if (b.queueNumber !== null) return 1;
    return a.startTime.localeCompare(b.startTime);
  });

  const current = resolveCurrentQueue(sortedRows);

  const stats: DoctorQueueStats = {
    waiting: 0,
    called: 0,
    inService: 0,
    calledOrInService: 0,
    completed: 0,
    walkIn: 0,
    noShow: 0,
    notArrived: 0,
    total: sortedRows.length,
  };

  const items: DoctorQueueItem[] = sortedRows.map((r) => {
    const displayStatus = deriveQueueDisplayStatus(r);
    if (displayStatus === "WAITING") stats.waiting += 1;
    if (displayStatus === "CALLED") stats.called += 1;
    if (displayStatus === "IN_SERVICE") stats.inService += 1;
    if (displayStatus === "COMPLETED") stats.completed += 1;
    if (displayStatus === "NO_SHOW") stats.noShow += 1;
    if (displayStatus === "NOT_ARRIVED") stats.notArrived += 1;
    if (r.source === "WALK_IN") stats.walkIn += 1;

    return {
      id: r.id,
      patientId: r.patientId,
      patientName: r.patient.name,
      medicalRecordNumber: r.patient.medicalRecordNumber,
      source: r.source,
      startTime: r.startTime,
      endTime: r.endTime,
      queueNumber: r.queueNumber,
      formattedQueueNumber: r.queueNumber !== null ? formatQueueNumber(r.queueNumber) : null,
      status: r.status,
      displayStatus,
      checkedInAt: r.checkedInAt ? r.checkedInAt.toISOString() : null,
      calledAt: r.calledAt ? r.calledAt.toISOString() : null,
    };
  });

  stats.calledOrInService = stats.called + stats.inService;

  return {
    doctorId: doctor.id,
    doctorName: doctor.name,
    dateStr,
    currentAppointmentId: current?.appointmentId ?? null,
    currentQueueNumber: current?.queueNumber ?? null,
    formattedCurrentQueueNumber: current?.formattedQueueNumber ?? null,
    items,
    stats,
  };
}

export type StaffQueueBoardPayload = {
  dateStr: string;
  updatedAt: string;
  totals: {
    waiting: number;
    calledOrInService: number;
    completed: number;
    walkIn: number;
    noShow: number;
    total: number;
  };
  doctors: DoctorQueueSnapshot[];
};

/** Data papan antrean hari ini seluruh dokter yang praktik untuk staf pendaftaran. */
export async function getStaffQueueBoardData(
  todayStr: string = jakartaTodayStr(),
): Promise<StaffQueueBoardPayload> {
  const dayOfWeek = dayOfWeekFromDateStr(todayStr);
  const targetDate = parseDateOnlyUtc(todayStr);

  const [scheduledDoctors, queuedDoctors] = await Promise.all([
    db.doctorSchedule.findMany({
      where: {
        dayOfWeek,
        isActive: true,
        doctor: { role: "DOCTOR", isActive: true },
      },
      select: { doctorId: true },
      distinct: ["doctorId"],
    }),
    db.appointment.findMany({
      where: {
        appointmentDate: targetDate,
        status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED", "NO_SHOW"] },
        patient: activePatientWhere(),
      },
      select: { doctorId: true },
      distinct: ["doctorId"],
    }),
  ]);

  const doctorIds = Array.from(
    new Set([...scheduledDoctors.map((s) => s.doctorId), ...queuedDoctors.map((a) => a.doctorId)]),
  );

  const snapshots = (await Promise.all(doctorIds.map((id) => getDoctorQueue(id, todayStr))))
    .filter((snap): snap is DoctorQueueSnapshot => snap !== null)
    .sort((a, b) => a.doctorName.localeCompare(b.doctorName, "id"));

  const totals = {
    waiting: 0,
    calledOrInService: 0,
    completed: 0,
    walkIn: 0,
    noShow: 0,
    total: 0,
  };

  for (const doc of snapshots) {
    totals.waiting += doc.stats.waiting;
    totals.calledOrInService += doc.stats.calledOrInService;
    totals.completed += doc.stats.completed;
    totals.walkIn += doc.stats.walkIn;
    totals.noShow += doc.stats.noShow;
    totals.total += doc.stats.total;
  }

  return {
    dateStr: todayStr,
    updatedAt: new Date().toISOString(),
    totals,
    doctors: snapshots,
  };
}

export type PatientLiveQueueItem = {
  appointmentId: string;
  patientName: string;
  doctorName: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  source: AppointmentSource;
  queueNumber: number | null;
  formattedQueueNumber: string | null;
  currentQueueNumber: number | null;
  formattedCurrentQueueNumber: string | null;
  aheadCount: number | null;
  displayStatus: PatientQueueDisplayStatus;
};

export type PatientLiveQueuePayload = {
  dateStr: string;
  updatedAt: string;
  items: PatientLiveQueueItem[];
};

function derivePatientQueueDisplayStatus(row: {
  status: AppointmentStatus;
  checkedInAt: Date | null;
  calledAt: Date | null;
}): PatientQueueDisplayStatus {
  if (row.status === "PENDING") return "PENDING";
  if (row.status === "IN_PROGRESS") return "IN_SERVICE";
  if (row.status === "COMPLETED") return "COMPLETED";
  if (row.calledAt !== null) return "CALLED";
  if (row.checkedInAt !== null) return "WAITING";
  return "CONFIRMED_NOT_CHECKED_IN";
}

/**
 * Ambil status live queue HANYA milik akun pasien yang login untuk hari ini.
 * Ketat privasi: query antrean publik hanya membaca status & nomor antrean tanpa data/nama pasien lain.
 */
export async function getPatientLiveQueueData(
  accountUserId: string,
  todayStr: string = jakartaTodayStr(),
): Promise<PatientLiveQueuePayload> {
  const targetDate = parseDateOnlyUtc(todayStr);

  const ownRows = await db.appointment.findMany({
    where: {
      appointmentDate: targetDate,
      status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"] },
      patient: activePatientWhere({ accountUserId }),
    },
    select: {
      id: true,
      doctorId: true,
      startTime: true,
      endTime: true,
      source: true,
      queueNumber: true,
      status: true,
      checkedInAt: true,
      calledAt: true,
      patient: { select: { name: true } },
      doctor: { select: { name: true } },
    },
    orderBy: [{ startTime: "asc" }, { queueNumber: "asc" }, { createdAt: "asc" }],
  });

  if (ownRows.length === 0) {
    return {
      dateStr: todayStr,
      updatedAt: new Date().toISOString(),
      items: [],
    };
  }

  const doctorIds = Array.from(new Set(ownRows.map((r) => r.doctorId)));

  // Jangan pernah men-select nama, ID, atau No. RM pasien lain dari database.
  const queueRows = await db.appointment.findMany({
    where: {
      doctorId: { in: doctorIds },
      appointmentDate: targetDate,
      status: { in: ["CONFIRMED", "IN_PROGRESS"] },
      patient: activePatientWhere(),
    },
    select: {
      id: true,
      doctorId: true,
      status: true,
      queueNumber: true,
      checkedInAt: true,
      calledAt: true,
      updatedAt: true,
    },
  });

  const rowsByDoctor = new Map<string, typeof queueRows>();
  for (const row of queueRows) {
    const list = rowsByDoctor.get(row.doctorId) ?? [];
    list.push(row);
    rowsByDoctor.set(row.doctorId, list);
  }

  const doctorSummaryMap = new Map<
    string,
    {
      currentQueueNumber: number | null;
      formattedCurrentQueueNumber: string | null;
      waitingQueueNumbers: number[];
    }
  >();

  for (const doctorId of doctorIds) {
    const docRows = rowsByDoctor.get(doctorId) ?? [];
    const current = resolveCurrentQueue(docRows);
    const waitingQueueNumbers = docRows
      .filter(
        (r) =>
          r.status === "CONFIRMED" &&
          r.checkedInAt !== null &&
          r.calledAt === null &&
          r.queueNumber !== null,
      )
      .map((r) => r.queueNumber as number);

    doctorSummaryMap.set(doctorId, {
      currentQueueNumber: current?.queueNumber ?? null,
      formattedCurrentQueueNumber: current?.formattedQueueNumber ?? null,
      waitingQueueNumbers,
    });
  }

  const items: PatientLiveQueueItem[] = ownRows.map((r) => {
    const displayStatus = derivePatientQueueDisplayStatus(r);
    const docSummary = doctorSummaryMap.get(r.doctorId);
    let aheadCount: number | null = null;

    if (
      displayStatus === "CALLED" ||
      displayStatus === "IN_SERVICE" ||
      displayStatus === "COMPLETED"
    ) {
      aheadCount = 0;
    } else if (r.queueNumber !== null && docSummary) {
      aheadCount = docSummary.waitingQueueNumbers.filter((n) => n < r.queueNumber!).length;
    }

    return {
      appointmentId: r.id,
      patientName: r.patient.name,
      doctorName: r.doctor.name,
      appointmentDate: todayStr,
      startTime: r.startTime,
      endTime: r.endTime,
      source: r.source,
      queueNumber: r.queueNumber,
      formattedQueueNumber: r.queueNumber !== null ? formatQueueNumber(r.queueNumber) : null,
      currentQueueNumber: docSummary?.currentQueueNumber ?? null,
      formattedCurrentQueueNumber: docSummary?.formattedCurrentQueueNumber ?? null,
      aheadCount,
      displayStatus,
    };
  });

  return {
    dateStr: todayStr,
    updatedAt: new Date().toISOString(),
    items,
  };
}
