"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  CalendarCheck2,
  CalendarClock,
  Check,
  Clock,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui-kit/confirm-dialog";
import { DataTable, type Column } from "@/components/ui-kit/data-table";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { FormField } from "@/components/ui-kit/form-field";
import { NativeSelect } from "@/components/ui-kit/native-select";
import { StatCard } from "@/components/ui-kit/stat-card";
import { StatusBadge } from "@/components/ui-kit/status-badge";
import { SubmitButton } from "@/components/ui-kit/submit-button";
import { formatDate } from "@/lib/date";
import { applyFieldErrors } from "@/lib/form";
import {
  APPOINTMENT_STATUS_LABEL,
  APPOINTMENT_STATUS_VARIANT,
  formatQueueNumber,
  rejectAppointmentSchema,
  type AppointmentStatusKey,
  type RejectAppointmentInput,
} from "@/features/appointments/schemas";
import type {
  DoctorOption,
  StaffAppointmentRequestRow,
  StaffAppointmentStats,
} from "@/features/appointments/queries";
import {
  approveAppointmentAction,
  rejectAppointmentAction,
} from "@/features/appointments/actions";

type Props = {
  requests: StaffAppointmentRequestRow[];
  stats: StaffAppointmentStats;
  doctors: DoctorOption[];
};

const QUOTA_BAR_CLASS = {
  AVAILABLE: "bg-primary-700",
  ALMOST_FULL: "bg-warning",
  FULL: "bg-danger",
} as const;

export function AppointmentRequestsPanel({ requests, stats, doctors }: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [doctorFilter, setDoctorFilter] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"DATE_ASC" | "DATE_DESC" | "PATIENT_ASC">("DATE_ASC");

  const [approveTarget, setApproveTarget] = useState<StaffAppointmentRequestRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<StaffAppointmentRequestRow | null>(null);
  const [rejectPending, startRejectTransition] = useTransition();

  const rejectForm = useForm<RejectAppointmentInput>({
    resolver: zodResolver(rejectAppointmentSchema) as never,
    defaultValues: {
      appointmentId: "",
      reason: "",
    },
  });

  useEffect(() => {
    if (rejectTarget) {
      rejectForm.reset({
        appointmentId: rejectTarget.id,
        reason: "",
      });
    }
  }, [rejectTarget, rejectForm]);

  const filteredRows = useMemo(() => {
    const list = requests.filter((row) => {
      if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
      if (doctorFilter !== "ALL" && row.doctorId !== doctorFilter) return false;
      if (dateFilter && row.appointmentDate !== dateFilter) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === "PATIENT_ASC") {
        return a.patientName.localeCompare(b.patientName, "id");
      }
      const keyA = `${a.appointmentDate} ${a.startTime}`;
      const keyB = `${b.appointmentDate} ${b.startTime}`;
      return sortBy === "DATE_DESC" ? keyB.localeCompare(keyA) : keyA.localeCompare(keyB);
    });
  }, [requests, statusFilter, doctorFilter, dateFilter, sortBy]);

  const hasCustomFilters =
    statusFilter !== "PENDING" || doctorFilter !== "ALL" || dateFilter !== "" || sortBy !== "DATE_ASC";

  async function handleApprove(target: StaffAppointmentRequestRow) {
    const res = await approveAppointmentAction(target.id);
    if (!res.ok) {
      toast.error(res.message ?? "Gagal menyetujui janji temu.");
      return;
    }
    toast.success(res.message ?? "Janji temu disetujui.");
    router.refresh();
  }

  const onRejectSubmit = rejectForm.handleSubmit((values) => {
    startRejectTransition(async () => {
      const res = await rejectAppointmentAction(values);
      if (!res.ok) {
        if (res.fieldErrors) applyFieldErrors(rejectForm, res.fieldErrors);
        if (res.message) toast.error(res.message);
        return;
      }
      toast.success(res.message ?? "Janji temu ditolak.");
      setRejectTarget(null);
      router.refresh();
    });
  });

  const columns: Column<StaffAppointmentRequestRow>[] = [
    {
      key: "patient",
      header: "Pasien",
      primary: true,
      cell: (row) => (
        <div className="space-y-0.5">
          <p className="text-ink-strong font-medium">{row.patientName}</p>
          <p className="text-ink-muted font-mono text-xs">{row.medicalRecordNumber}</p>
        </div>
      ),
    },
    {
      key: "schedule",
      header: "Dokter & Sesi",
      cell: (row) => (
        <div className="space-y-0.5">
          <p className="text-ink-strong font-medium">{row.doctorName}</p>
          <p className="text-ink-soft text-xs">
            {formatDate(row.appointmentDate)}, {row.startTime}–{row.endTime} WIB
          </p>
        </div>
      ),
    },
    {
      key: "quota",
      header: "Kuota Sesi",
      cell: (row) => {
        if (row.sessionQuota === null || row.sessionQuotaStatus === null) {
          return <span className="text-ink-muted text-xs">{row.sessionUsed} terdaftar</span>;
        }
        return (
          <div className="min-w-36 space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-ink-strong font-medium">
                {row.sessionUsed}/{row.sessionQuota} terpakai
              </span>
              <span className="text-ink-muted">{row.sessionQuotaLabel}</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={row.sessionUsed}
              aria-valuemin={0}
              aria-valuemax={row.sessionQuota}
              aria-label={`Kuota sesi ${row.doctorName} tanggal ${row.appointmentDate}`}
              className="bg-paper border-line h-1.5 w-full overflow-hidden rounded-full border"
            >
              <div
                className={`h-full rounded-full ${QUOTA_BAR_CLASS[row.sessionQuotaStatus]}`}
                style={{ width: `${row.sessionPercentage}%` }}
              />
            </div>
            <p className="text-ink-muted text-xs">
              {row.sessionRemaining} dari {row.sessionQuota} tersisa
            </p>
          </div>
        );
      },
    },
    {
      key: "complaint",
      header: "Keluhan",
      cell: (row) => (
        <div className="max-w-xs space-y-1">
          <p className="text-ink text-sm">{row.chiefComplaint ?? "-"}</p>
          {row.status === "REJECTED" && row.rejectionReason ? (
            <p className="text-danger-ink text-xs">Alasan ditolak: {row.rejectionReason}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => {
        const key = row.status as AppointmentStatusKey;
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge variant={APPOINTMENT_STATUS_VARIANT[key]}>
              {APPOINTMENT_STATUS_LABEL[key]}
            </StatusBadge>
            {row.queueNumber !== null ? (
              <StatusBadge variant="neutral">
                Antrean {formatQueueNumber(row.queueNumber)}
              </StatusBadge>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Aksi",
      actions: true,
      cell: (row) =>
        row.status === "PENDING" ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-primary-700 text-surface hover:bg-primary-800"
              onClick={() => setApproveTarget(row)}
            >
              <Check aria-hidden="true" className="size-3.5" />
              Setujui
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setRejectTarget(row)}
            >
              <X aria-hidden="true" className="size-3.5" />
              Tolak
            </Button>
          </div>
        ) : (
          <span className="text-ink-muted text-xs">Sudah diproses</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Ringkasan KPI */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Menunggu Persetujuan"
          value={stats.pendingCount}
          icon={Clock}
          hint="Perlu ditinjau staf"
        />
        <StatCard
          label="Disetujui"
          value={stats.confirmedCount}
          icon={CalendarCheck2}
          hint="Sudah mendapat nomor antrean"
        />
        <StatCard
          label="Ditolak"
          value={stats.rejectedCount}
          icon={XCircle}
          hint="Kuota otomatis dikembalikan"
        />
        <StatCard
          label="Total Hari Ini"
          value={stats.todayTotalCount}
          icon={Users}
          hint="Semua janji untuk hari ini"
        />
      </div>

      {/* Filter & Urutan */}
      <div className="border-line bg-surface rounded-xl border p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <label htmlFor="req-filter-status" className="text-ink text-sm font-medium">
              Status
            </label>
            <NativeSelect
              id="req-filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="PENDING">Menunggu Persetujuan</option>
              <option value="ALL">Semua Status</option>
              <option value="CONFIRMED">Disetujui</option>
              <option value="REJECTED">Ditolak</option>
              <option value="IN_PROGRESS">Sedang Diperiksa</option>
              <option value="COMPLETED">Selesai</option>
              <option value="CANCELLED">Dibatalkan</option>
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="req-filter-dokter" className="text-ink text-sm font-medium">
              Dokter
            </label>
            <NativeSelect
              id="req-filter-dokter"
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
            >
              <option value="ALL">Semua dokter</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="req-filter-tanggal" className="text-ink text-sm font-medium">
              Tanggal
            </label>
            <Input
              id="req-filter-tanggal"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="req-sort" className="text-ink text-sm font-medium">
              Urutkan
            </label>
            <NativeSelect
              id="req-sort"
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "DATE_ASC" | "DATE_DESC" | "PATIENT_ASC")
              }
            >
              <option value="DATE_ASC">Jadwal terdekat</option>
              <option value="DATE_DESC">Jadwal terbaru</option>
              <option value="PATIENT_ASC">Nama pasien (A–Z)</option>
            </NativeSelect>
          </div>
        </div>

        {hasCustomFilters ? (
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter("PENDING");
                setDoctorFilter("ALL");
                setDateFilter("");
                setSortBy("DATE_ASC");
              }}
            >
              Reset Filter
            </Button>
          </div>
        ) : null}
      </div>

      {/* Tabel Permintaan Janji */}
      <DataTable
        caption="Daftar permintaan janji temu pasien"
        columns={columns}
        rows={filteredRows}
        rowKey={(row) => row.id}
        empty={
          <EmptyState
            icon={CalendarClock}
            title={
              statusFilter === "PENDING"
                ? "Tidak ada permintaan janji yang menunggu"
                : "Tidak ada permintaan janji yang cocok"
            }
            description={
              statusFilter === "PENDING"
                ? "Semua pengajuan janji pasien sudah ditinjau."
                : "Ubah filter status, dokter, atau tanggal untuk melihat daftar lainnya."
            }
            action={
              hasCustomFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStatusFilter("PENDING");
                    setDoctorFilter("ALL");
                    setDateFilter("");
                    setSortBy("DATE_ASC");
                  }}
                >
                  Tampilkan Menunggu Persetujuan
                </Button>
              ) : undefined
            }
          />
        }
      />

      {/* Konfirmasi Setujui */}
      <ConfirmDialog
        open={Boolean(approveTarget)}
        onOpenChange={(open) => {
          if (!open) setApproveTarget(null);
        }}
        title="Setujui permintaan janji?"
        description={
          approveTarget ? (
            <>
              Janji temu <strong>{approveTarget.patientName}</strong> bersama{" "}
              <strong>{approveTarget.doctorName}</strong> pada tanggal{" "}
              <strong>{formatDate(approveTarget.appointmentDate)}</strong> pukul{" "}
              <strong>
                {approveTarget.startTime}–{approveTarget.endTime} WIB
              </strong>{" "}
              akan disetujui dan otomatis mendapat nomor antrean dokter hari tersebut.
            </>
          ) : null
        }
        confirmLabel="Ya, Setujui"
        destructive={false}
        onConfirm={async () => {
          if (approveTarget) await handleApprove(approveTarget);
        }}
      />

      {/* Dialog Penolakan dengan Alasan Wajib */}
      <Dialog
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => {
          if (!open && !rejectPending) setRejectTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tolak Permintaan Janji</DialogTitle>
            <DialogDescription>
              {rejectTarget
                ? `Berikan alasan penolakan untuk ${rejectTarget.patientName} (${rejectTarget.doctorName}, ${formatDate(rejectTarget.appointmentDate)}).`
                : null}
            </DialogDescription>
          </DialogHeader>

          <FormProvider {...rejectForm}>
            <form onSubmit={onRejectSubmit} className="space-y-4">
              <input type="hidden" {...rejectForm.register("appointmentId")} />

              <FormField<RejectAppointmentInput>
                name="reason"
                label="Alasan penolakan"
                hint="Alasan ini akan tampil di portal pasien."
              >
                {(field) => (
                  <Textarea
                    {...field}
                    rows={3}
                    maxLength={500}
                    placeholder="Contoh: Dokter berhalangan hadir pada tanggal tersebut, silakan pilih hari lain."
                  />
                )}
              </FormField>

              <DialogFooter className="gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRejectTarget(null)}
                  disabled={rejectPending}
                >
                  Batal
                </Button>
                <SubmitButton variant="destructive" pending={rejectPending}>
                  Tolak Janji
                </SubmitButton>
              </DialogFooter>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>
    </div>
  );
}
