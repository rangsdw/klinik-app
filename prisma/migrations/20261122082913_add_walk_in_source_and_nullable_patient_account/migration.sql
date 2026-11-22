-- AlterTable
ALTER TABLE `appointments` ADD COLUMN `source` ENUM('ONLINE', 'WALK_IN') NOT NULL DEFAULT 'ONLINE';

-- AlterTable
ALTER TABLE `patients` ADD COLUMN `created_by_user_id` VARCHAR(191) NULL,
    MODIFY `account_user_id` VARCHAR(191) NULL;
