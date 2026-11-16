"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { OctagonX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/ui-kit/form-field";
import { PasswordInput } from "@/components/ui-kit/password-input";
import { SubmitButton } from "@/components/ui-kit/submit-button";
import { loginSchema, type LoginInput } from "@/features/auth/schemas";
import { loginAction } from "@/features/auth/actions";
import { applyFieldErrors } from "@/lib/form";

export function LoginForm({ callbackUrl }: { callbackUrl: string | null }) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "", remember: false },
  });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await loginAction(values, callbackUrl);
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

        <FormField<LoginInput> name="identifier" label="Email atau No. HP">
          {(field) => (
            <Input
              {...field}
              autoComplete="username"
              placeholder="nama@email.com atau 0812..."
              autoFocus
            />
          )}
        </FormField>

        <FormField<LoginInput> name="password" label="Password">
          {(field) => (
            <PasswordInput {...field} autoComplete="current-password" placeholder="Password Anda" />
          )}
        </FormField>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Checkbox
              id="remember"
              checked={form.watch("remember") === true}
              onCheckedChange={(v) => form.setValue("remember", v === true)}
            />
            <Label htmlFor="remember" className="text-ink font-normal">
              Ingat saya
            </Label>
          </div>
          <Link
            href="/lupa-password"
            className="text-primary-700 text-sm font-semibold underline-offset-4 hover:underline"
          >
            Lupa password?
          </Link>
        </div>

        <SubmitButton pending={pending} pendingLabel="Memeriksa..." className="w-full">
          Masuk
        </SubmitButton>
      </form>
    </FormProvider>
  );
}
