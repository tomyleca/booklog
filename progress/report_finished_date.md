# Reporte implementer — Feature #20 `finished_date`

> Transcripto por el leader desde el mensaje de entrega del implementer
> (el entorno no le permitió escribir este archivo).

Estado: ready-for-review (`in_progress`, sin commits).

## Verificación (según implementer)
`.\init.ps1` OK (29 archivos, 489 tests). `pnpm typecheck`, `pnpm lint:check`, `pnpm build` OK.

## Base de datos
- `prisma/schema.prisma`: `finishedAt DateTime?` en `Book`.
- Migración `prisma/migrations/20261017212053_add_book_finished_at/migration.sql` (generada con `--create-only`) + backfill manual: `UPDATE "Book" SET "finishedAt" = "updatedAt" WHERE "status" = 'FINISHED' AND "finishedAt" IS NULL;`. Aplicada a `prisma/dev.db` con `pnpm prisma migrate dev` (sin reset). Backup previo de dev.db en el scratchpad. Resultado: id 2 (FINISHED) con finishedAt = updatedAt, id 1 (READING) null.
- Quedó `prisma/dev.db-journal` (header en cero, ignorado por git).

## Por capa
- Dominio: nuevo `src/shared/domain/entities/CalendarDate.ts` (día = Date a las 12:00 locales, viaja como `YYYY-MM-DD`; `todayIsoDate`, `isAfterToday` por día calendario). `Book.ts`: `finishedAt`, `Book.parseFinishedDate`, `updateStatus(status, finishedAt?)` (FINISHED sin fecha → hoy; salir de FINISHED conserva; reaplicar FINISHED sin fecha conserva; con fecha sobrescribe), `setFinishedDate` (solo FINISHED). `DomainErrors.ts`: `InvalidFinishedDateError`, `FutureFinishedDateError` → IPC `VALIDATION_ERROR`.
- Persistencia: `BookMapper.ts` mapea `finishedAt`.
- Aplicación: `AddBook` y `UpdateBookStatus` aceptan `finishedAt?: 'YYYY-MM-DD'`; nuevo `SetFinishedDate.ts`; `UpdateBookProgress` sin cambios (el dominio asigna hoy al 100%).
- IPC: canal `books:setFinishedDate` + `SetFinishedDateDTO`, handler, preload; `bookService.setFinishedDate` y tercer parámetro opcional en `updateStatus`.
- UI: `components/FinishedDateField.tsx` (input date, max = hoy), `components/finishedDate.ts` (default, validación, formato es-AR). AddBookModal (`input-book-finished-date`), UpdateProgressModal (`modal-finished-date-input`, form `noValidate`), Detalle (confirmación `detail-confirm-finish` al elegir Terminado; "Terminado el dd/mm/aaaa" + "Editar fecha"), BookCard (`book-finished-date` solo FINISHED), Dashboard (sección `finished-timeline`: año, mes, recientes por finishedAt, máx 5; solo libros FINISHED).

## Tests
Nuevos: `tests/domain/test_finished_date.test.ts`, `tests/application/test_finished_date_use_cases.test.ts`, `tests/infrastructure/test_finished_date_persistence.test.ts` (migraciones previas + datos viejos + nueva migración → backfill), `tests/ipc/test_finished_date_ipc.test.ts`, `tests/renderer/test_finished_date_ui.test.ts`. Ajustados: `test_book_entity`, `test_book_detail_page`, `test_progress_and_notes_modals`.

## Docs
`docs/decisions/020-finished-date.md` (incluye por qué no `toISOString`: en UTC−3 después de las 21 da el día siguiente); `docs/guides/prisma-sqlite-setup.md` §6 (migraciones con backfill, Mermaid).

## Decisiones menores
- `setFinishedDate` y `updateStatus(no-FINISHED, fecha)` dan error.
- `AddBook` ignora `finishedAt` si el estado no es FINISHED.
- Si en UpdateProgressModal se destilda el checkbox al 100%, el backend ya había autocompletado: `finishedAt` queda con hoy, no se muestra ni cuenta mientras no esté FINISHED, y se sobrescribe al volver a terminar.
- Los migrados conservan la hora exacta de `updatedAt`.

## Problema preexistente
La app empaquetada usa `userData/booklog.db` y no aplica migraciones al arrancar; con la columna nueva, la app instalada fallará hasta migrar esa base. En dev se usa `prisma/dev.db`, ya migrada.
