import { signOut } from "@/lib/auth";

/**
 * Keluarkan sesi lalu arahkan ke /masuk. Dipakai rbac.getCurrentUser() saat akun
 * dinonaktifkan di tengah sesi (?alasan=nonaktif).
 */
export async function GET(request: Request) {
  const reason = new URL(request.url).searchParams.get("alasan");
  await signOut({
    redirectTo: reason === "nonaktif" ? "/masuk?status=nonaktif" : "/masuk?status=keluar",
  });
}
