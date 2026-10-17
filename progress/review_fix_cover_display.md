# Review — feature 19 (fix_cover_display)

**Veredicto:** CHANGES_REQUESTED

## Verificación ejecutada
- `.\init.ps1`: exit 0. 24 archivos de test y 415 tests en verde.
- `pnpm typecheck` (node + web): OK.
- `pnpm lint:check`: OK, sin errores.
- `pnpm build`: OK. `out/renderer/index.html` contiene `img-src 'self' data: https: booklog-media:`.

## Criterios de aceptación (feature_list.json #19)
- [x] CSP: `src/renderer/index.html:8`. Se agrega solo `booklog-media:` a `img-src`; las demás directivas no cambian. No se abren otros orígenes.
- [x] Las tapas locales se ven en la estantería (`BookCard.tsx:86-93`), el detalle (`BookDetailPage.tsx:327-334`) y el dashboard (`DashboardPage.tsx:117-123`). Los tres usan `useCoverSource`.
- [x] Fallback local→remoto→placeholder:
  - `buildCoverCandidates` (`coverService.ts:45-51`) arma la lista `[local, remota]` sin vacíos ni duplicados.
  - `useCoverSource` avanza un candidato en cada `onError`. Cuando se agotan, `src === null` y no se renderiza la `<img>`, así que no puede haber un loop de `onError`.
  - El contador va ligado a la `key` de los candidatos, así que la cadena se reinicia al cambiar de libro.
  - Las dos `<img>` de `AddBookModal.tsx` (538, 774) muestran URLs remotas de búsqueda o vista previa, no tapas guardadas, así que están fuera del alcance. Conservan su `display:none` sin loop.
- [x] Tests significativos (`tests/renderer/test_fix_cover_display.test.ts`):
  - Parsean la CSP real: `img-src` exacto y `booklog-media:` ausente en el resto de las directivas.
  - Cubren el helper, el hook (incluido el reinicio de la cadena al cambiar los datos) y los dos `fireEvent.error` sucesivos en los tres componentes reales.
- [x] test, typecheck, lint:check y build en verde.
- [x] Sin cambio visual: el diff de los componentes solo toca `src`/`onError` y la condición. No se agregan clases ni colores crudos.
- [x] Se conservan los `data-testid` `book-cover`, `book-cover-image`, `book-cover-placeholder`, `detail-cover-image` y `detail-cover-placeholder`.
- [x] Documentación:
  - Existe el ADR `docs/decisions/019-fix-cover-display.md`, con contexto, decisión y alternativas.
  - La guía `docs/guides/electron-ipc-bridge.md` suma una sección con un diagrama Mermaid sobre CSP y protocolo.

## Checkpoints
- C1: [x]. Arnés completo e `init.ps1` con exit 0.
- C2: [x]. Una sola feature en `in_progress` (#19). La #20 está en `pending`. `progress/current.md` describe la sesión activa.
- C3: [ ]. Razón: `src/renderer/src/pages/BookDetailPage.tsx:33` quedó con el comentario huérfano `// Local state for image error handling` (más una línea en blanco). El estado `imageError` al que se refería fue eliminado en este diff, así que el comentario describe código que ya no existe. Eso viola `docs/conventions.md` § Comentarios. Todo lo demás de C3 se cumple:
  - El hook está en `src/renderer/src/hooks/`, con nombre `useX` en camelCase.
  - Los imports relativos llevan `.js`.
  - No hay `any`, `console.log` ni TODOs.
- C4: [x]. 415 tests en verde. El build compila.
- C5: [x] para esta revisión: no hay archivos sueltos sospechosos. La entrada de `progress/history.md` y el paso a `done` le tocan al líder al cerrar, después de la aprobación.

## Cambios requeridos
1. `src/renderer/src/pages/BookDetailPage.tsx:33-34`: eliminar la línea `// Local state for image error handling` y la línea en blanco extra que le sigue.

No se necesita ningún otro cambio. Con esa corrección, la feature está en condiciones de aprobarse.
