"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Printer, QrCode, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui-kit/confirm-dialog";
import { regeneratePatientQrAction } from "@/features/patients/actions";

type PatientQrDialogProps = {
  patientId: string;
  patientName: string;
  medicalRecordNumber: string;
  qrSvg: string;
  clinicName: string;
  clinicAddress?: string;
  clinicPhone?: string;
  allowRegenerate?: boolean;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "secondary";
  triggerClassName?: string;
};

export function PatientQrDialog({
  patientId,
  patientName,
  medicalRecordNumber,
  qrSvg,
  clinicName,
  clinicAddress,
  clinicPhone,
  allowRegenerate = false,
  triggerLabel = "Tampilkan QR",
  triggerVariant = "default",
  triggerClassName,
}: PatientQrDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [printingActive, setPrintingActive] = useState(false);
  const qrBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const cleanup = () => {
      document.body.classList.remove("printing-qr-card");
      setPrintingActive(false);
    };
    window.addEventListener("afterprint", cleanup);
    return () => {
      window.removeEventListener("afterprint", cleanup);
      cleanup();
    };
  }, []);

  function triggerDownload(url: string, filename: string) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function handleDownloadSvg() {
    const blob = new Blob([qrSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `qr-${medicalRecordNumber}.svg`);
    URL.revokeObjectURL(url);
    toast.success("QR Code (SVG) berhasil diunduh.");
  }

  function handleDownloadPng() {
    const svgBlob = new Blob([qrSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = () => {
      const size = 640;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        const bgColor = qrBoxRef.current
          ? getComputedStyle(qrBoxRef.current).backgroundColor
          : getComputedStyle(document.documentElement).getPropertyValue("--color-qr-surface").trim();
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        canvas.toBlob((pngBlob) => {
          URL.revokeObjectURL(url);
          if (!pngBlob) {
            toast.error("Gagal menyiapkan file PNG.");
            return;
          }
          const pngUrl = URL.createObjectURL(pngBlob);
          triggerDownload(pngUrl, `qr-${medicalRecordNumber}.png`);
          URL.revokeObjectURL(pngUrl);
          toast.success("QR Code (PNG) berhasil diunduh.");
        }, "image/png");
      } else {
        URL.revokeObjectURL(url);
        toast.error("Browser tidak mendukung pembuatan PNG.");
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast.error("Gagal merender gambar QR.");
    };

    img.src = url;
  }

  function handlePrint() {
    setPrintingActive(true);
    document.body.classList.add("printing-qr-card");
    requestAnimationFrame(() => {
      window.print();
    });
  }

  async function handleRegenerate() {
    const res = await regeneratePatientQrAction(patientId);
    if (!res.ok) {
      toast.error(res.message ?? "Gagal membuat QR Code baru.");
      return;
    }
    toast.success(res.message ?? "QR Code baru berhasil dibuat.");
    router.refresh();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant={triggerVariant} className={triggerClassName}>
            <QrCode aria-hidden="true" />
            {triggerLabel}
          </Button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code Pasien</DialogTitle>
            <DialogDescription>
              Tunjukkan QR ini ke petugas pendaftaran saat tiba di klinik.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div
              ref={qrBoxRef}
              className="bg-qr-surface text-qr-ink border-line mx-auto flex flex-col items-center rounded-2xl border p-5"
            >
              <div
                aria-label={`QR Code berobat ${patientName}`}
                className="w-56 max-w-full sm:w-64 [&_svg]:h-auto [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <p className="text-qr-ink mt-3 text-center text-lg font-bold">{patientName}</p>
              <p className="tabular text-ink-soft font-mono text-sm font-semibold">
                {medicalRecordNumber}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button type="button" variant="outline" className="min-h-11" onClick={handleDownloadPng}>
                <Download aria-hidden="true" className="size-4" />
                Unduh PNG
              </Button>
              <Button type="button" variant="outline" className="min-h-11" onClick={handleDownloadSvg}>
                <Download aria-hidden="true" className="size-4" />
                Unduh SVG
              </Button>
              <Button type="button" variant="outline" className="min-h-11" onClick={handlePrint}>
                <Printer aria-hidden="true" className="size-4" />
                Cetak
              </Button>
            </div>

            {allowRegenerate ? (
              <div className="border-line flex items-center justify-between gap-3 border-t pt-3">
                <p className="text-ink-muted text-xs">
                  Kartu QR hilang atau bocor? Ganti agar QR lama tidak berlaku lagi.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-danger-ink hover:bg-danger-soft hover:text-danger-ink shrink-0"
                  onClick={() => setConfirmResetOpen(true)}
                >
                  <RefreshCw aria-hidden="true" className="size-3.5" />
                  Buat QR Baru
                </Button>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {allowRegenerate ? (
        <ConfirmDialog
          open={confirmResetOpen}
          onOpenChange={setConfirmResetOpen}
          title="Buat QR Code baru?"
          description={
            <>
              QR Code lama milik <strong>{patientName}</strong> ({medicalRecordNumber}) akan langsung
              dinonaktifkan dan tidak bisa dipakai lagi untuk check-in.
            </>
          }
          confirmLabel="Ya, Buat QR Baru"
          destructive
          onConfirm={handleRegenerate}
        />
      ) : null}

      {printingActive ? (
        <div className="qr-print-only hidden print:flex">
          <div className="border-line bg-qr-surface text-qr-ink w-full max-w-sm rounded-2xl border p-8 text-center">
            <p className="text-primary-700 text-lg font-bold">{clinicName}</p>
            {clinicAddress ? <p className="text-ink-soft mt-1 text-xs">{clinicAddress}</p> : null}
            {clinicPhone ? <p className="text-ink-soft text-xs">Telp. {clinicPhone}</p> : null}

            <div className="border-line my-5 border-t pt-5">
              <div
                className="mx-auto w-56 [&_svg]:h-auto [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            </div>

            <p className="text-qr-ink text-xl font-bold">{patientName}</p>
            <p className="tabular text-ink-soft mt-1 font-mono text-base font-semibold">
              {medicalRecordNumber}
            </p>
            <p className="text-ink-muted mt-4 text-xs">
              Tunjukkan QR ini ke petugas pendaftaran saat tiba di klinik.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
