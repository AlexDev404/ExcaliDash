/*
  Warnings:

  - Added the required column `userId` to the `Collection` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Drawing` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Collection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Collection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Collection" ("createdAt", "id", "name", "updatedAt") SELECT "createdAt", "id", "name", "updatedAt" FROM "Collection";
DROP TABLE "Collection";
ALTER TABLE "new_Collection" RENAME TO "Collection";
CREATE TABLE "new_Drawing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "elements" TEXT NOT NULL,
    "appState" TEXT NOT NULL,
    "files" TEXT NOT NULL DEFAULT '{}',
    "preview" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "userId" TEXT NOT NULL,
    "collectionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Drawing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Drawing_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Drawing" ("appState", "collectionId", "createdAt", "elements", "files", "id", "name", "preview", "updatedAt", "version") SELECT "appState", "collectionId", "createdAt", "elements", "files", "id", "name", "preview", "updatedAt", "version" FROM "Drawing";
DROP TABLE "Drawing";
ALTER TABLE "new_Drawing" RENAME TO "Drawing";
CREATE TABLE "new_Library" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "items" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Library" ("createdAt", "id", "items", "updatedAt") SELECT "createdAt", "id", "items", "updatedAt" FROM "Library";
DROP TABLE "Library";
ALTER TABLE "new_Library" RENAME TO "Library";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
