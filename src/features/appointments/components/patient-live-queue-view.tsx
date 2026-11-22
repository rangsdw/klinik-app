"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BellRing,
  CheckCircle2,
  Clock,
  Hourglass,
  ListOrdered,
  RefreshCw,
  Stethoscope,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { StatusBadge } from "@/components/ui-kit/status-badge";
import {
  PATIENT_QUEUE_STATUS_LABEL,
  PATIENT_QUEUE_STATUS_VARIANT,
  type PatientQueueDisplayStatus,
} from "@/features/appointments/schemas";
import type {
  PatientLiveQueueItem,
  PatientLiveQueuePayload,
} from "@/features/appointments/queries";

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

function statusIconForPatient(status: PatientQueueDisplayStatus) {
  switch (status) {
    case "PENDING":
      return Clock;
    case "CONFIRMED_NOT_CHECKED_IN":
      return Clock;
    case "WAITING":
      return Hourglass;
    case "CALLED":
      return BellRing;
    case "IN_SERVICE":
      return Stethoscope;
    case "COMPLETED":
      return CheckCircle2;
  }
}

function aheadText(item: PatientLiveQueueItem): string {
  switch (item.displayStatus) {
    case "CALLED":
    case "IN_SERVICE":
      return "Sekarang giliran Anda";
    case "COMPLETED":
      return "Pemeriksaan selesai";
    case "PENDING":
      return "Menunggu persetujuan";
    case "CONFIRMED_NOT_CHECKED_IN":
    case "WAITING":
      return item.aheadCount === null ? "-" : `${item.aheadCount} pasien`;
  }
}

/** Putar nada singkat & getar perangkat hanya saat dipanggil dan pasien mengaktifkannya. */
function triggerPatientCallAlert() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([220, 120, 220]);
    }
    const AudioCtx =
      typeof window !== "undefined"
        ? window.AudioContext ||
          (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [660, 880];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.08, now + idx * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.16 + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.16);
      osc.stop(now + idx * 0.16 + 0.15);
    });
    window.setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, 600);
  } catch {
    // Abaikan jika browser membatasi AudioContext/vibrasi
  }
}

export function PatientLiveQueueView({ initialData }: { initialData: PatientLiveQueuePayload }) {
  const [data, setData] = useState<PatientLiveQueuePayload>(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const [alertEnabled, setAlertEnabled] = useState(false);

  const alertEnabledRef = useRef(alertEnabled);
  const prevStatusRef = useRef<Map<string, PatientQueueDisplayStatus>>(
    new Map(initialData.items.map((item) => [item.appointmentId, item.displayStatus])),
  );

  useEffect(() => {
    alertEnabledRef.current = alertEnabled;
  }, [alertEnabled]);

  useEffect(() => {
    setData(initialData);
    prevStatusRef.current = new Map(
      initialData.items.map((item) => [item.appointmentId, item.displayStatus]),
    );
  }, [initialData]);

  const applyNewPayload = useCallback((next: PatientLiveQueuePayload) => {
    const prevMap = prevStatusRef.current;
    let newlyCalled = false;
    for (const item of next.items) {
      const prevStatus = prevMap.get(item.appointmentId);
      if (item.displayStatus === "CALLED" && prevStatus !== undefined && prevStatus !== "CALLED") {
        newlyCalled = true;
      }
    }
    prevStatusRef.current = new Map(
      next.items.map((item) => [item.appointmentId, item.displayStatus]),
    );
    setData(next);
    setPollError(null);
    if (newlyCalled && alertEnabledRef.current) {
      triggerPatientCallAlert();
    }
  }, []);

  const fetchLatest = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/antrean", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const next = (await res.json()) as PatientLiveQueuePayload;
      applyNewPayload(next);
    } catch {
      setPollError("Gagal memperbarui data otomatis. Menampilkan pembaruan terakhir.");
    } finally {
      setRefreshing(false);
    }
  }, [applyNewPayload]);

  useEffect(() => {
    let timerId: number | null = null;

    const startPolling = () => {
      if (timerId !== null || document.hidden) return;
      timerId = window.setInterval(() => {
        if (!document.hidden) {
          void fetchLatest();
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
        void fetchLatest();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchLatest]);

  return (
    <div className="space-y-5">
      {/* Bar pembaruan otomatis & preferensi notifikasi suara/getar */}
      <div className="border-line bg-surface shadow-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 sm:px-5">
        <div className="space-y-0.5">
          <p className="tabular text-ink-strong text-sm font-medium">
            Diperbarui {formatTimeSecondsWib(data.updatedAt)} WIB
          </p>
          <p className="text-ink-muted text-xs">
            Pembaruan otomatis setiap 10 detik saat halaman aktif
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={alertEnabled ? "secondary" : "outline"}
            size="sm"
            aria-pressed={alertEnabled}
            onClick={() => setAlertEnabled((prev) => !prev)}
            className="min-h-10"
          >
            {alertEnabled ? (
              <>
                <Volume2 aria-hidden="true" className="size-4" />
                Bunyi &amp; getar aktif
              </>
            ) : (
              <>
                <VolumeX aria-hidden="true" className="size-4" />
                Aktifkan bunyi &amp; getar
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void fetchLatest()}
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

      {data.items.length === 0 ? (
        <EmptyState
          icon={ListOrdered}
          title="Belum ada janji temu hari ini"
          description="Anda belum memiliki antrean aktif untuk hari ini. Buat janji temu terlebih dahulu untuk mendapatkan nomor antrean."
          action={
            <Button asChild className="bg-primary-700 text-surface hover:bg-primary-800 min-h-11">
              <Link href="/pasien/janji">Buat Janji Temu</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {data.items.map((item) => {
            const StatusIcon = statusIconForPatient(item.displayStatus);
            const isYourTurn =
              item.displayStatus === "CALLED" || item.displayStatus === "IN_SERVICE";

            return (
              <article
                key={item.appointmentId}
                aria-label={`Antrean ${item.patientName} untuk ${item.doctorName}`}
                className={
                  isYourTurn
                    ? "border-success bg-surface shadow-card overflow-hidden rounded-2xl border-2"
                    : "border-line bg-surface shadow-card overflow-hidden rounded-2xl border"
                }
              >
                {isYourTurn ? (
                  <div
                    role="status"
                    aria-live="assertive"
                    className="bg-success-soft border-success/30 text-success-ink flex items-center gap-3 border-b px-5 py-3.5 text-sm font-semibold sm:text-base"
                  >
                    <BellRing aria-hidden="true" className="size-5 shrink-0" />
                    <span>Giliran Anda, silakan menuju ruang periksa</span>
                  </div>
                ) : null}

                {/* Identitas pasien & dokter */}
                <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                  <div className="min-w-0 space-y-1">
                    <p className="text-ink-strong text-base font-bold">{item.patientName}</p>
                    <p className="text-ink-soft text-sm">
                      {item.doctorName}, Sesi {item.startTime}–{item.endTime} WIB
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {item.source === "WALK_IN" ? (
                      <StatusBadge variant="neutral">Walk-in</StatusBadge>
                    ) : null}
                    <StatusBadge
                      variant={PATIENT_QUEUE_STATUS_VARIANT[item.displayStatus]}
                      icon={StatusIcon}
                    >
                      {PATIENT_QUEUE_STATUS_LABEL[item.displayStatus]}
                    </StatusBadge>
                  </div>
                </div>

                {/* Dua angka besar: Antrean Sekarang vs Nomor Antrean Anda */}
                <div className="border-line divide-line grid grid-cols-2 divide-x border-y">
                  <div className="px-4 py-5 text-center sm:px-6 sm:py-6">
                    <p className="text-ink-muted text-xs font-medium sm:text-sm">
                      Antrean Sekarang
                    </p>
                    {item.formattedCurrentQueueNumber ? (
                      <p className="tabular text-primary-800 mt-1.5 text-4xl font-bold tracking-tight sm:text-5xl">
                        {item.formattedCurrentQueueNumber}
                      </p>
                    ) : (
                      <p className="text-ink-soft mt-2.5 text-lg font-semibold sm:text-2xl">
                        Belum dimulai
                      </p>
                    )}
                  </div>

                  <div className="px-4 py-5 text-center sm:px-6 sm:py-6">
                    <p className="text-ink-muted text-xs font-medium sm:text-sm">
                      Nomor Antrean Anda
                    </p>
                    {item.formattedQueueNumber ? (
                      <p className="tabular text-ink-strong mt-1.5 text-4xl font-bold tracking-tight sm:text-5xl">
                        {item.formattedQueueNumber}
                      </p>
                    ) : (
                      <p className="text-ink-soft mt-2.5 text-lg font-semibold sm:text-2xl">
                        Belum terbit
                      </p>
                    )}
                  </div>
                </div>

                {/* Sisa antrean di depan Anda & petunjuk check-in */}
                <div className="bg-paper space-y-2 px-5 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-ink-soft">Sisa antrean di depan Anda</span>
                    <span className="tabular text-ink-strong font-bold">{aheadText(item)}</span>
                  </div>

                  {item.displayStatus === "CONFIRMED_NOT_CHECKED_IN" ? (
                    <p className="text-ink-muted text-xs">
                      Setibanya di klinik, tunjukkan QR Code di menu{" "}
                      <Link href="/pasien" className="text-primary-700 font-semibold underline">
                        Beranda
                      </Link>{" "}
                      kepada petugas pendaftaran untuk check-in.
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
