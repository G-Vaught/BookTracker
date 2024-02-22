/*
  Warnings:

  - You are about to drop the `ProgressType` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `progressTypeId` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the column `profileUrl` on the `User` table. All the data in the column will be lost.
  - Added the required column `progressType` to the `Book` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedDate` to the `Book` table without a default value. This is not possible if the table is not empty.
  - Added the required column `isFirstLookup` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `isUserFriends` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storygraphUsername` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedDate` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ProgressType_type_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ProgressType";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Book" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "inProgress" BOOLEAN NOT NULL,
    "isComplete" BOOLEAN NOT NULL,
    "progressAmount" INTEGER NOT NULL,
    "progressType" TEXT NOT NULL,
    "userId" TEXT,
    "creationDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" DATETIME NOT NULL,
    CONSTRAINT "Book_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Book" ("id", "inProgress", "isComplete", "progressAmount", "url", "userId") SELECT "id", "inProgress", "isComplete", "progressAmount", "url", "userId" FROM "Book";
DROP TABLE "Book";
ALTER TABLE "new_Book" RENAME TO "Book";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "storygraphUsername" TEXT NOT NULL,
    "isUserFriends" BOOLEAN NOT NULL,
    "isFirstLookup" BOOLEAN NOT NULL,
    "creationDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" DATETIME NOT NULL
);
INSERT INTO "new_User" ("guildId", "id", "userId") SELECT "guildId", "id", "userId" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
