"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Info, Pencil, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui-kit/form-field";
import { NativeSelect } from "@/components/ui-kit/native-select";
import { SubmitButton } from "@/components/ui-kit/submit-button";
import { applyFieldErrors } from "@/lib/form";
import { toDateInput } from "@/lib/date";
import {
  familyMemberSchema,
  MEMBER_RELATIONSHIPS,
  RELATIONSHIP_LABEL,
  type FamilyMemberInput,
} from "@/features/patients/schemas";
import { addFamilyMemberAction, updatePatientAction } from "@/features/patients/actions";
import type { PatientView } from "@/features/patients/queries";

type FormValues = Omit<FamilyMemberInput, "relationship" | "gender"> & {
  relationship: FamilyMemberInput["relationship"] | "";
  gender: FamilyMemberInput["gender"] | "";
};

function toDefaults(p?: PatientView): FormValues {
  return {
    name: p?.name ?? "",
    relationship: p?.relationship ?? "",
    nik: p?.nik ?? "",
    birthDate: p ? toDateInput(p.birthDate) : "",
    gender: p?.gender ?? "",
    bloodType: p?.bloodType ?? "",
    phone: p?.phone ?? "",
    address: p?.address ?? "",
    allergies: p?.allergies ?? "",
    specialConditions: p?.specialConditions ?? "",
  };
}

type Props = { patient?: PatientView; disabled?: boolean; triggerLabel?: string };

/** Tambah (tanpa `patient`) atau ubah (dengan `patient`) data anggota keluarga. */
export function MemberFormDialog({ patient, disabled, triggerLabel }: Props) {
  const router = useRouter();
  const editing = !!patient;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(familyMemberSchema) as never,
    defaultValues: toDefaults(patient),
  });
  const today = new Date().toISOString().slice(0, 10);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const input = values as FamilyMemberInput;
      const r = editing
        ? await updatePatientAction(patient.id, input)
        : await addFamilyMemberAction(input);
      if (r.ok) {
        toast.success(r.message);
        setOpen(false);
        if (!editing) form.reset(toDefaults());
        router.refresh();
      } else {
        if (r.fieldErrors) applyFieldErrors(form, r.fieldErrors);
        if (r.message) toast.error(r.message);
      }
    });
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (pending) return;
        setOpen(o);
        if (o) form.reset(toDefaults(patient));
      }}
    >
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="outline">
            <Pencil aria-hidden="true" />
            {triggerLabel ?? "Ubah data"}
          </Button>
        ) : (
          <Button disabled={disabled}>
            <UserPlus aria-hidden="true" />
            {triggerLabel ?? "Tambah anggota"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Ubah data ${patient.name}` : "Tambah anggota keluarga"}
          </DialogTitle>
          <DialogDescription className="flex items-start gap-2">
            <Info aria-hidden="true" className="text-info-ink mt-0.5 size-4 shrink-0" />
            Rekam medis dan QR Code setiap anggota terpisah.
          </DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <FormField<FormValues> name="name" label="Nama lengkap">
              {(f) => <Input {...f} placeholder="Sesuai KTP/KK" autoComplete="off" />}
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              {patient?.isSelf ? (
                <input type="hidden" {...form.register("relationship")} />
              ) : (
                <FormField<FormValues> name="relationship" label="Hubungan dengan Anda">
                  {(f) => (
                    <NativeSelect {...f}>
                      <option value="" disabled>
                        Pilih hubungan
                      </option>
                      {MEMBER_RELATIONSHIPS.map((r) => (
                        <option key={r} value={r}>
                          {RELATIONSHIP_LABEL[r]}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </FormField>
              )}
              <FormField<FormValues> name="nik" label="NIK" optional>
                {(f) => <Input {...f} inputMode="numeric" maxLength={16} placeholder="16 digit" />}
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField<FormValues> name="birthDate" label="Tanggal lahir">
                {(f) => <Input {...f} type="date" max={today} />}
              </FormField>
              <FormField<FormValues> name="gender" label="Jenis kelamin">
                {(f) => (
                  <NativeSelect {...f}>
                    <option value="" disabled>
                      Pilih
                    </option>
                    <option value="FEMALE">Perempuan</option>
                    <option value="MALE">Laki-laki</option>
                  </NativeSelect>
                )}
              </FormField>
              <FormField<FormValues> name="bloodType" label="Gol. darah" optional>
                {(f) => (
                  <NativeSelect {...f}>
                    <option value="">Belum tahu</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="AB">AB</option>
                    <option value="O">O</option>
                  </NativeSelect>
                )}
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField<FormValues> name="phone" label="No. HP" optional>
                {(f) => <Input {...f} type="tel" inputMode="tel" placeholder="0812..." />}
              </FormField>
              <FormField<FormValues> name="address" label="Alamat" optional>
                {(f) => <Input {...f} placeholder="Kosongkan bila sama" />}
              </FormField>
            </div>

            <FormField<FormValues>
              name="allergies"
              label="Alergi"
              optional
              hint="Obat, makanan, atau lainnya. Dokter akan melihat catatan ini."
            >
              {(f) => <Textarea {...f} rows={2} placeholder="mis. Amoksisilin, udang" />}
            </FormField>
            <FormField<FormValues> name="specialConditions" label="Kondisi khusus" optional>
              {(f) => <Textarea {...f} rows={2} placeholder="mis. asma, hipertensi" />}
            </FormField>

            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Batal
              </Button>
              <SubmitButton pending={pending} pendingLabel="Menyimpan...">
                {editing ? "Simpan perubahan" : "Tambah anggota"}
              </SubmitButton>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
