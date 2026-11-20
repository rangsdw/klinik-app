# Modul farmasi — Axel

Project terintegrasi dari snapshot develop yang diberikan. Untuk GitHub, gunakan branch baru dari develop terbaru dan salin hanya file yang tercantum di bawah; jangan menimpa seluruh repository terbaru.

## Lokal (PowerShell)
1. Pastikan Node.js dan MySQL 8 tersedia. Buat database lokal `klinik_app`.
2. `Copy-Item .env.example .env` (jika belum ada); isi DATABASE_URL dan AUTH_SECRET (buat dengan `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).
3. `npm ci`
4. `npx prisma migrate dev` (khusus database lokal)
5. `npm run db:seed` (hanya database demo baru)
6. `npm run typecheck` dan `npm run dev`
7. Buka http://localhost:3000, login farmasi@klinik.test / password123 (demo lokal).

## Uji
- Resep dari pemeriksaan COMPLETED tampil; resep draft tidak tampil.
- Terima resep, tandai siap, cetak etiket, centang pemeriksaan dan serahkan.
- Pastikan stok turun sekali saja, stok tidak cukup membatalkan transaksi.
- Dokter tidak dapat mengubah rekam medis setelah farmasi menerima resep. Koreksi perlu koordinasi.
- Coba akses dengan akun lain; harus ditolak.

## File perubahan untuk branch Git
- prisma/schema.prisma
- prisma/migrations/20261118130000_pharmacy_workflow/migration.sql
- src/app/(app)/staf/farmasi/page.tsx
- src/features/pharmacy/actions.ts
- src/features/pharmacy/label.tsx
- src/features/doctor/actions.ts

Pemeriksaan sintaks TypeScript dilakukan; instalasi dependency belum berhasil karena cache npm tidak lengkap, sehingga typecheck penuh dan pengujian MySQL/browser belum dilakukan. Jangan gunakan untuk layanan pasien nyata tanpa validasi dan review lebih lanjut.
