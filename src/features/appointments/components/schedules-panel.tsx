"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Clock, Pencil, Power, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui-kit/confirm-dialog";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { NativeSelect } from "@/components/ui-kit/native-select";
import { StatusBadge } from "@/components/ui-kit/status-badge";
import { DAY_DISPLAY_ORDER, DAY_LABEL, DAY_OPTIONS } from "@/features/appointments/schemas";
import type { DoctorOption, DoctorScheduleRow } from "@/features/appointments/queries";
import { toggleScheduleStatusAction } from "@/features/appointments/actions";
import { ScheduleFormDialog } from "@/features/appointments/components/schedule-form-dialog";

type Props = {
  schedules: DoctorScheduleRow[];
  doctors: DoctorOption[];
};

export function SchedulesPanel({ schedules, doctors }: Props) {
  const [doctorFilter, setDoctorFilter] = useState<string>("ALL");
  const [dayFilter, setDayFilter] = useState<string>("ALL");
  const [editing, setEditing] = useState<DoctorScheduleRow | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<DoctorScheduleRow | null>(null);

  const filtered = useMemo(() => {
    return schedules.filter((item) => {
      if (doctorFilter !== "ALL" && item.doctorId !== doctorFilter) return false;
      if (dayFilter !== "ALL" && String(item.dayOfWeek) !== dayFilter) return false;
      return true;
    });
  }, [schedules, doctorFilter, dayFilter]);

  const groupedByDay = useMemo(() => {
    const map = new Map<number, DoctorScheduleRow[]>();
    for (const day of DAY_DISPLAY_ORDER) {
      map.set(day, []);
    }
    for (const item of filtered) {
      const list = map.get(item.dayOfWeek);
      if (list) list.push(item);
      else map.set(item.dayOfWeek, [item]);
    }
    return DAY_DISPLAY_ORDER.map((day) => ({
      day,
      label: DAY_LABEL[day],
      items: map.get(day) ?? [],
    })).filter((g) => g.items.length > 0);
  }, [filtered]);

  async function handleToggleStatus(target: DoctorScheduleRow) {
    const res = await toggleScheduleStatusAction(target.id, !target.isActive);
    if (!res.ok) {
      toast.error(res.message ?? "Gagal memperbarui status sesi.");
      return;
    }
    toast.success(res.message ?? "Status sesi diperbarui.");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid flex-1 gap-3 sm:max-w-lg sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="filter-dokter" className="text-ink text-sm font-medium">
              Filter Dokter
            </label>
            <NativeSelect
              id="filter-dokter"
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
            <label htmlFor="filter-hari" className="text-ink text-sm font-medium">
              Filter Hari
            </label>
            <NativeSelect
              id="filter-hari"
              value={dayFilter}
              onChange={(e) => setDayFilter(e.target.value)}
            >
              <option value="ALL">Semua hari</option>
              {DAY_OPTIONS.map((day) => (
                <option key={day.value} value={String(day.value)}>
                  {day.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        <div className="shrink-0">
          <ScheduleFormDialog mode="create" doctors={doctors} />
        </div>
      </div>

      {doctors.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Belum ada dokter aktif"
          description="Tambahkan akun dokter aktif terlebih dahulu melalui menu Manajemen Pengguna sebelum mengatur jadwal praktik."
        />
      ) : groupedByDay.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={schedules.length === 0 ? "Belum ada jadwal praktik" : "Jadwal tidak ditemukan"}
          description={
            schedules.length === 0
              ? "Klik tombol Tambah Sesi untuk membuat jadwal praktik dan kuota pasien pertama."
              : "Tidak ada sesi jadwal yang cocok dengan filter dokter atau hari yang dipilih."
          }
          action={
            schedules.length > 0 ? (
              <Button
                variant="outline"
                onClick={() => {
                  setDoctorFilter("ALL");
                  setDayFilter("ALL");
                }}
              >
                Reset Filter
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {groupedByDay.map((group) => (
            <Card key={group.day} className="border-line bg-surface">
              <CardHeader className="border-line border-b py-3.5">
                <CardTitle className="text-ink-strong flex items-center justify-between text-base font-semibold">
                  <span className="flex items-center gap-2">
                    <CalendarDays aria-hidden="true" className="text-primary-700 size-4" />
                    {group.label}
                  </span>
                  <span className="text-ink-muted text-xs font-normal">
                    {group.items.length} sesi
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-line divide-y p-0">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-ink-strong font-medium">{item.doctorName}</p>
                        <StatusBadge variant={item.isActive ? "success" : "neutral"}>
                          {item.isActive ? "Aktif" : "Nonaktif"}
                        </StatusBadge>
                      </div>
                      <div className="text-ink-soft flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock aria-hidden="true" className="size-3.5" />
                          {item.startTime} – {item.endTime} WIB
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Users aria-hidden="true" className="size-3.5" />
                          Kuota {item.quota} pasien
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditing(item)}
                      >
                        <Pencil aria-hidden="true" className="size-3.5" />
                        Ubah
                      </Button>
                      <Button
                        type="button"
                        variant={item.isActive ? "outline" : "default"}
                        size="sm"
                        onClick={() => setConfirmTarget(item)}
                      >
                        <Power aria-hidden="true" className="size-3.5" />
                        {item.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing ? (
        <ScheduleFormDialog
          mode="edit"
          doctors={doctors}
          schedule={editing}
          open={Boolean(editing)}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
        title={
          confirmTarget?.isActive ? "Nonaktifkan sesi jadwal?" : "Aktifkan kembali sesi jadwal?"
        }
        description={
          confirmTarget ? (
            <>
              Sesi <strong>{confirmTarget.doctorName}</strong> pada hari{" "}
              <strong>{DAY_LABEL[confirmTarget.dayOfWeek]}</strong> pukul{" "}
              <strong>
                {confirmTarget.startTime}–{confirmTarget.endTime}
              </strong>{" "}
              {confirmTarget.isActive
                ? "tidak akan bisa dipilih pasien untuk janji baru. Data jadwal tetap tersimpan."
                : "akan dibuka kembali apabila tidak bentrok dengan sesi aktif lain."}
            </>
          ) : null
        }
        confirmLabel={confirmTarget?.isActive ? "Nonaktifkan" : "Aktifkan"}
        destructive={Boolean(confirmTarget?.isActive)}
        onConfirm={async () => {
          if (confirmTarget) await handleToggleStatus(confirmTarget);
        }}
      />
    </div>
  );
}
