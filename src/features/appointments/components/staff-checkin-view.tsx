"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  QrCode,
  Search,
  UserCheck,
  UserPlus,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { StatCard } from "@/components/ui-kit/stat-card";
import { StatusBadge } from "@/components/ui-kit/status-badge";
import type { StaffPatientSummary } from "@/features/patients/staff-queries";
import {
  APPOINTMENT_STATUS_LABEL,
  APPOINTMENT_STATUS_VARIANT,
  type AppointmentStatusKey,
} from "@/features/appointments/schemas";
import type { CheckInLookupResult } from "@/features/appointments/service";
import type { CheckInDashboardStats, RecentCheckInRow } from "@/features/appointments/queries";
import {
  lookupCheckInAction,
  performCheckInAction,
  selectCheckInPatientAction,
} from "@/features/appointments/actions";
import { QrCameraScanner } from "@/features/appointments/components/qr-camera-scanner";

type Props = {
  stats: CheckInDashboardStats;
  recentCheckIns: RecentCheckInRow[];
};

function formatTimeWib(date: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function StaffCheckInView({ stats, recentCheckIns }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [query, setQuery] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<StaffPatientSummary[]>([]);
  const [detail, setDetail] = useState<CheckInLookupResult | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>("");
  const [lookupPending, startLookup] = useTransition();
  const [checkInPending, startCheckIn] = useTransition();

  function runLookup(rawQuery: string) {
    const trimmed = rawQuery.trim();
    if (!trimmed) {
      setLookupError("Masukkan hasil pindai QR, No. RM, atau nama pasien.");
      return;
    }

    setLookupError(null);
    setCandidates([]);
    startLookup(async () => {
      const res = await lookupCheckInAction(trimmed);
      if (!res.ok) {
        setDetail(null);
        setSelectedAppointmentId("");
        setLookupError(res.message ?? "Pasien tidak ditemukan.");
        return;
      }

      const payload = res.data;
      if (!payload) return;

      if (payload.mode === "candidates") {
        setDetail(null);
        setSelectedAppointmentId("");
        setCandidates(payload.candidates);
        return;
      }

      setDetail(payload.detail);
      setSelectedAppointmentId(payload.detail.eligibleConfirmed[0]?.id ?? "");
    });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    runLookup(query);
  }

  function handleCameraScan(decoded: string) {
    setQuery(decoded);
    runLookup(decoded);
  }

  function handleSelectCandidate(patientId: string) {
    setLookupError(null);
    startLookup(async () => {
      const res = await selectCheckInPatientAction(patientId);
      if (!res.ok || !res.data) {
        setLookupError(res.message ?? "Pasien tidak ditemukan.");
        return;
      }
      setCandidates([]);
      setDetail(res.data);
      setSelectedAppointmentId(res.data.eligibleConfirmed[0]?.id ?? "");
    });
  }

  function handleConfirmCheckIn() {
    if (!detail || !selectedAppointmentId) return;
    startCheckIn(async () => {
      const res = await performCheckInAction({
        appointmentId: selectedAppointmentId,
        method: detail.method,
      });

      if (!res.ok) {
        toast.error(res.message ?? "Gagal memproses check-in.");
        return;
      }

      toast.success(res.message ?? "Check-in berhasil.");
      setDetail(null);
      setCandidates([]);
      setSelectedAppointmentId("");
      setQuery("");
      setLookupError(null);
      router.refresh();
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    });
  }

  const noAppointmentsToday =
    detail !== null &&
    detail.eligibleConfirmed.length === 0 &&
    detail.alreadyCheckedIn.length === 0 &&
    detail.pendingAppointments.length === 0;

  return (
    <div className="space-y-6">
      {/* KPI Ringkasan Check-in Hari Ini */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Sudah Check-in Hari Ini"
          value={stats.checkedInTodayCount}
          icon={UserCheck}
          hint="Pasien sudah tiba di klinik dan masuk daftar tunggu"
        />
        <StatCard
          label="Belum Check-in (Disetujui)"
          value={stats.pendingCheckInTodayCount}
          icon={Clock}
          hint="Janji disetujui hari ini yang menunggu kedatangan"
        />
      </div>

      {/* Area Pindai (Kiri) & Hasil Check-in (Kanan) */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Card className="border-line bg-surface">
          <CardHeader className="border-line border-b">
            <CardTitle className="text-ink-strong flex items-center gap-2 text-base font-semibold">
              <QrCode aria-hidden="true" className="text-primary-700 size-5" />
              Pindai QR atau Cari Pasien
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-5">
            <form onSubmit={handleSearchSubmit} className="space-y-2">
              <Label htmlFor="checkin-lookup" className="text-ink text-sm font-medium">
                Token QR / No. Rekam Medis / Nama Pasien
              </Label>
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  id="checkin-lookup"
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setLookupError(null);
                  }}
                  placeholder="Scan QR atau ketik RM-2026-... / nama"
                  className="h-11 flex-1"
                />
                <Button
                  type="submit"
                  disabled={lookupPending}
                  className="bg-primary-700 text-surface hover:bg-primary-800 h-11 px-5"
                >
                  {lookupPending ? (
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  ) : (
                    <Search aria-hidden="true" className="size-4" />
                  )}
                  Cari
                </Button>
              </div>
              <p className="text-ink-muted text-xs">
                Kompatibel dengan scanner USB (otomatis tekan Enter setelah scan).
              </p>
            </form>

            {lookupError ? (
              <p
                role="alert"
                className="border-danger/30 bg-danger-soft text-danger-ink rounded-xl border px-4 py-3 text-sm font-medium"
              >
                {lookupError}
              </p>
            ) : null}

            {candidates.length > 0 ? (
              <div className="space-y-2">
                <p className="text-ink-strong text-sm font-semibold">
                  Ditemukan {candidates.length} pasien — pilih salah satu:
                </p>
                <ul className="divide-line border-line divide-y rounded-xl border">
                  {candidates.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectCandidate(c.id)}
                        className="hover:bg-paper flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-ink-strong font-medium">{c.name}</p>
                          <p className="text-ink-muted font-mono text-xs">
                            {c.medicalRecordNumber} — {c.ageLabel}
                          </p>
                        </div>
                        <ArrowRight aria-hidden="true" className="text-ink-muted size-4 shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <QrCameraScanner onScan={handleCameraScan} />
          </CardContent>
        </Card>

        {/* Hasil Pindai / Detail Check-in */}
        <Card className="border-line bg-surface">
          <CardHeader className="border-line border-b">
            <CardTitle className="text-ink-strong flex items-center gap-2 text-base font-semibold">
              <UserCheck aria-hidden="true" className="text-primary-700 size-5" />
              Hasil Pindai &amp; Konfirmasi Check-in
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {!detail ? (
              <EmptyState
                icon={QrCode}
                title="Siap memindai pasien"
                description="Pindai QR Code pasien atau cari berdasarkan nomor RM / nama untuk memeriksa janji temu hari ini."
              />
            ) : (
              <div className="space-y-5">
                {/* Identitas Minimum Pasien (tanpa data medis) */}
                <div className="border-line bg-paper flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
                  <div className="flex items-center gap-3">
                    <span className="bg-primary-50 text-primary-700 grid size-11 shrink-0 place-items-center rounded-full">
                      <UserRound aria-hidden="true" className="size-5" />
                    </span>
                    <div>
                      <p className="text-ink-strong text-base font-bold">{detail.patient.name}</p>
                      <p className="text-ink-soft text-sm">
                        <span className="font-mono">{detail.patient.medicalRecordNumber}</span>
                        {" — "}
                        {detail.patient.ageLabel}
                      </p>
                    </div>
                  </div>
                  <StatusBadge variant="neutral">
                    {detail.method === "QR" ? "Via QR" : "Manual"}
                  </StatusBadge>
                </div>

                {/* Janji CONFIRMED siap check-in */}
                {detail.eligibleConfirmed.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-ink-strong text-sm font-semibold">
                      {detail.eligibleConfirmed.length > 1
                        ? "Pasien memiliki beberapa janji hari ini — pilih janji untuk check-in:"
                        : "Janji temu siap check-in:"}
                    </p>

                    <div role="radiogroup" aria-label="Janji siap check-in" className="space-y-2.5">
                      {detail.eligibleConfirmed.map((appt) => {
                        const isSelected = selectedAppointmentId === appt.id;
                        return (
                          <button
                            key={appt.id}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => setSelectedAppointmentId(appt.id)}
                            className={
                              isSelected
                                ? "border-primary-700 bg-primary-50/60 ring-primary-700 flex w-full items-center justify-between gap-3 rounded-xl border-2 p-4 text-left ring-1"
                                : "border-line bg-surface hover:border-primary-300 flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left"
                            }
                          >
                            <div className="space-y-1">
                              <p className="text-ink-strong font-semibold">{appt.doctorName}</p>
                              <p className="text-ink-soft text-sm">
                                Sesi {appt.startTime}–{appt.endTime} WIB
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-ink-muted text-xs">Nomor Antrean</p>
                              <p className="tabular text-primary-800 text-xl font-bold">
                                {appt.formattedQueueNumber ?? "-"}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <Button
                      type="button"
                      size="lg"
                      disabled={checkInPending || !selectedAppointmentId}
                      aria-busy={checkInPending}
                      onClick={handleConfirmCheckIn}
                      className="bg-primary-700 text-surface hover:bg-primary-800 h-12 w-full text-base font-semibold"
                    >
                      {checkInPending ? (
                        <>
                          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                          Memproses Check-in...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 aria-hidden="true" className="size-5" />
                          Check-in
                        </>
                      )}
                    </Button>
                  </div>
                ) : null}

                {/* Janji yang sudah check-in */}
                {detail.alreadyCheckedIn.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-ink-strong text-sm font-semibold">Sudah Check-in Hari Ini</p>
                    <ul className="space-y-2">
                      {detail.alreadyCheckedIn.map((appt) => {
                        const statusKey = appt.status as AppointmentStatusKey;
                        return (
                          <li
                            key={appt.id}
                            className="border-success/30 bg-success-soft flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3"
                          >
                            <div>
                              <p className="text-ink-strong font-medium">{appt.doctorName}</p>
                              <p className="text-success-ink text-xs font-medium">
                                Check-in pukul{" "}
                                {appt.checkedInAt ? `${formatTimeWib(appt.checkedInAt)} WIB` : "-"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {appt.formattedQueueNumber ? (
                                <StatusBadge variant="neutral">
                                  Antrean {appt.formattedQueueNumber}
                                </StatusBadge>
                              ) : null}
                              <StatusBadge variant={APPOINTMENT_STATUS_VARIANT[statusKey]}>
                                {APPOINTMENT_STATUS_LABEL[statusKey]}
                              </StatusBadge>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                {/* Janji masih PENDING */}
                {detail.pendingAppointments.length > 0 ? (
                  <div className="border-warning/30 bg-warning-soft space-y-2 rounded-xl border p-4">
                    <p className="text-warning-ink text-sm font-semibold">Janji belum disetujui</p>
                    <p className="text-ink-soft text-xs">
                      Pasien memiliki {detail.pendingAppointments.length} pengajuan janji hari ini
                      yang masih menunggu persetujuan.
                    </p>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/staf/pendaftaran">Buka Permintaan Janji</Link>
                    </Button>
                  </div>
                ) : null}

                {/* Tidak ada janji hari ini -> tawarkan Walk-in */}
                {noAppointmentsToday ? (
                  <div className="border-line bg-paper space-y-3 rounded-xl border border-dashed p-5 text-center">
                    <CalendarClock aria-hidden="true" className="text-ink-muted mx-auto size-7" />
                    <div>
                      <p className="text-ink-strong font-semibold">Tidak ada janji temu hari ini</p>
                      <p className="text-ink-muted mt-1 text-sm">
                        Pasien datang langsung tanpa janji? Daftarkan ke antrean walk-in hari ini.
                      </p>
                    </div>
                    <Button
                      asChild
                      className="bg-primary-700 text-surface hover:bg-primary-800 min-h-11"
                    >
                      <Link href={`/staf/pendaftaran/walk-in?patientId=${detail.patient.id}`}>
                        <UserPlus aria-hidden="true" className="size-4" />
                        Daftarkan sebagai walk-in
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daftar Check-in Terbaru Hari Ini */}
      <Card className="border-line bg-surface">
        <CardHeader className="border-line border-b">
          <CardTitle className="text-ink-strong text-base font-semibold">
            Check-in terbaru hari ini
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentCheckIns.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={UserCheck}
                title="Belum ada pasien check-in hari ini"
                description="Pasien yang sudah check-in akan muncul di daftar ini secara berurutan."
              />
            </div>
          ) : (
            <ul className="divide-line divide-y">
              {recentCheckIns.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-ink-strong font-medium">{row.patientName}</p>
                    <p className="text-ink-muted text-xs">
                      <span className="font-mono">{row.medicalRecordNumber}</span>
                      {" — "}
                      {row.doctorName}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {row.formattedQueueNumber ? (
                      <StatusBadge variant="info">{row.formattedQueueNumber}</StatusBadge>
                    ) : null}
                    <span className="tabular text-ink-soft text-sm">
                      {formatTimeWib(row.checkedInAt)} WIB
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
