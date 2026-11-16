"use client";

import { useState, useTransition } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { OctagonX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FieldError, FormField } from "@/components/ui-kit/form-field";
import { NativeSelect } from "@/components/ui-kit/native-select";
import { PasswordInput } from "@/components/ui-kit/password-input";
import { SubmitButton } from "@/components/ui-kit/submit-button";
import { registerSchema, type RegisterInput } from "@/features/auth/schemas";
import { registerAction } from "@/features/auth/actions";
import { applyFieldErrors } from "@/lib/form";

type RegisterFormValues = Omit<RegisterInput, "consent" | "gender"> & {
  consent: boolean;
  gender: RegisterInput["gender"] | "";
};

export function RegisterForm() {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema) as never,
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      nik: "",
      birthDate: "",
      gender: "",
      address: "",
      password: "",
      confirmPassword: "",
      consent: false,
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await registerAction(values as RegisterInput);
      if (result && !result.ok) {
        if (result.fieldErrors) applyFieldErrors(form, result.fieldErrors);
        if (result.message) setFormError(result.message);
      }
    });
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {formError ? (
          <Alert className="border-danger/30 bg-danger-soft" role="alert">
            <OctagonX className="text-danger-ink" />
            <AlertDescription className="text-danger-ink">{formError}</AlertDescription>
          </Alert>
        ) : null}

        <FormField<RegisterFormValues> name="name" label="Nama lengkap">
          {(f) => (
            <Input {...f} autoComplete="name" placeholder="Sesuai KTP, mis. Siti Rahmawati" />
          )}
        </FormField>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField<RegisterFormValues> name="email" label="Email">
            {(f) => (
              <Input
                {...f}
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="nama@email.com"
              />
            )}
          </FormField>
          <FormField<RegisterFormValues> name="phone" label="No. HP">
            {(f) => (
              <Input
                {...f}
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="0812 3456 7890"
              />
            )}
          </FormField>
        </div>

        <FormField<RegisterFormValues>
          name="nik"
          label="NIK"
          optional
          hint="16 digit, sesuai KTP atau KK."
        >
          {(f) => (
            <Input {...f} inputMode="numeric" maxLength={16} placeholder="3201xxxxxxxxxxxx" />
          )}
        </FormField>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField<RegisterFormValues> name="birthDate" label="Tanggal lahir">
            {(f) => <Input {...f} type="date" max={today} autoComplete="bday" />}
          </FormField>
          <FormField<RegisterFormValues> name="gender" label="Jenis kelamin">
            {(f) => (
              <NativeSelect {...f} autoComplete="sex">
                <option value="" disabled>
                  Pilih
                </option>
                <option value="FEMALE">Perempuan</option>
                <option value="MALE">Laki-laki</option>
              </NativeSelect>
            )}
          </FormField>
        </div>

        <FormField<RegisterFormValues> name="address" label="Alamat" optional>
          {(f) => (
            <Textarea
              {...f}
              rows={2}
              autoComplete="street-address"
              placeholder="Jalan, RT/RW, kelurahan, kota"
            />
          )}
        </FormField>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField<RegisterFormValues>
            name="password"
            label="Password"
            hint="Minimal 8 karakter, huruf dan angka."
          >
            {(f) => <PasswordInput {...f} autoComplete="new-password" />}
          </FormField>
          <FormField<RegisterFormValues> name="confirmPassword" label="Ulangi password">
            {(f) => <PasswordInput {...f} autoComplete="new-password" />}
          </FormField>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-start gap-3">
            <Checkbox
              id="consent"
              className="mt-0.5"
              aria-invalid={Boolean(form.formState.errors.consent)}
              checked={form.watch("consent")}
              onCheckedChange={(v) =>
                form.setValue("consent", v === true, { shouldValidate: form.formState.isSubmitted })
              }
            />
            <Label htmlFor="consent" className="text-ink leading-relaxed font-normal">
              Saya setuju data saya dipakai untuk layanan kesehatan di klinik ini dan disimpan
              secara rahasia.
            </Label>
          </div>
          <FieldError message={form.formState.errors.consent?.message} />
        </div>

        <SubmitButton pending={pending} pendingLabel="Mendaftarkan..." className="w-full">
          Daftar sekarang
        </SubmitButton>
      </form>
    </FormProvider>
  );
}
