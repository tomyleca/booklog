-- Feature #22: subrayados (Highlight) y origen de las notas.
-- No destructiva: las notas existentes se copian tal cual y toman origin = MANUAL por el DEFAULT.

-- CreateTable
CREATE TABLE "Highlight" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bookId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "locationKind" TEXT NOT NULL,
    "locationStart" INTEGER NOT NULL,
    "locationEnd" INTEGER,
    "capturedAt" DATETIME,
    "fingerprint" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Highlight_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Note" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bookId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'MANUAL',
    "highlightId" INTEGER,
    "locationKind" TEXT,
    "locationStart" INTEGER,
    "locationEnd" INTEGER,
    "capturedAt" DATETIME,
    "fingerprint" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Note_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Note_highlightId_fkey" FOREIGN KEY ("highlightId") REFERENCES "Highlight" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Note" ("bookId", "content", "createdAt", "id", "updatedAt") SELECT "bookId", "content", "createdAt", "id", "updatedAt" FROM "Note";
DROP TABLE "Note";
ALTER TABLE "new_Note" RENAME TO "Note";
CREATE INDEX "Note_highlightId_idx" ON "Note"("highlightId");
CREATE UNIQUE INDEX "Note_bookId_fingerprint_key" ON "Note"("bookId", "fingerprint");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Highlight_bookId_fingerprint_key" ON "Highlight"("bookId", "fingerprint");

