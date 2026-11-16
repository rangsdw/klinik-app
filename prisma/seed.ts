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

  // Seed Master Obat
  const MEDICINES = [
    { code: "MED-001", name: "Paracetamol 500mg", category: "Analgesik & Antipiretik", dosageForm: "Tablet", unit: "Strip", stock: 120, price: 8000 },
    { code: "MED-002", name: "Amoxicillin 500mg", category: "Antibiotik", dosageForm: "Kapsul", unit: "Strip", stock: 85, price: 15000 },
    { code: "MED-003", name: "Cetirizine 10mg", category: "Antihistamin", dosageForm: "Tablet", unit: "Strip", stock: 60, price: 10000 },
    { code: "MED-004", name: "Antasida Doen", category: "Antasida", dosageForm: "Tablet Kunyah", unit: "Strip", stock: 100, price: 6000 },
    { code: "MED-005", name: "Amlodipine 5mg", category: "Antihipertensi", dosageForm: "Tablet", unit: "Strip", stock: 95, price: 18000 },
  ];

  for (const m of MEDICINES) {
    await db.medicine.upsert({
      where: { code: m.code },
      create: m,
      update: { name: m.name, category: m.category, dosageForm: m.dosageForm, unit: m.unit, stock: m.stock, price: m.price },
    });
  }

  // Seed Data Appointment & Rekam Medis untuk Dokter 1
  const doctor = await db.user.findUnique({ where: { email: "dokter1@klinik.test" } });
  const patientBudi = await db.patient.findFirst({ where: { name: "Budi Santoso", deletedAt: null } });
  const patientSutrisno = await db.patient.findFirst({ where: { name: "Sutrisno", deletedAt: null } });
  const patientAlya = await db.patient.findFirst({ where: { name: "Alya Santoso", deletedAt: null } });

  if (doctor && patientBudi && patientSutrisno && patientAlya) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
