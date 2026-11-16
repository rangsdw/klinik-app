"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui-kit/form-field";
import { SubmitButton } from "@/components/ui-kit/submit-button";
import { applyFieldErrors } from "@/lib/form";
import { profileSchema, type ProfileInput } from "@/features/patients/schemas";
import { updateProfileAction } from "@/features/patients/actions";

export function ProfileForm({ defaults }: { defaults: Omit<ProfileInput, "syncPatient"> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { ...defaults, syncPatient: true },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const r = await updateProfileAction(values);
      if (r.ok) {
        toast.success(r.message);
        router.refresh();
      } else {
        if (r.fieldErrors) applyFieldErrors(form, r.fieldErrors);
        if (r.message) toast.error(r.message);
      }
    });
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4">
        <FormField<ProfileInput> name="name" label="Nama lengkap">
          {(f) => <Input {...f} autoComplete="name" />}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField<ProfileInput> name="email" label="Email">
            {(f) => <Input {...f} type="email" inputMode="email" autoComplete="email" />}
          </FormField>
          <FormField<ProfileInput> name="phone" label="No. HP">
            {(f) => <Input {...f} type="tel" inputMode="tel" autoComplete="tel" />}
          </FormField>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox
            id="syncPatient"
            className="mt-0.5"
            checked={form.watch("syncPatient") === true}
            onCheckedChange={(v) => form.setValue("syncPatient", v === true)}
          />
          <Label htmlFor="syncPatient" className="text-ink leading-relaxed font-normal">
            Perbarui juga nama dan no. HP di data pasien saya
          </Label>
        </div>
        <SubmitButton pending={pending} pendingLabel="Menyimpan...">
          Simpan profil
        </SubmitButton>
      </form>
    </FormProvider>
  );
}
