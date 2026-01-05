-- CreateEnum
CREATE TYPE "ProfileType" AS ENUM ('Default', 'Discussions', 'LogEvents', 'RecentChanges');

-- CreateTable
CREATE TABLE "Profile" (
    "avatar" VARCHAR(255),
    "color" INTEGER DEFAULT 44225,
    "name" VARCHAR(255),
    "type" "ProfileType" NOT NULL,
    "configurationGuild" VARCHAR(255) NOT NULL,
    "configurationWiki" VARCHAR(255) NOT NULL
);

-- CreateTable
CREATE TABLE "Configurations" (
    "channel" VARCHAR(255) NOT NULL,
    "guild" VARCHAR(255) NOT NULL,
    "wiki" VARCHAR(255) NOT NULL,
    "guildSnowflake" VARCHAR(255),

    CONSTRAINT "Configurations_pkey" PRIMARY KEY ("guild","wiki")
);

-- CreateTable
CREATE TABLE "Guilds" (
    "limit" INTEGER DEFAULT 1,
    "snowflake" VARCHAR(255) NOT NULL,

    CONSTRAINT "Guilds_pkey" PRIMARY KEY ("snowflake")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_configurationGuild_configurationWiki_type_key" ON "Profile"("configurationGuild", "configurationWiki", "type");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_configurationGuild_configurationWiki_fkey" FOREIGN KEY ("configurationGuild", "configurationWiki") REFERENCES "Configurations"("guild", "wiki") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Configurations" ADD CONSTRAINT "Configurations_guildSnowflake_fkey" FOREIGN KEY ("guildSnowflake") REFERENCES "Guilds"("snowflake") ON DELETE SET NULL ON UPDATE CASCADE;
