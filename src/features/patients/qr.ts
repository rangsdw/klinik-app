export const QR_PREFIX = "KLINIK:";

const UUID_TOKEN_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Periksa apakah token mentah berformat UUID v4 yang sah. */
export function isValidQrToken(token: string): boolean {
  return UUID_TOKEN_REGEX.test(token.trim());
}

/** Susun payload QR Code pasien dengan format `KLINIK:<token>`. */
export function encodePatientQr(qrToken: string): string {
  if (!qrToken || typeof qrToken !== "string" || !isValidQrToken(qrToken)) {
    throw new Error("Token QR pasien tidak valid.");
  }
  return `${QR_PREFIX}${qrToken.trim().toLowerCase()}`;
}

/**
 * Urai string hasil pemindaian QR (atau input manual berawalan `KLINIK:`).
 * Mengembalikan token UUID lowercase jika sah, atau `null` jika format/token rusak.
 */
export function parsePatientQr(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith(QR_PREFIX)) return null;
  const token = trimmed.slice(QR_PREFIX.length);
  if (!isValidQrToken(token)) return null;
  return token.toLowerCase();
}
