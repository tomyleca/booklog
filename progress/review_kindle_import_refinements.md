# Review — feature 25 (kindle_import_refinements)

**Veredicto:** APPROVED

## Verificación
- pnpm test: 46 archivos, 689 tests en verde (re-ejecutado por el reviewer).
- typecheck/lint/build: tomados del informe del implementer (lint:check exit 0, build OK). El diff no toca configuración.
- Informe: sección "Reporte #25" de `progress/current.md`, porque el entorno no dejó crear `report_kindle_import_refinements.md`.

## Criterios de aceptación
- Una nota por ubicación, la más reciente: `keepLatestNotePerLocation` en `src/shared/domain/services/kindle/resolveKindleAnnotations.ts` agrupa por `noteLocationKey` (`pos:` si hay posición, si no `page:`, si no `entry:<index>`) y conserva la más reciente según `isNewer` (fecha y, a igual fecha, orden en el archivo). Mantiene el orden del archivo. [x]
- Vínculo nota→subrayado: se calcula sobre `finalNotes`, la nota que queda. Hay tests de dominio en el describe "Feature #25 — one Kindle note per location". [x]
- Huella estable: `kindleFingerprint` y `kindle-v1` no cambian. El test de use cases que reimporta da `notesSkipped: 4` y no duplica. [x]
- Notas KINDLE ya guardadas intactas: `CommitKindleImport` no cambia. El test nuevo "should keep KINDLE notes saved before (#25) and only add the newest one" lo comprueba. [x]
- Orden de la vista previa: `sortKindleGroups` es pura y ordena una copia. Por defecto usa `HIGHLIGHTS` desc; también ofrece notas desc, fecha desc (sin fecha al final) y título A-Z. La selección sigue indexada por `group.key`, y un test de UI comprueba que reordenar no cambia las asignaciones. [x]
- "Crear libro": `AddBookModal.initialSearch` abre en la pestaña de búsqueda, carga query y autor, cancela el debounce, incrementa `searchRequestIdRef` y lanza `executeSearch` desde un efecto. Ese efecto está declarado después del reset y `executeSearch` es estable (`useCallback` con `[]`). `test_add_book_initial_search.test.ts` cubre que busca una sola vez sin debounce, que sin `initialSearch` no cambia nada y que una respuesta tardía se descarta por el requestId. `KindleImportModal` pasa `createSearch` memoizado. [x]
- Fixture anonimizado: `tests/fixtures/kindleClippings.ts` usa "Borrador de nota terminado. una pelicula, influenxiq → influenx → influencia?" y no tiene contenido real. [x]
- Tokens de color y data-testid: el selector usa `bg-card`, `border-rule`, `text-ink`, `text-ink-muted` y `accent`, sin colores literales. Los `data-testid` existentes se conservan y se suma `kindle-import-sort`. [x]
- ADR 025: `docs/decisions/025-kindle-import-refinements.md` existe. El ADR 023 indica que la decisión 2 quedó reemplazada, y la guía `kindle-clippings-import.md` está actualizada (§5, §7, §8) con Mermaid. [x]

## Checkpoints
- C1: [x] Arnés completo. `pnpm test` pasa; `init.ps1` corrió en verde según el informe.
- C2: [x] Solo la #25 estaba `in_progress`; con este cierre pasa a `done`. `current.md` queda vacío.
- C3: [x] El dominio no importa infraestructura y la lógica de orden vive en un helper del renderer. No hay `console.log` ni `any` nuevos (en `onChange` hay un solo `as KindleGroupSort` sobre el valor del `<select>`, acotado a las opciones).
- C4: [x] Hay tests por capa (domain, application, infrastructure con SQLite real, renderer). 689 tests en verde.
- C5: [x] Los archivos sin trackear son legítimos (ADR 025 y un test nuevo). Se agrega la entrada en `history.md`.

## Cambios requeridos (solo bloqueantes)
Ninguno.

## Notas no bloqueantes
- `docs/decisions/025-kindle-import-refinements.md:14`: el contexto cita textos de notas reales del usuario (`mulholland drive, influenxiq`, `Y pq es mas dificil…`). El fixture está anonimizado. Si se quiere el mismo criterio en los docs, conviene reemplazar esas citas.
- `docs/decisions/025-kindle-import-refinements.md`: el estado dice "Aceptado (pendiente de revisión)" y debería pasar a "Aceptado".
- `src/renderer/src/components/AddBookModal.tsx`: si quien lo usa pasa `initialSearch` sin memoizar, el modal se reinicia y vuelve a buscar en cada render. Está documentado en el JSDoc de la prop y `KindleImportModal` lo memoiza.
- `AddBookModal.tsx` ya fallaba `prettier --check` en HEAD, antes de este cambio, y sigue fallando.
