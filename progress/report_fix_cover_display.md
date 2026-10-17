# Reporte — feature #19 `fix_cover_display`

Estado: implementada y verificada. Sigue `in_progress` (sin reviewer, sin commit, como pidió el líder).

## Cambios
- `src/renderer/index.html`: `img-src 'self' data: https: booklog-media:` (solo se agrega el esquema a img-src).
- `src/renderer/src/services/coverService.ts`: nuevo `buildCoverCandidates(coverPath, coverUrl)` que devuelve `[local, remota]` ordenada, sin vacíos ni duplicados. `resolveCoverUrl` no cambia.
- `src/renderer/src/hooks/useCoverSource.ts` (nuevo): `useCoverSource(coverPath, coverUrl) -> { src, onError }`. Cada `onError` pasa al siguiente candidato; `src === null` significa placeholder. El contador de fallos va atado a la lista de candidatos, así que se reinicia solo cuando cambia el libro (sin useEffect).
- `BookCard.tsx`, `BookDetailPage.tsx`, `DashboardPage.tsx` (RecentBookItem) usan el hook. Se eliminaron el estado `imageError`, el reset `setImageError(false)` del detalle y el `useState` que quedó sin uso en Dashboard. JSX, clases y `data-testid` no cambian. No hay otros componentes que muestren tapas guardadas; AddBookModal solo previsualiza URLs remotas de búsqueda o del formulario.
- Test: `tests/renderer/test_fix_cover_display.test.ts` (12 tests): img-src exacto, booklog-media: ausente de otras directivas, helper, hook (cadena y reinicio), y cadena local -> remota -> placeholder en BookCard, BookDetailPage y DashboardPage.
- Docs: `docs/decisions/019-fix-cover-display.md`; sección "Relación con la CSP (feature #19)" en `docs/guides/electron-ipc-bridge.md` (con diagrama Mermaid).

## Verificación
- `.\init.ps1`: OK, 24 archivos / 415 tests en verde.
- `pnpm lint:check`: OK. `pnpm build` (incluye typecheck node+web): OK. `out/renderer/index.html` contiene la CSP nueva.
- Electron real: harness en el scratchpad (`csp-harness/main.js`, fuera del repo) con userData temporal y un PNG en `covers/`. Mismo registro privilegiado del esquema y la CSP leída de `src/renderer/index.html`. Con la CSP nueva la imagen carga (2x3); con la CSP anterior da `error`. No se tocaron dev.db ni %APPDATA%\booklog. Los directorios temporales se borraron.
- No verificado: abrir la app completa con el libro "Hyperpolitics" real, porque usa la base y el userData del usuario. Conviene que el usuario lo confirme con `pnpm dev`.

## Notas
- Un `coverPath` que sea ruta absoluta del disco (AddBookModal guarda como coverPath cualquier texto que no sea http) sigue resolviéndose a una URL booklog-media inválida. Ahora cae a coverUrl o al placeholder sin romper nada. No se cambió porque está fuera del scope de esta feature.
- El harness tardó en cerrarse (lo cortó un timeout) y no quedaron procesos electron vivos.
