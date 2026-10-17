# Review — feature 20 (finished_date)

**Veredicto:** APPROVED

## Verificación ejecutada
- `.\init.ps1`: exit 0. 29 archivos de test y 489 tests en verde. El stack trace del log viene de un test que fuerza un error a propósito; la suite termina verde.
- `pnpm typecheck` (node + web): OK.
- `pnpm lint:check`: OK, sin errores.
- `pnpm build`: OK.
- `prisma/dev.db`: md5 igual antes y después de la revisión, así que no se modificó.

## Criterios de aceptación (feature_list.json #20)
- [x] Columna y migración:
  - `schema.prisma` agrega `finishedAt DateTime?`.
  - `migration.sql` hace un `ALTER TABLE ... ADD COLUMN` nullable, más un `UPDATE` que pone `finishedAt = updatedAt` a los libros con status FINISHED y `finishedAt IS NULL`.
  - No es destructiva: no hay DROP, no se recrea la tabla y no se tocan otras columnas. Se puede re-ejecutar sin efecto gracias al `IS NULL`.
  - Copia la misma representación de DateTime que usa Prisma, porque es columna a columna.
  - `test_finished_date_persistence` aplica las migraciones previas sobre una DB temporal real, inserta datos "viejos" y aplica la nueva. Verifica `finishedAt == updatedAt` para FINISHED y `null` para el resto.
- [x] Dominio, mappers, use cases e IPC soportan `finishedAt`:
  - Errores tipados `InvalidFinishedDateError` y `FutureFinishedDateError` (`DomainErrors.ts`). Extienden `DomainError`, así que `formatIpcError` los mapea a `VALIDATION_ERROR` (`contracts.ts:56-57`).
  - No se aceptan fechas futuras: `Book.validateFinishedAt` (`Book.ts:316`) se aplica en el constructor, en `updateStatus` y en `setFinishedDate`. El renderer además usa `max={todayIsoDate()}` (`FinishedDateField.tsx:31`) y `validateFinishedDateInput`.
- [x] En los caminos manuales se pide la fecha con hoy precargado:
  - AddBookModal: `input-book-finished-date` solo con FINISHED.
  - UpdateProgressModal: `modal-finished-date-input` bajo el checkbox. Se valida antes de llamar a `updateProgress`, así que no hay guardado parcial.
  - Detalle: `handleStatusChange` (`BookDetailPage.tsx:263`) intercepta el paso a FINISHED con `detail-confirm-finish`, que trae hoy y se puede cancelar.
- [x] Al llegar al 100% se asigna hoy sin preguntar. `UpdateBookProgress` llama a `book.updateStatus(FINISHED)` sin fecha, y el dominio asigna `toCalendarNoon(new Date())`. Si el libro ya estaba FINISHED, la fecha se conserva. Hay tests en application e IPC.
- [x] La fecha se conserva al salir de FINISHED y se sobrescribe al volver a terminar (`Book.updateStatus`, `Book.ts:233-256`). En el detalle, volver a terminar abre la confirmación con hoy, no con la fecha conservada. Hay tests en domain, application y repositorio.
- [x] Detalle: muestra "Terminado el dd/mm/aaaa" y deja editar la fecha (`books:setFinishedDate`, use case `SetFinishedDate`).
- [x] Ficha del estante: `book-finished-date` aparece solo si `status === FINISHED`. Una fecha conservada no se muestra.
- [x] Dashboard: `countFinishedInPeriod` (año y mes locales) y `sortRecentlyFinishedBooks` (orden por `finishedAt`, máximo 5). Ambos filtran por `status === FINISHED`.
- [x] Tests por capa (domain 22, application 14, infrastructure 6, ipc 9, renderer 20, más 3 archivos ajustados). Los ajustes no borran ninguna aserción previa. test, typecheck, lint:check y build en verde.

## Puntos verificados en particular
- **Clean Architecture:** `src/shared/domain` y `src/shared/application` no importan `@prisma/client` ni `electron` (grep vacío). `CalendarDate.ts` es TypeScript puro. `SetFinishedDate` recibe `BookRepository` por constructor. El handler IPC solo orquesta.
- **Zonas horarias:**
  - Un día se guarda como mediodía local, lo que deja ±12 h de margen frente a UTC y al horario de verano.
  - `toIsoDate` usa los getters locales, no `toISOString`.
  - `isAfterToday` compara por día calendario local, así que hoy a cualquier hora no cuenta como futuro.
  - `parseIsoDate` rechaza días inexistentes, como `2026-02-30`.
  - El test "local calendar day, not UTC" es significativo en esta máquina (UTC−3: 23:30 local cae al día siguiente en UTC). Ver la recomendación 3.
- **Contratos IPC tipados:** `SetFinishedDateDTO` se define en el use case y se re-exporta en `contracts.ts`. La constante `IPC_CHANNELS.BOOKS.SET_FINISHED_DATE`, el preload (devuelve `Promise<IpcResult<BookPrimitives>>`) y `bookService.setFinishedDate` están tipados. `finishedAt?: string` (`YYYY-MM-DD`) está en `AddBookDTO` y `UpdateBookStatusDTO`.
- **Estilos:** las líneas agregadas en `src/renderer` no tienen colores crudos, `dark:` ni hex. Todos los tokens usados (`ink-faint`, `status-finished`, `accent-ink`, `accent-strong`, `well`, `shelf`, `card`, `danger`, `rule-strong`) existen en `main.css` (en `@theme` y en `.dark`). `test_retro_library_theme` sigue verde.
- **data-testid:** el diff no elimina ningún `data-testid` existente.
- **Docs:** existe `docs/decisions/020-finished-date.md` con contexto, decisión, diagrama y alternativas descartadas. También la §6 "Migraciones con backfill de datos" con un diagrama Mermaid en `docs/guides/prisma-sqlite-setup.md`.
- **Código:** no hay `any`, `console.log` ni TODOs nuevos. Los imports relativos llevan `.js`.

## Decisiones menores del reporte
1. `setFinishedDate` y `updateStatus` con fecha y estado distinto de FINISHED dan error: **de acuerdo.** Es coherente con "una fecha de terminado solo tiene sentido si está terminado" y está tipado.
2. `AddBook` ignora `finishedAt` si el estado no es FINISHED: **aceptable**, con un matiz. `AddBook.ts:40` parsea `dto.finishedAt` antes de saber si se va a usar. Si llega una fecha malformada con estado no FINISHED, se lanza `InvalidFinishedDateError` en vez de ignorarla. Es inofensivo (la UI no la manda en ese caso), pero es inconsistente con "se ignora". Ver la recomendación 1.
3. Destildar el checkbox al 100% en UpdateProgressModal:
   - El backend autocompleta y después se revierte el estado (`UpdateProgressModal.tsx:204` y `:231`).
   - Si el libro tenía una fecha conservada de una lectura anterior, queda pisada con hoy aunque el usuario dijo "no terminado".
   - No es observable (no se muestra ni se cuenta fuera de FINISHED y se sobrescribe al volver a terminar), así que **no bloquea**.
   - Pero contradice literalmente "la fecha se conserva". Ver la recomendación 2.
4. Los libros migrados conservan la hora exacta de `updatedAt` (no el mediodía): **de acuerdo.** Toda la lectura (formato, comparación, dashboard) es por día local, y ese instante es el día local real en que se tocó el libro.

## Riesgo preexistente (fuera del alcance, para el leader)
La app empaquetada usa `userData/booklog.db` y no aplica migraciones al arrancar. Esta es la primera columna nueva desde que existe la app instalada, así que una app instalada fallará al leer `Book.finishedAt` hasta que se migre. Recomiendo abrir una feature para correr `prisma migrate deploy` (o equivalente) al iniciar.

## Checkpoints
- C1: [x]. Arnés completo e `init.ps1` con exit 0.
- C2: [x]. Una sola feature en `in_progress` (#20). `progress/current.md` describe la sesión activa (#20). Las features `done` siguen con tests verdes.
- C3: [x]. La estructura respeta `docs/architecture.md`. Domain y application no tienen dependencias de infraestructura. Hay DI por constructor. No hay `console.log`, `any` ni TODOs.
- C4: [x]. Hay tests en domain, application, infrastructure (SQLite real temporal, sin mocks de DB), ipc y renderer. 489 tests en verde y el build compila.
- C5: [x] para esta revisión: no hay archivos sospechosos sin trackear (`prisma/dev.db-journal` está ignorado por git). La entrada en `progress/history.md` y el paso a `done` le tocan al leader al cerrar.

## Cambios requeridos
Ninguno bloqueante.

## Recomendaciones (no bloqueantes)
1. `src/shared/application/use-cases/AddBook.ts:40`: parsear `finishedAt` solo si el status es FINISHED, para que "se ignora" sea literal.
2. `UpdateProgressModal.tsx:204/231` y `UpdateBookProgress`: si se quiere respetar a rajatabla "se conserva", evitar que el auto-FINISHED del backend pise la fecha cuando el usuario destilda. Por ejemplo, pasar un flag `autoFinish: false` en el DTO de progreso en vez de revertir.
3. Fijar la zona horaria de algún test de `CalendarDate` (p. ej. `process.env.TZ = 'America/Argentina/Buenos_Aires'` en un archivo dedicado). Así el test anti-`toISOString` no queda trivialmente verde en una máquina en UTC (CI).
