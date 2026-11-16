"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { emailLayout, sendMail } from "@/lib/mail";
import { loginLimiter } from "@/lib/rate-limit";
import { normalizeEmail, normalizePhone } from "@/lib/normalize";
import { canAccessPath, homeFor, safeCallbackUrl } from "@/lib/roles";
import { firstErrors, type ActionResult } from "@/lib/action-result";
import { clinicConfig } from "@/config/clinic";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
} from "@/features/auth/schemas";
import { findUserByIdentifier } from "@/features/auth/queries";
import { sendVerificationEmail } from "@/features/auth/verification";
import {
  BCRYPT_COST,
  registerPatientAccount,
  uniqueFieldFromError,
} from "@/features/patients/service";

const GENERIC_LOGIN_ERROR = "Email/No. HP atau password salah.";

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

function identifierKey(identifier: string) {
  const v = identifier.trim();
  return v.includes("@") ? normalizeEmail(v) : normalizePhone(v);
}

/** Login dengan email atau no. HP. Rate limit 5x/menit per identifier+IP. */
export async function loginAction(
  input: LoginInput,
  callbackUrl?: string | null,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: firstErrors(parsed.error.flatten().fieldErrors) };
  }
  const { identifier, password, remember } = parsed.data;
  const key = `login:${identifierKey(identifier)}:${await clientIp()}`;

  const limit = await loginLimiter.hit(key);
  if (!limit.ok) {
    return {
      ok: false,
      message: `Terlalu banyak percobaan, coba lagi dalam ${limit.retryAfterSeconds} detik.`,
    };
  }

  try {
    await signIn("credentials", {
      identifier,
      password,
      remember: String(remember),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const code = (error as AuthError & { code?: string }).code;
      if (code === "inactive") {
        return {
          ok: false,
          message: "Akun Anda sedang dinonaktifkan. Silakan hubungi petugas klinik.",
        };
      }
      return { ok: false, message: GENERIC_LOGIN_ERROR };
    }
    throw error;
  }

  await loginLimiter.reset(key);
  const user = await findUserByIdentifier(identifier);
  if (!user) return { ok: false, message: GENERIC_LOGIN_ERROR };

  const home = homeFor(user.role, user.staffType);
  const target = safeCallbackUrl(callbackUrl);
  redirect(target && canAccessPath(target, user.role, user.staffType) ? target : home);
}

/** Registrasi pasien publik: User (PATIENT) + Patient diri sendiri, lalu otomatis login. */
export async function registerAction(input: RegisterInput): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: firstErrors(parsed.error.flatten().fieldErrors) };
  }

  try {
    const { user } = await registerPatientAccount(parsed.data);
    await sendVerificationEmail(user); // no-op bila EMAIL_VERIFICATION_ENABLED=false
  } catch (error) {
    const field = uniqueFieldFromError(error);
    if (field === "email")
      return { ok: false, fieldErrors: { email: "Email ini sudah terdaftar." } };
    if (field === "phone")
      return { ok: false, fieldErrors: { phone: "No. HP ini sudah terdaftar." } };
    if (field === "nik") return { ok: false, fieldErrors: { nik: "NIK ini sudah terdaftar." } };
    console.error("[registerAction]", error);
    return { ok: false, message: "Pendaftaran gagal. Silakan coba lagi." };
  }

  await signIn("credentials", {
    identifier: parsed.data.email,
    password: parsed.data.password,
    remember: "true",
    redirect: false,
  });
  redirect("/pasien?selamat=1");
}

export async function logoutAction() {
  await signOut({ redirectTo: "/masuk?status=keluar" });
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

const RESET_TTL_MINUTES = 60;

/** Kirim tautan reset password. Respons selalu sama agar tidak membocorkan email terdaftar. */
export async function forgotPasswordAction(input: ForgotPasswordInput): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: firstErrors(parsed.error.flatten().fieldErrors) };
  }
  const message =
    "Jika email tersebut terdaftar, tautan untuk mengatur ulang password sudah kami kirim. Periksa kotak masuk Anda.";

  const user = await db.user.findUnique({
    where: { email: normalizeEmail(parsed.data.email) },
    select: { id: true, name: true, email: true, isActive: true },
  });
  if (!user || !user.isActive) return { ok: true, message };

  const token = randomBytes(32).toString("base64url");
  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000),
    },
  });

  const url = `${env.NEXT_PUBLIC_APP_URL}/reset-password/${token}`;
  await sendMail({
    to: user.email,
    subject: `Atur ulang password akun ${clinicConfig.name}`,
    text: `Halo ${user.name},\n\nKami menerima permintaan untuk mengatur ulang password akun Anda.\nBuka tautan berikut (berlaku ${RESET_TTL_MINUTES} menit, sekali pakai):\n${url}\n\nAbaikan email ini bila Anda tidak memintanya.\n\n${clinicConfig.name}`,
    html: emailLayout({
      title: "Atur ulang password",
      intro: `Halo ${user.name}, kami menerima permintaan untuk mengatur ulang password akun Anda. Tautan ini berlaku ${RESET_TTL_MINUTES} menit dan hanya bisa dipakai sekali.`,
      actionLabel: "Atur ulang password",
      actionUrl: url,
      outro: "Abaikan email ini bila Anda tidak memintanya. Password Anda tidak akan berubah.",
    }),
  });
  return { ok: true, message };
}

/** Cek token reset (dipakai halaman /reset-password/[token]). */
export async function isResetTokenValid(token: string): Promise<boolean> {
  const row = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { expiresAt: true, usedAt: true },
  });
  return !!row && !row.usedAt && row.expiresAt > new Date();
}

export async function resetPasswordAction(input: ResetPasswordInput): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: firstErrors(parsed.error.flatten().fieldErrors) };
  }
  const tokenHash = hashToken(parsed.data.token);
  const row = await db.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!row || row.usedAt || row.expiresAt <= new Date()) {
    return {
      ok: false,
      message: "Tautan sudah kedaluwarsa atau sudah dipakai. Minta tautan baru.",
    };
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, BCRYPT_COST);
  await db.$transaction([
    db.user.update({ where: { id: row.userId }, data: { passwordHash } }),
    db.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    db.passwordResetToken.deleteMany({ where: { userId: row.userId, usedAt: null } }),
  ]);
  redirect("/masuk?status=reset");
}
