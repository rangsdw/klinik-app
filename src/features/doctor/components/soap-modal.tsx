"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Plus, Trash2, Pill, Activity, Stethoscope } from "lucide-react";
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
import { saveSoapRecordAction } from "../actions";
import type { Medicine } from "@prisma/client";

type PrescriptionRow = {
  medicineId: string;
  quantity: number;
  dosageInstructions: string;
  notes?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: {
    id: string;
    queueNumber: number;
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
  availableMedicines: Medicine[];
};

export function SoapModal({ open, onOpenChange, appointment, availableMedicines }: Props) {
  const router = useRouter();
  const rec = appointment.medicalRecord;

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
    if (availableMedicines.length === 0) return;
    setPrescriptions((prev) => [
      ...prev,
      {
        medicineId: availableMedicines[0].id,
        quantity: 1,
        dosageInstructions: "3x sehari 1 tablet sesudah makan",
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
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-ink-strong">
                <Stethoscope className="size-5 text-primary-700" />
                Rekam Medis & Form SOAP
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-ink-soft">
                Antrean #{appointment.queueNumber} · {appointment.patient.name} (RM:{" "}
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

        <form onSubmit={handleSubmit} className="space-y-6 py-2">
          {/* Bagian Tanda Vital (Objective Vitals) */}
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
                  P — Plan (Tindakan Medis & Edukasi Pasien)
                </Label>
                <span className="text-xs text-ink-muted">Rencana terapi, tindakan, jadwal kontrol</span>
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

          {/* E-Resep Obat */}
          <div className="space-y-3 rounded-xl border border-line p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pill className="size-4 text-primary-600" />
                <h4 className="text-sm font-semibold text-ink-strong">E-Resep Obat</h4>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPrescriptionRow}
                className="h-8 gap-1 text-xs"
              >
                <Plus className="size-3.5" />
                Tambah Obat
              </Button>
            </div>

            {prescriptions.length === 0 ? (
              <p className="text-xs text-ink-muted italic py-1">
                Belum ada obat yang diresepkan. Klik &quot;Tambah Obat&quot; untuk menambahkan resep.
              </p>
            ) : (
              <div className="space-y-3">
                {prescriptions.map((row, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-2 rounded-lg border border-line bg-paper/50 p-3 sm:flex-row sm:items-center"
                  >
                    <div className="flex-1 sm:max-w-xs">
                      <Label className="text-xs text-ink-soft">Pilih Obat</Label>
                      <Select
                        value={row.medicineId}
                        onValueChange={(val) => updatePrescriptionRow(idx, "medicineId", val)}
                      >
                        <SelectTrigger className="bg-surface h-9 text-xs">
                          <SelectValue placeholder="Pilih obat" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableMedicines.map((m) => (
                            <SelectItem key={m.id} value={m.id} className="text-xs">
                              {m.name} ({m.dosageForm}) - Stok: {m.stock}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-20">
                      <Label className="text-xs text-ink-soft">Jumlah</Label>
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

                    <div className="flex-1">
                      <Label className="text-xs text-ink-soft">Aturan Pakai (Signa)</Label>
                      <Input
                        value={row.dosageInstructions}
                        placeholder="Contoh: 3x1 sesudah makan"
                        onChange={(e) =>
                          updatePrescriptionRow(idx, "dosageInstructions", e.target.value)
                        }
                        className="bg-surface h-9 text-xs"
                      />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removePrescriptionRow(idx)}
                      className="text-danger hover:bg-danger-soft h-9 w-9 self-end sm:self-center"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selesaikan Pemeriksaan */}
          <div className="flex items-center space-x-2 rounded-lg border border-line bg-primary-50/50 p-3">
            <Checkbox
              id="markCompleted"
              checked={markCompleted}
              onCheckedChange={(c) => setMarkCompleted(!!c)}
            />
            <Label htmlFor="markCompleted" className="text-xs font-medium text-ink-strong cursor-pointer">
              Selesaikan sesi pemeriksaan (Otomatis ubah status janji temu menjadi &quot;Selesai&quot;)
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
            <Button type="submit" disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan Rekam Medis"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
