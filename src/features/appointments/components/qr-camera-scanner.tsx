"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, CameraOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onScan: (decodedText: string) => void;
};

type ScannerInstance = {
  stop: () => Promise<void>;
  clear: () => void;
};

export function QrCameraScanner({ onScan }: Props) {
  const rawId = useId();
  const containerId = `qr-reader-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const scannerRef = useRef<ScannerInstance | null>(null);
  const lastScanRef = useRef<{ value: string; time: number }>({ value: "", time: 0 });
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  async function stopScanner() {
    const instance = scannerRef.current;
    scannerRef.current = null;
    if (instance) {
      try {
        await instance.stop();
      } catch {
        // Abaikan error saat scanner belum sempat berjalan penuh
      }
      try {
        instance.clear();
      } catch {
        // Abaikan error pembersihan DOM
      }
    }
    setActive(false);
    setStarting(false);
  }

  useEffect(() => {
    return () => {
      const instance = scannerRef.current;
      scannerRef.current = null;
      if (instance) {
        void instance.stop().catch(() => undefined);
      }
    };
  }, []);

  async function startScanner() {
    if (starting || active) return;
    setCameraError(null);

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setCameraError(
        "Kamera memerlukan koneksi HTTPS atau localhost. Gunakan kolom input token atau pencarian manual.",
      );
      return;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "Browser atau perangkat ini tidak menyediakan kamera. Gunakan input manual atau scanner USB.",
      );
      return;
    }

    setStarting(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(containerId, { verbose: false });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          const now = Date.now();
          if (
            lastScanRef.current.value === decodedText &&
            now - lastScanRef.current.time < 2000
          ) {
            return;
          }
          lastScanRef.current = { value: decodedText, time: now };
          onScanRef.current(decodedText);
        },
        () => {
          // Frame tanpa QR diabaikan agar tidak membanjiri UI
        },
      );

      setActive(true);
    } catch (error) {
      await stopScanner();
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("permission") || message.includes("notallowed")) {
        setCameraError(
          "Izin kamera ditolak. Izinkan akses kamera pada browser atau gunakan pencarian manual / scanner USB.",
        );
      } else {
        setCameraError(
          "Kamera tidak tersedia atau sedang dipakai aplikasi lain. Gunakan pencarian manual / scanner USB.",
        );
      }
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="border-line bg-paper space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-ink-strong text-sm font-semibold">Pindai dengan kamera</p>
          <p className="text-ink-muted text-xs">
            Arahkan QR pasien ke kamera perangkat untuk pencarian otomatis.
          </p>
        </div>

        {active ? (
          <Button type="button" variant="outline" size="sm" onClick={() => void stopScanner()}>
            <CameraOff aria-hidden="true" className="size-4" />
            Matikan Kamera
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={starting}
            onClick={() => void startScanner()}
          >
            {starting ? (
              <>
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                Membuka Kamera...
              </>
            ) : (
              <>
                <Camera aria-hidden="true" className="size-4" />
                Aktifkan Kamera
              </>
            )}
          </Button>
        )}
      </div>

      {cameraError ? (
        <p
          role="alert"
          className="border-warning/30 bg-warning-soft text-warning-ink rounded-lg border px-3 py-2 text-xs"
        >
          {cameraError}
        </p>
      ) : null}

      <div
        id={containerId}
        className={
          active
            ? "border-line bg-surface overflow-hidden rounded-lg border"
            : "hidden"
        }
      />
    </div>
  );
}
