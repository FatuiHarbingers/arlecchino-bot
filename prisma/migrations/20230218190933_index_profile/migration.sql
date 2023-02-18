/*
  Warnings:

  - The primary key for the `Profile` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Profile` table. All the data in the column will be lost.
  - Made the column `configurationGuild` on table `Profile` required. This step will fail if there are existing NULL values in that column.
  - Made the column `configurationWiki` on table `Profile` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `Profile` DROP FOREIGN KEY `Profile_configurationGuild_configurationWiki_fkey`;

-- AlterTable
ALTER TABLE `Profile` DROP PRIMARY KEY,
    DROP COLUMN `id`,
    MODIFY `configurationGuild` VARCHAR(255) NOT NULL,
    MODIFY `configurationWiki` VARCHAR(255) NOT NULL,
    ADD PRIMARY KEY (`configurationGuild`, `configurationWiki`);

-- AddForeignKey
ALTER TABLE `Profile` ADD CONSTRAINT `Profile_configurationGuild_configurationWiki_fkey` FOREIGN KEY (`configurationGuild`, `configurationWiki`) REFERENCES `Configurations`(`guild`, `wiki`) ON DELETE RESTRICT ON UPDATE CASCADE;
