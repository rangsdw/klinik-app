import { z } from "zod";

export const updateScheduleSchema = z.object({
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Format jam harus HH:mm"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Format jam harus HH:mm"),
  status: z.enum(["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]),
});

export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;

export const prescriptionItemSchema = z.object({
  medicineId: z.string().min(1, "Pilih obat"),
  quantity: z.coerce.number().int().min(1, "Jumlah minimal 1"),
  dosageInstructions: z.string().min(1, "Aturan pakai wajib diisi"),
  notes: z.string().optional(),
});

export const saveSoapRecordSchema = z.object({
  appointmentId: z.string().min(1),
  // SOAP
  subjective: z.string().optional(),
  objective: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
  // Vital Signs
  bloodPressure: z.string().optional(),
  bodyTemperature: z.coerce.number().nullable().optional(),
  bodyWeight: z.coerce.number().nullable().optional(),
  pulseRate: z.coerce.number().int().nullable().optional(),
  // E-Resep
  prescriptions: z.array(prescriptionItemSchema).optional(),
  markCompleted: z.boolean().default(true),
});

export type SaveSoapRecordInput = z.infer<typeof saveSoapRecordSchema>;
