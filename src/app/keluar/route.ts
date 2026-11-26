import { signOut } from "@/lib/auth";

/**
 * Keluarkan sesi lalu arahkan ke /masuk. Dipakai rbac.getCurrentUser() saat akun
 * dinonaktifkan di tengah sesi (?alasan=nonaktif) atau sesi tidak ditemukan di DB (?alasan=sesi).
 */
export async function GET(request: Request) {
  const reason = new URL(request.url).searchParams.get("alasan");
  const status = reason === "nonaktif" ? "nonaktif" : reason === "sesi" ? "sesi" : "keluar";
  await signOut({
    redirectTo: `/masuk?status=${status}`,
  });
}
