/*
  Warnings:

  - A unique constraint covering the columns `[configurationGuild,configurationWiki]` on the table `Profile` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `Profile_configurationGuild_configurationWiki_key` ON `Profile`(`configurationGuild`, `configurationWiki`);
