-- AlterTable
ALTER TABLE `appointments` ADD COLUMN `reschedule_note` TEXT NULL,
    ADD COLUMN `rescheduled_at` DATETIME(3) NULL;
