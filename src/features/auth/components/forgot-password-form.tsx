"use client";

import { useState, useTransition } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/ui-kit/form-field";
import { SubmitButton } from "@/components/ui-kit/submit-button";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/features/auth/schemas";
import { forgotPasswordAction } from "@/features/auth/actions";
import { applyFieldErrors } from "@/lib/form";

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState<string | null>(null);
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await forgotPasswordAction(values);
      if (result.ok) setSent(result.message ?? "Tautan terkirim.");
      else if (result.fieldErrors) applyFieldErrors(form, result.fieldErrors);
    });
  });

  if (sent) {
    return (
      <Alert className="border-success/30 bg-success-soft" role="status">
        <MailCheck className="text-success-ink" />
        <AlertDescription className="text-success-ink">{sent}</AlertDescription>
      </Alert>
    );
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FormField<ForgotPasswordInput> name="email" label="Email">
          {(f) => (
            <Input
              {...f}
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="nama@email.com"
              autoFocus
            />
          )}
        </FormField>
        <SubmitButton pending={pending} pendingLabel="Mengirim..." className="w-full">
          Kirim tautan
        </SubmitButton>
      </form>
    </FormProvider>
  );
}
