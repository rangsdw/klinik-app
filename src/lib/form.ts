import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

/** Pasang error dari server ke field React Hook Form, lalu fokus ke field pertama yang salah. */
export function applyFieldErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  fieldErrors: Record<string, string>,
) {
  const entries = Object.entries(fieldErrors);
  entries.forEach(([name, message], i) => {
    form.setError(name as Path<T>, { type: "server", message }, { shouldFocus: i === 0 });
  });
}
