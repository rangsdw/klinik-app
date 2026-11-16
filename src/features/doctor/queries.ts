import "server-only";
import { db } from "@/lib/db";

export async function getDoctorAppointments(doctorId: string, dateStr?: string) {
  const targetDate = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : new Date();
  targetDate.setUTCHours(0, 0, 0, 0);

  const appointments = await db.appointment.findMany({
    where: {
      doctorId,
      appointmentDate: targetDate,
    },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          medicalRecordNumber: true,
          birthDate: true,
          gender: true,
          bloodType: true,
          allergies: true,
          specialConditions: true,
          phone: true,
        },
      },
      medicalRecord: {
        include: {
          prescriptions: {
            include: {
              medicine: true,
            },
          },
        },
      },
    },
    orderBy: [{ queueNumber: "asc" }, { startTime: "asc" }],
  });

  return appointments;
}

export async function getDoctorStats(doctorId: string, dateStr?: string) {
  const targetDate = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : new Date();
  targetDate.setUTCHours(0, 0, 0, 0);

  const [total, waiting, inProgress, completed] = await Promise.all([
    db.appointment.count({
      where: { doctorId, appointmentDate: targetDate },
    }),
    db.appointment.count({
      where: {
        doctorId,
        appointmentDate: targetDate,
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    }),
    db.appointment.count({
      where: {
        doctorId,
        appointmentDate: targetDate,
        status: "IN_PROGRESS",
      },
    }),
    db.appointment.count({
      where: {
        doctorId,
        appointmentDate: targetDate,
        status: "COMPLETED",
      },
    }),
  ]);

  return { total, waiting, inProgress, completed };
}

export async function getPatientsWithHistory(searchQuery?: string) {
  const trimmed = searchQuery?.trim();
  const whereClause = {
    deletedAt: null,
    ...(trimmed
      ? {
          OR: [
            { name: { contains: trimmed } },
            { medicalRecordNumber: { contains: trimmed } },
            { nik: { contains: trimmed } },
          ],
        }
      : {}),
  };

  const patients = await db.patient.findMany({
    where: whereClause,
    include: {
      appointments: {
        include: {
          doctor: { select: { name: true } },
          medicalRecord: {
            include: {
              prescriptions: {
                include: { medicine: true },
              },
            },
          },
        },
        orderBy: { appointmentDate: "desc" },
      },
    },
    orderBy: { name: "asc" },
    take: 50,
  });

  return patients;
}

export async function getMedicinesList() {
  return db.medicine.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}
