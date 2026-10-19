# Review — feature 22 (highlights_and_note_origin)

**Veredicto:** APPROVED

## Verificación
- pnpm test: 37 archivos, 577 tests, todos en verde.
- typecheck, lint y prisma: re-ejecutados porque el diff toca `prisma/schema.prisma`. `pnpm typecheck` (node y web) exit 0, `pnpm lint:check` sin errores y `prisma validate` OK. `pnpm build` se toma del informe del implementer (exit 0).

## Puntos pedidos por el leader
- **Migración no destructiva:** `migration.sql` recrea `Note` con `INSERT ... SELECT` de todas las columnas previas, y `origin` toma `DEFAULT 'MANUAL'`. El FK `Note.highlightId` tiene `ON DELETE SET NULL` y `Highlight.bookId` tiene `ON DELETE CASCADE`. Hay índice único `Highlight_bookId_fingerprint_key` y `Note_bookId_fingerprint_key` (este último admite varios NULL, cubierto por un test). Lo cubre `tests/infrastructure/test_highlight_persistence.test.ts:76-116` (notas existentes quedan MANUAL), `:228` (SET NULL) y `:254` (cascada).
- **Dominio puro:** `src/shared/domain` y `src/shared/application` no importan `@prisma/client`, `electron` ni `react`. Los use cases reciben los ports por constructor.
- **Listo para #23:** `AnnotationLocation` (PAGE o LOCATION, inicio y fin opcional, normaliza `N-N`), `capturedAt` nullable, `fingerprint` obligatoria en Highlight y en notas KINDLE, `Note.createImported` con `highlightId`, y `locationLastPoint` para el vínculo nota→subrayado.
- **UI:** "Mis notas" (`data-testid="my-notes-section"`, etiqueta Kindle, ubicación, "Sobre un subrayado") y "Subrayados" (`HighlightsSection`: cita, ubicación, fecha y notas vinculadas debajo vía `groupNotesByHighlight`). Los `data-testid` previos y "+ Nueva Idea" se conservan, y `test_book_detail_page` sigue en verde.
- **Tokens de color:** `HighlightsSection.tsx` y `BookDetailPage.tsx` no usan clases de paleta cruda (red/gray/etc.), solo `ink`, `accent`, `rule`, `danger`, `shelf`, `well` y `card`.
- **Docs:** guía `docs/guides/annotations-model.md` (Mermaid de clases, ER y secuencia) y ADR `docs/decisions/022-highlights-and-note-origin.md`.

## Checkpoints
- C1: [x] (no se re-ejecutó init.ps1; el informe lo muestra en OK)
- C2: [x] tras el cierre: una sola feature en curso, que pasa a done, y current.md vuelve a la plantilla.
- C3: [x]
- C4: [x] Hay tests por capa (domain, application, infrastructure con SQLite real, ipc y renderer). Build OK según el informe.
- C5: [x] No hay archivos sospechosos sin trackear. La entrada se agregó a history.md.

## Cambios requeridos (solo bloqueantes)
Ninguno.

## Notas no bloqueantes
- `prisma/schema.prisma`: el diff incluye un realineado de columnas en `Book` (lo hizo `prisma format`). Es ruido en el diff, pero inocuo.
- `BookDetailPage.tsx`: la etiqueta "Sobre un subrayado" solo aparece cuando la query de subrayados ya cargó. Si esa query falla, la etiqueta no se muestra aunque `highlightId` exista. Se acepta.
- El modal de borrar libro sigue diciendo "Se eliminarán también todas sus notas." sin mencionar los subrayados. Se puede ajustar junto con su test en #23.
