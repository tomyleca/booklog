-- AlterTable
ALTER TABLE "Book" ADD COLUMN "finishedAt" DATETIME;

-- Backfill (editado a mano, feature #20): los libros que ya estaban terminados
-- toman como fecha de terminado su ultima actualizacion
UPDATE "Book" SET "finishedAt" = "updatedAt" WHERE "status" = 'FINISHED' AND "finishedAt" IS NULL;
