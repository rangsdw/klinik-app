-- AlterTable
ALTER TABLE `appointments` ADD COLUMN `checked_in_at` DATETIME(3) NULL,
    ADD COLUMN `checked_in_by_user_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `appointments_doctor_id_appointment_date_status_idx` ON `appointments`(`doctor_id`, `appointment_date`, `status`);
