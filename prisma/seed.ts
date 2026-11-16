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
  console.info("Seeder selesai:", counts.map((c) => `${c.role}=${c._count._all}`).join(", "));
  console.info(`Password akun demo: ${DEMO_PASSWORD} (hanya lokal)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
