"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  Plus,
  Trash2,
  Pill,
  Activity,
  Stethoscope,
  Sparkles,
  ClipboardCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "soap" | "prescription";
  appointment: {
    id: string;
    queueNumber: number | null;
    chiefComplaint: string | null;
    patient: {
      id: string;
      name: string;
      medicalRecordNumber: string;
      gender: string;
      allergies: string | null;
      specialConditions: string | null;
      birthDate: string | Date;
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

export function SoapModal({
  open,
  onOpenChange,
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

  function addPrescriptionRow() {
    // Prefer medicine with stock > 0
    const inStockMed = availableMedicines.find((m) => m.stock > 0) || availableMedicines[0];
    if (!inStockMed) return;

    setPrescriptions((prev) => [
      ...prev,
      {
        medicineId: inStockMed.id,
        quantity: 1,
        dosageInstructions: "3x1 sehari sesudah makan",
        notes: "",
      },
    ]);
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

      toast.success(res.message);
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Terjadi kendala saat menyimpan rekam medis.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-ink-strong">
                <Stethoscope className="size-5 text-primary-700" />
                Pemeriksaan Medis &amp; E-Resep Pasien
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-ink-soft">
                Antrean #{appointment.queueNumber ?? "-"} · {appointment.patient.name} (RM:{" "}
                <span className="font-mono font-medium text-ink-strong">
                  {appointment.patient.medicalRecordNumber}
                </span>
                )
              </DialogDescription>
            </div>
            <Badge variant="outline" className="border-primary-200 bg-primary-50 text-primary-800">
              {appointment.patient.gender === "MALE" ? "Laki-laki" : "Perempuan"}
            </Badge>
          </div>
        </DialogHeader>

        {/* Red Flag Alergi / Kondisi Khusus */}
        {(appointment.patient.allergies || appointment.patient.specialConditions) && (
          <div className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger-ink">
            <div className="flex items-start gap-2">
              <AlertCircle className="size-4 shrink-0 mt-0.5 text-danger" />
              <div>
                <p className="font-semibold">Perhatian Khusus Medis (Red Flag):</p>
                {appointment.patient.allergies && (
                  <p>
                    <span className="font-medium">Alergi:</span> {appointment.patient.allergies}
                  </p>
                )}
                {appointment.patient.specialConditions && (
                  <p>
                    <span className="font-medium">Kondisi Khusus:</span>{" "}
                    {appointment.patient.specialConditions}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-paper border border-line">
              <TabsTrigger value="soap" className="flex items-center gap-2 text-xs sm:text-sm">
                <Activity className="size-4 text-primary-700" />
                1. Pemeriksaan Fisik &amp; SOAP
              </TabsTrigger>
              <TabsTrigger
                value="prescription"
                className="flex items-center gap-2 text-xs sm:text-sm"
              >
                <Pill className="size-4 text-primary-700" />
                2. Pembuatan E-Resep ({prescriptions.length} Obat)
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: FORM SOAP & VITAL SIGNS */}
            <TabsContent value="soap" className="space-y-5 pt-3">
              {/* Bagian Tanda Vital */}
              <div className="rounded-xl border border-line bg-paper/60 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink-strong">
                  <Activity className="size-4 text-primary-600" />
                  <span>Tanda Vital Pasien (Dapat diisi awal oleh Staf/Perawat)</span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="space-y-1">
                    <Label htmlFor="bp" className="text-xs text-ink-soft">
                      Tensi Darah (mmHg)
                    </Label>
                    <Input
                      id="bp"
                      placeholder="e.g. 120/80"
                      value={bloodPressure}
                      onChange={(e) => setBloodPressure(e.target.value)}
                      className="bg-surface h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="temp" className="text-xs text-ink-soft">
                      Suhu Tubuh (°C)
                    </Label>
                    <Input
                      id="temp"
                      type="number"
                      step="0.1"
                      placeholder="e.g. 36.5"
                      value={bodyTemperature}
                      onChange={(e) => setBodyTemperature(e.target.value)}
                      className="bg-surface h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="weight" className="text-xs text-ink-soft">
                      Berat Badan (kg)
                    </Label>
                    <Input
                      id="weight"
                      type="number"
                      step="0.1"
                      placeholder="e.g. 65"
                      value={bodyWeight}
                      onChange={(e) => setBodyWeight(e.target.value)}
                      className="bg-surface h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pulse" className="text-xs text-ink-soft">
                      Denyut Nadi (bpm)
                    </Label>
                    <Input
                      id="pulse"
                      type="number"
                      placeholder="e.g. 80"
                      value={pulseRate}
                      onChange={(e) => setPulseRate(e.target.value)}
                      className="bg-surface h-9 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Form SOAP Kolom Medis */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-ink-strong">Format Rekam Medis (SOAP)</h4>

                {/* Subjective */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="subjective" className="font-semibold text-ink-strong text-xs">
                      S — Subjective (Anamnesis / Keluhan Pasien)
                    </Label>
                    <span className="text-xs text-ink-muted">Keluhan, riwayat penyakit saat ini</span>
                  </div>
                  <Textarea
                    id="subjective"
                    rows={2}
                    placeholder="Keluhan utama, riwayat penyakit yang diderita..."
                    value={subjective}
                    onChange={(e) => setSubjective(e.target.value)}
                  />
                </div>

                {/* Objective */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="objective" className="font-semibold text-ink-strong text-xs">
                      O — Objective (Pemeriksaan Fisik Dokter)
                    </Label>
                    <span className="text-xs text-ink-muted">Status generalis / status lokalis</span>
                  </div>
                  <Textarea
                    id="objective"
                    rows={2}
                    placeholder="Hasil inspeksi, palpasi, perkusi, auskultasi..."
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                  />
                </div>

                {/* Assessment */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="assessment" className="font-semibold text-ink-strong text-xs">
                      A — Assessment (Diagnosis Penyakit / Kode ICD-10)
                    </Label>
                    <span className="text-xs text-ink-muted">Diagnosis primer / sekunder</span>
                  </div>
                  <Textarea
                    id="assessment"
                    rows={2}
                    placeholder="Contoh: Faringitis Akut (J02.9) / Hipertensi Primer (I10)..."
                    value={assessment}
                    onChange={(e) => setAssessment(e.target.value)}
                  />
                </div>

                {/* Plan */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="plan" className="font-semibold text-ink-strong text-xs">
                      P — Plan (Tindakan Medis &amp; Edukasi Pasien)
                    </Label>
                    <span className="text-xs text-ink-muted">Rencana terapi, tindakan, anjuran</span>
                  </div>
                  <Textarea
                    id="plan"
                    rows={2}
                    placeholder="Tindakan medis yang diberikan, anjuran istirahat, diet, kontrol ulang..."
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={() => setActiveTab("prescription")}
                  className="gap-2 bg-primary-700 hover:bg-primary-800 text-surface text-xs"
                >
                  <span>Lanjut ke Pembuatan E-Resep</span>
                  <Pill className="size-3.5" />
                </Button>
              </div>
            </TabsContent>

            {/* TAB 2: PEMBUATAN E-RESEP */}
            <TabsContent value="prescription" className="space-y-4 pt-3">
              <div className="flex flex-col gap-2 rounded-xl border border-line bg-paper/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-ink-strong flex items-center gap-1.5">
                    <Pill className="size-4 text-primary-700" />
                    Daftar Resep Obat Elektronik (E-Resep)
                  </h4>
                  <p className="text-xs text-ink-soft mt-0.5">
                    Pilih obat dari master stok, tentukan jumlah, aturan pakai, dan catatan khusus pasien/apotek.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPrescriptionRow}
                  className="gap-1.5 border-primary-300 bg-surface text-primary-800 hover:bg-primary-50 text-xs self-start sm:self-auto font-medium"
                >
                  <Plus className="size-3.5" />
                  Tambah Obat
                </Button>
              </div>

              {prescriptions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line bg-paper/30 py-10 text-center">
                  <Pill className="mx-auto size-10 text-ink-muted mb-2" />
                  <p className="text-sm font-medium text-ink-strong">Belum ada obat dalam e-resep</p>
                  <p className="text-xs text-ink-soft max-w-sm mx-auto mt-1 mb-4">
                    Jika pasien membutuhkan terapi farmakologis, klik tombol di bawah untuk memilih obat dari stok apotek.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPrescriptionRow}
                    className="gap-1.5 text-xs text-primary-700"
                  >
                    <Plus className="size-3.5" />
                    Pilih Obat Sekarang
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {prescriptions.map((row, idx) => {
                    const selectedMed = availableMedicines.find((m) => m.id === row.medicineId);
                    const isOutOfStock = selectedMed ? selectedMed.stock <= 0 : false;
                    const isLowStock = selectedMed ? selectedMed.stock > 0 && selectedMed.stock <= 10 : false;

                    return (
                      <div
                        key={idx}
                        className="rounded-xl border border-line bg-surface p-4 space-y-3 shadow-xs relative"
                      >
                        {/* Header Item */}
                        <div className="flex items-center justify-between border-b border-line pb-2">
                          <span className="text-xs font-semibold text-primary-800 flex items-center gap-1.5">
                            <span className="flex size-5 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-800">
                              {idx + 1}
                            </span>
                            Obat #{idx + 1}
                          </span>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removePrescriptionRow(idx)}
                            className="h-7 px-2 text-danger hover:bg-danger-soft text-xs gap-1"
                          >
                            <Trash2 className="size-3.5" />
                            Hapus
                          </Button>
                        </div>

                        {/* Row 1: Pilih Obat & Jumlah */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                          <div className="sm:col-span-8 space-y-1">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-medium text-ink-strong">Pilih Obat dari Stok</Label>
                              {selectedMed && (
                                <span className="text-[11px] text-ink-muted">
                                  Bentuk: <span className="font-medium text-ink-strong">{selectedMed.dosageForm}</span> · Satuan:{" "}
                                  <span className="font-medium text-ink-strong">{selectedMed.unit}</span>
                                </span>
                              )}
                            </div>
                            <Select
                              value={row.medicineId}
                              onValueChange={(val) => updatePrescriptionRow(idx, "medicineId", val)}
                            >
                              <SelectTrigger className="bg-surface h-9 text-xs">
                                <SelectValue placeholder="Pilih obat..." />
                              </SelectTrigger>
                              <SelectContent>
                                {availableMedicines.map((m) => (
                                  <SelectItem key={m.id} value={m.id} className="text-xs">
                                    <div className="flex items-center justify-between gap-4">
                                      <span>
                                        {m.name} ({m.dosageForm})
                                      </span>
                                      <span
                                        className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${m.stock <= 0
                                          ? "bg-danger-soft text-danger-ink"
                                          : m.stock <= 10
                                            ? "bg-warning-soft text-warning-ink"
                                            : "bg-success-soft text-success-ink"
                                          }`}
                                      >
                                        Stok: {m.stock} {m.unit}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {isOutOfStock && (
                              <p className="text-[11px] text-danger-ink flex items-center gap-1 mt-1">
                                <AlertCircle className="size-3 shrink-0" />
                                Perhatian: Stok obat ini saat ini kosong di apotek!
                              </p>
                            )}
                            {isLowStock && (
                              <p className="text-[11px] text-warning-ink flex items-center gap-1 mt-1">
                                <AlertCircle className="size-3 shrink-0" />
                                Stok obat menipis (tersisa {selectedMed?.stock} {selectedMed?.unit}).
                              </p>
                            )}
                          </div>

                          <div className="sm:col-span-4 space-y-1">
                            <Label className="text-xs font-medium text-ink-strong">Jumlah ({selectedMed?.unit || "Unit"})</Label>
                            <Input
                              type="number"
                              min="1"
                              value={row.quantity}
                              onChange={(e) =>
                                updatePrescriptionRow(idx, "quantity", parseInt(e.target.value, 10) || 1)
                              }
                              className="bg-surface h-9 text-xs"
                            />
                          </div>
                        </div>

                        {/* Row 2: Aturan Pakai (Signa) & Quick Presets */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium text-ink-strong">
                              Aturan Pakai (Signa) <span className="text-danger">*</span>
                            </Label>
                            <span className="text-[10px] text-ink-muted">Contoh: 3x1 sehari sesudah makan</span>
                          </div>
                          <Input
                            value={row.dosageInstructions}
                            placeholder="Tulis aturan pakai..."
                            onChange={(e) =>
                              updatePrescriptionRow(idx, "dosageInstructions", e.target.value)
                            }
                            className="bg-surface h-9 text-xs"
                          />
                          {/* Quick Preset Buttons */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[10px] text-ink-muted flex items-center gap-0.5">
                              <Sparkles className="size-3 text-primary-600" />
                              Pilihan cepat:
                            </span>
                            {COMMON_DOSAGES.map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => updatePrescriptionRow(idx, "dosageInstructions", preset)}
                                className="rounded bg-paper px-2 py-0.5 text-[10px] text-ink-soft hover:bg-primary-50 hover:text-primary-800 border border-line transition-colors"
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Row 3: Kolom Catatan Obat */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium text-ink-strong">
                              Catatan Obat / Petunjuk Khusus
                            </Label>
                            <span className="text-[10px] text-ink-muted">Opsional (untuk pasien &amp; apotek)</span>
                          </div>
                          <Input
                            value={row.notes || ""}
                            placeholder="Contoh: Habiskan, Bila panas saja, Diminum sebelum tidur..."
                            onChange={(e) =>
                              updatePrescriptionRow(idx, "notes", e.target.value)
                            }
                            className="bg-surface h-9 text-xs"
                          />
                          {/* Quick Notes Presets */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {COMMON_NOTES.map((notePreset) => (
                              <button
                                key={notePreset}
                                type="button"
                                onClick={() => updatePrescriptionRow(idx, "notes", notePreset)}
                                className="rounded bg-paper px-2 py-0.5 text-[10px] text-ink-muted hover:bg-primary-50 hover:text-primary-800 border border-line transition-colors"
                              >
                                + {notePreset}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Selesaikan Pemeriksaan */}
          <div className="flex items-center space-x-2 rounded-lg border border-line bg-primary-50/50 p-3 mt-4">
            <Checkbox
              id="markCompleted"
              checked={markCompleted}
              onCheckedChange={(c) => setMarkCompleted(!!c)}
            />
            <Label htmlFor="markCompleted" className="text-xs font-medium text-ink-strong cursor-pointer">
              Selesaikan sesi pemeriksaan (Otomatis ubah status janji temu menjadi &quot;Selesai&quot; dan simpan rekam medis serta e-resep)
            </Label>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              Tutup
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="gap-1.5 bg-primary-700 hover:bg-primary-800 text-surface"
            >
              <ClipboardCheck className="size-4" />
              {loading ? "Menyimpan..." : "Simpan Rekam Medis & E-Resep"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
