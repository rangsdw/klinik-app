ALTER TABLE `medical_records`
  ADD COLUMN `pharmacy_status` ENUM('WAITING','PROCESSING','READY','DISPENSED') NOT NULL DEFAULT 'WAITING',
  ADD COLUMN `pharmacy_received_at` DATETIME(3) NULL,
  ADD COLUMN `pharmacy_ready_at` DATETIME(3) NULL,
  ADD COLUMN `pharmacy_dispensed_at` DATETIME(3) NULL,
  ADD COLUMN `pharmacy_dispensed_by` VARCHAR(191) NULL;
