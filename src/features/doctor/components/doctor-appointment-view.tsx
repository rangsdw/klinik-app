"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Clock,
  UserCheck,
  UsersRound,
  Stethoscope,
  Calendar,
  AlertTriangle,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { setAppointmentStatusAction } from "../actions";
import { EditScheduleDialog } from "./edit-schedule-dialog";
import { SoapModal } from "./soap-modal";
import type { Medicine, AppointmentStatus } from "@prisma/client";

type AppointmentItem = {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentDate: Date;
  startTime: string;
  endTime: string;
  queueNumber: number;
  status: AppointmentStatus;
  chiefComplaint: string | null;
  patient: {
    id: string;
    name: string;
    medicalRecordNumber: string;
    birthDate: Date;
    gender: string;
    bloodType: string | null;
    allergies: string | null;
    specialConditions: string | null;
    phone: string | null;
  };
  medicalRecord: {
    subjective: string | null;
    objective: string | null;
    assessment: string | null;
    plan: string | null;
    bloodPressure: string | null;
    bodyTemperature: number | null;
    bodyWeight: number | null;
    pulseRate: number | null;
    prescriptions: {
      medicineId: string;
      quantity: number;
      dosageInstructions: string;
      notes: string | null;
      medicine: Medicine;
    }[];
  } | null;
};

type Props = {
  doctorName: string;
  currentDate: string; // YYYY-MM-DD
  stats: {
    total: number;
    waiting: number;
    inProgress: number;
    completed: number;
  };
  appointments: AppointmentItem[];
  availableMedicines: Medicine[];
};

export function DoctorAppointmentView({
  doctorName,
  currentDate,
  stats,
  appointments,
  availableMedicines,
}: Props) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(currentDate);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentItem | null>(null);
  const [soapAppointment, setSoapAppointment] = useState<AppointmentItem | null>(null);

  function handleDateChange(newDate: string) {
    setSelectedDate(newDate);
    router.push(`/dokter?date=${newDate}`);
  }

  async function handleStartExam(id: string) {
    try {
      const res = await setAppointmentStatusAction(id, "IN_PROGRESS");
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Gagal memulai pemeriksaan.");
    }
  }

  const statusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case "COMPLETED":
        return <Badge className="bg-success-soft text-success-ink border-success/20">Selesai</Badge>;
      case "IN_PROGRESS":
        return (
          <Badge className="bg-info-soft text-info-ink border-info/20 animate-pulse">
            Sedang Diperiksa
          </Badge>
        );
      case "CONFIRMED":
        return <Badge className="bg-primary-50 text-primary-700 border-primary-200">Terkonfirmasi</Badge>;
      case "PENDING":
        return <Badge className="bg-warning-soft text-warning-ink border-warning/20">Menunggu</Badge>;
      case "CANCELLED":
        return <Badge className="bg-danger-soft text-danger-ink border-danger/20">Dibatalkan</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Date Picker */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-strong">
            Selamat Bertugas, {doctorName}
          </h1>
          <p className="text-sm text-ink-soft">
            Kelola jadwal konsultasi, pemeriksaan fisik SOAP, dan resep pasien Anda.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-ink-muted" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-auto bg-surface text-sm font-medium"
          />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-line bg-surface">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-ink-muted">Total Janji Temu</p>
              <p className="text-2xl font-bold text-ink-strong">{stats.total}</p>
            </div>
            <div className="rounded-xl bg-primary-50 p-2.5 text-primary-700">
              <CalendarClock className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-line bg-surface">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-ink-muted">Menunggu Antrean</p>
              <p className="text-2xl font-bold text-warning-ink">{stats.waiting}</p>
            </div>
            <div className="rounded-xl bg-warning-soft p-2.5 text-warning-ink">
              <UsersRound className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-line bg-surface">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-ink-muted">Sedang Diperiksa</p>
              <p className="text-2xl font-bold text-info-ink">{stats.inProgress}</p>
            </div>
            <div className="rounded-xl bg-info-soft p-2.5 text-info-ink">
              <Clock className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-line bg-surface">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-ink-muted">Selesai Diperiksa</p>
              <p className="text-2xl font-bold text-success-ink">{stats.completed}</p>
            </div>
            <div className="rounded-xl bg-success-soft p-2.5 text-success-ink">
              <UserCheck className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Appointment List Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink-strong">
            Daftar Antrean &amp; Janji Temu ({appointments.length})
          </h2>
          <span className="text-xs text-ink-muted">
            Format Waktu: 24 Jam · Diurutkan berdasarkan nomor antrean
          </span>
        </div>

        {appointments.length === 0 ? (
          <Card className="border-line border-dashed bg-paper/40 py-12 text-center">
            <CardContent>
              <CalendarClock className="mx-auto size-10 text-ink-muted mb-3" />
              <h3 className="text-base font-semibold text-ink-strong">Tidak ada janji temu</h3>
              <p className="text-sm text-ink-soft max-w-sm mx-auto mt-1">
                Belum ada jadwal konsultasi atau antrean pasien terdaftar untuk tanggal ini.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {appointments.map((item) => {
              const rec = item.medicalRecord;
              const hasVitals =
                rec?.bloodPressure ||
                rec?.bodyTemperature != null ||
                rec?.bodyWeight != null ||
                rec?.pulseRate != null;

              return (
                <Card
                  key={item.id}
                  className="border-line bg-surface transition-all hover:border-line-strong hover:shadow-xs"
                >
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      {/* Left info: Queue + Patient Details */}
                      <div className="flex items-start gap-3.5">
                        <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-primary-50 font-bold text-primary-800 border border-primary-200">
                          <span className="text-[10px] font-medium leading-none text-primary-600">No</span>
                          <span className="text-lg leading-tight">{item.queueNumber}</span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-ink-strong text-base">
                              {item.patient.name}
                            </h3>
                            <span className="font-mono text-xs text-ink-muted bg-paper px-2 py-0.5 rounded border border-line">
                              {item.patient.medicalRecordNumber}
                            </span>
                            {statusBadge(item.status)}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
                            <span className="flex items-center gap-1">
                              <Clock className="size-3.5 text-ink-muted" />
                              {item.startTime} - {item.endTime} WIB
                            </span>
                            <span>·</span>
                            <span>{item.patient.gender === "MALE" ? "Laki-laki" : "Perempuan"}</span>
                            {item.patient.phone && (
                              <>
                                <span>·</span>
                                <span>{item.patient.phone}</span>
                              </>
                            )}
                          </div>

                          {/* Chief Complaint */}
                          {item.chiefComplaint && (
                            <p className="text-xs text-ink-soft pt-1">
                              <span className="font-medium text-ink-strong">Keluhan Awal:</span>{" "}
                              {item.chiefComplaint}
                            </p>
                          )}

                          {/* Red Flag Allergies */}
                          {(item.patient.allergies || item.patient.specialConditions) && (
                            <div className="flex items-center gap-1.5 pt-1 text-xs text-danger-ink">
                              <AlertTriangle className="size-3.5 shrink-0 text-danger" />
                              <span>
                                {item.patient.allergies && `Alergi: ${item.patient.allergies}`}
                                {item.patient.allergies && item.patient.specialConditions && " | "}
                                {item.patient.specialConditions &&
                                  `Kondisi: ${item.patient.specialConditions}`}
                              </span>
                            </div>
                          )}

                          {/* Vital signs chip if entered */}
                          {hasVitals && (
                            <div className="flex flex-wrap items-center gap-2 pt-2">
                              <span className="text-[11px] font-medium text-ink-muted">Tanda Vital:</span>
                              {rec?.bloodPressure && (
                                <span className="rounded bg-paper px-2 py-0.5 text-[11px] font-medium text-ink-soft border border-line">
                                  TD: {rec.bloodPressure} mmHg
                                </span>
                              )}
                              {rec?.bodyTemperature != null && (
                                <span className="rounded bg-paper px-2 py-0.5 text-[11px] font-medium text-ink-soft border border-line">
                                  Suhu: {rec.bodyTemperature}°C
                                </span>
                              )}
                              {rec?.bodyWeight != null && (
                                <span className="rounded bg-paper px-2 py-0.5 text-[11px] font-medium text-ink-soft border border-line">
                                  BB: {rec.bodyWeight} kg
                                </span>
                              )}
                              {rec?.pulseRate != null && (
                                <span className="rounded bg-paper px-2 py-0.5 text-[11px] font-medium text-ink-soft border border-line">
                                  Nadi: {rec.pulseRate} bpm
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                        {item.status !== "COMPLETED" && item.status !== "IN_PROGRESS" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartExam(item.id)}
                            className="h-8 gap-1.5 text-xs text-primary-700 hover:text-primary-800 hover:bg-primary-50"
                          >
                            <Play className="size-3.5" />
                            Panggil Pasien
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingAppointment(item)}
                          className="h-8 gap-1.5 text-xs"
                        >
                          <CalendarClock className="size-3.5 text-ink-muted" />
                          Ubah Jadwal
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => setSoapAppointment(item)}
                          className="h-8 gap-1.5 text-xs bg-primary-700 hover:bg-primary-800 text-surface"
                        >
                          <Stethoscope className="size-3.5" />
                          {item.status === "COMPLETED" ? "Lihat / Edit SOAP" : "Periksa & SOAP"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog Edit Jadwal */}
      {editingAppointment && (
        <EditScheduleDialog
          open={!!editingAppointment}
          onOpenChange={(open) => !open && setEditingAppointment(null)}
          appointment={{
            id: editingAppointment.id,
            appointmentDate: selectedDate,
            startTime: editingAppointment.startTime,
            endTime: editingAppointment.endTime,
            status: editingAppointment.status,
            patientName: editingAppointment.patient.name,
            queueNumber: editingAppointment.queueNumber,
          }}
        />
      )}

      {/* Modal Pemeriksaan SOAP */}
      {soapAppointment && (
        <SoapModal
          open={!!soapAppointment}
          onOpenChange={(open) => !open && setSoapAppointment(null)}
          appointment={soapAppointment}
          availableMedicines={availableMedicines}
        />
      )}
    </div>
  );
}
