import "server-only";
import { db } from "@/lib/db";

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
