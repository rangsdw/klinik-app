"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users,
  Search,
  Calendar,
  Clock,
  FileText,
  Activity,
  AlertCircle,
  Pill,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Medicine, AppointmentStatus } from "@prisma/client";

type PatientItem = {
  id: string;
  name: string;
  medicalRecordNumber: string;
  nik: string | null;
  birthDate: Date;
  gender: string;
  bloodType: string | null;
  allergies: string | null;
  specialConditions: string | null;
  phone: string | null;
  appointments: {
    id: string;
    appointmentDate: Date;
    startTime: string;
    endTime: string;
    queueNumber: number | null;
    status: AppointmentStatus;
    chiefComplaint: string | null;
    doctor: { name: string };
    medicalRecord: {
      id: string;
      subjective: string | null;
      objective: string | null;
      assessment: string | null;
      plan: string | null;
      bloodPressure: string | null;
      bodyTemperature: number | null;
      bodyWeight: number | null;
      pulseRate: number | null;
      createdAt: Date;
      prescriptions: {
        id: string;
        quantity: number;
        dosageInstructions: string;
        notes: string | null;
        medicine: Medicine;
      }[];
    } | null;
  }[];
};

type Props = {
  initialPatients: PatientItem[];
  searchQuery: string;
};

export function PatientHistoryViewer({ initialPatients, searchQuery }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchQuery);
  const [selectedPatient, setSelectedPatient] = useState<PatientItem | null>(
    initialPatients.length > 0 ? initialPatients[0] : null,
  );
  const [viewingAppointment, setViewingAppointment] = useState<
    PatientItem["appointments"][0] | null
  >(null);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (query.trim()) {
      params.set("q", query.trim());
    } else {
      params.delete("q");
    }
    router.push(`/dokter/pasien?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-strong">Daftar Pasien</h1>
        <p className="text-sm text-ink-soft">
          Cari pasien untuk melihat profil dan rekam jejak riwayat janji temu beserta catatan medisnya.
        </p>
      </div>

      {/* Search Bar */}
      <Card className="border-line bg-surface">
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
              <Input
                placeholder="Cari nama pasien, Nomor Rekam Medis (RM), atau NIK..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 bg-surface text-sm"
              />
            </div>
            <Button type="submit" className="gap-1.5 bg-primary-700 hover:bg-primary-800 text-surface">
              <Search className="size-4" />
              Cari Pasien
            </Button>
            {searchQuery && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setQuery("");
                  router.push("/dokter/pasien");
                }}
              >
                Reset
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Main Content Area */}
      {initialPatients.length === 0 ? (
        <Card className="border-line border-dashed bg-paper/40 py-16 text-center">
          <CardContent>
            <Users className="mx-auto size-12 text-ink-muted mb-3" />
            <h3 className="text-base font-semibold text-ink-strong">
              {searchQuery ? "Pasien tidak ditemukan" : "Daftar Pasien Kosong"}
            </h3>
            <p className="text-sm text-ink-soft max-w-sm mx-auto mt-1">
              {searchQuery
                ? `Tidak ada pasien yang cocok dengan kata kunci "${searchQuery}". Silakan coba kata kunci lain.`
                : "Gunakan kolom pencarian di atas untuk menemukan data pasien klinik."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Kolom Kiri: List Pasien */}
          <div className="space-y-3 lg:col-span-5">
            <h2 className="text-sm font-semibold text-ink-strong">
              Hasil Pasien ({initialPatients.length})
            </h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {initialPatients.map((p) => {
                const isSelected = selectedPatient?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPatient(p)}
                    className={`w-full text-left rounded-xl p-3.5 border transition-all ${
                      isSelected
                        ? "border-primary-600 bg-primary-50/70 shadow-xs"
                        : "border-line bg-surface hover:border-line-strong hover:bg-paper/50"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-ink-strong text-sm">{p.name}</h4>
                        <p className="font-mono text-xs text-primary-700">{p.medicalRecordNumber}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {p.gender === "MALE" ? "Laki-laki" : "Perempuan"}
                      </Badge>
                    </div>

                    {(p.allergies || p.specialConditions) && (
                      <p className="text-[11px] text-danger-ink mt-2 truncate flex items-center gap-1">
                        <AlertCircle className="size-3 shrink-0" />
                        {p.allergies ? `Alergi: ${p.allergies}` : p.specialConditions}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-xs text-ink-muted mt-2 pt-2 border-t border-line/60">
                      <span>{p.appointments.length} Riwayat Janji</span>
                      <ChevronRight className="size-3.5" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Kolom Kanan: Detail Riwayat Appointment Pasien */}
          <div className="lg:col-span-7">
            {selectedPatient ? (
              <Card className="border-line bg-surface">
                <CardHeader className="border-b border-line pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg font-bold text-ink-strong">
                        {selectedPatient.name}
                      </CardTitle>
                      <CardDescription className="font-mono text-xs text-primary-700 mt-0.5">
                        No. RM: {selectedPatient.medicalRecordNumber}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {selectedPatient.gender === "MALE" ? "Laki-laki" : "Perempuan"}
                    </Badge>
                  </div>

                  {/* Red Flag Info */}
                  {(selectedPatient.allergies || selectedPatient.specialConditions) && (
                    <div className="rounded-lg bg-danger-soft border border-danger/20 p-2.5 mt-3 text-xs text-danger-ink flex items-start gap-1.5">
                      <AlertCircle className="size-4 shrink-0 mt-0.5 text-danger" />
                      <div>
                        {selectedPatient.allergies && (
                          <p>
                            <span className="font-semibold">Alergi:</span> {selectedPatient.allergies}
                          </p>
                        )}
                        {selectedPatient.specialConditions && (
                          <p>
                            <span className="font-semibold">Kondisi:</span>{" "}
                            {selectedPatient.specialConditions}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  <h3 className="text-sm font-semibold text-ink-strong">
                    Riwayat Appointment &amp; Catatan Medis
                  </h3>

                  {selectedPatient.appointments.length === 0 ? (
                    <div className="py-8 text-center text-xs text-ink-muted italic">
                      Pasien ini belum memiliki riwayat janji temu.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedPatient.appointments.map((app) => {
                        const dateFormatted = new Date(app.appointmentDate).toLocaleDateString(
                          "id-ID",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          },
                        );

                        return (
                          <div
                            key={app.id}
                            className="rounded-xl border border-line bg-paper/40 p-3.5 space-y-2 hover:border-line-strong transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs font-semibold text-ink-strong">
                                <Calendar className="size-3.5 text-primary-600" />
                                <span>{dateFormatted}</span>
                                <span className="text-ink-muted">·</span>
                                <Clock className="size-3 text-ink-muted" />
                                <span className="text-ink-muted">{app.startTime} WIB</span>
                              </div>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  app.status === "COMPLETED"
                                    ? "bg-success-soft text-success-ink border-success/20"
                                    : "bg-primary-50 text-primary-700"
                                }`}
                              >
                                {app.status === "COMPLETED" ? "Selesai" : app.status}
                              </Badge>
                            </div>

                            <p className="text-xs text-ink-soft">
                              <span className="font-medium text-ink-strong">Dokter:</span>{" "}
                              {app.doctor.name}
                            </p>

                            {app.chiefComplaint && (
                              <p className="text-xs text-ink-soft">
                                <span className="font-medium text-ink-strong">Keluhan:</span>{" "}
                                {app.chiefComplaint}
                              </p>
                            )}

                            {/* Tombol Lihat Catatan Medis */}
                            {app.medicalRecord ? (
                              <div className="pt-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setViewingAppointment(app)}
                                  className="h-7 text-xs gap-1.5 text-primary-700 hover:text-primary-800 hover:bg-primary-50 border-primary-200"
                                >
                                  <FileText className="size-3.5" />
                                  Buka Catatan Pemeriksaan &amp; Resep
                                </Button>
                              </div>
                            ) : (
                              <p className="text-[11px] text-ink-muted italic pt-1">
                                Belum ada catatan rekam medis untuk appointment ini.
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-line text-sm text-ink-muted">
                Pilih pasien dari daftar untuk melihat riwayat janji temu.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Detail Catatan Appointment (SOAP & Resep) */}
      {viewingAppointment && viewingAppointment.medicalRecord && (
        <Dialog open={!!viewingAppointment} onOpenChange={() => setViewingAppointment(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-semibold text-ink-strong">
                <FileText className="size-4 text-primary-700" />
                Catatan Rekam Medis &amp; SOAP
              </DialogTitle>
              <DialogDescription className="text-xs text-ink-soft">
                Kunjungan tanggal{" "}
                {new Date(viewingAppointment.appointmentDate).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}{" "}
                oleh {viewingAppointment.doctor.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-sm">
              {/* Tanda Vital */}
              <div className="rounded-xl border border-line bg-paper/60 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-strong">
                  <Activity className="size-3.5 text-primary-600" />
                  <span>Tanda Vital</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div>
                    <span className="text-ink-muted">Tensi Darah:</span>
                    <p className="font-semibold text-ink-strong">
                      {viewingAppointment.medicalRecord.bloodPressure || "-"} mmHg
                    </p>
                  </div>
                  <div>
                    <span className="text-ink-muted">Suhu Tubuh:</span>
                    <p className="font-semibold text-ink-strong">
                      {viewingAppointment.medicalRecord.bodyTemperature != null
                        ? `${viewingAppointment.medicalRecord.bodyTemperature}°C`
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-ink-muted">Berat Badan:</span>
                    <p className="font-semibold text-ink-strong">
                      {viewingAppointment.medicalRecord.bodyWeight != null
                        ? `${viewingAppointment.medicalRecord.bodyWeight} kg`
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-ink-muted">Denyut Nadi:</span>
                    <p className="font-semibold text-ink-strong">
                      {viewingAppointment.medicalRecord.pulseRate != null
                        ? `${viewingAppointment.medicalRecord.pulseRate} bpm`
                        : "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* SOAP Details */}
              <div className="space-y-3">
                <div className="rounded-lg border border-line p-3">
                  <span className="text-xs font-bold text-primary-800">
                    S — Subjective (Keluhan / Anamnesis)
                  </span>
                  <p className="text-xs text-ink-soft mt-1 whitespace-pre-wrap">
                    {viewingAppointment.medicalRecord.subjective || "Tidak ada catatan."}
                  </p>
                </div>

                <div className="rounded-lg border border-line p-3">
                  <span className="text-xs font-bold text-primary-800">
                    O — Objective (Pemeriksaan Fisik)
                  </span>
                  <p className="text-xs text-ink-soft mt-1 whitespace-pre-wrap">
                    {viewingAppointment.medicalRecord.objective || "Tidak ada catatan."}
                  </p>
                </div>

                <div className="rounded-lg border border-line p-3">
                  <span className="text-xs font-bold text-primary-800">
                    A — Assessment (Diagnosis / ICD-10)
                  </span>
                  <p className="text-xs text-ink-strong font-medium mt-1 whitespace-pre-wrap">
                    {viewingAppointment.medicalRecord.assessment || "Tidak ada catatan."}
                  </p>
                </div>

                <div className="rounded-lg border border-line p-3">
                  <span className="text-xs font-bold text-primary-800">
                    P — Plan (Tindakan &amp; Terapi)
                  </span>
                  <p className="text-xs text-ink-soft mt-1 whitespace-pre-wrap">
                    {viewingAppointment.medicalRecord.plan || "Tidak ada catatan."}
                  </p>
                </div>
              </div>

              {/* Resep Obat */}
              <div className="rounded-xl border border-line p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-strong">
                  <Pill className="size-3.5 text-primary-600" />
                  <span>Resep Obat yang Diberikan</span>
                </div>
                {viewingAppointment.medicalRecord.prescriptions.length === 0 ? (
                  <p className="text-xs text-ink-muted italic">Tidak ada resep obat.</p>
                ) : (
                  <div className="space-y-1.5">
                    {viewingAppointment.medicalRecord.prescriptions.map((pr) => (
                      <div
                        key={pr.id}
                        className="flex items-center justify-between rounded bg-paper px-2.5 py-1.5 text-xs border border-line"
                      >
                        <div>
                          <span className="font-semibold text-ink-strong">
                            {pr.medicine.name}
                          </span>{" "}
                          <span className="text-ink-muted">({pr.medicine.dosageForm})</span>
                          <p className="text-ink-soft">{pr.dosageInstructions}</p>
                        </div>
                        <span className="font-mono font-medium text-ink-strong">
                          x{pr.quantity} {pr.medicine.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
