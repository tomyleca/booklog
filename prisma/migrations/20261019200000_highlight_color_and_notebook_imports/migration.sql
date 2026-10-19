-- AlterTable
ALTER TABLE "Highlight" ADD COLUMN "color" TEXT;

-- CreateTable
CREATE TABLE "ImportedNotebookFile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT NOT NULL,
    "modifiedAt" DATETIME NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportedNotebookFile_path_key" ON "ImportedNotebookFile"("path");

