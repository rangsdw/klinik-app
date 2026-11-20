-- AlterTable
ALTER TABLE `appointments` ADD COLUMN `schedule_id` VARCHAR(191) NULL,
    MODIFY `queue_number` INTEGER NULL;

-- CreateIndex
CREATE INDEX `appointments_schedule_id_appointment_date_idx` ON `appointments`(`schedule_id`, `appointment_date`);

-- AddForeignKey
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `doctor_schedules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
