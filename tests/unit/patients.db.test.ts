import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { formatMedicalRecordNumber, generateMedicalRecordNumber } from "@/features/patients/mrn";
import {
  addFamilyMember,
  FamilyLimitError,
  PatientNotOwnedError,
  regeneratePatientQrToken,
  registerPatientAccount,
} from "@/features/patients/service";
import { getOwnedPatient, listPatientsForAccount } from "@/features/patients/queries";
import { MAX_FAMILY_MEMBERS } from "@/config/clinic";

/** Integrasi ke database test terpisah (klinik_app_test), dibersihkan tiap test. */
async function clean() {
  await db.passwordResetToken.deleteMany();
  await db.patient.deleteMany();
  await db.user.deleteMany();
  await db.counter.deleteMany();
}

let seq = 0;
async function newAccount() {
  seq += 1;
  return registerPatientAccount({
    name: `pasien uji ${seq}`,
    email: `uji${seq}@contoh.test`,
    phone: `08130000${String(seq).padStart(4, "0")}`,
    nik: "",
    birthDate: "1990-01-01",
    gender: "MALE",
    address: "",
    password: "rahasia123",
    confirmPassword: "rahasia123",
    consent: true,
  });
}

beforeEach(clean);
afterAll(async () => {
  await clean();
  await db.$disconnect();
});

describe("nomor rekam medis", () => {
  it("format RM-YYYY-000001", () => {
    expect(formatMedicalRecordNumber(2026, 1)).toBe("RM-2026-000001");
    expect(formatMedicalRecordNumber(2026, 123456)).toBe("RM-2026-123456");
  });

  it("urut", async () => {
    const a = await db.$transaction((tx) => generateMedicalRecordNumber(tx));
    const b = await db.$transaction((tx) => generateMedicalRecordNumber(tx));
    expect(Number(b.slice(-6))).toBe(Number(a.slice(-6)) + 1);
  });

  it("unik walau dipanggil paralel", async () => {
    const results = await Promise.all(
      Array.from({ length: 15 }, () => db.$transaction((tx) => generateMedicalRecordNumber(tx))),
    );
    expect(new Set(results).size).toBe(15);
  });
});

describe("registrasi pasien", () => {
  it("membuat User PATIENT + Patient diri sendiri dalam satu transaksi", async () => {
    const { user, patient } = await newAccount();
    const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.role).toBe("PATIENT");
    expect(row.name).toBe("Pasien Uji 1");
    expect(row.passwordHash).not.toBe("rahasia123");
    const p = await db.patient.findUniqueOrThrow({ where: { id: patient.id } });
    expect(p.isSelf).toBe(true);
    expect(p.relationship).toBe("SELF");
    expect(p.medicalRecordNumber).toMatch(/^RM-\d{4}-\d{6}$/);
    expect(p.qrToken).toHaveLength(36);
  });
});

describe("kepemilikan pasien", () => {
  it("akun A tidak bisa mengambil pasien akun B", async () => {
    const a = await newAccount();
    const b = await newAccount();
    expect(await getOwnedPatient(a.user.id, a.patient.id)).not.toBeNull();
    expect(await getOwnedPatient(a.user.id, b.patient.id)).toBeNull();
  });

  it("pasien yang dihapus (soft delete) tidak tampil", async () => {
    const a = await newAccount();
    const m = await addFamilyMember(a.user.id, {
      name: "anak uji",
      relationship: "CHILD",
      birthDate: "2018-02-02",
      gender: "FEMALE",
    });
    await db.patient.update({ where: { id: m.id }, data: { deletedAt: new Date() } });
    expect(await getOwnedPatient(a.user.id, m.id)).toBeNull();
    expect((await listPatientsForAccount(a.user.id)).map((p) => p.id)).toEqual([a.patient.id]);
  });

  it(`batas ${MAX_FAMILY_MEMBERS} anggota per akun`, async () => {
    const a = await newAccount();
    for (let i = 1; i < MAX_FAMILY_MEMBERS; i++) {
      await addFamilyMember(a.user.id, {
        name: `anggota ${i}`,
        relationship: "OTHER",
        birthDate: "2000-01-01",
        gender: "MALE",
      });
    }
    await expect(
      addFamilyMember(a.user.id, {
        name: "kelebihan",
        relationship: "OTHER",
        birthDate: "2000-01-01",
        gender: "MALE",
      }),
    ).rejects.toBeInstanceOf(FamilyLimitError);
  });
});

describe("QR Code pasien", () => {
  it("pemilik akun dan anggota keluarga memiliki qrToken terpisah", async () => {
    const akun = await newAccount();
    const child = await addFamilyMember(akun.user.id, {
      name: "anak qr",
      relationship: "CHILD",
      birthDate: "2020-05-05",
      gender: "FEMALE",
    });

    const [selfRow, childRow] = await Promise.all([
      db.patient.findUniqueOrThrow({ where: { id: akun.patient.id }, select: { qrToken: true } }),
      db.patient.findUniqueOrThrow({ where: { id: child.id }, select: { qrToken: true } }),
    ]);

    expect(selfRow.qrToken).toHaveLength(36);
    expect(childRow.qrToken).toHaveLength(36);
    expect(childRow.qrToken).not.toBe(selfRow.qrToken);
  });

  it("regeneratePatientQrToken mengganti token dan menolak akses akun lain atau pasien terhapus", async () => {
    const akunA = await newAccount();
    const akunB = await newAccount();
    const { qrToken: oldToken } = await db.patient.findUniqueOrThrow({
      where: { id: akunA.patient.id },
      select: { qrToken: true },
    });

    const updated = await regeneratePatientQrToken(akunA.user.id, akunA.patient.id);
    expect(updated.qrToken).toHaveLength(36);
    expect(updated.qrToken).not.toBe(oldToken);

    const row = await db.patient.findUniqueOrThrow({ where: { id: akunA.patient.id } });
    expect(row.qrToken).toBe(updated.qrToken);

    // Akun B tidak boleh mengganti QR milik Akun A
    await expect(regeneratePatientQrToken(akunB.user.id, akunA.patient.id)).rejects.toBeInstanceOf(
      PatientNotOwnedError,
    );

    // Pasien soft-delete tidak bisa dibuatkan QR baru
    const child = await addFamilyMember(akunA.user.id, {
      name: "anak hapus",
      relationship: "CHILD",
      birthDate: "2021-01-01",
      gender: "MALE",
    });
    await db.patient.update({ where: { id: child.id }, data: { deletedAt: new Date() } });
    await expect(regeneratePatientQrToken(akunA.user.id, child.id)).rejects.toBeInstanceOf(
      PatientNotOwnedError,
    );
  });
});
