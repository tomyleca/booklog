# Review — feature 23

**Veredicto:** APPROVED

## Verificación
- pnpm test: 43 suites, 653 tests, todos en verde.
- typecheck/lint: los volví a correr porque el diff toca `prisma/schema.prisma`. `pnpm typecheck` (node + web) y `pnpm lint:check` quedaron en verde. `pnpm build` y `prisma migrate diff` (vacío) se toman del informe del implementer.

## Puntos pedidos por el leader
- **Lógica pura:** el parser, la normalización, el matching, la huella, el dedupe de subrayados, los borradores de notas y el vínculo nota→subrayado están en `src/shared/domain/services/kindle/`. Solo importan `entities/AnnotationLocation` y `rankSearchResults`. Se testean en `tests/domain/test_kindle_clippings_import.test.ts`.
- **Decisiones del usuario:**
  - `isNoteDraft` descarta prefijos y duplicados exactos en la misma ubicación (`resolveKindleAnnotations.ts:104`).
  - `findCommentedHighlight` vincula una nota si cae dentro de `[inicio, fin]`. Compara por posición y, si falta, por página. Gana el fin más cercano y, en empate, el más reciente anterior a la nota (`:127`).
  - Se guardan página y posición.
  - "— No importar —" y "+ Crear libro…" están en `KindleImportModal.tsx:330-331`.
  - El botón está en `SettingsPage.tsx`.
- **Fixtures anonimizados:** comparé la muestra real del scratchpad (2567 cuerpos) contra `tests/fixtures/kindleClippings.ts`, los 6 tests nuevos, la guía y el ADR. No aparece ningún cuerpo completo ni ninguna ventana de 40 caracteres. La comparación se hizo con un script del scratchpad que no imprime contenido.
- **Archivo real:** ningún `My Clippings*` está trackeado ni presente en el repo.
- **PowerShell:**
  - `KINDLE_COPY_SCRIPT` es constante. El destino y el timeout viajan por variables de entorno.
  - Corre con `execFile` (sin shell), `-NoProfile -NonInteractive -EncodedCommand`, `windowsHide` y un timeout de proceso (copia + margen).
  - El script tiene su propio timeout y espera la copia asíncrona de `CopyHere`: tamaño esperado o estable más apertura exclusiva.
  - La carpeta temporal se borra en `finally`.
- **Migración:** `20261019150000_annotation_page_and_position` recrea las tablas copiando la ubicación según `locationKind` y conserva ids, `highlightId`, `origin` e índices únicos. Lo cubre `test_kindle_import_persistence.test.ts:92-99`.
- **Reimportar:** `CommitKindleImport` salta las huellas que ya existen en el libro. Lo cubre `test_kindle_import_persistence.test.ts:127` con SQLite real.
- **IPC tipado:** canales en `channels.ts`, DTOs y códigos en `contracts.ts`, preload tipado. El renderer solo maneja `sourceId`; las rutas y el texto quedan en el main (`KindleImportSessionStore`).
- **UI:** se puede corregir el libro asociado, crear uno con `AddBookModal` precargado (título, autor, ISBN) mediante `onCreated`, o elegir "No importar". Al final muestra confirmación e informe. Usa solo tokens de color: no hay colores crudos en `KindleImportModal.tsx` ni en `SettingsPage.tsx`.
- **Docs:** guía `docs/guides/kindle-clippings-import.md` (4 bloques Mermaid) y ADR 023. También se actualizaron `annotations-model.md` y el ADR 022.

## Checkpoints
- C1: [x] Los archivos del arnés y los docs existen. No corrí `init.ps1`; tomo el resultado del informe.
- C2: [x] Antes del cierre la #23 era la única `in_progress`. Los tests están en verde. `current.md` describía la sesión activa y ahora vuelve a la plantilla.
- C3: [x] Las capas se respetan: domain puro, application solo importa domain y su propio `errors/`, los use cases reciben dependencias por constructor. No hay `console.log`, TODO ni `any` en los archivos nuevos.
- C4: [x] Hay tests por capa y SQLite real en infrastructure. 653 tests en verde. Build OK según el informe y typecheck re-ejecutado.
- C5: [x] No hay archivos sospechosos sin trackear. La entrada se agregó a `history.md` y el estado quedó en `done`.

## Cambios requeridos (solo bloqueantes)
Ninguno.

## Notas no bloqueantes
- **Pendiente de prueba manual:** la copia MTP con el Kindle conectado (Configuración → Importar del Kindle). La lógica está inyectada (`PowerShellRunner`) y testeada con un runner simulado. Sin dispositivo, el script real devuelve NOT_FOUND.
- `docs/decisions/023-kindle-clippings-import.md:4`: el estado dice "Aceptado (pendiente de revisión)". Conviene dejarlo en "Aceptado".
- Si el usuario edita en el Kindle un subrayado que ya se importó, la reimportación agrega la versión nueva y deja la vieja: el dedupe de editados solo actúa dentro de un mismo archivo. Es coherente con "reimportar no duplica", pero conviene documentarlo como limitación conocida.
- El criterio original de acceptance ("posición final coincide") quedó reemplazado por la decisión posterior del usuario (contención en `[inicio, fin]`), que está documentada en el ADR 023.
- Sigue abierto el pendiente que dejó la #22: `BookDetailPage.tsx:1045` todavía dice "Se eliminarán también todas sus notas." sin nombrar los subrayados, que ahora también llegan por importación. No era parte del acceptance de la #23.
