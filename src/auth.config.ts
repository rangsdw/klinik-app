import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";
import {
  canAccessPath,
  homeFor,
  rolesForPath,
  type RoleName,
  type StaffTypeName,
} from "@/lib/roles";

/** Durasi sesi: "Ingat saya" 30 hari, selain itu 12 jam. */
export const SESSION_MAX_AGE_REMEMBER = 60 * 60 * 24 * 30;
export const SESSION_MAX_AGE_DEFAULT = 60 * 60 * 12;

const AUTH_PAGES = ["/masuk", "/daftar", "/lupa-password"];

/**
 * Konfigurasi Auth.js yang edge-compatible (tanpa Prisma/bcrypt).
 * Dipakai middleware.ts; src/lib/auth.ts menambahkan provider Credentials.
 */
export const authConfig = {
  pages: { signIn: "/masuk" },
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_REMEMBER },
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.staffType = user.staffType ?? null;
        token.name = user.name;
        const maxAge = user.remember ? SESSION_MAX_AGE_REMEMBER : SESSION_MAX_AGE_DEFAULT;
        token.sessionExpiresAt = Math.floor(Date.now() / 1000) + maxAge;
      }
      // Sesi tanpa "Ingat saya" kedaluwarsa lebih cepat.
      if (token.sessionExpiresAt && Date.now() / 1000 > token.sessionExpiresAt) return null;
      return token;
    },
    session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.staffType = token.staffType ?? null;
        session.user.name = token.name ?? "";
      }
      return session;
    },
    /** Pemeriksaan ringan di middleware: login & kecocokan prefix route dengan role. */
    authorized({ auth, request }) {
      const { pathname, search } = request.nextUrl;
      const user = auth?.user;

      if (AUTH_PAGES.some((p) => pathname === p) && user?.role) {
        return Response.redirect(
          new URL(
            homeFor(user.role as RoleName, user.staffType as StaffTypeName | null),
            request.nextUrl,
          ),
        );
      }

      const roles = rolesForPath(pathname);
      if (!roles) return true;
      if (!user?.role) {
        const url = new URL("/masuk", request.nextUrl);
        url.searchParams.set("callbackUrl", pathname + search);
        return Response.redirect(url);
      }
      // Role/staffType tidak cocok -> tampilkan halaman 403 (layout area tetap memanggil requireRole()).
      if (!canAccessPath(pathname, user.role as RoleName, user.staffType as StaffTypeName | null)) {
        return NextResponse.rewrite(new URL("/akses-ditolak", request.nextUrl), { status: 403 });
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
