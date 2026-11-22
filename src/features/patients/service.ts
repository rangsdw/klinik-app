import "server-only";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { BloodType, Gender, Prisma, Relationship } from "@prisma/client";
import { db, type Tx } from "@/lib/db";
import { generateMedicalRecordNumber } from "@/features/patients/mrn";
import {
  emptyToUndefined,
  normalizeEmail,
  normalizeName,
  normalizeNik,
  normalizePhone,
  normalizeText,
} from "@/lib/normalize";
import { MAX_FAMILY_MEMBERS } from "@/config/clinic";
import { activePatientWhere, getOwnedPatient } from "@/features/patients/queries";
import type { FamilyMemberInput } from "@/features/patients/schemas";
import type { RegisterInput } from "@/features/auth/schemas";

export const BCRYPT_COST = 12;

export { formatMedicalRecordNumber, generateMedicalRecordNumber } from "@/features/patients/mrn";

export type CreatePatientData = {
  accountUserId: string;
  name: string;
  birthDate: Date;
  gender: Gender;
  relationship: Relationship;
  isSelf?: boolean;
  nik?: string | null;
  bloodType?: BloodType | null;
  phone?: string | null;
  address?: string | null;
  allergies?: string | null;
  specialConditions?: string | null;
};

/** Buat pasien: generate No. RM + qrToken, lalu simpan. Harus dipanggil di dalam transaksi. */
export async function createPatient(tx: Tx, data: CreatePatientData) {
  const medicalRecordNumber = await generateMedicalRecordNumber(tx);
  return tx.patient.create({
    data: {
      ...data,
      isSelf: data.isSelf ?? false,
      medicalRecordNumber,
      qrToken: randomUUID(),
    },
    select: { id: true, medicalRecordNumber: true, name: true },
  });
}

/** Ubah input form anggota keluarga menjadi data Prisma yang sudah dinormalisasi. */
export function normalizeMemberInput(input: FamilyMemberInput) {
  const nik = emptyToUndefined(input.nik);
  const phone = emptyToUndefined(input.phone);
  const bloodType = emptyToUndefined(input.bloodType);
  const text = (v?: string) => {
    const t = emptyToUndefined(v);
    return t ? normalizeText(t) : null;
  };
  return {
    name: normalizeName(input.name),
    relationship: input.relationship as Relationship,
    nik: nik ? normalizeNik(nik) : null,
    birthDate: new Date(`${input.birthDate}T00:00:00.000Z`),
    gender: input.gender as Gender,
    bloodType: (bloodType as BloodType | undefined) ?? null,
    phone: phone ? normalizePhone(phone) : null,
    address: text(input.address),
    allergies: text(input.allergies),
    specialConditions: text(input.specialConditions),
  };
}

export class FamilyLimitError extends Error {
  constructor() {
    super(`Maksimal ${MAX_FAMILY_MEMBERS} anggota per akun`);
  }
}

/** Tambah anggota keluarga ke akun, dengan batas maksimal anggota. */
export async function addFamilyMember(accountUserId: string, input: FamilyMemberInput) {
  const data = normalizeMemberInput(input);
  return db.$transaction(async (tx) => {
    const count = await tx.patient.count({ where: activePatientWhere({ accountUserId }) });
    if (count >= MAX_FAMILY_MEMBERS) throw new FamilyLimitError();
    return createPatient(tx, { ...data, accountUserId, isSelf: false });
  });
}

/**
 * Registrasi pasien online: dalam SATU transaksi membuat User (role PATIENT)
 * + Patient "diri sendiri" (isSelf = true, relationship = SELF).
 */
export async function registerPatientAccount(input: RegisterInput) {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
  const name = normalizeName(input.name);
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const nik = emptyToUndefined(input.nik);
  const address = emptyToUndefined(input.address);

  return db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, phone, passwordHash, role: "PATIENT" },
      select: { id: true, name: true, email: true },
    });
    const patient = await createPatient(tx, {
      accountUserId: user.id,
      name,
      birthDate: new Date(`${input.birthDate}T00:00:00.000Z`),
      gender: input.gender,
      relationship: "SELF",
      isSelf: true,
      nik: nik ? normalizeNik(nik) : null,
      phone,
      address: address ? normalizeText(address) : null,
    });
    return { user, patient };
  });
}

/** Petakan error unik Prisma (P2002) ke nama field form. */
export function uniqueFieldFromError(error: unknown): string | null {
  const e = error as Prisma.PrismaClientKnownRequestError;
  if (e?.code !== "P2002") return null;
  const target = (e.meta?.target ?? "") as string | string[];
  const t = Array.isArray(target) ? target.join(",") : String(target);
  if (t.includes("email")) return "email";
  if (t.includes("phone")) return "phone";
  if (t.includes("nik")) return "nik";
  return "unknown";
}

export class PatientNotOwnedError extends Error {
  constructor(message = "Pasien tidak ditemukan.") {
    super(message);
    this.name = "PatientNotOwnedError";
  }
}

/**
 * Terbitkan token QR baru untuk pasien milik akun yang login.
 * Token lama langsung tidak berlaku di database.
 */
export async function regeneratePatientQrToken(accountUserId: string, patientId: string) {
  const owned = await getOwnedPatient(accountUserId, patientId);
  if (!owned) {
    throw new PatientNotOwnedError();
  }

  return db.patient.update({
    where: { id: owned.id },
    data: { qrToken: randomUUID() },
    select: { id: true, qrToken: true },
  });
}
