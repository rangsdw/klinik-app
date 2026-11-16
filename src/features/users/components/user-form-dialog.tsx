"use client";

import { useState, useTransition } from "react";
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
import type { UserRow } from "@/features/users/queries";
import { internalUserSchema, type InternalUserInput } from "@/features/users/schemas";
import { createInternalUserAction, updateInternalUserAction } from "@/features/users/actions";
import { TemporaryPasswordDialog } from "@/features/users/components/temporary-password-dialog";

type Props =
  | {
      mode: "create";
      user?: undefined;
      isSelf?: undefined;
      open?: undefined;
      onOpenChange?: undefined;
    }
  | {
      mode: "edit";
      user: UserRow;
      isSelf: boolean;
      open: boolean;
      onOpenChange: (o: boolean) => void;
    };

type FormValues = Omit<InternalUserInput, "role"> & { role: InternalUserInput["role"] | "" };

export function UserFormDialog(props: Props) {
  const { mode, user } = props;
  const [openState, setOpenState] = useState(false);
  const open = mode === "edit" ? props.open : openState;
  const setOpen = mode === "edit" ? props.onOpenChange : setOpenState;
  const [pending, startTransition] = useTransition();
  const [temp, setTemp] = useState<{ name: string; password: string } | null>(null);

  const defaults: FormValues = {
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    role: user && user.role !== "PATIENT" ? user.role : "",
    staffType: user?.staffType ?? "",
  };
  const form = useForm<FormValues>({
    resolver: zodResolver(internalUserSchema) as never,
    defaultValues: defaults,
  });
  const role = form.watch("role");
  const roleLocked = mode === "edit" && props.isSelf;

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const input = values as InternalUserInput;
      if (mode === "create") {
        const r = await createInternalUserAction(input);
        if (r.ok) {
          setOpen(false);
          form.reset(defaults);
          toast.success(r.message);
          if (r.data) setTemp({ name: r.data.name, password: r.data.temporaryPassword });
        } else {
          if (r.fieldErrors) applyFieldErrors(form, r.fieldErrors);
          if (r.message) toast.error(r.message);
        }
      } else {
        const r = await updateInternalUserAction(user.id, input);
        if (r.ok) {
          setOpen(false);
          toast.success(r.message);
        } else {
          if (r.fieldErrors) applyFieldErrors(form, r.fieldErrors);
          if (r.message) toast.error(r.message);
        }
      }
    });
  });

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (pending) return;
          setOpen(o);
          if (o) form.reset(defaults);
        }}
      >
        {mode === "create" ? (
          <DialogTrigger asChild>
            <Button>
              <Plus aria-hidden="true" />
              Tambah akun
            </Button>
          </DialogTrigger>
        ) : null}
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "Tambah akun internal" : `Ubah akun ${user.name}`}
            </DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Password sementara dibuat otomatis dan ditampilkan sekali setelah akun tersimpan."
                : "Perubahan role berlaku saat pemilik akun membuka halaman berikutnya."}
            </DialogDescription>
          </DialogHeader>
          <FormProvider {...form}>
            <form onSubmit={onSubmit} noValidate className="space-y-4">
              <FormField<FormValues> name="name" label="Nama lengkap">
                {(f) => <Input {...f} placeholder="mis. dr. Andi Pratama" autoComplete="off" />}
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField<FormValues> name="email" label="Email">
                  {(f) => (
                    <Input
                      {...f}
                      type="email"
                      inputMode="email"
                      autoComplete="off"
                      placeholder="nama@klinik.test"
                    />
                  )}
                </FormField>
                <FormField<FormValues> name="phone" label="No. HP" optional>
                  {(f) => (
                    <Input
                      {...f}
                      type="tel"
                      inputMode="tel"
                      autoComplete="off"
                      placeholder="0812..."
                    />
                  )}
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField<FormValues>
                  name="role"
                  label="Role"
                  hint={roleLocked ? "Anda tidak bisa mengubah role akun sendiri." : undefined}
                >
                  {(f) =>
                    roleLocked ? (
                      <>
                        <input type="hidden" {...f} />
                        <Input value="Admin" readOnly aria-readonly className="bg-muted" />
                      </>
                    ) : (
                      <NativeSelect {...f}>
                        <option value="" disabled>
                          Pilih role
                        </option>
                        <option value="DOCTOR">Dokter</option>
                        <option value="STAFF">Staf</option>
                        <option value="ADMIN">Admin</option>
                      </NativeSelect>
                    )
                  }
                </FormField>
                {role === "STAFF" ? (
                  <FormField<FormValues> name="staffType" label="Tipe staf">
                    {(f) => (
                      <NativeSelect {...f}>
                        <option value="" disabled>
                          Pilih tipe
                        </option>
                        <option value="REGISTRATION">Pendaftaran</option>
                        <option value="PHARMACY">Farmasi</option>
                        <option value="CASHIER">Kasir</option>
                      </NativeSelect>
                    )}
                  </FormField>
                ) : null}
              </div>
              <DialogFooter className="gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                  Batal
                </Button>
                <SubmitButton pending={pending} pendingLabel="Menyimpan...">
                  {mode === "create" ? "Simpan akun" : "Simpan perubahan"}
                </SubmitButton>
              </DialogFooter>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>
      <TemporaryPasswordDialog value={temp} onClose={() => setTemp(null)} />
    </>
  );
}
