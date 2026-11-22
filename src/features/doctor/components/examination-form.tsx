"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Plus,
  Minus,
  Trash2,
  Pill,
  Activity,
  Stethoscope,
  ClipboardCheck,
  Clock,
  User,
  Calendar,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { saveSoapRecordAction } from "../actions";
import type { SerializedMedicine } from "../queries";

export type PrescriptionRow = {
  medicineId: string;
  quantity: number;
  dosageInstructions: string;
  notes?: string;
};

type Props = {
  defaultTab?: "soap" | "prescription";
  appointment: {
    id: string;
    queueNumber: number | null;
    startTime: string;
    endTime: string;
    appointmentDate: Date;
    chiefComplaint: string | null;
    patient: {
      id: string;
      name: string;
      medicalRecordNumber: string;
      gender: string;
      birthDate: Date;
      allergies: string | null;
      specialConditions: string | null;
      phone: string | null;
    };
    medicalRecord?: {
      subjective: string | null;
      objective: string | null;
      assessment: string | null;
      plan: string | null;
      bloodPressure: string | null;
      bodyTemperature: number | null;
      bodyWeight: number | null;
      pulseRate: number | null;
      prescriptions?: {
        medicineId: string;
        quantity: number;
        dosageInstructions: string;
        notes: string | null;
      }[];
    } | null;
  };
  availableMedicines: SerializedMedicine[];
};

const COMMON_DOSAGES = [
  "3x1 sehari sesudah makan",
  "2x1 sehari sesudah makan",
  "1x1 sehari malam hari",
  "1x1 sehari pagi hari",
  "Bila perlu / demam (maks 3x sehari)",
];

const COMMON_NOTES = [
  "Habiskan (antibiotik)",
  "Bila nyeri / demam saja",
  "Sebelum makan",
  "Sesudah makan",
  "Kocok dahulu sebelum diminum",
];

export function ExaminationForm({
  defaultTab = "soap",
  appointment,
  availableMedicines,
}: Props) {
  const router = useRouter();
  const rec = appointment.medicalRecord;
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  // SOAP State
  const [subjective, setSubjective] = useState(rec?.subjective || appointment.chiefComplaint || "");
  const [objective, setObjective] = useState(rec?.objective || "");
  const [assessment, setAssessment] = useState(rec?.assessment || "");
  const [plan, setPlan] = useState(rec?.plan || "");

  // Vitals State
  const [bloodPressure, setBloodPressure] = useState(rec?.bloodPressure || "");
  const [bodyTemperature, setBodyTemperature] = useState<string>(
    rec?.bodyTemperature != null ? String(rec.bodyTemperature) : "",
  );
  const [bodyWeight, setBodyWeight] = useState<string>(
    rec?.bodyWeight != null ? String(rec.bodyWeight) : "",
  );
  const [pulseRate, setPulseRate] = useState<string>(
    rec?.pulseRate != null ? String(rec.pulseRate) : "",
  );

  // E-Resep State
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>(
    rec?.prescriptions?.map((p) => ({
      medicineId: p.medicineId,
      quantity: p.quantity,
      dosageInstructions: p.dosageInstructions,
      notes: p.notes || undefined,
    })) || [],
  );

  const [markCompleted, setMarkCompleted] = useState(true);
  const [loading, setLoading] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  // Set active exam in localStorage for sidebar indication and restore draft
  useEffect(() => {
    try {
      localStorage.setItem(
        "active_exam",
        JSON.stringify({
          id: appointment.id,
          patientName: appointment.patient.name,
          queueNumber: appointment.queueNumber,
        }),
      );
      window.dispatchEvent(new Event("active_exam_changed"));
    } catch { }

    try {
      const savedDraft = localStorage.getItem(`draft_exam_${appointment.id}`);
      if (savedDraft) {
        const d = JSON.parse(savedDraft);
        if (d.subjective !== undefined) setSubjective(d.subjective);
        if (d.objective !== undefined) setObjective(d.objective);
        if (d.assessment !== undefined) setAssessment(d.assessment);
        if (d.plan !== undefined) setPlan(d.plan);
        if (d.bloodPressure !== undefined) setBloodPressure(d.bloodPressure);
        if (d.bodyTemperature !== undefined) setBodyTemperature(d.bodyTemperature);
        if (d.bodyWeight !== undefined) setBodyWeight(d.bodyWeight);
        if (d.pulseRate !== undefined) setPulseRate(d.pulseRate);
        if (d.prescriptions !== undefined) setPrescriptions(d.prescriptions);
        setDraftRestored(true);
      }
    } catch { }
  }, [appointment.id, appointment.patient.name, appointment.queueNumber]);

  // Autosave draft whenever fields change
  useEffect(() => {
    try {
      const draftData = {
        subjective,
        objective,
        assessment,
        plan,
        bloodPressure,
        bodyTemperature,
        bodyWeight,
        pulseRate,
        prescriptions,
      };
      localStorage.setItem(`draft_exam_${appointment.id}`, JSON.stringify(draftData));
    } catch { }
  }, [
    appointment.id,
    subjective,
    objective,
    assessment,
    plan,
    bloodPressure,
    bodyTemperature,
    bodyWeight,
    pulseRate,
    prescriptions,
  ]);

  const [medicineSearch, setMedicineSearch] = useState("");

  const filteredMedicines = availableMedicines.filter((m) => {
    if (!medicineSearch.trim()) return true;
    const q = medicineSearch.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.code.toLowerCase().includes(q) ||
      (m.category && m.category.toLowerCase().includes(q)) ||
      m.dosageForm.toLowerCase().includes(q)
    );
  });

  function handleAddMedicine(med: SerializedMedicine) {
    if (med.stock <= 0) {
      toast.error(`Stok ${med.name} saat ini kosong.`);
      return;
    }
    const existingIdx = prescriptions.findIndex((p) => p.medicineId === med.id);
    if (existingIdx >= 0) {
      updatePrescriptionRow(existingIdx, "quantity", prescriptions[existingIdx].quantity + 1);
      toast.success(`Jumlah ${med.name} ditambah (x${prescriptions[existingIdx].quantity + 1}).`);
    } else {
      setPrescriptions((prev) => [
        ...prev,
        {
          medicineId: med.id,
          quantity: 1,
          dosageInstructions: "3x1 sehari sesudah makan",
          notes: "",
        },
      ]);
      toast.success(`${med.name} ditambahkan.`);
    }
  }


  function removePrescriptionRow(index: number) {
    setPrescriptions((prev) => prev.filter((_, i) => i !== index));
  }

  function updatePrescriptionRow<K extends keyof PrescriptionRow>(
    index: number,
    field: K,
    value: PrescriptionRow[K],
  ) {
    setPrescriptions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await saveSoapRecordAction({
        appointmentId: appointment.id,
        subjective,
        objective,
        assessment,
        plan,
        bloodPressure,
        bodyTemperature: bodyTemperature ? parseFloat(bodyTemperature) : null,
        bodyWeight: bodyWeight ? parseFloat(bodyWeight) : null,
        pulseRate: pulseRate ? parseInt(pulseRate, 10) : null,
        prescriptions,
        markCompleted,
      });

      if (!res.ok) {
        toast.error(res.message || "Gagal menyimpan rekam medis.");
        return;
      }

      try {
        localStorage.removeItem(`draft_exam_${appointment.id}`);
        localStorage.removeItem("active_exam");
        window.dispatchEvent(new Event("active_exam_changed"));
      } catch { }

      toast.success("Rekam medis & e-resep berhasil disimpan!");
      router.push("/dokter");
      router.refresh();
    } catch {
      toast.error("Terjadi kendala saat menyimpan data.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between border-b border-line pb-4">
        <Button variant="ghost" size="sm" asChild className="gap-2 text-ink-soft hover:text-ink-strong">
          <Link href="/dokter">
            <ArrowLeft className="size-4" />
            <span>Kembali ke Daftar Antrean</span>
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          {draftRestored && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                try {
                  localStorage.removeItem(`draft_exam_${appointment.id}`);
                } catch { }
                toast.info("Draf direset ke data awal server.");
                window.location.reload();
              }}
              className="text-xs text-ink-muted hover:text-danger h-8"
            >
              Reset Draf
            </Button>
          )}
          <Badge variant="outline" className="border-primary-200 bg-primary-50 text-primary-800 font-medium">
            Halaman Pemeriksaan Dokter
          </Badge>
        </div>
      </div>

      {/* Patient Information Card */}
      <Card className="border-line bg-surface">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary-50 font-bold text-primary-800 border border-primary-200">
                <span className="text-[10px] font-medium leading-none text-primary-600">No</span>
                <span className="text-xl leading-tight">{appointment.queueNumber ?? "-"}</span>
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-ink-strong">{appointment.patient.name}</h2>
                  <span className="font-mono text-xs text-primary-700 bg-paper px-2.5 py-0.5 rounded border border-line">
                    No. RM: {appointment.patient.medicalRecordNumber}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {appointment.patient.gender === "MALE" ? "Laki-laki" : "Perempuan"}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5 text-ink-muted" />
                    Jadwal: {appointment.startTime} - {appointment.endTime} WIB
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3.5 text-ink-muted" />
                    {new Date(appointment.appointmentDate).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  {appointment.patient.phone && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <User className="size-3.5 text-ink-muted" />
                        {appointment.patient.phone}
                      </span>
                    </>
                  )}
                </div>

                {appointment.chiefComplaint && (
                  <p className="text-xs text-ink-soft pt-1">
                    <span className="font-semibold text-ink-strong">Keluhan Utama:</span>{" "}
                    {appointment.chiefComplaint}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Red Flag Warning */}
          {(appointment.patient.allergies || appointment.patient.specialConditions) && (
            <div className="mt-4 rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger-ink">
              <div className="flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-danger" />
                <div>
                  <p className="font-bold">Perhatian Khusus Medis (Red Flag):</p>
                  {appointment.patient.allergies && (
                    <p>
                      <span className="font-semibold">Riwayat Alergi:</span>{" "}
                      {appointment.patient.allergies}
                    </p>
                  )}
                  {appointment.patient.specialConditions && (
                    <p>
                      <span className="font-semibold">Kondisi Khusus:</span>{" "}
                      {appointment.patient.specialConditions}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Form: SOAP & E-Resep */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-paper border border-line h-11">
            <TabsTrigger
              value="soap"
              className="flex items-center gap-2 text-xs sm:text-sm font-medium transition-all duration-300"
            >
              <Stethoscope className="size-4 text-primary-700" />
              1. Pemeriksaan Fisik &amp; SOAP
            </TabsTrigger>
            <TabsTrigger
              value="prescription"
              className="flex items-center gap-2 text-xs sm:text-sm font-medium transition-all duration-300"
            >
              <Pill className="size-4 text-primary-700" />
              2. Pembuatan E-Resep
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: FORM SOAP & VITAL SIGNS */}
          <TabsContent
            value="soap"
            className="space-y-6 pt-4 data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:slide-in-from-left-4 duration-300 ease-out focus-visible:outline-none"
          >
            {/* Tanda Vital Pasien */}
            <Card className="border-line bg-surface">
              <CardHeader className="border-b border-line pb-3">
                <CardTitle className="text-sm font-semibold text-ink-strong flex items-center gap-2">
                  <Activity className="size-4 text-primary-600" />
                  <span>Tanda-Tanda Vital Pasien</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="bp" className="text-xs font-medium text-ink-soft">
                      Tensi Darah (mmHg)
                    </Label>
                    <Input
                      id="bp"
                      placeholder="e.g. 120/80"
                      value={bloodPressure}
                      onChange={(e) => setBloodPressure(e.target.value)}
                      className="bg-surface h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="temp" className="text-xs font-medium text-ink-soft">
                      Suhu Tubuh (°C)
                    </Label>
                    <Input
                      id="temp"
                      type="number"
                      step="0.1"
                      placeholder="e.g. 36.5"
                      value={bodyTemperature}
                      onChange={(e) => setBodyTemperature(e.target.value)}
                      className="bg-surface h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="weight" className="text-xs font-medium text-ink-soft">
                      Berat Badan (kg)
                    </Label>
                    <Input
                      id="weight"
                      type="number"
                      step="0.1"
                      placeholder="e.g. 65"
                      value={bodyWeight}
                      onChange={(e) => setBodyWeight(e.target.value)}
                      className="bg-surface h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pulse" className="text-xs font-medium text-ink-soft">
                      Denyut Nadi (bpm)
                    </Label>
                    <Input
                      id="pulse"
                      type="number"
                      placeholder="e.g. 80"
                      value={pulseRate}
                      onChange={(e) => setPulseRate(e.target.value)}
                      className="bg-surface h-10 text-sm"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Kolom Medis SOAP */}
            <Card className="border-line bg-surface">
              <CardHeader className="border-b border-line pb-3">
                <CardTitle className="text-sm font-semibold text-ink-strong">
                  Format Rekam Medis SOAP
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {/* S - Subjective */}
                <div className="space-y-1.5">
                  <Label htmlFor="subjective" className="font-semibold text-ink-strong text-xs">
                    S — Subjective
                  </Label>
                  <Textarea
                    id="subjective"
                    rows={3}
                    placeholder="Keluhan utama pasien, onset, kronologis gejala..."
                    value={subjective}
                    onChange={(e) => setSubjective(e.target.value)}
                  />
                </div>

                {/* O - Objective */}
                <div className="space-y-1.5">
                  <Label htmlFor="objective" className="font-semibold text-ink-strong text-xs">
                    O — Objective
                  </Label>
                  <Textarea
                    id="objective"
                    rows={3}
                    placeholder="Hasil inspeksi, palpasi, perkusi, auskultasi, pemeriksaan fisik..."
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                  />
                </div>

                {/* A - Assessment */}
                <div className="space-y-1.5">
                  <Label htmlFor="assessment" className="font-semibold text-ink-strong text-xs">
                    A — Assessment
                  </Label>
                  <Textarea
                    id="assessment"
                    rows={2}
                    placeholder="Diagnosis kerja / kode ICD-10..."
                    value={assessment}
                    onChange={(e) => setAssessment(e.target.value)}
                  />
                </div>

                {/* P - Plan */}
                <div className="space-y-1.5">
                  <Label htmlFor="plan" className="font-semibold text-ink-strong text-xs">
                    P — Plan
                  </Label>
                  <Textarea
                    id="plan"
                    rows={3}
                    placeholder="Tindakan medis yang dilakukan, anjuran non-farmakologis, edukasi pasien..."
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={() => {
                  setActiveTab("prescription");
                  window.scrollTo({ top: 260, behavior: "smooth" });
                }}
                className="group relative gap-2.5 bg-primary-700 hover:bg-primary-800 text-surface text-sm font-medium px-5 py-2.5 rounded-xl shadow-xs hover:shadow-md active:scale-95 transition-all duration-300"
              >
                <span>Lanjut ke Pembuatan E-Resep</span>
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1.5" />
              </Button>
            </div>
          </TabsContent>

          {/* TAB 2: PEMBUATAN E-RESEP (2-CARD DUAL MASTER-DETAIL VIEW) */}
          <TabsContent
            value="prescription"
            className="space-y-4 pt-4 data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:slide-in-from-right-4 duration-300 ease-out focus-visible:outline-none"
          >
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
              {/* CARD 1: LIST OBAT BESERTA SEARCH BAR */}
              <Card className="border-line bg-surface lg:col-span-5 shadow-xs">
                <CardHeader className="border-b border-line pb-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-ink-strong flex items-center gap-2">
                      <Pill className="size-4 text-primary-700" />
                      <span>Katalog Obat Apotek</span>
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px]">
                      {filteredMedicines.length} Obat
                    </Badge>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
                    <Input
                      placeholder="Cari nama atau sediaan obat..."
                      value={medicineSearch}
                      onChange={(e) => setMedicineSearch(e.target.value)}
                      className="pl-8 bg-paper/60 h-9 text-xs"
                    />
                  </div>
                </CardHeader>

                <CardContent className="p-3">
                  <div className="max-h-[540px] overflow-y-auto space-y-2 pr-1">
                    {filteredMedicines.length === 0 ? (
                      <div className="py-12 text-center text-xs text-ink-muted">
                        Tidak ada obat yang cocok dengan pencarian.
                      </div>
                    ) : (
                      filteredMedicines.map((med) => {
                        const isAdded = prescriptions.some((p) => p.medicineId === med.id);
                        const isOutOfStock = med.stock <= 0;
                        const isLowStock = med.stock > 0 && med.stock <= 10;

                        return (
                          <div
                            key={med.id}
                            className={`flex items-center justify-between gap-2 rounded-xl p-3 border transition-all ${isAdded
                              ? "border-primary-300 bg-primary-50/50"
                              : "border-line bg-surface hover:border-line-strong hover:bg-paper/40"
                              }`}
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="font-semibold text-ink-strong text-xs truncate">
                                  {med.name}
                                </h4>
                                {isAdded && (
                                  <Badge className="bg-primary-100 text-primary-800 text-[9px] px-1.5 py-0 border-0">
                                    Dipilih
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center gap-2 text-[11px] text-ink-muted">
                                <span>{med.dosageForm}</span>
                                <span>·</span>
                                <span
                                  className={
                                    isOutOfStock
                                      ? "text-danger-ink font-semibold"
                                      : isLowStock
                                        ? "text-warning-ink font-medium"
                                        : "text-success-ink font-medium"
                                  }
                                >
                                  {isOutOfStock
                                    ? "Stok Habis"
                                    : `Stok: ${med.stock} ${med.unit}`}
                                </span>
                              </div>
                            </div>

                            <Button
                              type="button"
                              size="sm"
                              variant={isAdded ? "secondary" : "outline"}
                              disabled={isOutOfStock}
                              onClick={() => handleAddMedicine(med)}
                              className="h-8 text-xs shrink-0 gap-1"
                            >
                              <Plus className="size-3" />
                              <span>{isAdded ? "Tambah" : "Pilih"}</span>
                            </Button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* CARD 2: MENAMPUNG OBAT YANG DITAMBAHKAN (HANYA 2 KOLOM: PEMAKAIAN & CATATAN) */}
              <Card className="border-line bg-surface lg:col-span-7 shadow-xs">
                <CardHeader className="border-b border-line pb-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold text-ink-strong flex items-center gap-2">
                        <ClipboardCheck className="size-4 text-primary-700" />
                        <span>Obat yang Ditambahkan</span>
                      </CardTitle>
                    </div>
                    <Badge variant="outline" className="text-xs border-primary-200 bg-primary-50 text-primary-800">
                      {prescriptions.length} Macam Obat
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  {prescriptions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-line bg-paper/30 py-16 text-center">
                      <Pill className="mx-auto size-10 text-ink-muted mb-2" />
                      <p className="text-sm font-semibold text-ink-strong">Belum ada obat yang ditambahkan</p>
                      <p className="text-xs text-ink-soft max-w-sm mx-auto mt-1">
                        Cari obat di katalog sebelah kiri dan klik tombol <strong>Pilih</strong> untuk memasukkan ke lembar e-resep.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3.5 max-h-[540px] overflow-y-auto pr-1">
                      {prescriptions.map((row, idx) => {
                        const selectedMed = availableMedicines.find((m) => m.id === row.medicineId);

                        return (
                          <div
                            key={idx}
                            className="rounded-xl border border-line bg-surface p-4 space-y-3 shadow-xs"
                          >
                            {/* Baris Atas: Nama Obat & Pengatur Kuantitas + Tombol Hapus */}
                            <div className="flex items-start justify-between gap-3 border-b border-line pb-2.5">
                              <div>
                                <h4 className="font-bold text-ink-strong text-sm">
                                  {selectedMed?.name || "Obat"}
                                </h4>
                                <p className="text-[11px] text-ink-muted">
                                  Sediaan: {selectedMed?.dosageForm} · Satuan: {selectedMed?.unit}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                {/* Kuantitas */}
                                <div className="flex items-center border border-line rounded-lg bg-paper">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (row.quantity > 1) {
                                        updatePrescriptionRow(idx, "quantity", row.quantity - 1);
                                      } else {
                                        removePrescriptionRow(idx);
                                      }
                                    }}
                                    className="p-1.5 text-ink-muted hover:text-ink-strong transition-colors"
                                    title="Kurangi"
                                  >
                                    <Minus className="size-3" />
                                  </button>
                                  <input
                                    type="number"
                                    min="1"
                                    value={row.quantity}
                                    onChange={(e) =>
                                      updatePrescriptionRow(
                                        idx,
                                        "quantity",
                                        parseInt(e.target.value, 10) || 1,
                                      )
                                    }
                                    className="w-10 bg-transparent text-center font-mono text-xs font-semibold text-ink-strong focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => updatePrescriptionRow(idx, "quantity", row.quantity + 1)}
                                    className="p-1.5 text-ink-muted hover:text-ink-strong transition-colors"
                                    title="Tambah"
                                  >
                                    <Plus className="size-3" />
                                  </button>
                                </div>

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removePrescriptionRow(idx)}
                                  className="h-8 w-8 text-danger hover:bg-danger-soft hover:text-danger"
                                  title="Hapus Obat"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </div>

                            {/* HANYA 2 KOLOM DI BAWAH NAMA OBAT: PEMAKAIAN & CATATAN */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                              {/* Kolom 1: Pemakaian (Aturan Pakai) */}
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-ink-strong">
                                  Pemakaian
                                </Label>
                                <Input
                                  value={row.dosageInstructions}
                                  placeholder="e.g. 3x1 sesudah makan"
                                  onChange={(e) =>
                                    updatePrescriptionRow(idx, "dosageInstructions", e.target.value)
                                  }
                                  className="bg-surface h-9 text-xs"
                                />
                                <div className="flex flex-wrap items-center gap-1 pt-1">
                                  {COMMON_DOSAGES.slice(0, 3).map((preset) => (
                                    <button
                                      key={preset}
                                      type="button"
                                      onClick={() => updatePrescriptionRow(idx, "dosageInstructions", preset)}
                                      className="rounded bg-paper px-2 py-0.5 text-[10px] text-ink-soft hover:bg-primary-50 hover:text-primary-800 border border-line transition-colors"
                                    >
                                      {preset.split(" ")[0]} {preset.split(" ")[2] || ""}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Kolom 2: Catatan */}
                              <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-ink-strong">
                                  Catatan
                                </Label>
                                <Input
                                  value={row.notes || ""}
                                  placeholder="e.g. Habiskan, Bila demam..."
                                  onChange={(e) =>
                                    updatePrescriptionRow(idx, "notes", e.target.value)
                                  }
                                  className="bg-surface h-9 text-xs"
                                />
                                <div className="flex flex-wrap items-center gap-1 pt-1">
                                  {COMMON_NOTES.slice(0, 3).map((notePreset) => (
                                    <button
                                      key={notePreset}
                                      type="button"
                                      onClick={() => updatePrescriptionRow(idx, "notes", notePreset)}
                                      className="rounded bg-paper px-2 py-0.5 text-[10px] text-ink-muted hover:bg-primary-50 hover:text-primary-800 border border-line transition-colors"
                                    >
                                      {notePreset}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-3 border-t border-line mt-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setActiveTab("soap");
                        window.scrollTo({ top: 260, behavior: "smooth" });
                      }}
                      className="group gap-2 text-xs text-ink-soft hover:text-ink-strong transition-all duration-200 active:scale-95"
                    >
                      <ArrowLeft className="size-3.5 transition-transform duration-300 group-hover:-translate-x-1" />
                      <span>Kembali ke Pemeriksaan SOAP</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer Actions */}
        <Card className="border-line bg-surface">
          <CardContent className="p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="markCompleted"
                checked={markCompleted}
                onCheckedChange={(c) => setMarkCompleted(!!c)}
              />
              <Label htmlFor="markCompleted" className="text-xs font-medium text-ink-strong cursor-pointer">
                Selesaikan sesi pemeriksaan
              </Label>
            </div>

            <div className="flex items-center gap-3 justify-end">
              <Button variant="outline" type="button" asChild disabled={loading}>
                <Link href="/dokter">Batal</Link>
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="gap-2 bg-primary-700 hover:bg-primary-800 text-surface"
              >
                <ClipboardCheck className="size-4" />
                <span>{loading ? "Menyimpan Data..." : "Simpan Rekam Medis & E-Resep"}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
