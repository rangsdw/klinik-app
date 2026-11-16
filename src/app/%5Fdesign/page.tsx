import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CalendarCheck,
  Inbox,
  UsersRound,
  Stethoscope,
  Info,
  CircleCheck,
  TriangleAlert,
  OctagonX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/ui-kit/page-header";
import { StatCard } from "@/components/ui-kit/stat-card";
import { StatusBadge } from "@/components/ui-kit/status-badge";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { UserAvatar } from "@/components/ui-kit/user-avatar";
import { DataTable } from "@/components/ui-kit/data-table";
import { NativeSelect } from "@/components/ui-kit/native-select";
import { PasswordInput } from "@/components/ui-kit/password-input";
import { DesignInteractive } from "./interactive";

export const metadata: Metadata = { title: "Design system", robots: { index: false } };

const SWATCHES = [
  ["primary-50", "bg-primary-50"],
  ["primary-100", "bg-primary-100"],
  ["primary-200", "bg-primary-200"],
  ["primary-300", "bg-primary-300"],
  ["primary-400", "bg-primary-400"],
  ["primary-500", "bg-primary-500"],
  ["primary-600", "bg-primary-600"],
  ["primary-700", "bg-primary-700"],
  ["primary-800", "bg-primary-800"],
  ["primary-900", "bg-primary-900"],
  ["accent-50", "bg-accent-50"],
  ["accent-500", "bg-accent-500"],
  ["accent-600", "bg-accent-600"],
  ["success", "bg-success"],
  ["warning", "bg-warning"],
  ["danger", "bg-danger"],
  ["info", "bg-info"],
  ["paper", "bg-paper"],
  ["line", "bg-line"],
  ["ink", "bg-ink"],
] as const;

type DemoRow = { id: string; name: string; rm: string; status: "Aktif" | "Nonaktif" };
const ROWS: DemoRow[] = [
  { id: "1", name: "Contoh Pasien Satu", rm: "RM-2026-000001", status: "Aktif" },
  { id: "2", name: "Contoh Pasien Dua", rm: "RM-2026-000002", status: "Nonaktif" },
];

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-ink-strong text-xl font-semibold">{title}</h2>
      <div className="border-line bg-surface rounded-2xl border p-5 sm:p-6">{children}</div>
    </section>
  );
}

/** Living style guide. Hanya tersedia saat NODE_ENV=development. */
export default function DesignPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="mx-auto max-w-5xl space-y-12 px-4 py-10 sm:px-6">
      <PageHeader
        title="Design system"
        description="Katalog komponen dan token. Semua modul memakai komponen di halaman ini."
      />

      <Block title="Warna">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {SWATCHES.map(([name, cls]) => (
            <li key={name} className="flex items-center gap-3">
              <span
                className={`border-line size-10 shrink-0 rounded-lg border ${cls}`}
                aria-hidden="true"
              />
              <span className="text-ink text-sm">{name}</span>
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Tipografi">
        <div className="space-y-3">
          <p className="text-ink-strong text-4xl font-bold tracking-tight">Judul halaman 36px</p>
          <p className="text-ink-strong text-2xl font-bold">Judul bagian 24px</p>
          <p className="text-ink-strong text-lg font-semibold">Judul kartu 18px</p>
          <p className="text-ink max-w-prose text-base leading-relaxed">
            Teks isi 16px dengan Plus Jakarta Sans. Teks utama slate-800, teks sekunder slate-500
            untuk keterangan.
          </p>
          <p className="text-ink-muted text-sm">Keterangan 14px</p>
        </div>
      </Block>

      <Block title="Tombol">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Utama</Button>
          <Button variant="outline">Sekunder</Button>
          <Button variant="secondary">Lembut</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Hapus</Button>
          <Button variant="destructive-outline">Hapus (outline)</Button>
          <Button variant="link">Tautan</Button>
          <Button disabled>Nonaktif</Button>
          <Button size="sm">Kecil</Button>
          <Button size="lg">Besar</Button>
        </div>
      </Block>

      <Block title="Form">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="d-name">Nama lengkap</Label>
            <Input id="d-name" placeholder="mis. Siti Rahmawati" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-err">Email (error)</Label>
            <Input
              id="d-err"
              aria-invalid
              defaultValue="bukan-email"
              aria-describedby="d-err-msg"
            />
            <p id="d-err-msg" className="text-danger-ink text-sm font-medium">
              Format email tidak valid
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-pass">Password</Label>
            <PasswordInput id="d-pass" defaultValue="rahasia123" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-sel">Jenis kelamin</Label>
            <NativeSelect id="d-sel" defaultValue="">
              <option value="" disabled>
                Pilih
              </option>
              <option>Perempuan</option>
              <option>Laki-laki</option>
            </NativeSelect>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="d-ta">Catatan alergi</Label>
            <Textarea id="d-ta" placeholder="mis. Amoksisilin" />
          </div>
          <div className="flex items-center gap-2.5">
            <Checkbox id="d-cb" defaultChecked />
            <Label htmlFor="d-cb" className="font-normal">
              Ingat saya
            </Label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-dis">Nonaktif</Label>
            <Input id="d-dis" disabled defaultValue="Tidak bisa diubah" />
          </div>
        </div>
      </Block>

      <Block title="Badge & avatar">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge variant="success">Aktif</StatusBadge>
          <StatusBadge variant="warning">Menunggu</StatusBadge>
          <StatusBadge variant="danger">Ditolak</StatusBadge>
          <StatusBadge variant="info">Anak</StatusBadge>
          <StatusBadge variant="neutral">Nonaktif</StatusBadge>
          <Badge>Default</Badge>
          <Separator orientation="vertical" className="h-8" />
          <UserAvatar name="Siti Rahmawati" size="sm" />
          <UserAvatar name="Budi Santoso" />
          <UserAvatar name="Andi Pratama" size="lg" />
        </div>
      </Block>

      <Block title="Alert">
        <div className="space-y-3">
          <Alert className="border-info/30 bg-info-soft">
            <Info className="text-info-ink" />
            <AlertTitle className="text-info-ink">Info</AlertTitle>
            <AlertDescription className="text-info-ink">
              Jadwal dokter diperbarui setiap Senin.
            </AlertDescription>
          </Alert>
          <Alert className="border-success/30 bg-success-soft">
            <CircleCheck className="text-success-ink" />
            <AlertTitle className="text-success-ink">Berhasil</AlertTitle>
            <AlertDescription className="text-success-ink">Data pasien tersimpan.</AlertDescription>
          </Alert>
          <Alert className="border-warning/30 bg-warning-soft">
            <TriangleAlert className="text-warning-ink" />
            <AlertTitle className="text-warning-ink">Perhatian</AlertTitle>
            <AlertDescription className="text-warning-ink">
              Pasien memiliki alergi obat.
            </AlertDescription>
          </Alert>
          <Alert className="border-danger/30 bg-danger-soft">
            <OctagonX className="text-danger-ink" />
            <AlertTitle className="text-danger-ink">Gagal</AlertTitle>
            <AlertDescription className="text-danger-ink">
              Koneksi terputus. Coba lagi.
            </AlertDescription>
          </Alert>
        </div>
      </Block>

      <Block title="Stat card">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Contoh angka"
            value={12}
            icon={CalendarCheck}
            hint="Angka contoh di style guide"
          />
          <StatCard
            label="Belum ada data"
            value={null}
            icon={UsersRound}
            hint="Tampil sebagai tanda strip"
          />
          <StatCard label="Dokter aktif" value={2} icon={Stethoscope} />
        </div>
      </Block>

      <Block title="Tabel (responsif: kartu di mobile)">
        <DataTable<DemoRow>
          caption="Contoh tabel"
          rowKey={(r) => r.id}
          rows={ROWS}
          columns={[
            { key: "name", header: "Nama", primary: true, cell: (r) => r.name },
            { key: "rm", header: "No. RM", cell: (r) => <span className="tabular">{r.rm}</span> },
            {
              key: "status",
              header: "Status",
              cell: (r) => (
                <StatusBadge variant={r.status === "Aktif" ? "success" : "neutral"}>
                  {r.status}
                </StatusBadge>
              ),
            },
            {
              key: "aksi",
              header: "Aksi",
              actions: true,
              cell: () => (
                <Button size="sm" variant="outline">
                  Lihat
                </Button>
              ),
            },
          ]}
        />
      </Block>

      <Block title="Empty state & skeleton">
        <div className="grid gap-6 md:grid-cols-2">
          <EmptyState
            icon={Inbox}
            title="Belum ada janji"
            description="Janji yang Anda buat akan tampil di sini."
            action={<Button>Buat janji</Button>}
          />
          <div className="space-y-3" aria-hidden="true">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-28" />
          </div>
        </div>
      </Block>

      <Block title="Dialog & toast">
        <DesignInteractive />
      </Block>
    </main>
  );
}
