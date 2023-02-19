/*
  Warnings:

  - The primary key for the `Profile` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Made the column `type` on table `Profile` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `Profile` DROP PRIMARY KEY,
    MODIFY `type` ENUM('Default', 'Discussions', 'LogEvents', 'RecentChanges') NOT NULL DEFAULT 'Default',
    ADD PRIMARY KEY (`configurationGuild`, `configurationWiki`, `type`);
