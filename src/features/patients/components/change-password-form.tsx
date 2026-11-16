"use client";

import { useTransition } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FormField } from "@/components/ui-kit/form-field";
import { PasswordInput } from "@/components/ui-kit/password-input";
import { SubmitButton } from "@/components/ui-kit/submit-button";
import { applyFieldErrors } from "@/lib/form";
import { changePasswordSchema, type ChangePasswordInput } from "@/features/patients/schemas";
import { changePasswordAction } from "@/features/patients/actions";

const EMPTY: ChangePasswordInput = { currentPassword: "", newPassword: "", confirmPassword: "" };

export function ChangePasswordForm() {
  const [pending, startTransition] = useTransition();
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: EMPTY,
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const r = await changePasswordAction(values);
      if (r.ok) {
        toast.success(r.message);
        form.reset(EMPTY);
      } else {
        if (r.fieldErrors) applyFieldErrors(form, r.fieldErrors);
        if (r.message) toast.error(r.message);
      }
    });
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4">
        <FormField<ChangePasswordInput> name="currentPassword" label="Password lama">
          {(f) => <PasswordInput {...f} autoComplete="current-password" />}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField<ChangePasswordInput>
            name="newPassword"
            label="Password baru"
            hint="Minimal 8 karakter, huruf dan angka."
          >
            {(f) => <PasswordInput {...f} autoComplete="new-password" />}
          </FormField>
          <FormField<ChangePasswordInput> name="confirmPassword" label="Ulangi password baru">
            {(f) => <PasswordInput {...f} autoComplete="new-password" />}
          </FormField>
        </div>
        <SubmitButton pending={pending} pendingLabel="Menyimpan...">
          Ganti password
        </SubmitButton>
      </form>
    </FormProvider>
  );
}
