import "server-only";
import { db } from "@/lib/db";

export type SerializedMedicine = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  dosageForm: string;
  unit: string;
  stock: number;
  minimumStock: number;
  price: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

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

  // Serialize Decimal objects to plain numbers for Client Components
  return appointments.map((app) => ({
    ...app,
    medicalRecord: app.medicalRecord
      ? {
          ...app.medicalRecord,
          prescriptions: app.medicalRecord.prescriptions.map((p) => ({
            ...p,
            medicine: {
              ...p.medicine,
              price: Number(p.medicine.price),
              minimumStock: p.medicine.minimumStock ?? 10,
            },
          })),
        }
      : null,
  }));
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

  // Serialize Decimal objects to plain numbers for Client Components
  return patients.map((patient) => ({
    ...patient,
    appointments: patient.appointments.map((app) => ({
      ...app,
      medicalRecord: app.medicalRecord
        ? {
            ...app.medicalRecord,
            prescriptions: app.medicalRecord.prescriptions.map((p) => ({
              ...p,
              medicine: {
                ...p.medicine,
                price: Number(p.medicine.price),
                minimumStock: p.medicine.minimumStock ?? 10,
              },
            })),
          }
        : null,
    })),
  }));
}

export async function getMedicinesList(): Promise<SerializedMedicine[]> {
  const medicines = await db.medicine.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return medicines.map((m) => ({
    ...m,
    price: Number(m.price),
    minimumStock: m.minimumStock ?? 10,
  }));
}

export async function getAppointmentForExamination(appointmentId: string, doctorId: string) {
  const appointment = await db.appointment.findFirst({
    where: {
      id: appointmentId,
      doctorId,
    },
    include: {
      patient: {
        include: {
          appointments: {
            where: {
              id: { not: appointmentId },
              medicalRecord: { isNot: null },
            },
            include: {
              doctor: { select: { name: true } },
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
            orderBy: { appointmentDate: "desc" },
            take: 5,
          },
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
  });

  if (!appointment) return null;

  return {
    ...appointment,
    patient: {
      ...appointment.patient,
      appointments: appointment.patient.appointments.map((pastApp) => ({
        ...pastApp,
        medicalRecord: pastApp.medicalRecord
          ? {
              ...pastApp.medicalRecord,
              prescriptions: pastApp.medicalRecord.prescriptions.map((p) => ({
                ...p,
                medicine: {
                  ...p.medicine,
                  price: Number(p.medicine.price),
                  minimumStock: p.medicine.minimumStock ?? 10,
                },
              })),
            }
          : null,
      })),
    },
    medicalRecord: appointment.medicalRecord
      ? {
          ...appointment.medicalRecord,
          prescriptions: appointment.medicalRecord.prescriptions.map((p) => ({
            ...p,
            medicine: {
              ...p.medicine,
              price: Number(p.medicine.price),
              minimumStock: p.medicine.minimumStock ?? 10,
            },
          })),
        }
      : null,
  };
}
