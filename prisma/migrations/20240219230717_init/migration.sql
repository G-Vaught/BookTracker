-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "profileUrl" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "inProgress" BOOLEAN NOT NULL,
    "isComplete" BOOLEAN NOT NULL,
    "progressAmount" INTEGER NOT NULL,
    "progressTypeId" TEXT NOT NULL,
    "userId" TEXT,
    CONSTRAINT "Book_progressTypeId_fkey" FOREIGN KEY ("progressTypeId") REFERENCES "ProgressType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Book_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProgressType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ProgressType_type_key" ON "ProgressType"("type");
