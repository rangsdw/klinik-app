"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardPlus,
  Clock,
  Loader2,
  Stethoscope,
  UserRound,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui-kit/confirm-dialog";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { NativeSelect } from "@/components/ui-kit/native-select";
import { StatusBadge } from "@/components/ui-kit/status-badge";
import { PatientSwitcher } from "@/features/patients/components/patient-switcher";
import { RELATIONSHIP_LABEL } from "@/features/patients/schemas";
import type { PatientView } from "@/features/patients/queries";
import { formatDate } from "@/lib/date";
import {
  APPOINTMENT_STATUS_LABEL,
  APPOINTMENT_STATUS_VARIANT,
  DAY_DISPLAY_ORDER,
  DAY_LABEL,
  bookAppointmentSchema,
  type AppointmentStatusKey,
} from "@/features/appointments/schemas";
import type {
  AvailableSessionSlot,
  DoctorOption,
  DoctorScheduleRow,
  PatientAppointmentRow,
} from "@/features/appointments/queries";
import {
  bookAppointmentAction,
  cancelAppointmentAction,
  getAvailableSessionsAction,
} from "@/features/appointments/actions";

type Props = {
  patients: PatientView[];
  activePatient: PatientView | null;
  doctors: DoctorOption[];
  doctorSchedules: DoctorScheduleRow[];
  initialDoctorId: string;
  initialDate: string;
  todayStr: string;
  maxDateStr: string;
  initialSessions: AvailableSessionSlot[];
  appointments: PatientAppointmentRow[];
};

const QUOTA_BADGE_VARIANT = {
  AVAILABLE: "success",
  ALMOST_FULL: "warning",
  FULL: "danger",
} as const;

const QUOTA_BAR_CLASS = {
  AVAILABLE: "bg-primary-700",
  ALMOST_FULL: "bg-warning",
  FULL: "bg-danger",
} as const;

export function PatientBookingView({
  patients,
  activePatient,
  doctors,
  doctorSchedules,
  initialDoctorId,
  initialDate,
  todayStr,
  maxDateStr,
  initialSessions,
  appointments,
}: Props) {
  const router = useRouter();
  const bookingSectionRef = useRef<HTMLElement | null>(null);
  const doctorSelectRef = useRef<HTMLSelectElement | null>(null);

  const [doctorId, setDoctorId] = useState(initialDoctorId);
  const [appointmentDate, setAppointmentDate] = useState(initialDate);
  const [sessions, setSessions] = useState<AvailableSessionSlot[]>(initialSessions);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>(() => {
    const firstAvailable = initialSessions.find((s) => s.quotaStatus !== "FULL");
    return firstAvailable?.scheduleId ?? "";
  });
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const [cancelTarget, setCancelTarget] = useState<PatientAppointmentRow | null>(null);

  // Daftar hari praktik unik per dokter agar pasien mudah memilih tanggal.
  const practiceDaysLabel = useMemo(() => {
    const days = Array.from(
      new Set(doctorSchedules.filter((s) => s.doctorId === doctorId).map((s) => s.dayOfWeek)),
    ).sort(
      (a, b) =>
        DAY_DISPLAY_ORDER.indexOf(a as (typeof DAY_DISPLAY_ORDER)[number]) -
        DAY_DISPLAY_ORDER.indexOf(b as (typeof DAY_DISPLAY_ORDER)[number]),
    );
    if (days.length === 0) return "Belum ada jadwal aktif untuk dokter ini";
    return `Praktik setiap hari ${days.map((d) => DAY_LABEL[d]).join(", ")}`;
  }, [doctorSchedules, doctorId]);

  const selectedDoctor = doctors.find((d) => d.id === doctorId);
  const selectedSession = sessions.find((s) => s.scheduleId === selectedScheduleId) ?? null;

  async function refreshSessions(nextDoctorId: string, nextDate: string) {
    if (!nextDoctorId || !nextDate) {
      setSessions([]);
      setSelectedScheduleId("");
      return;
    }
    setLoadingSessions(true);
    setSessionError(null);
    const res = await getAvailableSessionsAction(nextDoctorId, nextDate);
    setLoadingSessions(false);
    if (!res.ok) {
      setSessions([]);
      setSelectedScheduleId("");
      setSessionError(res.message ?? "Gagal memuat sesi jadwal.");
      return;
    }
    const list = res.data ?? [];
    setSessions(list);
    setSelectedScheduleId((prev) => {
      const stillAvailable = list.find((s) => s.scheduleId === prev && s.quotaStatus !== "FULL");
      if (stillAvailable) return stillAvailable.scheduleId;
      return list.find((s) => s.quotaStatus !== "FULL")?.scheduleId ?? "";
    });
  }

  useEffect(() => {
    // Sinkronkan daftar sesi awal bila props diperbarui setelah mutasi.
    setSessions(initialSessions);
  }, [initialSessions]);

  function handleDoctorChange(nextDoctorId: string) {
    setDoctorId(nextDoctorId);
    setFormError(null);
    void refreshSessions(nextDoctorId, appointmentDate);
  }

  function handleDateChange(nextDate: string) {
    setAppointmentDate(nextDate);
    setFormError(null);
    void refreshSessions(doctorId, nextDate);
  }

  function handleBookingSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!activePatient) {
      setFormError("Pilih pasien terlebih dahulu.");
      return;
    }

    const payload = {
      patientId: activePatient.id,
      doctorId,
      scheduleId: selectedScheduleId,
      appointmentDate,
      chiefComplaint,
    };

    const parsed = bookAppointmentSchema.safeParse(payload);
    if (!parsed.success) {
      const firstErr = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      setFormError(firstErr ?? "Periksa kembali data janji temu.");
      return;
    }

    startSubmit(async () => {
      const res = await bookAppointmentAction(parsed.data);
      if (!res.ok) {
        const firstFieldErr = res.fieldErrors ? Object.values(res.fieldErrors)[0] : undefined;
        const msg = firstFieldErr ?? res.message ?? "Gagal mengajukan janji temu.";
        setFormError(msg);
        toast.error(msg);
        await refreshSessions(doctorId, appointmentDate);
        return;
      }

      toast.success(res.message ?? "Janji temu berhasil diajukan.");
      setChiefComplaint("");
      setFormError(null);
      await refreshSessions(doctorId, appointmentDate);
      router.refresh();
    });
  }

  async function handleCancelAppointment(target: PatientAppointmentRow) {
    const res = await cancelAppointmentAction(target.id);
    if (!res.ok) {
      toast.error(res.message ?? "Gagal membatalkan janji.");
      return;
    }
    toast.success(res.message ?? "Janji temu dibatalkan.");
    await refreshSessions(doctorId, appointmentDate);
    router.refresh();
  }

  function focusBookingForm() {
    bookingSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    doctorSelectRef.current?.focus();
  }

  return (
    <div className="space-y-8">
      {/* Langkah 1: Pemilih pasien aktif */}
      <Card className="border-line bg-surface">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-ink-muted text-sm font-medium">Langkah 1 — Pasien yang berobat</p>
            {activePatient ? (
              <div className="flex flex-wrap items-center gap-2">
                <UserRound aria-hidden="true" className="text-primary-700 size-4 shrink-0" />
                <span className="text-ink-strong font-semibold">{activePatient.name}</span>
                <StatusBadge variant="neutral">
                  {RELATIONSHIP_LABEL[activePatient.relationship]}
                </StatusBadge>
                <span className="text-ink-muted font-mono text-xs">
                  {activePatient.medicalRecordNumber}
                </span>
              </div>
            ) : (
              <p className="text-ink-muted text-sm">Belum ada profil pasien aktif.</p>
            )}
          </div>

          {activePatient ? (
            <PatientSwitcher
              activeId={activePatient.id}
              patients={patients.map((p) => ({
                id: p.id,
                name: p.name,
                relationship: p.relationship,
                isSelf: p.isSelf,
              }))}
            />
          ) : null}
        </CardContent>
      </Card>

      {/* Form Booking Bertahap */}
      <section ref={bookingSectionRef} aria-labelledby="form-booking-judul">
        <Card className="border-line bg-surface">
          <CardHeader className="border-line border-b">
            <CardTitle id="form-booking-judul" className="text-ink-strong text-lg font-semibold">
              Buat janji baru
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 sm:p-6">
            {doctors.length === 0 ? (
              <EmptyState
                icon={Stethoscope}
                title="Belum ada dokter aktif"
                description="Jadwal dokter sedang disiapkan oleh klinik. Silakan cek kembali nanti."
              />
            ) : (
              <form onSubmit={handleBookingSubmit} className="space-y-6">
                {/* Langkah 2: Pilih dokter dan tanggal */}
                <div className="space-y-4">
                  <p className="text-ink-strong text-sm font-semibold">
                    Langkah 2 — Pilih dokter dan tanggal
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="booking-dokter" className="text-ink text-sm font-medium">
                        Dokter
                      </Label>
                      <NativeSelect
                        ref={doctorSelectRef}
                        id="booking-dokter"
                        value={doctorId}
                        onChange={(e) => handleDoctorChange(e.target.value)}
                        className="h-11"
                      >
                        <option value="">Pilih dokter...</option>
                        {doctors.map((doc) => (
                          <option key={doc.id} value={doc.id}>
                            {doc.name}
                          </option>
                        ))}
                      </NativeSelect>
                      <p className="text-ink-muted text-xs">{practiceDaysLabel}</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="booking-tanggal" className="text-ink text-sm font-medium">
                        Tanggal periksa
                      </Label>
                      <Input
                        id="booking-tanggal"
                        type="date"
                        value={appointmentDate}
                        min={todayStr}
                        max={maxDateStr}
                        onChange={(e) => handleDateChange(e.target.value)}
                        className="h-11"
                      />
                      <p className="text-ink-muted text-xs">
                        Pemesanan dibuka hingga 30 hari ke depan.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sesi & Indikator Kuota */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label className="text-ink-strong text-sm font-semibold">
                      Pilih sesi praktik yang tersedia
                    </Label>
                    {loadingSessions ? (
                      <span className="text-ink-muted inline-flex items-center gap-1.5 text-xs">
                        <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                        Memeriksa kuota...
                      </span>
                    ) : null}
                  </div>

                  {sessionError ? (
                    <div
                      role="alert"
                      className="border-danger/30 bg-danger-soft text-danger-ink rounded-xl border px-4 py-3 text-sm"
                    >
                      {sessionError}
                    </div>
                  ) : sessions.length === 0 && !loadingSessions ? (
                    <div className="border-line bg-paper rounded-xl border border-dashed px-4 py-6 text-center">
                      <CalendarDays aria-hidden="true" className="text-ink-muted mx-auto size-6" />
                      <p className="text-ink-strong mt-2 text-sm font-medium">
                        Tidak ada sesi praktik pada tanggal ini
                      </p>
                      <p className="text-ink-muted mt-1 text-xs">{practiceDaysLabel}.</p>
                    </div>
                  ) : (
                    <div
                      role="radiogroup"
                      aria-label="Daftar sesi praktik"
                      className="grid gap-3 sm:grid-cols-2"
                    >
                      {sessions.map((slot) => {
                        const isFull = slot.quotaStatus === "FULL";
                        const isSelected = selectedScheduleId === slot.scheduleId && !isFull;

                        return (
                          <button
                            key={slot.scheduleId}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            disabled={isFull}
                            onClick={() => {
                              setSelectedScheduleId(slot.scheduleId);
                              setFormError(null);
                            }}
                            className={
                              isFull
                                ? "border-line bg-paper text-ink-muted flex min-h-24 cursor-not-allowed flex-col justify-between rounded-xl border p-4 text-left opacity-70"
                                : isSelected
                                  ? "border-primary-700 bg-primary-50/60 ring-primary-700 flex min-h-24 flex-col justify-between rounded-xl border-2 p-4 text-left ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2"
                                  : "border-line bg-surface hover:border-primary-300 flex min-h-24 flex-col justify-between rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2"
                            }
                          >
                            <div className="flex w-full items-start justify-between gap-2">
                              <div>
                                <p className="text-ink-strong flex items-center gap-1.5 text-sm font-semibold">
                                  <Clock aria-hidden="true" className="size-4 shrink-0" />
                                  {slot.startTime} – {slot.endTime} WIB
                                </p>
                                <p className="text-ink-soft mt-1 text-xs font-medium">
                                  {slot.remaining} dari {slot.quota} tersisa
                                </p>
                              </div>
                              <StatusBadge variant={QUOTA_BADGE_VARIANT[slot.quotaStatus]}>
                                {slot.quotaLabel}
                              </StatusBadge>
                            </div>

                            <div className="mt-3 w-full space-y-1">
                              <div
                                role="progressbar"
                                aria-valuenow={slot.used}
                                aria-valuemin={0}
                                aria-valuemax={slot.quota}
                                aria-label={`Kuota sesi ${slot.startTime} sampai ${slot.endTime}`}
                                className="bg-paper border-line h-2 w-full overflow-hidden rounded-full border"
                              >
                                <div
                                  className={`h-full rounded-full transition-[width] ${QUOTA_BAR_CLASS[slot.quotaStatus]}`}
                                  style={{ width: `${slot.percentage}%` }}
                                />
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Langkah 3: Keluhan singkat */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="keluhan-singkat" className="text-ink-strong text-sm font-semibold">
                      Langkah 3 — Keluhan singkat
                    </Label>
                    <span className="text-ink-muted text-xs">{chiefComplaint.trim().length}/500</span>
                  </div>
                  <Textarea
                    id="keluhan-singkat"
                    rows={3}
                    maxLength={500}
                    placeholder="Contoh: Demam sejak kemarin malam dan sakit tenggorokan"
                    value={chiefComplaint}
                    onChange={(e) => {
                      setChiefComplaint(e.target.value);
                      setFormError(null);
                    }}
                  />
                </div>

                {/* Langkah 4: Ringkasan & Konfirmasi */}
                <div className="border-line bg-paper space-y-3 rounded-xl border p-4">
                  <p className="text-ink-strong text-sm font-semibold">
                    Langkah 4 — Ringkasan janji temu
                  </p>
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-ink-muted text-xs">Pasien</dt>
                      <dd className="text-ink-strong font-medium">
                        {activePatient?.name ?? "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted text-xs">Dokter</dt>
                      <dd className="text-ink-strong font-medium">
                        {selectedDoctor?.name ?? "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted text-xs">Tanggal &amp; Hari</dt>
                      <dd className="text-ink-strong font-medium">
                        {appointmentDate ? formatDate(appointmentDate) : "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted text-xs">Sesi &amp; Status awal</dt>
                      <dd className="text-ink-strong font-medium">
                        {selectedSession
                          ? `${selectedSession.startTime} – ${selectedSession.endTime} WIB (Menunggu Persetujuan)`
                          : "Belum memilih sesi"}
                      </dd>
                    </div>
                  </dl>
                </div>

                {formError ? (
                  <p role="alert" className="text-danger-ink text-sm font-medium">
                    {formError}
                  </p>
                ) : null}

                <div className="pt-1">
                  <Button
                    type="submit"
                    size="lg"
                    disabled={submitting || !activePatient || !selectedSession}
                    aria-busy={submitting}
                    className="bg-primary-700 text-surface hover:bg-primary-800 h-12 w-full text-base font-semibold sm:w-auto sm:px-8"
                  >
                    {submitting ? (
                      <>
                        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                        Mengajukan janji...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 aria-hidden="true" className="size-4" />
                        Ajukan Janji Temu
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Daftar Janji Pasien */}
      <section aria-labelledby="daftar-janji-judul" className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="daftar-janji-judul" className="text-ink-strong text-lg font-semibold">
            Daftar janji temu keluarga
          </h2>
          <span className="text-ink-muted text-sm">{appointments.length} janji</span>
        </div>

        {appointments.length === 0 ? (
          <EmptyState
            icon={ClipboardPlus}
            title="Belum ada janji temu"
            description="Buat janji temu pertama untuk diri sendiri atau anggota keluarga melalui formulir di atas."
            action={
              <Button
                type="button"
                onClick={focusBookingForm}
                className="bg-primary-700 text-surface hover:bg-primary-800"
              >
                <ClipboardPlus aria-hidden="true" />
                Buat Janji Sekarang
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {appointments.map((item) => {
              const statusKey = item.status as AppointmentStatusKey;
              return (
                <Card key={item.id} className="border-line bg-surface">
                  <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-ink-strong font-semibold">{item.doctorName}</span>
                        <StatusBadge variant={APPOINTMENT_STATUS_VARIANT[statusKey]}>
                          {APPOINTMENT_STATUS_LABEL[statusKey]}
                        </StatusBadge>
                        {item.queueNumber !== null ? (
                          <StatusBadge variant="neutral">Antrean #{item.queueNumber}</StatusBadge>
                        ) : null}
                      </div>

                      <div className="text-ink-soft flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <span className="inline-flex items-center gap-1.5">
                          <UserRound aria-hidden="true" className="size-3.5" />
                          {item.patientName}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays aria-hidden="true" className="size-3.5" />
                          {formatDate(item.appointmentDate)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock aria-hidden="true" className="size-3.5" />
                          {item.startTime} – {item.endTime} WIB
                        </span>
                      </div>

                      {item.chiefComplaint ? (
                        <p className="text-ink-muted text-sm">Keluhan: {item.chiefComplaint}</p>
                      ) : null}
                    </div>

                    {item.status === "PENDING" ? (
                      <div className="shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 w-full sm:w-auto"
                          onClick={() => setCancelTarget(item)}
                        >
                          <XCircle aria-hidden="true" className="size-4" />
                          Batalkan Janji
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
        title="Batalkan janji temu?"
        description={
          cancelTarget ? (
            <>
              Janji temu <strong>{cancelTarget.patientName}</strong> bersama{" "}
              <strong>{cancelTarget.doctorName}</strong> pada tanggal{" "}
              <strong>{formatDate(cancelTarget.appointmentDate)}</strong> pukul{" "}
              <strong>
                {cancelTarget.startTime}–{cancelTarget.endTime} WIB
              </strong>{" "}
              akan dibatalkan dan kuota sesi dikembalikan.
            </>
          ) : null
        }
        confirmLabel="Ya, Batalkan"
        destructive
        onConfirm={async () => {
          if (cancelTarget) await handleCancelAppointment(cancelTarget);
        }}
      />
    </div>
  );
}
