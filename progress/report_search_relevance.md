# Reporte implementer — Feature #21 `search_relevance`

> Transcripto por el leader desde el mensaje de entrega del implementer: el
> entorno rechaza que los subagentes creen archivos de reporte con Write
> ("Subagents should return findings as text, not write report files").

Estado: listo para review (`in_progress`, sin commits). Bitácora en `progress/current.md`.

## Verificación (según implementer)
- `.\init.ps1` (incluye `pnpm test`): exit 0, 32 archivos, 524 tests verdes.
- `pnpm lint:check` y `pnpm build` (incluye typecheck): exit 0.
- Sin cambios posteriores salvo `progress/current.md`. Sin llamadas reales a la API ni uso de la API key.

## Cambios
- **Dominio (puro, sin red):** `src/shared/domain/services/rankSearchResults.ts` y `mergeSearchResults.ts`. Puntaje: título exacto 100, título que empieza con el texto 60, frase contenida 45, palabras sueltas hasta 30; más coincidencia de autor y bonus por portada, ISBN y páginas. No descarta ediciones; en empate respeta el orden original.
- **`GoogleBooksService`:** consulta libre + consulta `intitle:` (más `inauthor:` si hay autor) en paralelo, ambas `printType=books&maxResults=40`; combina sin duplicados por `googleBooksId` y delega el orden al dominio. Si falla una usa la otra; si fallan ambas, error de siempre.
- **Contrato compatible:** port `searchByQuery(query, author?)`; `SearchBooksDTO` con `author` opcional; el handler sigue aceptando string suelto; preload y servicio del renderer con autor opcional.
- **`AddBookModal`:** campo "Autor (opcional)" (`data-testid="search-author-input"`), solo tokens; debounce y `requestId` conservados y compartidos entre ambos inputs.
- **Tests:** fixture `tests/fixtures/googleBooksPetSematary.ts` (la edición de King queda primera); nuevos en `tests/domain`, `tests/infrastructure`, `tests/renderer`; ajustados `test_google_books_service.test.ts` y `test_ipc_contracts.test.ts`.
- **Docs:** `docs/decisions/021-search-relevance.md`; `docs/guides/external-api-integration.md` §5 (Mermaid); `docs/guides/README.md`; `docs/architecture.md`.

## Decisiones menores a revisar
- Basta con que título **o** autor tenga 3 caracteres para buscar.
- Al combinar, la consulta `intitle:` va primero y gana los empates.
- Si fallan ambas consultas se muestra el error de la consulta libre.

## Entrada para history.md

```markdown
---

## Sesión 2026-10-17 — Feature #21: search_relevance (Fix: relevancia de la búsqueda en Google Books)

- **Estado:** Completada (done)
- **Logros:**
  - Diagnóstico: la consulta era solo `q=<texto>&maxResults=20`, sin `printType` ni `intitle:`, y sin reordenamiento local; títulos famosos como "pet sematary" quedaban enterrados.
  - Consultas en paralelo (libre + `intitle:`/`inauthor:`) con `printType=books&maxResults=40`, combinadas sin duplicados y con tolerancia a fallo parcial.
  - Ranking local puro en el dominio (`rankSearchResults`, `mergeSearchResults`) por coincidencia de título y autor, con bonus por portada/ISBN/páginas; se conservan todas las ediciones.
  - Campo "Autor (opcional)" en la búsqueda de `AddBookModal`; contrato IPC extendido de forma compatible.
  - Pruebas con respuestas grabadas (fixture "pet sematary": la edición de Stephen King queda primera). Suite: 32 archivos, 524 tests en verde; lint:check y build limpios.
  - Documentación: [ADR 021](../docs/decisions/021-search-relevance.md) y [guía de integración externa §5](../docs/guides/external-api-integration.md).
  - Reportes: [report_search_relevance.md](report_search_relevance.md) y [review_search_relevance.md](review_search_relevance.md).
```
