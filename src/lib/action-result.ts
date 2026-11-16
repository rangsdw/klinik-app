/** Bentuk hasil Server Action yang konsisten untuk form. */
export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; message?: string; fieldErrors?: Record<string, string> };

/** Ubah ZodError.flatten().fieldErrors menjadi { field: pesan pertama }. */
export function firstErrors(
  fieldErrors: Record<string, string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fieldErrors)) if (v?.[0]) out[k] = v[0];
  return out;
}
