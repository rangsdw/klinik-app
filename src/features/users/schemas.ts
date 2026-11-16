import { z } from "zod";
import { isIndonesianPhone, normalizePhone } from "@/lib/normalize";

/** Role yang bisa dikelola admin lewat menu akun internal. */
export const INTERNAL_ROLES = ["ADMIN", "DOCTOR", "STAFF"] as const;

export const internalUserSchema = z
  .object({
    name: z.string().trim().min(3, "Nama minimal 3 karakter").max(120, "Nama terlalu panjang"),
    email: z.string().trim().min(1, "Email wajib diisi").email("Format email tidak valid"),
    phone: z
      .string()
      .trim()
      .optional()
      .refine(
        (v) => !v || isIndonesianPhone(normalizePhone(v)),
        "No. HP tidak valid (contoh: 0812 3456 7890)",
      ),
    role: z.enum(INTERNAL_ROLES, { errorMap: () => ({ message: "Pilih role" }) }),
    staffType: z.enum(["REGISTRATION", "PHARMACY", "CASHIER", ""]).optional(),
  })
  .refine((d) => d.role !== "STAFF" || !!d.staffType, {
    path: ["staffType"],
    message: "Tipe staf wajib dipilih untuk role Staf",
  });
export type InternalUserInput = z.infer<typeof internalUserSchema>;

export const userListParamsSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  role: z.enum(["ADMIN", "DOCTOR", "STAFF", "PATIENT"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(1),
});
export type UserListParams = z.infer<typeof userListParamsSchema>;
