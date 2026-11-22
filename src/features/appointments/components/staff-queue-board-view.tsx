"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  BellRing,
  CheckCircle2,
  Clock,
  Hourglass,
  ListOrdered,
  Loader2,
  Megaphone,
  RefreshCw,
  ScanLine,
  Stethoscope,
  UserPlus,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui-kit/confirm-dialog";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { StatCard } from "@/components/ui-kit/stat-card";
import { StatusBadge } from "@/components/ui-kit/status-badge";
import {
  QUEUE_DISPLAY_STATUS_LABEL,
  QUEUE_DISPLAY_STATUS_VARIANT,
  type QueueDisplayStatus,
} from "@/features/appointments/schemas";
import type {
  DoctorQueueItem,
  DoctorQueueSnapshot,
  StaffQueueBoardPayload,
} from "@/features/appointments/queries";
import {
  callNextQueueAction,
  markNoShowAction,
  recallQueueAction,
} from "@/features/appointments/actions";

const POLL_INTERVAL_MS = 10_000;

function formatTimeSecondsWib(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function statusIconForQueue(status: QueueDisplayStatus) {
  switch (status) {
    case "NOT_ARRIVED":
      return Clock;
    case "WAITING":
      return Hourglass;
    case "CALLED":
      return BellRing;
    case "IN_SERVICE":
      return Stethoscope;
    case "COMPLETED":
      return CheckCircle2;
    case "NO_SHOW":
      return UserX;
  }
}

type NoShowTarget = {
  id: string;
  patientName: string;
  queueLabel: string;
  doctorName: string;
};

export function StaffQueueBoardView({ initialData }: { initialData: StaffQueueBoardPayload }) {
  const [data, setData] = useState<StaffQueueBoardPayload>(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const [actionPending, startAction] = useTransition();
  const [busyDoctorId, setBusyDoctorId] = useState<string | null>(null);
  const [busyAppointmentId, setBusyAppointmentId] = useState<string | null>(null);
  const [noShowTarget, setNoShowTarget] = useState<NoShowTarget | null>(null);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const fetchBoard = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/staf/antrean", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const next = (await res.json()) as StaffQueueBoardPayload;
      setData(next);
      setPollError(null);
    } catch {
      setPollError("Gagal memperbarui papan antrean otomatis. Menampilkan data terakhir.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let timerId: number | null = null;

    const startPolling = () => {
      if (timerId !== null || document.hidden) return;
      timerId = window.setInterval(() => {
        if (!document.hidden) {
          void fetchBoard();
        }
      }, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (timerId !== null) {
        window.clearInterval(timerId);
        timerId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        void fetchBoard();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchBoard]);

  function handleCallNext(doctorId: string) {
    setBusyDoctorId(doctorId);
    startAction(async () => {
      try {
        const res = await callNextQueueAction(doctorId);
        if (!res.ok) {
          toast.error(res.message ?? "Gagal memanggil antrean berikutnya.");
        } else {
          toast.success(res.message ?? "Pasien berhasil dipanggil.");
        }
        await fetchBoard();
      } finally {
        setBusyDoctorId(null);
      }
    });
  }

  function handleRecall(appointmentId: string) {
    setBusyAppointmentId(appointmentId);
    startAction(async () => {
      try {
        const res = await recallQueueAction(appointmentId);
        if (!res.ok) {
          toast.error(res.message ?? "Gagal memanggil ulang pasien.");
        } else {
          toast.success(res.message ?? "Pasien dipanggil ulang.");
        }
        await fetchBoard();
      } finally {
        setBusyAppointmentId(null);
      }
    });
  }

  async function handleConfirmNoShow() {
    if (!noShowTarget) return;
    const res = await markNoShowAction(noShowTarget.id);
    if (!res.ok) {
      toast.error(res.message ?? "Gagal menandai pasien tidak hadir.");
    } else {
      toast.success(res.message ?? "Pasien ditandai tidak hadir.");
    }
    await fetchBoard();
  }

  return (
    <div className="space-y-6">
      {/* Bar kontrol pembaruan & pintasan staf pendaftaran */}
      <div className="border-line bg-surface shadow-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 sm:px-5">
        <div className="space-y-0.5">
          <p className="tabular text-ink-strong text-sm font-medium">
            Diperbarui {formatTimeSecondsWib(data.updatedAt)} WIB
          </p>
          <p className="text-ink-muted text-xs">
            Pembaruan otomatis setiap 10 detik saat tab aktif
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm" className="min-h-10">
            <Link href="/staf/pendaftaran/check-in">
              <ScanLine aria-hidden="true" className="size-4" />
              Check-in QR
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="min-h-10">
            <Link href="/staf/pendaftaran/walk-in">
              <UserPlus aria-hidden="true" className="size-4" />
              Daftar Walk-in
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void fetchBoard()}
            disabled={refreshing}
            aria-busy={refreshing}
            className="min-h-10"
          >
            <RefreshCw
              aria-hidden="true"
              className={refreshing ? "size-4 animate-spin" : "size-4"}
            />
            Segarkan
          </Button>
        </div>
      </div>

      {pollError ? (
        <p
          role="status"
          className="border-warning/40 bg-warning-soft text-warning-ink rounded-xl border px-4 py-2.5 text-sm font-medium"
        >
          {pollError}
        </p>
      ) : null}

      {/* Ringkasan KPI Antrean Hari Ini (StatCard) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Menunggu" value={data.totals.waiting} icon={Hourglass} />
        <StatCard
          label="Dipanggil / Dilayani"
          value={data.totals.calledOrInService}
          icon={BellRing}
        />
        <StatCard label="Selesai" value={data.totals.completed} icon={CheckCircle2} />
        <StatCard label="Walk-in" value={data.totals.walkIn} icon={UserPlus} />
        <StatCard label="Tidak Hadir" value={data.totals.noShow} icon={UserX} />
      </div>

      {/* Papan antrean per dokter */}
      {data.doctors.length === 0 ? (
        <EmptyState
          icon={ListOrdered}
          title="Tidak ada dokter praktik hari ini"
          description="Belum ada jadwal praktik dokter aktif maupun antrean pasien pada hari ini."
          action={
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/staf/pendaftaran">Kelola Jadwal Dokter</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {data.doctors.map((doc) => (
            <DoctorQueueColumn
              key={doc.doctorId}
              doctor={doc}
              actionPending={actionPending}
              busyDoctorId={busyDoctorId}
              busyAppointmentId={busyAppointmentId}
              onCallNext={handleCallNext}
              onRecall={handleRecall}
              onRequestNoShow={(item) =>
                setNoShowTarget({
                  id: item.id,
                  patientName: item.patientName,
                  queueLabel: item.formattedQueueNumber ?? "-",
                  doctorName: doc.doctorName,
                })
              }
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={noShowTarget !== null}
        onOpenChange={(open) => {
          if (!open) setNoShowTarget(null);
        }}
        title="Tandai pasien tidak hadir?"
        description={
          noShowTarget ? (
            <>
              Antrean <strong>{noShowTarget.queueLabel}</strong> atas nama{" "}
              <strong>{noShowTarget.patientName}</strong> ({noShowTarget.doctorName}) akan ditandai{" "}
              <strong>Tidak hadir</strong> dan dikeluarkan dari antrean aktif.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Ya, Tandai Tidak Hadir"
        destructive
        onConfirm={handleConfirmNoShow}
      />
    </div>
  );
}

function DoctorQueueColumn({
  doctor,
  actionPending,
  busyDoctorId,
  busyAppointmentId,
  onCallNext,
  onRecall,
  onRequestNoShow,
}: {
  doctor: DoctorQueueSnapshot;
  actionPending: boolean;
  busyDoctorId: string | null;
  busyAppointmentId: string | null;
  onCallNext: (doctorId: string) => void;
  onRecall: (appointmentId: string) => void;
  onRequestNoShow: (item: DoctorQueueItem) => void;
}) {
  const activeItems = doctor.items.filter(
    (i) => i.displayStatus === "CALLED" || i.displayStatus === "IN_SERVICE",
  );
  const waitingItems = doctor.items.filter((i) => i.displayStatus === "WAITING");
  const notArrivedItems = doctor.items.filter((i) => i.displayStatus === "NOT_ARRIVED");
  const finishedItems = doctor.items.filter(
    (i) => i.displayStatus === "COMPLETED" || i.displayStatus === "NO_SHOW",
  );

  const progressPct =
    doctor.stats.total > 0 ? Math.round((doctor.stats.completed / doctor.stats.total) * 100) : 0;
  const isCallingThisDoctor = actionPending && busyDoctorId === doctor.doctorId;

  return (
    <section
      aria-label={`Antrean ${doctor.doctorName}`}
      className="border-line bg-surface shadow-card flex min-w-0 flex-col overflow-hidden rounded-2xl border"
    >
      {/* Header dokter + progres selesai */}
      <div className="border-line space-y-3 border-b px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-ink-strong text-lg font-bold">{doctor.doctorName}</h2>
          <span className="tabular text-ink-soft text-xs font-medium">
            Total {doctor.stats.total} pasien
          </span>
        </div>

        <p className="tabular text-ink-muted text-xs">
          Menunggu {doctor.stats.waiting}, Dipanggil/Dilayani {doctor.stats.calledOrInService},
          Walk-in {doctor.stats.walkIn}, Tidak hadir {doctor.stats.noShow}
        </p>

        {/* Indikator progres antrean dengan label angka eksplisit */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-ink-soft font-medium">Progres pemeriksaan</span>
            <span className="tabular text-ink-strong font-semibold">
              {doctor.stats.completed} / {doctor.stats.total} selesai ({progressPct}%)
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={`Progres pemeriksaan ${doctor.doctorName}`}
            aria-valuenow={doctor.stats.completed}
            aria-valuemin={0}
            aria-valuemax={Math.max(1, doctor.stats.total)}
            className="bg-muted h-2.5 w-full overflow-hidden rounded-full"
          >
            <div
              className="bg-primary-700 h-full rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Antrean Sekarang + Panggil Berikutnya */}
      <div className="border-line bg-primary-50/60 flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4">
        <div>
          <p className="text-ink-muted text-xs font-medium">Antrean Sekarang</p>
          {doctor.formattedCurrentQueueNumber ? (
            <p className="tabular text-primary-800 mt-0.5 text-3xl font-bold tracking-tight">
              {doctor.formattedCurrentQueueNumber}
            </p>
          ) : (
            <p className="text-ink-soft mt-1 text-lg font-semibold">Belum dimulai</p>
          )}
        </div>

        <Button
          type="button"
          onClick={() => onCallNext(doctor.doctorId)}
          disabled={actionPending || waitingItems.length === 0}
          aria-busy={isCallingThisDoctor}
          className="bg-primary-700 text-surface hover:bg-primary-800 min-h-11 font-semibold"
        >
          {isCallingThisDoctor ? (
            <>
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              Memanggil...
            </>
          ) : (
            <>
              <Megaphone aria-hidden="true" className="size-4" />
              Panggil Berikutnya
            </>
          )}
        </Button>
      </div>

      {/* Sub-bagian antrean */}
      <div className="divide-line divide-y">
        {/* Dipanggil & Sedang Dilayani */}
        <div className="space-y-2.5 px-5 py-4">
          <h3 className="text-ink-strong text-sm font-semibold">
            Dipanggil / Sedang Dilayani ({activeItems.length})
          </h3>
          {activeItems.length === 0 ? (
            <p className="text-ink-muted text-xs">Belum ada pasien yang dipanggil.</p>
          ) : (
            <ul className="divide-line border-line divide-y rounded-xl border">
              {activeItems.map((item) => (
                <QueueRowItem
                  key={item.id}
                  item={item}
                  actionPending={actionPending}
                  busyAppointmentId={busyAppointmentId}
                  onRecall={onRecall}
                  onRequestNoShow={onRequestNoShow}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Menunggu (sudah check-in, urut nomor) */}
        <div className="space-y-2.5 px-5 py-4">
          <h3 className="text-ink-strong text-sm font-semibold">
            Menunggu ({waitingItems.length})
          </h3>
          {waitingItems.length === 0 ? (
            <p className="text-ink-muted text-xs">Tidak ada pasien di daftar tunggu.</p>
          ) : (
            <ul className="divide-line border-line divide-y rounded-xl border">
              {waitingItems.map((item) => (
                <QueueRowItem
                  key={item.id}
                  item={item}
                  actionPending={actionPending}
                  busyAppointmentId={busyAppointmentId}
                  onRecall={onRecall}
                  onRequestNoShow={onRequestNoShow}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Belum Datang */}
        <div className="space-y-2.5 px-5 py-4">
          <h3 className="text-ink-strong text-sm font-semibold">
            Belum Datang ({notArrivedItems.length})
          </h3>
          {notArrivedItems.length === 0 ? (
            <p className="text-ink-muted text-xs">Semua janji disetujui sudah check-in.</p>
          ) : (
            <ul className="divide-line border-line divide-y rounded-xl border">
              {notArrivedItems.map((item) => (
                <QueueRowItem
                  key={item.id}
                  item={item}
                  actionPending={actionPending}
                  busyAppointmentId={busyAppointmentId}
                  onRecall={onRecall}
                  onRequestNoShow={onRequestNoShow}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Selesai & Tidak Hadir */}
        {finishedItems.length > 0 ? (
          <div className="space-y-2.5 px-5 py-4">
            <h3 className="text-ink-strong text-sm font-semibold">
              Selesai / Tidak Hadir ({finishedItems.length})
            </h3>
            <ul className="divide-line border-line divide-y rounded-xl border">
              {finishedItems.map((item) => (
                <QueueRowItem
                  key={item.id}
                  item={item}
                  actionPending={actionPending}
                  busyAppointmentId={busyAppointmentId}
                  onRecall={onRecall}
                  onRequestNoShow={onRequestNoShow}
                />
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function QueueRowItem({
  item,
  actionPending,
  busyAppointmentId,
  onRecall,
  onRequestNoShow,
}: {
  item: DoctorQueueItem;
  actionPending: boolean;
  busyAppointmentId: string | null;
  onRecall: (appointmentId: string) => void;
  onRequestNoShow: (item: DoctorQueueItem) => void;
}) {
  const StatusIcon = statusIconForQueue(item.displayStatus);
  const isRecalling = actionPending && busyAppointmentId === item.id;
  const canMarkNoShow =
    item.displayStatus === "CALLED" ||
    item.displayStatus === "WAITING" ||
    item.displayStatus === "NOT_ARRIVED";

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="tabular bg-primary-50 text-primary-800 border-primary-200 shrink-0 rounded-lg border px-2.5 py-1 text-sm font-bold">
          {item.formattedQueueNumber ?? "-"}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-ink-strong truncate text-sm font-semibold">{item.patientName}</p>
            {item.source === "WALK_IN" ? (
              <StatusBadge variant="neutral">Walk-in</StatusBadge>
            ) : null}
          </div>
          <p className="text-ink-muted text-xs">
            <span className="font-mono">{item.medicalRecordNumber}</span>, Sesi {item.startTime}–
            {item.endTime} WIB
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge variant={QUEUE_DISPLAY_STATUS_VARIANT[item.displayStatus]} icon={StatusIcon}>
          {QUEUE_DISPLAY_STATUS_LABEL[item.displayStatus]}
        </StatusBadge>

        {item.displayStatus === "CALLED" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onRecall(item.id)}
            disabled={actionPending}
            aria-busy={isRecalling}
          >
            {isRecalling ? (
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <BellRing aria-hidden="true" className="size-3.5" />
            )}
            Panggil Ulang
          </Button>
        ) : null}

        {item.displayStatus === "IN_SERVICE" ? (
          <span className="text-ink-muted text-xs">Ditangani dokter</span>
        ) : null}

        {canMarkNoShow ? (
          <Button
            type="button"
            variant="destructive-outline"
            size="sm"
            onClick={() => onRequestNoShow(item)}
            disabled={actionPending}
          >
            Tidak Hadir
          </Button>
        ) : null}
      </div>
    </li>
  );
}
