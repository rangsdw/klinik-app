import Link from "next/link";
import {
  CalendarDays,
  Clock,
  ClipboardPlus,
  Mail,
  MapPin,
  Phone,
  Pill,
  ReceiptText,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QueueTicket } from "@/components/landing/queue-ticket";
import { clinicConfig } from "@/config/clinic";
import { auth } from "@/lib/auth";
import { homeFor } from "@/lib/roles";

const STEPS = [
  { title: "Daftar", text: "Satu akun untuk Anda dan keluarga." },
  { title: "Buat janji", text: "Pilih dokter dan jam yang kosong." },
  { title: "Pantau antrean", text: "Datang saat nomor Anda hampir dipanggil." },
  { title: "Berobat", text: "Periksa, ambil obat, lalu bayar." },
];

const SERVICES = [
  {
    icon: Stethoscope,
    title: "Pemeriksaan dokter",
    text: "Riwayat dan catatan periksa tersimpan rapi di rekam medis elektronik.",
  },
  { icon: Pill, title: "Farmasi", text: "Resep dikirim langsung dari dokter ke farmasi." },
  {
    icon: ReceiptText,
    title: "Kasir",
    text: "Tagihan dan kuitansi dibuat otomatis setelah periksa.",
  },
  {
    icon: UsersRound,
    title: "Akun keluarga",
    text: "Satu akun untuk berobat anak, pasangan, atau orang tua.",
  },
];

export default async function HomePage() {
  const session = await auth();
  const dashboardHref = session?.user?.role
    ? homeFor(session.user.role, session.user.staffType)
    : null;
  const contact = [
    { icon: Clock, label: "Jam buka", value: clinicConfig.hours },
    { icon: MapPin, label: "Alamat", value: clinicConfig.address },
    {
      icon: Phone,
      label: "Telepon",
      value: clinicConfig.phone,
      href: clinicConfig.phone ? `tel:${clinicConfig.phone.replace(/[^\d+]/g, "")}` : undefined,
    },
    {
      icon: Mail,
      label: "Email",
      value: clinicConfig.email,
      href: clinicConfig.email ? `mailto:${clinicConfig.email}` : undefined,
    },
  ].filter((c) => c.value);

  return (
    <>
      {/* HERO: Stage, teks 5 kolom + tiket antrean 7 kolom */}
      <section className="mx-auto grid max-w-[1360px] items-center gap-12 px-4 py-12 sm:px-8 lg:min-h-[calc(100svh-72px)] lg:grid-cols-[minmax(0,576px)_minmax(0,540px)] lg:justify-center lg:gap-24 lg:py-16">
        <div className="max-w-xl space-y-7">
          <h1 className="text-ink-strong text-[2.75rem] leading-[1.05] font-bold tracking-tight sm:text-6xl lg:text-[4.25rem]">
            Berobat tanpa lama di ruang tunggu
          </h1>
          <p className="text-ink-soft max-w-md text-lg leading-relaxed sm:text-xl">
            Daftar online, buat janji, lalu datang saat nomor Anda hampir dipanggil.
          </p>
          <div className="flex flex-wrap gap-3">
            {dashboardHref ? (
              <Button asChild size="lg">
                <Link href={dashboardHref}>Ke Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg">
                  <Link href="/daftar">Daftar sekarang</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/masuk">Masuk</Link>
                </Button>
              </>
            )}
          </div>
        </div>
        <QueueTicket />
      </section>

      {/* CARA KERJA: satu ledger bernomor, bukan kartu ikon */}
      <section aria-labelledby="cara-kerja" className="border-line bg-surface border-y">
        <div className="mx-auto max-w-[1360px] px-4 py-20 sm:px-8 lg:py-32">
          <h2
            id="cara-kerja"
            className="text-ink-strong max-w-2xl text-4xl font-bold tracking-tight lg:text-5xl"
          >
            Empat langkah, dari rumah sampai ruang periksa
          </h2>
          <ol className="mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="border-primary-700 border-t-2 pt-6">
                <span
                  className="tabular text-primary-700 block text-5xl font-bold"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <h3 className="text-ink-strong mt-4 text-xl font-semibold">{s.title}</h3>
                <p className="text-ink-soft mt-2 leading-relaxed">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* LAYANAN */}
      <section
        id="layanan"
        aria-labelledby="layanan-judul"
        className="mx-auto max-w-[1360px] scroll-mt-24 px-4 py-20 sm:px-8 lg:py-32"
      >
        <div className="grid gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-20">
          <h2
            id="layanan-judul"
            className="text-ink-strong text-4xl font-bold tracking-tight lg:text-5xl"
          >
            Satu alur, tanpa berkas yang tercecer
          </h2>
          <ul className="border-line bg-line grid gap-px overflow-hidden rounded-2xl border sm:grid-cols-2">
            {SERVICES.map((s) => (
              <li key={s.title} className="bg-surface p-7 sm:p-8">
                <h3 className="text-ink-strong flex items-center gap-3 text-lg font-semibold">
                  <s.icon aria-hidden="true" className="text-primary-700 size-5" />
                  {s.title}
                </h3>
                <p className="text-ink-soft mt-2.5 leading-relaxed">{s.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* JADWAL DOKTER: terhubung data di Tahap 3 */}
      <section id="jadwal" aria-labelledby="jadwal-judul" className="bg-primary-50 scroll-mt-24">
        <div className="mx-auto max-w-[1360px] px-4 py-20 sm:px-8 lg:py-28">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <h2
              id="jadwal-judul"
              className="text-primary-900 text-4xl font-bold tracking-tight lg:text-5xl"
            >
              Jadwal dokter
            </h2>
            <Button asChild variant="outline">
              <Link href={dashboardHref ?? "/daftar"}>
                <ClipboardPlus aria-hidden="true" />
                Buat janji
              </Link>
            </Button>
          </div>
          <div className="border-primary-200 bg-surface mt-10 rounded-2xl border">
            <table className="w-full text-left">
              <caption className="sr-only">Jadwal praktik dokter</caption>
              <thead>
                <tr className="border-line border-b">
                  <th scope="col" className="text-ink-soft px-6 py-4 text-sm font-semibold">
                    Dokter
                  </th>
                  <th
                    scope="col"
                    className="text-ink-soft hidden px-6 py-4 text-sm font-semibold sm:table-cell"
                  >
                    Hari
                  </th>
                  <th
                    scope="col"
                    className="text-ink-soft hidden px-6 py-4 text-sm font-semibold sm:table-cell"
                  >
                    Jam praktik
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={3} className="px-6 py-14 text-center">
                    <CalendarDays aria-hidden="true" className="text-primary-700 mx-auto size-8" />
                    <p className="text-ink-strong mt-3 font-semibold">Jadwal sedang disiapkan</p>
                    <p className="text-ink-muted mt-1">
                      Jadwal praktik tampil di sini begitu klinik mengisinya.
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* KONTAK: penutup praktis, jam & alamat sebagai blok sendiri + aksi lagi */}
      <section
        id="kontak"
        aria-labelledby="kontak-judul"
        className="mx-auto max-w-[1360px] scroll-mt-24 px-4 py-20 sm:px-8 lg:py-32"
      >
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <div className="space-y-6">
            <h2
              id="kontak-judul"
              className="text-ink-strong text-4xl font-bold tracking-tight lg:text-5xl"
            >
              Datang ke {clinicConfig.name}
            </h2>
            {dashboardHref ? null : (
              <Button asChild size="lg">
                <Link href="/daftar">Daftar sekarang</Link>
              </Button>
            )}
          </div>
          <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {contact.map((c) => (
              <div key={c.label} className="border-line border-t pt-5">
                <dt className="text-ink-muted flex items-center gap-2 text-sm font-medium">
                  <c.icon aria-hidden="true" className="text-primary-700 size-4" />
                  {c.label}
                </dt>
                <dd className="text-ink-strong mt-2 text-xl font-semibold">
                  {c.href ? (
                    <a
                      href={c.href}
                      className="hover:text-primary-800 underline-offset-4 hover:underline"
                    >
                      {c.value}
                    </a>
                  ) : (
                    c.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
