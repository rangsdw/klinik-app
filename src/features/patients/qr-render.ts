import "server-only";
import QRCode from "qrcode";
import { encodePatientQr } from "@/features/patients/qr";

/**
 * Render gambar SVG QR Code di server secara lokal (tanpa layanan pihak ketiga).
 * Isi QR hanya `KLINIK:<qrToken>`, bukan data medis atau identitas pribadi.
 */
export async function renderPatientQrSvg(qrToken: string): Promise<string> {
  const payload = encodePatientQr(qrToken);
  return QRCode.toString(payload, {
    type: "svg",
    margin: 4,
    errorCorrectionLevel: "M",
  });
}
