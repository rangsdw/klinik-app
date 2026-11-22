# Modul Inventaris Farmasi — Axel (tahap 2)

Tambahan: CRUD master obat (hapus = nonaktif agar riwayat resep tetap aman), kategori, satuan, harga, minimum stok; batch masuk; FEFO pada dispensing; alert stok menipis / kedaluwarsa; kartu stok.

## Cara menggabungkan ke branch feature/farmasi

1. Backup database MySQL lokal. Pastikan database bukan data pasien nyata/produksi.
2. Dalam clone GitHub (`klinik-app-github`), jalankan `git switch feature/farmasi`, `git fetch origin`, lalu `git merge origin/develop`. Jika muncul konflik, selesaikan bersama tim sebelum melanjutkan.
3. Ekstrak ZIP perubahan ke root project clone GitHub **dengan mempertahankan hierarki folder** (jangan salin `.env` atau `node_modules`). Disarankan lakukan pada clone cadangan terlebih dahulu.
4. `npm.cmd ci` (jika dependency belum terinstal), lalu `npx.cmd prisma generate`.
5. Pada database lokal yang sesuai `.env`, jalankan `npx.cmd prisma migrate dev` dan pastikan migrasi `20261122160000_medicine_inventory` berjalan. Jangan gunakan `migrate reset` pada data yang ingin disimpan.
6. `npm.cmd run typecheck` dan `npm.cmd run dev`.
7. Login staf farmasi, buka `/staf/farmasi/obat`.
8. `git status`, review `git diff`, `git add prisma/schema.prisma prisma/migrations/20261122160000_medicine_inventory src/features/pharmacy src/app/'(app)'/staf/farmasi PANDUAN-INVENTARIS-AXEL.md`, lalu commit dan push.

## Penting: stok awal dan kedaluwarsa

Migrasi mempertahankan stok total sebelumnya dan memasukkan stok lama ke batch `LEGACY-PERLU-VERIFIKASI` dengan tanggal placeholder 2099-12-31. **Ini bukan tanggal kedaluwarsa sebenarnya.** Stok lama tidak boleh digunakan dalam dispensing sampai diverifikasi dan direkonsiliasi dengan batch fisik. Saat ini belum ada UI rekonsiliasi stok lama, jadi untuk pengujian FEFO gunakan master obat baru dan terima stok batch baru. Jangan memasukkan ulang stok lama tanpa mengoreksi saldo agar tidak menggandakan persediaan.

## Pengujian manual

- Buat obat baru. Edit harga/kategori dan atur ambang stok minimum.
- Tambah dua batch dengan tanggal kedaluwarsa berbeda dan jumlah stok berbeda. Pastikan stok total adalah jumlah keduanya.
- Buat e-resep di dokter untuk obat tersebut, selesaikan pemeriksaan, proses farmasi sampai DISPENSED. Periksa batch lebih dahulu kedaluwarsa terpotong pertama.
- Periksa kartu stok: penerimaan = IN, penyerahan = OUT.
- Pastikan batch kedaluwarsa tidak dikeluarkan, obat nonaktif tidak dapat diserahkan, stok kurang menolak dispensing.
- Uji pembatasan akses dari akun non-farmasi.

## Batasan

Kode disiapkan berdasarkan source ZIP yang diunggah, bukan hasil checkout terbaru dari branch `develop` saat ini. Belum teruji terhadap database MySQL dan npm/TypeScript pada mesin ini karena instalasi dependency tidak dapat diselesaikan. Verifikasi di VS Code lokal sebelum merge. Belum mencakup modul kasir dan auto-billing.
