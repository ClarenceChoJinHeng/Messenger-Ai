-- AlterTable
ALTER TABLE `message` ADD COLUMN `attachmentFile` VARCHAR(191) NULL,
    ADD COLUMN `attachmentMime` VARCHAR(191) NULL,
    ADD COLUMN `attachmentSize` INTEGER NULL,
    ADD COLUMN `readAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `theme` VARCHAR(191) NOT NULL DEFAULT 'grey',
    ADD COLUMN `tokenVersion` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `PendingChange` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `newValue` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PendingChange_tokenHash_key`(`tokenHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Message_receiverId_readAt_idx` ON `Message`(`receiverId`, `readAt`);

-- AddForeignKey
ALTER TABLE `PendingChange` ADD CONSTRAINT `PendingChange_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
