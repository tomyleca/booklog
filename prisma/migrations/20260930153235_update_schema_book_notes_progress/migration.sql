/*
  Warnings:

  - You are about to drop the `ReadingSession` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `notes` on the `Book` table. All the data in the column will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ReadingSession";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Note" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bookId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "page" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Note_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Book" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "googleBooksId" TEXT,
    "title" TEXT NOT NULL,
    "authors" TEXT NOT NULL,
    "coverUrl" TEXT,
    "coverPath" TEXT,
    "pageCount" INTEGER,
    "currentPage" INTEGER,
    "progressPercentage" INTEGER,
    "isbn" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TO_READ',
    "rating" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Book" ("authors", "coverUrl", "createdAt", "googleBooksId", "id", "isbn", "pageCount", "rating", "status", "title", "updatedAt") SELECT "authors", "coverUrl", "createdAt", "googleBooksId", "id", "isbn", "pageCount", "rating", "status", "title", "updatedAt" FROM "Book";
DROP TABLE "Book";
ALTER TABLE "new_Book" RENAME TO "Book";
CREATE UNIQUE INDEX "Book_googleBooksId_key" ON "Book"("googleBooksId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
