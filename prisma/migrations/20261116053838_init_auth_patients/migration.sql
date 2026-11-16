-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('ADMIN', 'DOCTOR', 'STAFF', 'PATIENT') NOT NULL DEFAULT 'PATIENT',
    `staff_type` ENUM('REGISTRATION', 'PHARMACY', 'CASHIER') NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `email_verified_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_phone_key`(`phone`),
    INDEX `users_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `token_hash` VARCHAR(128) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `password_reset_tokens_token_hash_key`(`token_hash`),
    INDEX `password_reset_tokens_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `counters` (
    `key` VARCHAR(64) NOT NULL,
    `value` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `patients` (
    `id` VARCHAR(191) NOT NULL,
    `account_user_id` VARCHAR(191) NOT NULL,
    `medical_record_number` VARCHAR(20) NOT NULL,
    `nik` CHAR(16) NULL,
    `name` VARCHAR(120) NOT NULL,
    `birth_date` DATE NOT NULL,
    `gender` ENUM('MALE', 'FEMALE') NOT NULL,
    `blood_type` ENUM('A', 'B', 'AB', 'O') NULL,
    `phone` VARCHAR(20) NULL,
    `address` TEXT NULL,
    `relationship` ENUM('SELF', 'SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER') NOT NULL,
    `allergies` TEXT NULL,
    `special_conditions` TEXT NULL,
    `qr_token` VARCHAR(64) NOT NULL,
    `is_self` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `patients_medical_record_number_key`(`medical_record_number`),
    UNIQUE INDEX `patients_nik_key`(`nik`),
    UNIQUE INDEX `patients_qr_token_key`(`qr_token`),
    INDEX `patients_account_user_id_idx`(`account_user_id`),
    INDEX `patients_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `patients` ADD CONSTRAINT `patients_account_user_id_fkey` FOREIGN KEY (`account_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
