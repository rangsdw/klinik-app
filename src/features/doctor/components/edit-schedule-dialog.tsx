"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateScheduleAction } from "../actions";
import type { AppointmentStatus } from "@prisma/client";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: {
    id: string;
    appointmentDate: string; // YYYY-MM-DD
    startTime: string;
    endTime: string;
    status: AppointmentStatus;
    patientName: string;
    queueNumber: number | null;
  };
};

export function EditScheduleDialog({ open, onOpenChange, appointment }: Props) {
  const router = useRouter();
  const [date, setDate] = useState(appointment.appointmentDate);
  const [startTime, setStartTime] = useState(appointment.startTime);
  const [endTime, setEndTime] = useState(appointment.endTime);
  const [status, setStatus] = useState<AppointmentStatus>(appointment.status);
  const [loading, setLoading] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await updateScheduleAction(appointment.id, {
        appointmentDate: date,
        startTime,
        endTime,
        status,
      });

      if (!res.ok) {
        toast.error(res.message || "Gagal memperbarui jadwal.");
        return;
      }

      toast.success(res.message);
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ubah Jadwal Janji Temu</DialogTitle>
          <DialogDescription>
            Atur ulang tanggal, jam, atau status untuk antrean #{appointment.queueNumber ?? "-"} (
            {appointment.patientName}).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="date">Tanggal Janji Temu</Label>
            <Input
              id="date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startTime">Jam Mulai</Label>
              <Input
                id="startTime"
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endTime">Jam Selesai</Label>
              <Input
                id="endTime"
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status">Status Janji Temu</Label>
            <Select value={status} onValueChange={(val) => setStatus(val as AppointmentStatus)}>
              <SelectTrigger id="status">
                <SelectValue placeholder="Pilih status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Menunggu (Pending)</SelectItem>
                <SelectItem value="CONFIRMED">Terkonfirmasi (Confirmed)</SelectItem>
                <SelectItem value="IN_PROGRESS">Sedang Diperiksa (In Progress)</SelectItem>
                <SelectItem value="COMPLETED">Selesai (Completed)</SelectItem>
                <SelectItem value="CANCELLED">Dibatalkan (Cancelled)</SelectItem>
                <SelectItem value="NO_SHOW">Tidak Hadir (No Show)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
