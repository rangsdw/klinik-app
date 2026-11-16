"use client";

import { useId } from "react";
import {
  useFormContext,
  type FieldValues,
  type Path,
  type UseFormRegisterReturn,
} from "react-hook-form";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type FieldControlProps = UseFormRegisterReturn & {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
};

type FormFieldProps<T extends FieldValues> = {
  name: Path<T>;
  label: string;
  hint?: React.ReactNode;
  optional?: boolean;
  className?: string;
  /** Render input; terima props register + aria yang sudah terhubung. */
  children: (field: FieldControlProps) => React.ReactNode;
};

/**
 * Label + input + pesan error inline, terhubung ke React Hook Form lewat FormProvider.
 * Pesan error berbahasa Indonesia berasal dari skema Zod.
 */
export function FormField<T extends FieldValues>({
  name,
  label,
  hint,
  optional,
  className,
  children,
}: FormFieldProps<T>) {
  const id = useId();
  const {
    register,
    formState: { errors },
  } = useFormContext<T>();

  const error = name.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, errors) as { message?: string } | undefined;

  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error?.message ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="text-ink text-sm font-medium">
        {label}
        {optional ? <span className="text-ink-muted font-normal">(opsional)</span> : null}
      </Label>
      {children({
        ...register(name),
        id,
        "aria-invalid": Boolean(error?.message),
        "aria-describedby": describedBy,
      })}
      {hint && !error?.message ? (
        <p id={hintId} className="text-ink-muted text-sm">
          {hint}
        </p>
      ) : null}
      <FieldError id={errorId} message={error?.message} />
    </div>
  );
}

/** Pesan error inline di bawah field. Selalu memesan tempat agar layout tidak melompat. */
export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-danger-ink text-sm font-medium">
      {message}
    </p>
  );
}
