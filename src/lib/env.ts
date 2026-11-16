import "server-only";
import { z } from "zod";

const boolString = z
  .enum(["true", "false", ""])
  .optional()
  .transform((v) => v === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string({ required_error: "DATABASE_URL wajib diisi" })
    .startsWith("mysql://", "DATABASE_URL harus berupa URL MySQL (mysql://...)"),
  AUTH_SECRET: z
    .string({ required_error: "AUTH_SECRET wajib diisi (jalankan: npx auth secret)" })
    .min(16, "AUTH_SECRET terlalu pendek (jalankan: npx auth secret)"),
  AUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  CLINIC_NAME: z.string().default("Klinik Sehat"),
  CLINIC_ADDRESS: z.string().default(""),
  CLINIC_PHONE: z.string().default(""),
  CLINIC_EMAIL: z.string().default(""),
  CLINIC_HOURS: z.string().default(""),

  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  MAIL_FROM: z.string().default("Klinik Sehat <no-reply@kliniksehat.test>"),

  EMAIL_VERIFICATION_ENABLED: boolString,
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`\nKonfigurasi environment tidak valid. Periksa file .env:\n${issues}\n`);
  }
  return parsed.data;
}

export const env = loadEnv();
export type Env = typeof env;
