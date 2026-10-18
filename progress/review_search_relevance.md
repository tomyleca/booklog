# Review — feature 21 (search_relevance)

**Veredicto:** APPROVED

## Verificación
- pnpm test: 32 suites, 524 tests, todo verde (re-ejecutado por el reviewer).
- typecheck/lint/build: tomados del informe del implementer (exit 0). El diff no toca configuración (`package.json`, `tsconfig*`, ESLint, `electron.vite.config.*`, `prisma/schema.prisma`).
- No se hicieron llamadas reales a la API: todos los tests usan `fetch` falso y el fixture `tests/fixtures/googleBooksPetSematary.ts`.

## Puntos pedidos por el leader
- **Ranking puro en dominio:** `src/shared/domain/services/rankSearchResults.ts` y `mergeSearchResults.ts` solo importan el tipo `BookSearchResult` del port. No usan red, Electron ni Prisma. `GoogleBooksService` (infra) depende del dominio, que es la dirección correcta. OK.
- **Contrato IPC compatible:** `src/main/ipc/searchHandlers.ts:14-27` sigue aceptando un `string` suelto. Cuando no hay autor llama a `searchByQuery(query)` con un solo argumento, así que los tests anteriores (`toHaveBeenCalledWith('Quijote')`) siguen valiendo. Hay un test nuevo para el string suelto (`tests/ipc/test_ipc_contracts.test.ts:799`). `SearchBooksDTO.author` es opcional. OK.
- **Fallback:** `GoogleBooksService.searchByQuery` usa `Promise.allSettled`. Hay tests para los casos de fallo: falla la consulta de campo por error de red, falla la libre por HTTP 503, y fallan ambas (se muestra el mensaje de error actual). OK.
- **Debounce y requestId:** los dos inputs pasan por `scheduleSearch` (`AddBookModal.tsx:202`), que comparte el timer, y el `requestId` sigue en `executeSearch`. Hay un test de respuesta obsoleta al cambiar el autor (`tests/renderer/test_search_relevance_ui.test.ts:117`). Enter en el input de autor también dispara la búsqueda. OK.
- **Tokens y data-testid:** el input nuevo usa solo tokens (`bg-well`, `border-rule`, `text-ink`, `text-ink-faint`, `accent`) y no colores literales. Se conservan los `data-testid` existentes (`search-books-button`, `search-min-chars-message`, etc.) y se agrega `search-author-input`. OK.
- **Test "pet sematary":** es significativo. En la consulta libre la edición de King viene **última**, y van antes guías de estudio con portada, ISBN y páginas (por ejemplo "Pet Sematary (Study Guide)", que da 60 + 20 = 80 frente a 100 + 20 = 120 de King). El test exige además que no haya duplicados y que se conserven las 8 ediciones (incluidas las traducciones de King, sin filtrar por idioma). Si se quitara el ranking, el test fallaría. OK.

## Decisiones menores (evaluación)
1. **Basta con título o autor con 3 caracteres:** correcto. Cumple el criterio "solo título, solo autor o ambos" y mantiene el mismo umbral que antes. Se acepta.
2. **`intitle:` primero, gana los empates:** correcto. El ordenamiento es estable y la consulta de campo es la más precisa, así que es un desempate razonable. Los duplicados por id son el mismo volumen, así que no se pierde información. Se acepta.
3. **Si fallan ambas, se muestra el error de la consulta libre:** correcto. Conserva el mensaje de siempre, que es lo que pide el criterio. Se acepta.

## Checkpoints
- C1: [x] Están los archivos base y los docs. `init.ps1` según el informe dio exit 0.
- C2: [x] Una sola feature `in_progress` (la #21, que pasa a `done` en este cierre). `current.md` vuelve a la plantilla.
- C3: [x] El dominio no tiene dependencias de infraestructura. La estructura de `src/shared/domain/services/` está documentada en `docs/architecture.md`. No hay `console.log` ni `any` nuevos.
- C4: [x] Hay tests en domain, infrastructure, ipc y renderer. `pnpm test` en verde y build en verde según el informe.
- C5: [x] No hay archivos sospechosos sin trackear. Se agrega la entrada en `history.md` y el estado queda en `done`.

## Cambios requeridos (solo bloqueantes)
Ninguno.

## Notas no bloqueantes
- `docs/decisions/021-search-relevance.md:4`: el estado dice "Aceptado (pendiente de revisión)". Ya aprobado, conviene dejarlo en "Aceptado".
- `src/shared/domain/services/rankSearchResults.ts:29`: la clase `[̀-ͯ]` está escrita con los caracteres combinantes literales y casi no se lee. Sería más claro `/[̀-ͯ]/g`.
- `AddBookModal.tsx:171`: `lastSearchedQuery` une título y autor con " — ". Funciona, pero es un detalle de presentación mezclado con el estado.
