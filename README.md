# Sistem Informasi Klinik (klinik-app)

Aplikasi web klinik berbasis Next.js. Pasien bisa mendaftar online, mengelola akun keluarga (multi-pasien), lalu (tahap berikutnya) membuat janji, memantau antrean, dan melihat riwayat. Admin, dokter, dan staf (pendaftaran, farmasi, kasir) punya area kerja masing-masing dengan akses terpisah.

Frontend dan backend ada dalam satu project: mutasi lewat **Server Actions**, endpoint untuk klien lewat **Route Handlers** (`src/app/api`). Tidak ada server terpisah.

| Lapisan     | Pilihan                                                             |
| ----------- | ------------------------------------------------------------------- |
| Framework   | Next.js 15 (App Router) + TypeScript strict                         |
| Database    | MySQL 8 + Prisma ORM 6                                              |
| Autentikasi | Auth.js v5 (Credentials, sesi JWT), bcryptjs (cost 12)              |
| UI          | Tailwind CSS 4 + shadcn/ui (Radix), lucide-react, Plus Jakarta Sans |
| Form        | React Hook Form + Zod (skema sama di klien dan server)              |
| Test        | Vitest (unit & integrasi) + Playwright (e2e)                        |

## Prasyarat

- Node.js 20 atau lebih baru (dikembangkan dengan Node 22), npm
- MySQL 8 (mis. bawaan Laragon)
- Google Chrome (dipakai Playwright lewat `channel: "chrome"`, tanpa unduh browser)

## Instalasi

```bash
git clone <URL-REPO>
cd klinik-app
npm install
cp .env.example .env
```

1. Isi `.env`. Minimal `DATABASE_URL` dan `AUTH_SECRET` (buat dengan `npx auth secret`). Data klinik (`CLINIC_*`) dipakai di seluruh tampilan; nama klinik tidak di-hardcode.
2. Buat database:
   ```sql
   CREATE DATABASE klinik_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. Jalankan migrasi dan data demo, lalu server dev:
   ```bash
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```
4. Buka http://localhost:3000.

Tanpa `SMTP_HOST`, email (mis. tautan reset password) dicetak ke console server.

## Akun demo (HANYA lokal)

Password semua akun: `password123`

| Email                                    | Role                                              | Masuk ke            |
| ---------------------------------------- | ------------------------------------------------- | ------------------- |
| admin@klinik.test                        | Admin                                             | `/admin`            |
| dokter1@klinik.test, dokter2@klinik.test | Dokter                                            | `/dokter`           |
| pendaftaran@klinik.test                  | Staf pendaftaran                                  | `/staf/pendaftaran` |
| farmasi@klinik.test                      | Staf farmasi                                      | `/staf/farmasi`     |
| kasir@klinik.test                        | Staf kasir                                        | `/staf/kasir`       |
| pasien@klinik.test                       | Pasien (3 anggota: diri sendiri, anak, orang tua) | `/pasien`           |

Seeder idempoten (aman diulang) dan menolak berjalan saat `NODE_ENV=production`.

## Skrip npm

| Skrip                                                           | Fungsi                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------- |
| `dev` / `build` / `start`                                       | Server dev, build produksi, jalankan build              |
| `lint` / `typecheck`                                            | ESLint, `tsc --noEmit`                                  |
| `format` / `format:check`                                       | Prettier (+ plugin Tailwind)                            |
| `test`                                                          | Vitest (unit + integrasi ke database `klinik_app_test`) |
| `test:e2e`                                                      | Playwright (memakai database dev yang sudah di-seed)    |
| `db:migrate` / `db:push` / `db:seed` / `db:studio` / `db:reset` | Prisma                                                  |

### Test

- `npm run test` membutuhkan database kosong `klinik_app_test` (dibuat sekali: `CREATE DATABASE klinik_app_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`). Skema didorong otomatis sebelum test.
- `npm run test:e2e` memakai server di :3000 bila sudah berjalan, atau menjalankan `npm run dev`. Jalankan `npm run db:seed` dulu.
- `npx playwright test screenshots` menyimpan screenshot halaman utama (mobile & desktop) ke `docs/screenshots/`.

## Route

| Route                                                            | Akses                  | Keterangan                                            |
| ---------------------------------------------------------------- | ---------------------- | ----------------------------------------------------- |
| `/`                                                              | publik                 | Landing page (Layanan, Jadwal Dokter, Kontak)         |
| `/masuk`, `/daftar`, `/lupa-password`, `/reset-password/[token]` | publik                 | Auth; user yang sudah login diarahkan ke dashboard    |
| `/admin`, `/admin/pengguna`                                      | ADMIN                  | Dashboard, manajemen akun internal                    |
| `/dokter`                                                        | DOCTOR                 | Dashboard kerangka                                    |
| `/staf` + `/staf/pendaftaran`, `/staf/farmasi`, `/staf/kasir`    | STAFF sesuai staffType | Dashboard kerangka per tipe staf                      |
| `/pasien`                                                        | PATIENT                | Beranda: pemilih pasien aktif, kartu pasien, pintasan |
| `/pasien/keluarga`, `/pasien/keluarga/[id]`                      | PATIENT                | Akun keluarga (maks. 10 anggota)                      |
| `/pasien/janji`, `/pasien/antrean`, `/pasien/riwayat`            | PATIENT                | Placeholder "Segera hadir" (Tahap 3 & 4)              |
| `/pasien/profil`                                                 | PATIENT                | Ubah profil, ganti password, keluar                   |
| `/_design`                                                       | development saja       | Living style guide semua komponen                     |

## Keamanan dan otorisasi (berlapis)

1. `src/middleware.ts` (edge, `src/auth.config.ts` tanpa Prisma/bcrypt): belum login diarahkan ke `/masuk?callbackUrl=...`; prefix route yang tidak cocok dengan role/staffType ditampilkan sebagai 403.
2. `src/lib/rbac.ts`: `requireUser()`, `requireRole()`, `requireStaffType()` dipanggil di layout tiap area **dan** di setiap Server Action. `apiRequireRole()` untuk Route Handler (401/403 JSON). Status `isActive`, role, dan staffType selalu dibaca ulang dari database, jadi akun yang dinonaktifkan di tengah sesi langsung dikeluarkan.
3. Data pasien: semua query lewat `src/features/patients/queries.ts` (filter `deletedAt` dan `accountUserId` di satu tempat). ID dari klien tidak pernah dipercaya; pasien akun lain menghasilkan 404.
4. Login: pesan error generik, rate limit 5 percobaan/menit per identifier + IP (`src/lib/rate-limit.ts`, interface siap diganti Redis/Upstash), bcrypt tetap dijalankan walau akun tidak ada.
5. Reset password: token acak disimpan sebagai hash SHA-256, berlaku 60 menit, sekali pakai.
6. Header keamanan di `next.config.ts`; `passwordHash` tidak pernah dikirim ke klien (`select` eksplisit).

## Struktur folder

```
prisma/              schema.prisma, migrations/, seed.ts
src/
  app/
    (public)/        landing page
    (auth)/          masuk, daftar, lupa-password, reset-password
    (app)/           admin, dokter, staf (sidebar + topbar)
    (patient)/pasien portal pasien (bottom nav di mobile)
    api/             route handlers (auth)
    %5Fdesign/       /_design (style guide, dev saja)
  components/
    ui/              shadcn/ui, disesuaikan dengan design token
    ui-kit/          PageHeader, StatCard, StatusBadge, EmptyState, UserAvatar, SubmitButton,
                     FormField, PasswordInput, ConfirmDialog, DataTable, NativeSelect
    layout/          sidebar, topbar, bottom nav, brand, 403
    landing/         komponen landing page
  features/
    auth/            actions, schemas, queries, komponen form
    patients/        actions, queries, schemas, service, mrn (nomor RM), komponen
    users/           akun internal (admin)
  config/            clinic.ts (identitas klinik), navigation.ts (menu per role)
  lib/               db, env (validasi Zod), auth, rbac, roles, normalize, mail, rate-limit, date
  types/             augmentasi tipe Auth.js
tests/unit, tests/e2e
docs/                DATABASE.md, screenshots/
```

## Design system

Token ada di `src/app/globals.css` (satu-satunya tempat literal warna/font): primary teal (tombol utama memakai primary-700 agar kontras teks putih memenuhi WCAG AA), accent biru, status success/warning/danger/info beserta varian lembut dan tinta teks, neutral slate. Komponen modul baru cukup memakai utilitas token (`bg-primary-700`, `text-ink-muted`, `border-line`) dan komponen di `components/ui-kit`. Lihat semuanya di `/_design`.

## Titik sambung untuk tim

- **Menu**: tambah item di `src/config/navigation.ts` (field `roles` dan opsional `staffTypes`). Layout tidak perlu diubah.
- **Halaman staf**: `src/app/(app)/staf/farmasi` dan `/kasir` (Axel), sudah dijaga `requireStaffType`.
- **Rekam medis** (Ravy): model `Patient` punya `allergies` dan `specialConditions` untuk Red Flag; lihat TODO di `deletePatientAction` untuk mencegah hapus pasien yang sudah punya kunjungan.
- **Schema**: tambah model di blok bertanda tiap modul di `prisma/schema.prisma`, lalu `npm run db:migrate`. Perbarui `docs/DATABASE.md`.
- **QR**: `Patient.qrToken` sudah dibuat otomatis; gambar QR dan check-in di Tahap 4.

Lihat juga [docs/DATABASE.md](docs/DATABASE.md).
