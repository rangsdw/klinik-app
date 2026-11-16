import "server-only";
import { env } from "@/lib/env";

/**
 * Hook verifikasi email (opsional). Default MATI lewat EMAIL_VERIFICATION_ENABLED=false
 * agar demo lancar. Saat diaktifkan, implementasikan: buat token (pola sama dengan
 * PasswordResetToken), kirim email via sendMail(), lalu set User.emailVerifiedAt saat token dibuka.
 */
export function isEmailVerificationEnabled(): boolean {
  return env.EMAIL_VERIFICATION_ENABLED;
}

export async function sendVerificationEmail(_user: {
  id: string;
  email: string;
  name: string;
}): Promise<void> {
  if (!isEmailVerificationEnabled()) return;
  // TODO: implementasi token verifikasi + email saat fitur diaktifkan.
  console.info(`[verifikasi email] belum diimplementasikan untuk ${_user.email}`);
}
