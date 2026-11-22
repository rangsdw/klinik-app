"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  Printer,
  Search,
  UserCheck,
  UserPlus,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { FormField } from "@/components/ui-kit/form-field";
import { NativeSelect } from "@/components/ui-kit/native-select";
import { StatusBadge } from "@/components/ui-kit/status-badge";
import { BLOOD_TYPES, walkInNewPatientSchema, type WalkInNewPatientInput } from "@/features/patients/schemas";
import type { StaffPatientSummary } from "@/features/patients/staff-queries";
import { PatientQrDialog } from "@/features/patients/components/patient-qr-dialog";
import { formatDate } from "@/lib/date";
import { applyFieldErrors } from "@/lib/form";
import type { TodayWalkInSessionOption } from "@/features/appointments/queries";
import {
  registerWalkInAction,
  searchWalkInPatientsAction,
  type WalkInActionSuccess,
} from "@/features/appointments/actions";

type Props = {
  sessions: TodayWalkInSessionOption[];
  preselectedPatient: StaffPatientSummary | null;
  clinicName: string;
  clinicAddress?: string;
  clinicPhone?: string;
};

type NewPatientFormValues = Omit<WalkInNewPatientInput, "gender"> & {
  gender: WalkInNewPatientInput["gender"] | "";
};

const EMPTY_NEW_PATIENT: NewPatientFormValues = {
  name: "",
  birthDate: "",
  gender: "",
  nik: "",
  bloodType: "",
  phone: "",
  address: "",
  allergies: "",
  specialConditions: "",
};

export function StaffWalkInView({
  sessions,
  preselectedPatient,
  clinicName,
  clinicAddress,
  clinicPhone,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"EXISTING" | "NEW">("EXISTING");

  // Pasien lama
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StaffPatientSummary[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, startSearch] = useTransition();
  const [selectedPatient, setSelectedPatient] = useState<StaffPatientSummary | null>(
    preselectedPatient,
  );

  // Pasien baru (RHF + Zod)
  const [duplicatePatient, setDuplicatePatient] = useState<StaffPatientSummary | null>(null);
  const newPatientForm = useForm<NewPatientFormValues>({
    resolver: zodResolver(walkInNewPatientSchema) as never,
    defaultValues: EMPTY_NEW_PATIENT,
  });

  // Sesi & keluhan
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>(
    () => sessions.find((s) => !s.isEnded)?.scheduleId ?? "",
  );
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  // Sukses & cetak karcis
  const [successData, setSuccessData] = useState<WalkInActionSuccess | null>(null);
  const [printingTicket, setPrintingTicket] = useState(false);

  useEffect(() => {
    const cleanup = () => {
      document.body.classList.remove("printing-queue-ticket");
      setPrintingTicket(false);
    };
    window.addEventListener("afterprint", cleanup);
    return () => {
      window.removeEventListener("afterprint", cleanup);
      cleanup();
    };
  }, []);

  const selectedSession = sessions.find((s) => s.scheduleId === selectedScheduleId) ?? null;

  function handleSearchPatients(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    setSubmitError(null);
    startSearch(async () => {
      const res = await searchWalkInPatientsAction(trimmed);
      setHasSearched(true);
      if (!res.ok) {
        toast.error(res.message ?? "Gagal mencari pasien.");
        return;
      }
      setSearchResults(res.data ?? []);
    });
  }

  function switchToExistingWithPatient(patient: StaffPatientSummary) {
    setMode("EXISTING");
    setSelectedPatient(patient);
    setDuplicatePatient(null);
    setSubmitError(null);
  }

  function handlePrintTicket() {
    setPrintingTicket(true);
    document.body.classList.add("printing-queue-ticket");
    requestAnimationFrame(() => {
      window.print();
    });
  }

  function handleResetForNextPatient() {
    setSuccessData(null);
    setSelectedPatient(null);
    setSearchQuery("");
    setSearchResults([]);
    setHasSearched(false);
    setDuplicatePatient(null);
    newPatientForm.reset(EMPTY_NEW_PATIENT);
    setChiefComplaint("");
    setSubmitError(null);
    router.refresh();
  }

  async function handleSubmitWalkIn(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setDuplicatePatient(null);

    if (!selectedSession) {
      setSubmitError("Pilih sesi praktik dokter hari ini terlebih dahulu.");
      return;
    }

    if (chiefComplaint.trim().length < 3) {
      setSubmitError("Keluhan singkat minimal 3 karakter.");
      return;
    }

    if (mode === "EXISTING") {
      if (!selectedPatient) {
        setSubmitError("Cari dan pilih pasien terlebih dahulu.");
        return;
      }

      startSubmit(async () => {
        const res = await registerWalkInAction({
          mode: "EXISTING",
          patientId: selectedPatient.id,
          doctorId: selectedSession.doctorId,
          scheduleId: selectedSession.scheduleId,
          chiefComplaint,
        });

        if (!res.ok) {
          const msg = res.message ?? "Gagal mendaftarkan walk-in.";
          setSubmitError(msg);
          toast.error(msg);
          return;
        }

        toast.success(res.message ?? "Walk-in berhasil didaftarkan.");
        setSuccessData(res.data);
        router.refresh();
      });
      return;
    }

    // Mode pasien baru: validasi form pasien baru dulu via React Hook Form
    const valid = await newPatientForm.trigger();
    if (!valid) {
      setSubmitError("Periksa kembali data pasien baru.");
      return;
    }

    const values = newPatientForm.getValues() as WalkInNewPatientInput;
    startSubmit(async () => {
      const res = await registerWalkInAction({
        mode: "NEW",
        newPatient: values,
        doctorId: selectedSession.doctorId,
        scheduleId: selectedSession.scheduleId,
        chiefComplaint,
      });

      if (!res.ok) {
        if (res.duplicatePatient) {
          setDuplicatePatient(res.duplicatePatient);
        }
        if (res.fieldErrors) {
          // Field prefix newPatient.* dipetakan kembali ke form pasien baru
          const mappedErrors: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.fieldErrors)) {
            mappedErrors[k.replace(/^newPatient\./, "")] = v;
          }
          applyFieldErrors(newPatientForm, mappedErrors);
        }
        const msg = res.message ?? "Gagal mendaftarkan pasien walk-in.";
        setSubmitError(msg);
        toast.error(msg);
        return;
      }

      toast.success(res.message ?? "Pasien walk-in berhasil didaftarkan.");
      setSuccessData(res.data);
      router.refresh();
    });
  }

  // Layar sukses besar menampilkan nomor antrean
  if (successData) {
    return (
      <>
        <Card className="border-primary-200 bg-surface mx-auto max-w-xl">
          <CardContent className="space-y-6 p-6 text-center sm:p-8">
            <div className="bg-success-soft text-success-ink mx-auto grid size-14 place-items-center rounded-full">
              <CheckCircle2 aria-hidden="true" className="size-8" />
            </div>

            <div className="space-y-1">
              <p className="text-ink-muted text-sm font-medium">Nomor Antrean Walk-in</p>
              <p className="tabular text-primary-800 text-5xl font-bold tracking-tight sm:text-6xl">
                {successData.formattedQueueNumber}
              </p>
            </div>

            <div className="border-line bg-paper space-y-2 rounded-xl border p-4 text-left text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-ink-muted">Pasien</span>
                <span className="text-ink-strong font-semibold">
                  {successData.patientName} ({successData.medicalRecordNumber})
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-ink-muted">Dokter</span>
                <span className="text-ink-strong font-semibold">{successData.doctorName}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-ink-muted">Jadwal Sesi</span>
                <span className="text-ink font-medium">
                  {formatDate(successData.appointmentDate)}, {successData.startTime}–
                  {successData.endTime} WIB
                </span>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <Button
                type="button"
                size="lg"
                onClick={handlePrintTicket}
                className="bg-primary-700 text-surface hover:bg-primary-800 min-h-11"
              >
                <Printer aria-hidden="true" className="size-4" />
                Cetak Karcis Antrean
              </Button>

              {successData.isNewPatient && successData.newPatientQrSvg ? (
                <PatientQrDialog
                  patientId={successData.patientId}
                  patientName={successData.patientName}
                  medicalRecordNumber={successData.medicalRecordNumber}
                  qrSvg={successData.newPatientQrSvg}
                  clinicName={clinicName}
                  clinicAddress={clinicAddress}
                  clinicPhone={clinicPhone}
                  allowRegenerate={false}
                  triggerLabel="Cetak Kartu QR"
                  triggerVariant="outline"
                  triggerClassName="min-h-11"
                />
              ) : null}

              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleResetForNextPatient}
                className="min-h-11"
              >
                Daftarkan Pasien Berikutnya
              </Button>
            </div>
          </CardContent>
        </Card>

        {printingTicket ? (
          <div className="ticket-print-only hidden print:flex">
            <div className="border-line bg-qr-surface text-qr-ink w-full max-w-xs rounded-xl border p-6 text-center">
              <p className="text-primary-700 text-base font-bold">{clinicName}</p>
              {clinicAddress ? <p className="text-ink-soft mt-0.5 text-xs">{clinicAddress}</p> : null}
              <div className="border-line my-4 border-y py-4">
                <p className="text-ink-muted text-xs">NOMOR ANTREAN WALK-IN</p>
                <p className="tabular text-qr-ink mt-1 text-5xl font-bold">
                  {successData.formattedQueueNumber}
                </p>
              </div>
              <p className="text-qr-ink font-semibold">{successData.doctorName}</p>
              <p className="text-ink-soft text-xs">
                {formatDate(successData.appointmentDate)}, {successData.startTime}–
                {successData.endTime} WIB
              </p>
              <p className="text-ink-muted mt-3 text-xs">
                Pasien: {successData.patientName} ({successData.medicalRecordNumber})
              </p>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <form onSubmit={handleSubmitWalkIn} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Langkah 1: Cari Pasien Lama atau Daftarkan Pasien Baru */}
        <Card className="border-line bg-surface">
          <CardHeader className="border-line border-b">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-ink-strong text-base font-semibold">
                1. Identitas Pasien
              </CardTitle>
              <div className="bg-paper border-line inline-flex rounded-lg border p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "EXISTING" ? "default" : "ghost"}
                  onClick={() => {
                    setMode("EXISTING");
                    setDuplicatePatient(null);
                    setSubmitError(null);
                  }}
                >
                  <Search aria-hidden="true" className="size-3.5" />
                  Pasien Lama
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "NEW" ? "default" : "ghost"}
                  onClick={() => {
                    setMode("NEW");
                    setSubmitError(null);
                  }}
                >
                  <UserPlus aria-hidden="true" className="size-3.5" />
                  Pasien Baru
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 p-5">
            {mode === "EXISTING" ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="walkin-cari" className="text-ink text-sm font-medium">
                    Cari berdasarkan No. RM, NIK, Nama, atau No. HP
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="walkin-cari"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSearchPatients(e);
                        }
                      }}
                      placeholder="Ketik RM-2026-..., NIK, atau nama pasien"
                      className="h-11 flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={searching}
                      onClick={handleSearchPatients}
                      className="h-11 px-4"
                    >
                      {searching ? (
                        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                      ) : (
                        <Search aria-hidden="true" className="size-4" />
                      )}
                      Cari
                    </Button>
                  </div>
                </div>

                {selectedPatient ? (
                  <div className="border-primary-700 bg-primary-50/50 flex items-center justify-between gap-3 rounded-xl border p-4">
                    <div className="flex items-center gap-3">
                      <span className="bg-primary-700 text-surface grid size-10 shrink-0 place-items-center rounded-full">
                        <UserRound aria-hidden="true" className="size-5" />
                      </span>
                      <div>
                        <p className="text-ink-strong font-semibold">{selectedPatient.name}</p>
                        <p className="text-ink-soft text-xs">
                          <span className="font-mono">{selectedPatient.medicalRecordNumber}</span>
                          {" — "}
                          {selectedPatient.ageLabel}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPatient(null)}
                    >
                      Ganti
                    </Button>
                  </div>
                ) : null}

                {searchResults.length > 0 ? (
                  <ul className="divide-line border-line divide-y rounded-xl border">
                    {searchResults.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPatient(p);
                            setSearchResults([]);
                            setSubmitError(null);
                          }}
                          className="hover:bg-paper flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                        >
                          <div>
                            <p className="text-ink-strong font-medium">{p.name}</p>
                            <p className="text-ink-muted font-mono text-xs">
                              {p.medicalRecordNumber} — {p.ageLabel}
                            </p>
                          </div>
                          <span className="text-primary-700 text-xs font-semibold">Pilih</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : hasSearched && !searching && !selectedPatient ? (
                  <div className="border-line bg-paper rounded-xl border border-dashed p-4 text-center">
                    <p className="text-ink-strong text-sm font-medium">Pasien tidak ditemukan</p>
                    <p className="text-ink-muted mt-1 text-xs">
                      Belum pernah berobat? Daftarkan sebagai pasien baru.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => setMode("NEW")}
                    >
                      <UserPlus aria-hidden="true" className="size-3.5" />
                      Buat Data Pasien Baru
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                {duplicatePatient ? (
                  <div
                    role="alert"
                    className="border-warning/40 bg-warning-soft space-y-2 rounded-xl border p-4"
                  >
                    <p className="text-warning-ink flex items-center gap-2 text-sm font-semibold">
                      <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
                      Data pasien sudah terdaftar
                    </p>
                    <p className="text-ink-soft text-xs">
                      Ditemukan pasien dengan data yang sama:{" "}
                      <strong>{duplicatePatient.name}</strong> (
                      <span className="font-mono">{duplicatePatient.medicalRecordNumber}</span>,{" "}
                      {duplicatePatient.ageLabel}).
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => switchToExistingWithPatient(duplicatePatient)}
                    >
                      <UserCheck aria-hidden="true" className="size-3.5" />
                      Pilih Pasien Ini
                    </Button>
                  </div>
                ) : null}

                <FormProvider {...newPatientForm}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField<NewPatientFormValues>
                      name="name"
                      label="Nama lengkap"
                      className="sm:col-span-2"
                    >
                      {(field) => <Input {...field} placeholder="Sesuai KTP/identitas" />}
                    </FormField>

                    <FormField<NewPatientFormValues> name="birthDate" label="Tanggal lahir">
                      {(field) => <Input {...field} type="date" />}
                    </FormField>

                    <FormField<NewPatientFormValues> name="gender" label="Jenis kelamin">
                      {(field) => (
                        <NativeSelect {...field}>
                          <option value="">Pilih...</option>
                          <option value="MALE">Laki-laki</option>
                          <option value="FEMALE">Perempuan</option>
                        </NativeSelect>
                      )}
                    </FormField>

                    <FormField<NewPatientFormValues> name="nik" label="NIK" optional>
                      {(field) => (
                        <Input {...field} inputMode="numeric" maxLength={16} placeholder="16 digit" />
                      )}
                    </FormField>

                    <FormField<NewPatientFormValues> name="phone" label="No. HP" optional>
                      {(field) => <Input {...field} inputMode="tel" placeholder="08xxxxxxxxxx" />}
                    </FormField>

                    <FormField<NewPatientFormValues> name="bloodType" label="Gol. darah" optional>
                      {(field) => (
                        <NativeSelect {...field}>
                          <option value="">Belum diketahui</option>
                          {BLOOD_TYPES.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </NativeSelect>
                      )}
                    </FormField>

                    <FormField<NewPatientFormValues> name="address" label="Alamat" optional>
                      {(field) => <Input {...field} placeholder="Alamat tempat tinggal" />}
                    </FormField>

                    <FormField<NewPatientFormValues> name="allergies" label="Alergi obat/makanan" optional>
                      {(field) => <Input {...field} placeholder="Contoh: Amoksisilin" />}
                    </FormField>

                    <FormField<NewPatientFormValues>
                      name="specialConditions"
                      label="Kondisi khusus"
                      optional
                    >
                      {(field) => <Input {...field} placeholder="Contoh: Hipertensi, Asma" />}
                    </FormField>
                  </div>
                </FormProvider>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Langkah 2: Pilih Dokter & Sesi Hari Ini + Keluhan */}
        <Card className="border-line bg-surface">
          <CardHeader className="border-line border-b">
            <CardTitle className="text-ink-strong text-base font-semibold">
              2. Pilih Dokter, Sesi Hari Ini &amp; Keluhan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-5">
            <p className="bg-info-soft text-info-ink rounded-lg px-3 py-2 text-xs font-medium">
              Walk-in tidak dihitung ke kuota online dan langsung mendapatkan nomor antrean dokter.
            </p>

            {sessions.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="Tidak ada jadwal praktik aktif hari ini"
                description="Tambahkan atau aktifkan jadwal dokter untuk hari ini di menu Pendaftaran."
                action={
                  <Button asChild variant="outline">
                    <Link href="/staf/pendaftaran">Atur Jadwal Dokter</Link>
                  </Button>
                }
              />
            ) : (
              <div role="radiogroup" aria-label="Sesi praktik dokter hari ini" className="space-y-2.5">
                {sessions.map((slot) => {
                  const isSelected = selectedScheduleId === slot.scheduleId && !slot.isEnded;
                  return (
                    <button
                      key={slot.scheduleId}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={slot.isEnded}
                      onClick={() => {
                        setSelectedScheduleId(slot.scheduleId);
                        setSubmitError(null);
                      }}
                      className={
                        slot.isEnded
                          ? "border-line bg-paper text-ink-muted flex w-full cursor-not-allowed items-center justify-between gap-3 rounded-xl border p-3.5 text-left opacity-65"
                          : isSelected
                            ? "border-primary-700 bg-primary-50/60 ring-primary-700 flex w-full items-center justify-between gap-3 rounded-xl border-2 p-3.5 text-left ring-1"
                            : "border-line bg-surface hover:border-primary-300 flex w-full items-center justify-between gap-3 rounded-xl border p-3.5 text-left"
                      }
                    >
                      <div className="space-y-0.5">
                        <p className="text-ink-strong font-semibold">{slot.doctorName}</p>
                        <p className="text-ink-soft flex items-center gap-1.5 text-xs">
                          <Clock aria-hidden="true" className="size-3.5" />
                          {slot.startTime}–{slot.endTime} WIB
                        </p>
                      </div>
                      <div className="text-right">
                        {slot.isEnded ? (
                          <StatusBadge variant="neutral">Sesi selesai</StatusBadge>
                        ) : (
                          <>
                            <p className="tabular text-ink-strong text-sm font-bold">
                              {slot.currentQueueCount} antrean
                            </p>
                            <p className="text-ink-muted text-xs">{slot.walkInCount} walk-in</p>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="walkin-keluhan" className="text-ink text-sm font-medium">
                Keluhan singkat
              </Label>
              <Textarea
                id="walkin-keluhan"
                rows={3}
                maxLength={500}
                value={chiefComplaint}
                onChange={(e) => {
                  setChiefComplaint(e.target.value);
                  setSubmitError(null);
                }}
                placeholder="Contoh: Batuk berdahak dan demam sejak 2 hari lalu"
              />
            </div>

            {submitError ? (
              <p role="alert" className="text-danger-ink text-sm font-medium">
                {submitError}
              </p>
            ) : null}

            <Button
              type="submit"
              size="lg"
              disabled={submitting || !selectedSession}
              aria-busy={submitting}
              className="bg-primary-700 text-surface hover:bg-primary-800 h-12 w-full text-base font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  Mendaftarkan Walk-in...
                </>
              ) : (
                <>
                  <UserPlus aria-hidden="true" className="size-5" />
                  Terbitkan Nomor Antrean Walk-in
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
