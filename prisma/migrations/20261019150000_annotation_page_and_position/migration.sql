-- Feature #23: la ubicacion guarda pagina y posicion a la vez (ambas opcionales).
-- No destructiva: la ubicacion vieja (locationKind + locationStart/End) se copia a las
-- columnas de pagina o de posicion segun su tipo.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Highlight" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bookId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "positionStart" INTEGER,
    "positionEnd" INTEGER,
    "capturedAt" DATETIME,
    "fingerprint" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Highlight_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Highlight" ("bookId", "capturedAt", "content", "createdAt", "fingerprint", "id", "pageStart", "pageEnd", "positionStart", "positionEnd") SELECT "bookId", "capturedAt", "content", "createdAt", "fingerprint", "id", CASE WHEN "locationKind" = 'PAGE' THEN "locationStart" END, CASE WHEN "locationKind" = 'PAGE' THEN "locationEnd" END, CASE WHEN "locationKind" = 'LOCATION' THEN "locationStart" END, CASE WHEN "locationKind" = 'LOCATION' THEN "locationEnd" END FROM "Highlight";
DROP TABLE "Highlight";
ALTER TABLE "new_Highlight" RENAME TO "Highlight";
CREATE UNIQUE INDEX "Highlight_bookId_fingerprint_key" ON "Highlight"("bookId", "fingerprint");
CREATE TABLE "new_Note" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bookId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'MANUAL',
    "highlightId" INTEGER,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "positionStart" INTEGER,
    "positionEnd" INTEGER,
    "capturedAt" DATETIME,
    "fingerprint" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Note_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Note_highlightId_fkey" FOREIGN KEY ("highlightId") REFERENCES "Highlight" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Note" ("bookId", "capturedAt", "content", "createdAt", "fingerprint", "highlightId", "id", "origin", "updatedAt", "pageStart", "pageEnd", "positionStart", "positionEnd") SELECT "bookId", "capturedAt", "content", "createdAt", "fingerprint", "highlightId", "id", "origin", "updatedAt", CASE WHEN "locationKind" = 'PAGE' THEN "locationStart" END, CASE WHEN "locationKind" = 'PAGE' THEN "locationEnd" END, CASE WHEN "locationKind" = 'LOCATION' THEN "locationStart" END, CASE WHEN "locationKind" = 'LOCATION' THEN "locationEnd" END FROM "Note";
DROP TABLE "Note";
ALTER TABLE "new_Note" RENAME TO "Note";
CREATE INDEX "Note_highlightId_idx" ON "Note"("highlightId");
CREATE UNIQUE INDEX "Note_bookId_fingerprint_key" ON "Note"("bookId", "fingerprint");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

