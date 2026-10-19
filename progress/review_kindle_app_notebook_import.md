# Review — feature 26

**Veredicto:** APPROVED

## Verificación
- pnpm test: 52 suites, 744 tests, todos verdes.
- typecheck/lint/build: re-ejecutados porque el diff toca `prisma/schema.prisma`. `pnpm lint:check` sin errores; `pnpm build` (typecheck node + web) OK.
- Informe del implementer: sección "Reporte #26" de `progress/current.md`. El entorno no permitió crear `progress/report_kindle_app_notebook_import.md`, igual que en #24.

## Puntos pedidos por el leader
- **Parser tolerante** (`src/shared/domain/services/kindle/parseKindleNotebook.ts`). No usa un parser XML: tokeniza por clases conocidas y corta cada elemento en el primer cierre de bloque o en la próxima apertura conocida. Soporta:
  - `Subrayado/Resaltado/Highlight`, `Nota/Note` y `Marcador/Bookmark`;
  - color por clase `highlight_*` o por nombre ES/EN;
  - `Página/Page` y `Posición/Location` (ambas a la vez también);
  - capítulo antes de `&gt;`;
  - `<br>`, BOM, CRLF, entidades con nombre y numéricas (decodificadas una sola vez, test l.162);
  - notas multilínea.
  Hay tests en `tests/domain/test_kindle_app_notebook_import.test.ts` l.54–162, con un fixture ES, uno con capítulos y uno EN con marcador, entrada vacía y `Page xii`.
- **Vínculo nota → subrayado anterior** (`resolveKindleNotebook.ts`). Solo mira el subrayado inmediatamente anterior y exige `0 ≤ Δ ≤ 2 + ⌈largo/100⌉`. Por página, el margen es `0..1`. Las notas que no cumplen quedan sueltas. Tests en l.179–214.
- **Dedupe entre fuentes** (`annotationDedupeKey.ts` + `KindleAnnotationWriter.ts`). La clave es solo el inicio de la ubicación (posición, o página si no hay) + texto en NFC con espacios colapsados, y se compara por libro (`findByBookId`).
  - Si hay coincidencia gana lo existente, y las notas se re-vinculan al subrayado existente.
  - Funciona en los dos sentidos: application l.293 y l.316.
  - Contra los rangos de My Clippings (`1265-1268` vs `1265`) lo prueba el test de dominio l.254.
- **Migración no destructiva.** `migration.sql` solo hace `ADD COLUMN "color" TEXT` (nullable) y `CREATE TABLE`. Lo prueba `tests/infrastructure/test_kindle_notebook_persistence.test.ts` l.90.
- **Color con tokens.** Hay tokens `--color-highlight-*` en `@theme` y en `.dark` (`main.css`). El renderer usa solo `bg-highlight-*` (`annotations.ts`); sin colores crudos.
- **#24 no se afecta.** `suggestFinishedDate` ignora `capturedAt` nulo y los subrayados de la exportación quedan con `capturedAt: null`. Test de dominio l.287.
- **Escaneo de carpeta** (`KindleNotebookScanner.ts`).
  - Carpeta por defecto `app.getPath('documents')`; la configurada se guarda en `settings.json`.
  - La carpeta solo la cambia el main tras el diálogo nativo `openDirectory`. `saveSettings` ignora lo que mande el renderer.
  - `readdir` no entra en subcarpetas y solo toma `Dirent.isFile()` (excluye symlinks y directorios) que cumplan `NOTEBOOK_FILE_SUFFIX`, con `path.join(folder, entry.name)`. El renderer nunca manda rutas: el commit usa los archivos de la sesión en memoria, indexados por `fileName`.
  - Tamaño máximo 20 MB.
  - No hay vector de path traversal.
  - Lo ya importado se recuerda con `ImportedNotebookFile` (ruta + mtime): NEW, IMPORTED o CHANGED. Los IMPORTED arrancan en "No importar".
- **Vista previa reutilizada.** `KindleImportModal` acepta `initialSource: 'NOTEBOOK'` y usa el mismo flujo (matching, orden, crear libro, No importar) y el mismo `kindle:commit`. No hay un modal duplicado.
- **Fixtures anonimizados.** Comparé los 117 `noteText` de las 3 exportaciones reales de `E:\Tomas\Documents` con `tests/`, `src/`, `docs/` y `progress/`: ningún fragmento de 15 o más caracteres aparece. Los hashes reales (`a47b006f…`, `e989a68d…`, `64c1c71f…`) tampoco están en el repo, y no hay ningún `.html` real dentro del repo.
- **data-testid conservados.** `kindle-import-retry-device` y `kindle-import-choose-file` solo se re-indentaron. Hay testids nuevos: `kindle-notebook-import-button`, `kindle-notebook-folder*`, `kindle-import-retry-notebook`, `kindle-import-group-state` y `highlight-color`.
- **Guía y ADR.** `docs/guides/kindle-clippings-import.md` §9 tiene 3 diagramas Mermaid. Además: `annotations-model.md`, `README.md` y `docs/decisions/026-kindle-app-notebook-import.md` (contexto, decisión, alternativas, diagrama).

## Checkpoints
- C1: [x]. Los archivos base y los docs existen. No corrí `init.ps1` por protocolo; el implementer lo reporta en `[OK]`.
- C2: [x]. Solo #26 estaba `in_progress` y pasa a `done` con este cierre. `current.md` queda vaciado.
- C3: [x]
  - `domain/` no importa infraestructura.
  - `application/` solo importa de `domain/` (y de `application/services`).
  - Los use cases reciben los ports por constructor.
  - No hay `console.log` ni `any`.
- C4: [x]. Hay tests en `domain/`, `application/`, `infrastructure/` (SQLite real + migración), `ipc/`, `services/` y `renderer/`. Test, lint y build en verde.
- C5: [x]. No hay archivos sospechosos sin trackear. `history.md` tiene la entrada y la feature quedó en `done`.

## Cambios requeridos (solo bloqueantes)
Ninguno.

## Notas no bloqueantes
- `docs/decisions/026-kindle-app-notebook-import.md:4`: el estado es "Aceptado (pendiente de revisión)" y tiene que pasar a "Aceptado".
- `src/main/services/KindleImportSessionStore.ts:22`: la línea del comentario pasa los 100 caracteres porque Prettier no se aplicó a ese archivo.
- `src/shared/application/services/` es una carpeta nueva que no figura en el árbol de `docs/architecture.md`. Conviene agregarla al diagrama de carpetas.
- **Dedupe por página.** Si una exportación trae solo `Página N` y My Clippings trae página + posición del mismo subrayado, las claves no coinciden (`page:` vs `pos:`) y el subrayado quedaría duplicado. En las muestras reales siempre hay posición, así que hoy no pasa.
- **Notas entre fuentes.** My Clippings guarda la nota en la posición donde termina el subrayado, y la app en inicio + 0..2. Si las posiciones difieren, la misma nota no se deduplica entre fuentes. Esto es coherente con el criterio aprobado (mismo inicio + texto), pero conviene tenerlo presente.
