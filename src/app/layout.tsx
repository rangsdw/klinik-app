import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { clinicConfig } from "@/config/clinic";
import { env } from "@/lib/env";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const description = `${clinicConfig.name}: daftar online, buat janji dokter, dan pantau antrean dari HP.`;

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: { default: clinicConfig.name, template: `%s | ${clinicConfig.name}` },
  description,
  applicationName: clinicConfig.name,
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: clinicConfig.name,
    title: clinicConfig.name,
    description,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={jakarta.variable}>
      <body className="min-h-dvh">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
