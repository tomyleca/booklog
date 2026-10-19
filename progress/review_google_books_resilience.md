# Review — feature 27 (google_books_resilience)

**Veredicto:** APPROVED

## Verificación
- pnpm test: 55 archivos, 792 tests, todo en verde. Los 3 archivos de Google Books (54 tests) tardan 47 ms en total, así que no hay esperas reales.
- typecheck/lint/build: se toman del informe del implementer (init.ps1, lint:check y build en verde). El diff no toca configuración (`package.json`, tsconfig, ESLint, vite, prisma).

## Criterios de aceptación revisados
- **Backoff.** `fetchWithRetry.ts` usa `maxRetries: 2`, `baseDelayMs: 500` y `backoffFactor: 3`, lo que da 500 ms y 1500 ms con un jitter de ±20 % (`backoffDelay`, que nunca devuelve un valor negativo). `Retry-After` se acepta en segundos o como fecha HTTP, calculada con el `now` inyectado, y se limita a `maxRetryAfterMs: 5000` (`parseRetryAfter`). Solo se reintentan 429/500/502/503/504 y los errores de red. Los 400/401/403/404 se devuelven sin reintentar, y hay un test `it.each` que lo cubre.
- **Errores tipados.** `domain/errors/BookSearchErrors.ts` no importa nada de infraestructura. `classifyGoogleBooksError` diferencia key, cuota, no disponible y genérico a partir del status y el cuerpo. `formatIpcError` traduce cada error a `SEARCH_UNAVAILABLE`, `SEARCH_QUOTA_EXCEEDED`, `SEARCH_INVALID_API_KEY` y `SEARCH_FAILED` antes del caso `DomainError`. Hay tests para los 4 casos y para el handler `search:books`.
- **Caché.** `CachedBookSearchService` normaliza la clave (trim, espacios colapsados, minúsculas) y separa texto y autor con `\u0000`. Tiene un TTL de 5 min, guarda como máximo 50 entradas con LRU (reinserta en el Map cuando hay un hit) y solo guarda resultados exitosos, porque `store` corre después del `await` y un throw lo saltea. El wiring está en `src/main/ipc/index.ts:71-74`.
- **UI.** `searchErrorMessage` asigna un mensaje en castellano a cada código. `handleRetrySearch` (`AddBookModal.tsx:285`) cancela el debounce y vuelve a llamar a `executeSearch` con los últimos argumentos, lo que conserva `requestId` y cubre la búsqueda inicial de #25. Solo se usan tokens (`danger`, `accent`). Se agregó `search-retry-button` y no se eliminó ningún `data-testid`.
- **Sin API real.** Todos los tests usan un `fetch` mock y `sleep` inmediato. Los tests anteriores (#21/#25) inyectan `retry.sleep`.
- **Docs.** Está el ADR `docs/decisions/027-google-books-resilience.md` (contexto, decisión, alternativas y diagrama) y la sección 6 de `docs/guides/external-api-integration.md`, con Mermaid.

## Checkpoints
- C1: [x] El arnés está completo. Según el informe, init.ps1 da OK.
- C2: [x] Solo #27 queda in_progress hasta este cierre, y current.md describe la sesión activa.
- C3: [x] Los errores del dominio no tienen dependencias de infraestructura. El retry y la caché están en `infrastructure/api`. El decorador recibe el port por constructor. No hay `console.log` ni `any`.
- C4: [x] Hay tests de infrastructure, ipc y renderer. `pnpm test` da 792 en verde y el build está OK según el informe.
- C5: [x] No hay archivos temporales sospechosos. La entrada de history.md se agrega en este cierre.

## Cambios requeridos (solo bloqueantes)
Ninguno.

## Notas no bloqueantes
- `src/shared/infrastructure/api/CachedBookSearchService.ts:52`: en un hit devuelve la misma referencia del array cacheado. Si algún consumidor dentro del main process lo mutara, alteraría la caché. Hoy no pasa, porque IPC serializa.
- No hay test de que `registerIpcHandlers` use `CachedBookSearchService`, porque requiere Prisma y Electron. Es una línea y el typecheck la cubre.
- `registerSearchHandlers()` sin argumentos sigue creando un `GoogleBooksService` sin caché. Hoy solo afecta a los tests.
- El informe quedó en `progress/current.md` y no en `progress/report_google_books_resilience.md`, porque el entorno no dejó crear el archivo.
