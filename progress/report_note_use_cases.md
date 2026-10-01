# Reporte de Implementación: Feature #6 - Casos de Uso de Notas (`use_cases_notes`)

## 1. Resumen Ejecutivo
Se implementó de manera completa la Feature #6 correspondiente a los Casos de Uso de Notas (`AddNote`, `GetBookNotes`, `UpdateNote`, `DeleteNote`) y se adaptó el modelo de datos y de dominio según las reglas acordadas con el usuario:
- Las notas representan reflexiones e ideas del lector, por lo que **no llevan número de página (`page`)**.
- Se removió el campo `page` del esquema de base de datos SQLite y de la entidad de dominio `Note`.
- Si se intenta consultar o agregar notas para un libro inexistente, se lanza `BookNotFoundError`.
- Si se intenta actualizar o eliminar una nota inexistente, se lanza `NoteNotFoundError`.

---

## 2. Modificaciones y Archivos Creados

### A. Persistencia y Base de Datos
- `prisma/schema.prisma`: Se eliminó el campo `page Int?` del modelo `Note`.
- `prisma/migrations/20261001000502_remove_note_page/migration.sql`: Migración generada y aplicada con `prisma migrate dev`.
- `src/shared/infrastructure/persistence/mappers/NoteMapper.ts`: Se removió el mapeo de `page` en `toDomain` y `toPersistence`.
- Actualización de tests de infraestructura (`test_prisma_connection.test.ts`, `test_book_repository.test.ts`, `test_note_repository.test.ts`, `test_mappers.test.ts`).

### B. Capa de Dominio
- `src/shared/domain/entities/Note.ts`: Se eliminó `page` de `NoteProps`, `NotePrimitives`, constructor, serializadores `toPrimitives()` / `fromPrimitives()` y se removieron los métodos `updatePage()` y `validatePage()`.
- `tests/domain/test_note_entity.test.ts`: Actualizados los tests unitarios eliminando las validaciones y mutaciones asociadas a `page`.
- `tests/domain/test_book_entity.test.ts`: Actualizados los tests de serialización con notas embebidas.

### C. Capa de Aplicación
- `src/shared/application/errors/NoteNotFoundError.ts`: Error tipado con propiedad `noteId: number`.
- `src/shared/application/errors/index.ts`: Re-export de `NoteNotFoundError`.
- `src/shared/application/use-cases/AddNote.ts`: Valida existencia del libro mediante `BookRepository.findById` (lanza `BookNotFoundError` si no existe). Valida invariante de contenido, crea y persiste la entidad `Note`.
- `src/shared/application/use-cases/GetBookNotes.ts`: Valida existencia del libro (lanza `BookNotFoundError` si no existe) y obtiene las notas ordenadas cronológicamente (`createdAt ASC`).
- `src/shared/application/use-cases/UpdateNote.ts`: Valida existencia de la nota en `NoteRepository` (lanza `NoteNotFoundError` si no existe), actualiza el contenido y persiste los cambios.
- `src/shared/application/use-cases/DeleteNote.ts`: Valida existencia de la nota en `NoteRepository` (lanza `NoteNotFoundError` si no existe) y elimina la nota.
- `src/shared/application/use-cases/index.ts`: Exportación de los 4 casos de uso y sus DTOs.
- `tests/application/test_note_use_cases.test.ts`: 11 pruebas unitarias cubriendo casos de éxito, validaciones de invariantes de dominio (`InvalidNoteError`) y excepciones de aplicación (`BookNotFoundError`, `NoteNotFoundError`) usando mocks en memoria.

### D. Documentación Técnica
- `docs/decisions/006-use-cases-notes.md`: ADR detallando la decisión del modelo conceptual de notas sin página física, manejo de excepciones y validación de libro padre.
- `docs/guides/notes-use-cases.md`: Guía técnica con diagramas Mermaid de secuencia y arquitectura.
- `docs/guides/README.md`: Incorporación de la guía al índice general.

---

## 3. Verificación de Calidad

- **Tests Vitest (`pnpm test`):**
  - 9 suites ejecutadas, **92 tests pasados exitosamente** (0 fallas).
  - Incluye tests unitarios de dominio, infraestructura SQLite en memoria/aislada y casos de uso con mocks.
- **Typecheck (`pnpm run typecheck`):**
  - `tsc --noEmit` en entornos Node y Web ejecutado sin errores (0 errores de tipado).
  - Todos los imports locales en TypeScript utilizan la extensión `.js` estricta.
- **Linter (`pnpm run lint`):**
  - ESLint ejecutado sin advertencias ni errores de estilo (0 errores).
