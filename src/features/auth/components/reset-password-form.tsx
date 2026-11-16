"use client";

import { useState, useTransition } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { OctagonX } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/ui-kit/form-field";
import { PasswordInput } from "@/components/ui-kit/password-input";
import { SubmitButton } from "@/components/ui-kit/submit-button";
import { resetPasswordSchema, type ResetPasswordInput } from "@/features/auth/schemas";
import { resetPasswordAction } from "@/features/auth/actions";
import { applyFieldErrors } from "@/lib/form";

export function ResetPasswordForm({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await resetPasswordAction(values);
      if (result && !result.ok) {
        if (result.fieldErrors) applyFieldErrors(form, result.fieldErrors);
        if (result.message) setFormError(result.message);
      }
    });
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {formError ? (
          <Alert className="border-danger/30 bg-danger-soft" role="alert">
            <OctagonX className="text-danger-ink" />
            <AlertDescription className="text-danger-ink">{formError}</AlertDescription>
          </Alert>
        ) : null}
        <FormField<ResetPasswordInput> name="password" label="Password baru">
          {(f) => <PasswordInput {...f} autoComplete="new-password" autoFocus />}
        </FormField>
        <FormField<ResetPasswordInput> name="confirmPassword" label="Ulangi password baru">
          {(f) => <PasswordInput {...f} autoComplete="new-password" />}
        </FormField>
        <SubmitButton pending={pending} pendingLabel="Menyimpan..." className="w-full">
          Simpan password
        </SubmitButton>
      </form>
    </FormProvider>
  );
}
