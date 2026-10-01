# Reporte: Actualización del Esquema de Base de Datos (Book, Note, Progreso y Offline-First)

## Resumen de Cambios

Se actualizó el esquema de base de datos de Prisma y SQLite según los nuevos requerimientos arquitectónicos del producto:

1. **Esquema Prisma (`prisma/schema.prisma`)**:
   - `enum BookStatus`: Se agregó el estado `PAUSED` (estados completos: `TO_READ`, `READING`, `PAUSED`, `FINISHED`, `ABANDONED`).
   - `model Book`:
     - Se añadió `coverPath String?` para guardar rutas locales de carátulas (`offline-first`).
     - Se añadieron `currentPage Int?` y `progressPercentage Int?` para seguimiento directo y flexible del avance.
     - Se eliminó el campo simple `notes String?` y se reemplazó por la relación 1:N `notes Note[]`.
     - Se eliminó la relación `readingSessions ReadingSession[]`.
   - `model Note`:
     - Modelo independiente con `id`, `bookId`, `content`, `page` opcional, `createdAt`, `updatedAt`.
     - Relación referencial estricta hacia `Book` con directiva `onDelete: Cascade`.
   - `model ReadingSession`:
     - Modelo removido en su totalidad.

2. **Migración de Prisma (`prisma/migrations/20260930153235_update_schema_book_notes_progress/`)**:
   - Generada y aplicada con `pnpm prisma migrate dev --name update_schema_book_notes_progress`.
   - Regenerado `@prisma/client` con los nuevos tipos.

3. **Pruebas de Integración (`tests/infrastructure/test_prisma_connection.test.ts`)**:
   - En `beforeAll`, se leen y aplican automáticamente y en orden todas las migraciones SQL presentes en `prisma/migrations` sobre SQLite en memoria/temporal (`os.tmpdir()`).
   - Cobertura de pruebas agregada y verificada:
     - Creación de `Book` con los nuevos campos (`coverPath`, `currentPage`, `progressPercentage`, status `PAUSED`).
     - Creación y consulta de `Note` vinculadas a un `Book`.
     - Verificación estricta de `ON DELETE CASCADE` de notas al eliminar un libro.
     - Verificación del índice `@unique` en `googleBooksId`.
     - Resolución dinámica de conexión de base de datos (`resolveDatabaseUrl`).
   - Todos los imports locales en TypeScript incluyen extensión `.js`.

4. **Documentación Técnica Actualizada**:
   - `docs/decisions/002-database-schema.md`: Actualizada la decisión de diseño, alternativas y diagramas Mermaid.
   - `docs/guides/prisma-sqlite-setup.md`: Actualizados diagramas de entidad-relación (ER), descripción de campos y estrategias de aislamiento.

## Verificación de Calidad

- **Tests Vitest**: 7/7 tests pasando (`pnpm test` OK).
- **TypeScript**: 0 errores en Node y Web (`pnpm run typecheck` OK).
- **ESLint**: 0 errores o advertencias (`pnpm run lint` OK).
- **Integridad de datos**: Las bases de datos de desarrollo no fueron borradas y los tests operan en entornos efímeros aislados.
