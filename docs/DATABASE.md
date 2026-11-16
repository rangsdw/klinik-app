# Database

MySQL 8, dikelola Prisma (`prisma/schema.prisma` adalah sumber kebenaran; ERD final mengikuti file ini). Charset `utf8mb4`, collation `utf8mb4_unicode_ci`. Model PascalCase, kolom camelCase di kode, tabel dan kolom snake_case di MySQL (`@@map` / `@map`).

Perbarui dokumen ini setiap kali modul menambah atau mengubah tabel.

## Enum

| Enum           | Nilai                                       |
| -------------- | ------------------------------------------- |
| `Role`         | ADMIN, DOCTOR, STAFF, PATIENT               |
| `StaffType`    | REGISTRATION, PHARMACY, CASHIER             |
| `Gender`       | MALE, FEMALE                                |
| `Relationship` | SELF, SPOUSE, CHILD, PARENT, SIBLING, OTHER |
| `BloodType`    | A, B, AB, O                                 |

## Tabel (Tahap 1 & 2, Rangga)

### `users` (User)

Akun login untuk semua role.

| Kolom                  | Tipe           | Catatan                                                                       |
| ---------------------- | -------------- | ----------------------------------------------------------------------------- |
| id                     | varchar (cuid) | PK                                                                            |
| name                   | varchar(120)   |                                                                               |
| email                  | varchar(191)   | unik, disimpan lowercase                                                      |
| phone                  | varchar(20)    | unik, nullable, format 08xx                                                   |
| password_hash          | varchar(255)   | bcrypt cost 12, tidak pernah dikirim ke klien                                 |
| role                   | enum Role      | default PATIENT, index                                                        |
| staff_type             | enum StaffType | nullable; wajib bila role = STAFF (divalidasi di `features/users/service.ts`) |
| is_active              | boolean        | default true; dicek ulang di server setiap request area login                 |
| email_verified_at      | datetime       | nullable (verifikasi email opsional, default mati)                            |
| created_at, updated_at | datetime       |                                                                               |

### `patients` (Patient)

Satu baris = satu orang pasien dengan rekam medis dan QR sendiri. Satu akun (User PATIENT) punya banyak pasien (akun keluarga, maks. 10 aktif).

| Kolom                  | Tipe              | Catatan                                                                                      |
| ---------------------- | ----------------- | -------------------------------------------------------------------------------------------- |
| id                     | varchar (cuid)    | PK                                                                                           |
| account_user_id        | varchar           | FK ke `users.id` (cascade), index                                                            |
| medical_record_number  | varchar(20)       | unik, format `RM-YYYY-000001`                                                                |
| nik                    | char(16)          | unik bila diisi, nullable                                                                    |
| name                   | varchar(120)      | index, Title Case                                                                            |
| birth_date             | date              |                                                                                              |
| gender                 | enum Gender       |                                                                                              |
| blood_type             | enum BloodType    | nullable                                                                                     |
| phone                  | varchar(20)       | nullable                                                                                     |
| address                | text              | nullable                                                                                     |
| relationship           | enum Relationship | SELF hanya untuk pasien pemilik akun                                                         |
| allergies              | text              | nullable, dipakai Red Flag modul dokter (Ravy)                                               |
| special_conditions     | text              | nullable (asma, hipertensi, ...)                                                             |
| qr_token               | varchar(64)       | unik, UUID acak; gambar QR di Tahap 4                                                        |
| is_self                | boolean           | pasien pemilik akun (tidak bisa dihapus)                                                     |
| deleted_at             | datetime          | soft delete; semua query menyaring `deleted_at IS NULL` lewat `features/patients/queries.ts` |
| created_at, updated_at | datetime          |                                                                                              |

### `password_reset_tokens` (PasswordResetToken)

| Kolom      | Tipe           | Catatan                                                  |
| ---------- | -------------- | -------------------------------------------------------- |
| id         | varchar (cuid) | PK                                                       |
| user_id    | varchar        | FK ke `users.id` (cascade), index                        |
| token_hash | varchar(128)   | unik, SHA-256 dari token (token asli hanya ada di email) |
| expires_at | datetime       | 60 menit setelah dibuat                                  |
| used_at    | datetime       | nullable; token sekali pakai                             |
| created_at | datetime       |                                                          |

### `counters` (Counter)

Penghitung atomik. Key `rm-<tahun>` untuk nomor rekam medis per tahun (zona Asia/Jakarta).

| Kolom | Tipe        | Catatan |
| ----- | ----------- | ------- |
| key   | varchar(64) | PK      |
| value | int         |         |

Nomor RM dibuat di `src/features/patients/mrn.ts` dengan satu statement `INSERT ... ON DUPLICATE KEY UPDATE value = value + 1` di dalam transaksi pembuatan pasien, lalu nilainya dibaca di transaksi yang sama. Aman dipanggil paralel (diuji di `tests/unit/patients.db.test.ts`).

## Blok modul berikutnya

`prisma/schema.prisma` sudah punya blok bertanda untuk:

- Jadwal, appointment, antrean (Rangga, Tahap 3 & 4)
- Rekam medis (Ravy)
- Obat, farmasi, kasir (Axel)

Tambahkan model di blok masing-masing, buat migrasi baru (`npm run db:migrate`), dan jangan mengedit migrasi yang sudah di-merge.
