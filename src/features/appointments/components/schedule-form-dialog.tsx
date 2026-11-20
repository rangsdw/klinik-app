"use client";

import { useEffect, useState, useTransition } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
import { FormField } from "@/components/ui-kit/form-field";
import { NativeSelect } from "@/components/ui-kit/native-select";
import { SubmitButton } from "@/components/ui-kit/submit-button";
import { applyFieldErrors } from "@/lib/form";
import {
  DAY_OPTIONS,
  doctorScheduleSchema,
  type DoctorScheduleInput,
} from "@/features/appointments/schemas";
import type { DoctorOption, DoctorScheduleRow } from "@/features/appointments/queries";
import { createScheduleAction, updateScheduleAction } from "@/features/appointments/actions";

type Props =
  | {
      mode: "create";
      doctors: DoctorOption[];
      schedule?: undefined;
      open?: undefined;
      onOpenChange?: undefined;
    }
  | {
      mode: "edit";
      doctors: DoctorOption[];
      schedule: DoctorScheduleRow;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    };

export function ScheduleFormDialog(props: Props) {
  const { mode, doctors, schedule } = props;
  const [openState, setOpenState] = useState(false);
  const open = mode === "edit" ? props.open : openState;
  const setOpen = mode === "edit" ? props.onOpenChange : setOpenState;
  const [pending, startTransition] = useTransition();

  const defaults: DoctorScheduleInput = {
    doctorId: schedule?.doctorId ?? doctors[0]?.id ?? "",
    dayOfWeek: schedule?.dayOfWeek ?? 1,
    startTime: schedule?.startTime ?? "08:00",
    endTime: schedule?.endTime ?? "12:00",
    quota: schedule?.quota ?? 15,
  };

  const form = useForm<DoctorScheduleInput>({
    resolver: zodResolver(doctorScheduleSchema) as never,
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) {
      form.reset({
        doctorId: schedule?.doctorId ?? doctors[0]?.id ?? "",
        dayOfWeek: schedule?.dayOfWeek ?? 1,
        startTime: schedule?.startTime ?? "08:00",
        endTime: schedule?.endTime ?? "12:00",
        quota: schedule?.quota ?? 15,
      });
    }
  }, [open, schedule, doctors, form]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createScheduleAction(values)
          : await updateScheduleAction(schedule.id, values);

      if (!res.ok) {
        if (res.fieldErrors) applyFieldErrors(form, res.fieldErrors);
        if (res.message) toast.error(res.message);
        return;
      }

      toast.success(res.message ?? "Jadwal tersimpan.");
      setOpen(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {mode === "create" ? (
        <DialogTrigger asChild>
          <Button disabled={doctors.length === 0}>
            <Plus aria-hidden="true" />
            Tambah Sesi
          </Button>
        </DialogTrigger>
      ) : null}

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Tambah Sesi Jadwal Dokter" : "Ubah Sesi Jadwal Dokter"}
          </DialogTitle>
          <DialogDescription>
            Tentukan dokter, hari praktik, jam sesi, dan kuota maksimal pasien.
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField<DoctorScheduleInput> name="doctorId" label="Dokter">
              {(field) => (
                <NativeSelect {...field}>
                  <option value="">Pilih dokter...</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField<DoctorScheduleInput> name="dayOfWeek" label="Hari praktik">
                {(field) => (
                  <NativeSelect {...field}>
                    {DAY_OPTIONS.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FormField>

              <FormField<DoctorScheduleInput>
                name="quota"
                label="Kuota pasien"
                hint="Maksimal pasien per sesi"
              >
                {(field) => <Input {...field} type="number" min={1} max={200} />}
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField<DoctorScheduleInput> name="startTime" label="Jam mulai">
                {(field) => <Input {...field} type="time" />}
              </FormField>

              <FormField<DoctorScheduleInput> name="endTime" label="Jam selesai">
                {(field) => <Input {...field} type="time" />}
              </FormField>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Batal
              </Button>
              <SubmitButton pending={pending}>
                {mode === "create" ? "Simpan Sesi" : "Simpan Perubahan"}
              </SubmitButton>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
