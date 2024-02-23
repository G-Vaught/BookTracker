/*
  Warnings:

  - A unique constraint covering the columns `[userId,guildId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "User_userId_guildId_key" ON "User"("userId", "guildId");
