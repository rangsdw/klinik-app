import { describe, expect, it } from "vitest";
import { encodePatientQr, isValidQrToken, parsePatientQr, QR_PREFIX } from "@/features/patients/qr";
import { renderPatientQrSvg } from "@/features/patients/qr-render";

describe("format QR pasien", () => {
  const sampleUuid = "550e8400-e29b-41d4-a716-446655440000";

  it("encodePatientQr menghasilkan format KLINIK:<uuid> lowercase", () => {
    expect(encodePatientQr(sampleUuid.toUpperCase())).toBe(`${QR_PREFIX}${sampleUuid}`);
  });

  it("encodePatientQr menolak token kosong atau bukan UUID", () => {
    expect(() => encodePatientQr("")).toThrow();
    expect(() => encodePatientQr("bukan-uuid")).toThrow();
    expect(() => encodePatientQr("KLINIK:" + sampleUuid)).toThrow();
  });

  it("parsePatientQr menerima format valid beserta spasi pinggir", () => {
    expect(parsePatientQr(`  KLINIK:${sampleUuid.toUpperCase()}  `)).toBe(sampleUuid);
    expect(isValidQrToken(sampleUuid)).toBe(true);
  });

  it("parsePatientQr menolak tanpa prefix, prefix salah, atau token rusak", () => {
    expect(parsePatientQr("")).toBeNull();
    expect(parsePatientQr(sampleUuid)).toBeNull();
    expect(parsePatientQr(`LAIN:${sampleUuid}`)).toBeNull();
    expect(parsePatientQr("KLINIK:12345")).toBeNull();
    expect(parsePatientQr(`KLINIK:${sampleUuid}:Budi`)).toBeNull();
  });

  it("renderPatientQrSvg menghasilkan SVG lokal tanpa URL pihak ketiga maupun data medis", async () => {
    const svg = await renderPatientQrSvg(sampleUuid);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).not.toContain("<image");
    expect(svg.replace('xmlns="http://www.w3.org/2000/svg"', "")).not.toMatch(/https?:\/\//i);
    expect(svg).not.toContain("Budi");
    expect(svg).not.toContain("Alergi");
  });
});
