/**
 * Seeder data demo (idempoten: aman dijalankan berulang).
 * Password semua akun demo: password123 (HANYA untuk lokal).
 * Jalankan: npm run db:seed
 */
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import {
  PrismaClient,
  type Gender,
  type Relationship,
  type Role,
  type StaffType,
  type BloodType,
} from "@prisma/client";
import { generateMedicalRecordNumber } from "../src/features/patients/mrn";
import { addDaysToDateStr, jakartaTodayStr, parseDateOnlyUtc } from "../src/lib/date";

if (process.env.NODE_ENV === "production") {
  console.error("Seeder menolak berjalan di NODE_ENV=production.");
  process.exit(1);
}

const db = new PrismaClient();
const DEMO_PASSWORD = "password123";

type SeedUser = { name: string; email: string; phone: string; role: Role; staffType?: StaffType };

const USERS: SeedUser[] = [
  { name: "Admin Klinik", email: "admin@klinik.test", phone: "081200000001", role: "ADMIN" },
  { name: "dr. Andi Pratama", email: "dokter1@klinik.test", phone: "081200000002", role: "DOCTOR" },
  { name: "dr. Rina Kusuma", email: "dokter2@klinik.test", phone: "081200000003", role: "DOCTOR" },
  {
    name: "Dewi Lestari",
    email: "pendaftaran@klinik.test",
    phone: "081200000004",
    role: "STAFF",
    staffType: "REGISTRATION",
  },
  {
    name: "Fajar Nugroho",
    email: "farmasi@klinik.test",
    phone: "081200000005",
    role: "STAFF",
    staffType: "PHARMACY",
  },
  {
    name: "Maya Sari",
    email: "kasir@klinik.test",
    phone: "081200000006",
    role: "STAFF",
    staffType: "CASHIER",
  },
  { name: "Budi Santoso", email: "pasien@klinik.test", phone: "081200000007", role: "PATIENT" },
];

type SeedPatient = {
  name: string;
  relationship: Relationship;
  isSelf: boolean;
  birthDate: string;
  gender: Gender;
  bloodType?: BloodType;
  allergies?: string;
  specialConditions?: string;
  phone?: string;
};

const FAMILY: SeedPatient[] = [
  {
    name: "Budi Santoso",
    relationship: "SELF",
    isSelf: true,
    birthDate: "1988-04-12",
    gender: "MALE",
    bloodType: "O",
    phone: "081200000007",
  },
  {
    name: "Alya Santoso",
    relationship: "CHILD",
    isSelf: false,
    birthDate: "2019-09-03",
    gender: "FEMALE",
    bloodType: "O",
    allergies: "Amoksisilin",
  },
  {
    name: "Sutrisno",
    relationship: "PARENT",
    isSelf: false,
    birthDate: "1955-01-20",
    gender: "MALE",
    bloodType: "A",
    specialConditions: "Hipertensi, rutin kontrol tekanan darah",
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  for (const u of USERS) {
    await db.user.upsert({
      where: { email: u.email },
      create: { ...u, staffType: u.staffType ?? null, passwordHash, isActive: true },
      update: {
        name: u.name,
        phone: u.phone,
        role: u.role,
        staffType: u.staffType ?? null,
        isActive: true,
      },
    });
  }

  const owner = await db.user.findUniqueOrThrow({ where: { email: "pasien@klinik.test" } });
  for (const p of FAMILY) {
    const existing = await db.patient.findFirst({
      where: { accountUserId: owner.id, name: p.name, deletedAt: null },
    });
    if (existing) continue;
    await db.$transaction(async (tx) => {
      const medicalRecordNumber = await generateMedicalRecordNumber(tx);
      await tx.patient.create({
        data: {
          accountUserId: owner.id,
          medicalRecordNumber,
          qrToken: randomUUID(),
          name: p.name,
          relationship: p.relationship,
          isSelf: p.isSelf,
          birthDate: new Date(`${p.birthDate}T00:00:00.000Z`),
          gender: p.gender,
          bloodType: p.bloodType ?? null,
          allergies: p.allergies ?? null,
          specialConditions: p.specialConditions ?? null,
          phone: p.phone ?? null,
        },
      });
    });
  }

  const counts = await db.user.groupBy({ by: ["role"], _count: { _all: true } });

  const todayStr = jakartaTodayStr();
  const today = parseDateOnlyUtc(todayStr);

  const actorUser =
    (await db.user.findUnique({ where: { email: "farmasi@klinik.test" }, select: { id: true } })) ??
    (await db.user.findUniqueOrThrow({ where: { email: "admin@klinik.test" }, select: { id: true } }));

  // Seed Master Obat & Batch Awal (FEFO-ready, idempoten)
  const MEDICINES = [
    {
      code: "MED-001",
      name: "Paracetamol 500mg",
      category: "Analgesik & Antipiretik",
      dosageForm: "Tablet",
      unit: "Strip",
      stock: 120,
      price: 8000,
      batchNumber: "BATCH-MED001-A",
      expiryDays: 365,
    },
    {
      code: "MED-002",
      name: "Amoxicillin 500mg",
      category: "Antibiotik",
      dosageForm: "Kapsul",
      unit: "Strip",
      stock: 85,
      price: 15000,
      batchNumber: "BATCH-MED002-A",
      expiryDays: 300,
    },
    {
      code: "MED-003",
      name: "Cetirizine 10mg",
      category: "Antihistamin",
      dosageForm: "Tablet",
      unit: "Strip",
      stock: 60,
      price: 10000,
      batchNumber: "BATCH-MED003-A",
      expiryDays: 240,
    },
    {
      code: "MED-004",
      name: "Antasida Doen",
      category: "Antasida",
      dosageForm: "Tablet Kunyah",
      unit: "Strip",
      stock: 100,
      price: 6000,
      batchNumber: "BATCH-MED004-A",
      expiryDays: 420,
    },
    {
      code: "MED-005",
      name: "Amlodipine 5mg",
      category: "Antihipertensi",
      dosageForm: "Tablet",
      unit: "Strip",
      stock: 95,
      price: 18000,
      batchNumber: "BATCH-MED005-A",
      expiryDays: 365,
    },
  ];

  for (const m of MEDICINES) {
    const med = await db.medicine.upsert({
      where: { code: m.code },
      create: {
        code: m.code,
        name: m.name,
        category: m.category,
        dosageForm: m.dosageForm,
        unit: m.unit,
        stock: 0,
        price: m.price,
      },
      update: {
        name: m.name,
        category: m.category,
        dosageForm: m.dosageForm,
        unit: m.unit,
        price: m.price,
      },
    });

    const batches = await db.medicineBatch.findMany({ where: { medicineId: med.id } });
    const hasVerifiedBatch = batches.some((b) => b.batchNumber !== "LEGACY-PERLU-VERIFIKASI");

    if (!hasVerifiedBatch) {
      const expiryDate = parseDateOnlyUtc(addDaysToDateStr(todayStr, m.expiryDays));
      const legacyBatch = batches.find((b) => b.batchNumber === "LEGACY-PERLU-VERIFIKASI");

      await db.$transaction(async (tx) => {
        if (legacyBatch) {
          const targetQty =
            legacyBatch.quantity === 0 && med.stock === 0 ? m.stock : legacyBatch.quantity;
          const updatedBatch = await tx.medicineBatch.update({
            where: { id: legacyBatch.id },
            data: {
              batchNumber: m.batchNumber,
              expiryDate,
              quantity: targetQty,
            },
          });

          const totalBatchQty = await tx.medicineBatch.aggregate({
            where: { medicineId: med.id },
            _sum: { quantity: true },
          });
          const syncedStock = totalBatchQty._sum.quantity ?? 0;

          const updatedMed = await tx.medicine.update({
            where: { id: med.id },
            data: { stock: syncedStock },
          });

          const existingLog = await tx.stockLog.findFirst({
            where: { batchId: updatedBatch.id },
            select: { id: true },
          });
          if (!existingLog && updatedBatch.quantity > 0) {
            await tx.stockLog.create({
              data: {
                medicineId: med.id,
                batchId: updatedBatch.id,
                type: "IN",
                quantity: updatedBatch.quantity,
                balanceAfter: updatedMed.stock,
                actorId: actorUser.id,
                note: "Verifikasi stok awal demo (seed)",
              },
            });
          }
        } else {
          const createdBatch = await tx.medicineBatch.create({
            data: {
              medicineId: med.id,
              batchNumber: m.batchNumber,
              expiryDate,
              quantity: m.stock,
            },
          });

          const updatedMed = await tx.medicine.update({
            where: { id: med.id },
            data: { stock: { increment: m.stock } },
          });

          await tx.stockLog.create({
            data: {
              medicineId: med.id,
              batchId: createdBatch.id,
              type: "IN",
              quantity: m.stock,
              balanceAfter: updatedMed.stock,
              actorId: actorUser.id,
              note: "Stok awal demo (seed)",
            },
          });
        }
      });
    }
  }

  // Seed Data Appointment & Rekam Medis untuk Dokter 1
  const doctor = await db.user.findUnique({ where: { email: "dokter1@klinik.test" } });
  const patientBudi = await db.patient.findFirst({ where: { name: "Budi Santoso", deletedAt: null } });
  const patientSutrisno = await db.patient.findFirst({ where: { name: "Sutrisno", deletedAt: null } });
  const patientAlya = await db.patient.findFirst({ where: { name: "Alya Santoso", deletedAt: null } });

  if (doctor && patientBudi && patientSutrisno && patientAlya) {
    // Appointment 1: Sutrisno (COMPLETED dengan Rekam Medis & Resep)
    let app1 = await db.appointment.findFirst({
      where: { patientId: patientSutrisno.id, doctorId: doctor.id, queueNumber: 1 },
    });
    if (!app1) {
      app1 = await db.appointment.create({
        data: {
          patientId: patientSutrisno.id,
          doctorId: doctor.id,
          appointmentDate: today,
          startTime: "08:30",
          endTime: "08:50",
          queueNumber: 1,
          status: "COMPLETED",
          chiefComplaint: "Kontrol tensi rutin, kepala agak berat.",
        },
      });

      const medRecord = await db.medicalRecord.create({
        data: {
          appointmentId: app1.id,
          patientId: patientSutrisno.id,
          doctorId: doctor.id,
          subjective: "Pasien mengeluhkan tengkuk terasa berat sejak 2 hari lalu. Rutin minum obat hipertensi.",
          objective: "Keadaan umum baik, compos mentis.",
          assessment: "Hipertensi Grade 1 terkontrol (ICD-10 I10)",
          plan: "Lanjutkan terapi antihipertensi, kurangi konsumsi garam, kontrol kembali 1 bulan.",
          bloodPressure: "140/90",
          bodyTemperature: 36.6,
          pulseRate: 78,
        },
      });

      const amlodipine = await db.medicine.findUnique({ where: { code: "MED-005" } });
      if (amlodipine) {
        await db.prescriptionItem.create({
          data: {
            medicalRecordId: medRecord.id,
            medicineId: amlodipine.id,
            quantity: 3,
            dosageInstructions: "1x sehari 1 tablet pagi hari sesudah makan",
            notes: "Habiskan selama 1 bulan",
          },
        });
      }
    }

    // Appointment 2: Budi Santoso (IN_PROGRESS - sedang diperiksa dokter)
    const existingApp2 = await db.appointment.findFirst({
      where: { patientId: patientBudi.id, doctorId: doctor.id, queueNumber: 2 },
    });
    if (!existingApp2) {
      await db.appointment.create({
        data: {
          patientId: patientBudi.id,
          doctorId: doctor.id,
          appointmentDate: today,
          startTime: "09:00",
          endTime: "09:20",
          queueNumber: 2,
          status: "IN_PROGRESS",
          chiefComplaint: "Demam naik turun sejak kemarin, sakit kepala, nafsu makan berkurang.",
        },
      });
    }

    // Appointment 3: Alya Santoso (CONFIRMED - antrean berikutnya)
    const existingApp3 = await db.appointment.findFirst({
      where: { patientId: patientAlya.id, doctorId: doctor.id, queueNumber: 3 },
    });
    if (!existingApp3) {
      await db.appointment.create({
        data: {
          patientId: patientAlya.id,
          doctorId: doctor.id,
          appointmentDate: today,
          startTime: "09:30",
          endTime: "09:50",
          queueNumber: 3,
          status: "CONFIRMED",
          chiefComplaint: "Batuk pilek dan bersin-bersin. (Alergi amoksisilin).",
        },
      });
    }

    // Sinkronkan counter antrean harian agar nomor antrean baru tidak bentrok dengan data seed
    const maxQueueAgg = await db.appointment.aggregate({
      where: { doctorId: doctor.id, appointmentDate: today },
      _max: { queueNumber: true },
    });
    const maxQueue = maxQueueAgg._max.queueNumber ?? 0;
    if (maxQueue > 0) {
      const counterKey = `queue-${doctor.id}-${todayStr}`.slice(0, 64);
      await db.$executeRaw`INSERT INTO counters (\`key\`, value) VALUES (${counterKey}, ${maxQueue}) ON DUPLICATE KEY UPDATE value = GREATEST(value, ${maxQueue})`;
    }
  }

  // Seed Jadwal Praktik Dokter 1 & Dokter 2 (idempoten)
  const doctor2 = await db.user.findUnique({ where: { email: "dokter2@klinik.test" } });
  const DEMO_SCHEDULES: Array<{
    doctorId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    quota: number;
  }> = [];

  if (doctor) {
    DEMO_SCHEDULES.push(
      { doctorId: doctor.id, dayOfWeek: 1, startTime: "08:00", endTime: "12:00", quota: 15 },
      { doctorId: doctor.id, dayOfWeek: 3, startTime: "08:00", endTime: "12:00", quota: 15 },
      { doctorId: doctor.id, dayOfWeek: 5, startTime: "08:00", endTime: "11:30", quota: 12 },
    );
  }
  if (doctor2) {
    DEMO_SCHEDULES.push(
      { doctorId: doctor2.id, dayOfWeek: 2, startTime: "13:00", endTime: "17:00", quota: 15 },
      { doctorId: doctor2.id, dayOfWeek: 4, startTime: "13:00", endTime: "17:00", quota: 15 },
      { doctorId: doctor2.id, dayOfWeek: 6, startTime: "09:00", endTime: "13:00", quota: 12 },
    );
  }

  for (const s of DEMO_SCHEDULES) {
    const existing = await db.doctorSchedule.findFirst({
      where: {
        doctorId: s.doctorId,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
      },
    });
    if (!existing) {
      await db.doctorSchedule.create({ data: { ...s, isActive: true } });
    }
  }

  console.info("Seeder selesai:", counts.map((c) => `${c.role}=${c._count._all}`).join(", "));
  console.info(`Password akun demo: ${DEMO_PASSWORD} (hanya lokal)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
