/*
  Warnings:

  - You are about to drop the column `inProgress` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the column `isComplete` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the column `progressAmount` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the column `progressType` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `Book` table. All the data in the column will be lost.
  - Added the required column `title` to the `Book` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Book" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "userId" TEXT,
    "creationDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" DATETIME NOT NULL,
    CONSTRAINT "Book_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Book" ("creationDate", "id", "updatedDate", "userId") SELECT "creationDate", "id", "updatedDate", "userId" FROM "Book";
DROP TABLE "Book";
ALTER TABLE "new_Book" RENAME TO "Book";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
