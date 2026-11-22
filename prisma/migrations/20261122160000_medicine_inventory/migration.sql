ALTER TABLE `medicines` ADD COLUMN `minimum_stock` INTEGER NOT NULL DEFAULT 10;
CREATE TABLE `medicine_batches` (
 `id` VARCHAR(191) NOT NULL,
 `medicine_id` VARCHAR(191) NOT NULL,
 `batch_number` VARCHAR(100) NOT NULL,
 `expiry_date` DATE NOT NULL,
 `quantity` INTEGER NOT NULL DEFAULT 0,
 `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (`id`),
 UNIQUE INDEX `medicine_batches_medicine_id_batch_number_key` (`medicine_id`, `batch_number`),
 INDEX `medicine_batches_medicine_id_expiry_date_idx` (`medicine_id`, `expiry_date`),
 CONSTRAINT `medicine_batches_medicine_id_fkey` FOREIGN KEY (`medicine_id`) REFERENCES `medicines` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `stock_logs` (
 `id` VARCHAR(191) NOT NULL,
 `medicine_id` VARCHAR(191) NOT NULL,
 `batch_id` VARCHAR(191) NOT NULL,
 `type` ENUM('IN','OUT') NOT NULL,
 `quantity` INTEGER NOT NULL,
 `balance_after` INTEGER NOT NULL,
 `note` VARCHAR(255) NULL,
 `actor_id` VARCHAR(191) NOT NULL,
 `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (`id`),
 INDEX `stock_logs_medicine_id_created_at_idx` (`medicine_id`, `created_at`),
 INDEX `stock_logs_batch_id_idx` (`batch_id`),
 CONSTRAINT `stock_logs_medicine_id_fkey` FOREIGN KEY (`medicine_id`) REFERENCES `medicines` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT `stock_logs_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `medicine_batches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Migrasi stok sebelum fitur batch: diberi batch LEGACY dan tanggal kedaluwarsa
-- sementara agar stok lama tidak hilang. WAJIB verifikasi tanggal aktual sebelum dipakai.
INSERT INTO `medicine_batches` (`id`, `medicine_id`, `batch_number`, `expiry_date`, `quantity`, `received_at`)
SELECT CONCAT('legacy-', `id`), `id`, 'LEGACY-PERLU-VERIFIKASI', '2099-12-31', `stock`, NOW(3)
FROM `medicines` WHERE `stock` > 0;
