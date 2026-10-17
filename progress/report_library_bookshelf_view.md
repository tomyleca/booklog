# Reporte — Feature #17 `library_bookshelf_view`

Estado: **ready-for-review** (sigue `in_progress` en feature_list.json; sin commits).

## Archivos

Código:
- `src/renderer/src/components/BookGrid.tsx` — grid `bookshelf grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-x-0 gap-y-10 pt-2 pb-6`.
- `src/renderer/src/components/BookCard.tsx` — tapa (`book-cover`) → tramo de estante (`shelf-plank`, `data-shelf-plank`) → ficha (`book-ficha`) con título, autor, badge, estrellas y progreso. Placeholder de cuero `bg-leather`/`bg-spine` alternado por id (`data-cover-tone`), marco `border-double border-brass/60`, icono `text-brass`. `book-hinge` sobre todas las tapas.
- `src/renderer/src/assets/main.css` — `@utility shelf-plank`, `@utility bookshelf` (overflow hidden + `:last-child [data-shelf-plank]::after` que prolonga el último tramo), `@utility book-hinge`. Sólo `var(--color-*)`/`--relief-*`/`--texture-wood` + `color-mix`; sin tokens nuevos.
- `LibraryPage.tsx` sin cambios. Dashboard/Detalle/Settings sin tocar.

Tests:
- `tests/renderer/test_library_view.test.ts` — el test de la grilla ahora valida `bookshelf` + `auto-fill/minmax` + `gap-x-0`, ausencia de breakpoints `sm|md|lg|xl:grid-cols-N`, cada `book-card` hijo directo del grid con exactamente un `shelf-plank`.
- `tests/renderer/test_library_bookshelf_view.test.ts` (nuevo, 14 tests): orden tapa→estante→ficha; toda la info dentro de la ficha (badge fuera de la tapa); sin progreso en TO_READ/FINISHED; click en tapa y ficha abre detalle; placeholder de cuero con marco latón; alternancia leather/spine determinista (id undefined → leather); fallback por onError; grid auto-fill; un tramo por celda; CSS (`shelf-plank` con texture-wood/tokens, `bookshelf` con prolongación + overflow hidden, sin hex/rgb); integración LibraryPage (click → onSelectBook(id), estado vacío sin estantería).

Docs:
- `docs/decisions/017-library-bookshelf-view.md` (ADR: decisión grid por celda + justificación, alternativas descartadas).
- `docs/guides/css-grid-bookshelf-layout.md` (guía nueva con Mermaid).
- `docs/guides/README.md` (índice), `docs/guides/design-tokens-theming.md` (tabla de utilidades), `docs/conventions.md` (lista de utilidades).

data-testid conservados: book-grid, book-card, book-cover-image, book-cover-placeholder, book-status-badge, book-title, book-authors, book-progress, book-rating, star-N / star-N-filled. Nuevos: book-cover, shelf-plank, book-ficha, book-cover-placeholder-frame.

## Decisiones (detalle en ADR 017)

- Layout: CSS grid `auto-fill` sin gap horizontal; cada celda dibuja su tramo; la última fila incompleta se completa con un `::after` del último tramo recortado por el contenedor. Elegido sobre agrupar filas en JS (ResizeObserver) por ser CSS puro, sin estado ni mocks.
- Madera con `color-mix(chrome, brass)` + `texture-wood`, sin tokens nuevos.
- El badge de estado se movió de superpuesto en la tapa a la ficha (pedido: ficha con badge debajo).
- Placeholder: cuero rojo (`leather`) o verde (`spine`) alternado por id.
- Hover: libro sube 4 px y título toma `text-accent`.

## Verificación

- `.\init.ps1`: OK — 22 archivos, 378 tests verdes.
- `eslint` sobre archivos tocados: sin errores. `pnpm build` (typecheck node+web + electron-vite build): OK.
- Visual: harness fuera del repo (scratchpad: vite + @tailwindcss/vite sobre `LibraryPage` real con `window.api` stub, capturas con Electron offscreen) en claro/oscuro a 1200 px (7 libros por estante, 2 filas, última fila con estante prolongado) y 640 px (3 por estante). Estantes continuos, fichas alineadas, placeholders de cuero legibles en ambos temas.

## Notas para el reviewer

- jsdom no calcula layout: la continuidad del estante se valida estructuralmente + capturas.
- `pnpm lint` del repo usa `--fix` sobre todo el árbol; se corrió eslint sin `--fix` sólo sobre los archivos tocados para no alterar otros archivos.
- Edge: si la imagen remota no carga, se ve la tapa vacía hasta que dispare `onError` (igual que antes).
