import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/**
 * Middleware ringan (edge): belum login -> /masuk?callbackUrl=..., user login yang membuka
 * /masuk atau /daftar -> dashboard-nya. Otorisasi role yang sebenarnya ada di server
 * (requireRole di layout area, Server Action, dan Route Handler).
 */
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    "/admin/:path*",
    "/dokter/:path*",
    "/staf/:path*",
    "/pasien/:path*",
    "/masuk",
    "/daftar",
    "/lupa-password",
  ],
};
