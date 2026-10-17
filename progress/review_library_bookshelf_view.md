# Review — feature 17 (`library_bookshelf_view`)

**Veredicto:** APPROVED

## Alcance revisado
Solo lo que aporta la #17 (la #16 ya fue aprobada en `progress/review_retro_library_theme.md`):
- `src/renderer/src/components/BookGrid.tsx`, `src/renderer/src/components/BookCard.tsx`
- `src/renderer/src/assets/main.css` (`@utility shelf-plank`, `@utility bookshelf`, `@utility book-hinge`, líneas ~200-256)
- `tests/renderer/test_library_view.test.ts` (test de la grilla), `tests/renderer/test_library_bookshelf_view.test.ts` (nuevo, 14 tests)
- `docs/decisions/017-library-bookshelf-view.md`, `docs/guides/css-grid-bookshelf-layout.md`, `docs/guides/README.md`, `docs/guides/design-tokens-theming.md`, `docs/conventions.md`

## Verificación ejecutada
- `.\init.ps1` (PowerShell): exit 0 — 22 archivos, 378 tests verdes.
- `eslint . --ext ...` **sin `--fix`** sobre todo el repo: 0 errores/advertencias; `git status` sin cambios después.
- `pnpm build` (typecheck node + web + electron-vite build): OK.

## Criterios de aceptación (feature_list.json #17)
- [x] Filas de estantes: `BookGrid` usa `bookshelf grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-x-0`; cada `BookCard` dibuja su tramo `shelf-plank` (madera con `color-mix` de `--color-brass`/`--color-chrome` + `--texture-wood`); el último tramo se prolonga con `::after` y se recorta con `overflow: hidden`.
- [x] Sin pérdida de información: título (`book-title`), autor (`book-authors`), badge (`book-status-badge`, ahora en la ficha y no superpuesto en la tapa), progreso (`book-progress`, solo READING/PAUSED/ABANDONED, mismo cálculo que antes), estrellas (`book-rating`, `star-N`/`star-N-filled`, mismo aria-label). Comparado con el diff de `BookCard.tsx` contra HEAD.
- [x] Placeholder de cuero: `bg-leather`/`bg-spine` alternado por id + `texture-paper`, marco `border-double border-brass/60`, icono `text-brass`; fallback `onError` conservado.
- [x] Responsive: `auto-fill/minmax` sin breakpoints; el número de libros por estante depende del ancho.
- [x] Se conservan filtros, estado vacío, click al detalle y data-testid: `LibraryPage.tsx` no tiene cambios de la #17 (mtime 17:26, anterior a la aprobación de #16 a las 17:38); `onClick` del `article` sigue llamando `onClick?.(book)`; test de integración cubre click -> `onSelectBook(id)` y estado vacío sin estantería.
- [x] Claro/oscuro: solo tokens (`var(--color-*)`, `--relief-*`, `--texture-wood`) que tienen override en `.dark`; sin `dark:` ni hex/rgb en `BookCard.tsx`/`BookGrid.tsx` ni en las utilidades nuevas (verificado con grep y por el test "should not hardcode colors"). Todos los tokens usados existen en `main.css` (status-*, star, ink*, rule*, card, accent, brass, leather, spine, chrome, chrome-ink, backdrop). Validación visual reportada por el implementer con capturas en ambos temas.
- [x] test, typecheck, lint y build en verde.

## Puntos específicos pedidos
- Dashboard, Detalle y Settings: sin modificaciones de la #17 (mtimes 17:27, todos de la #16).
- Test de layout actualizado (`tests/renderer/test_library_view.test.ts` ~L245-266): sigue siendo significativo — exige `bookshelf`, `grid`, `auto-fill/minmax`, `gap-x-0`, prohíbe breakpoints `sm|md|lg|xl:grid-cols-N`, y verifica que cada `book-card` es hijo directo del grid con exactamente un `shelf-plank`. Es estructural (jsdom no calcula layout), lo cual es razonable.
- ADR `docs/decisions/017-library-bookshelf-view.md`: existe, con Contexto, Decisión, Alternativas descartadas, Consecuencias y Diagrama. Guía nueva con Mermaid.

## Checkpoints
- C1: [x] Archivos base y docs presentes; `.\init.ps1` exit 0.
- C2: [x] Una sola feature `in_progress` (#17); `progress/current.md` describe la sesión activa.
- C3: [x] Cambios solo en `src/renderer` (capa de presentación); sin imports nuevos de infraestructura, sin `console.log`, sin `any`, sin TODOs.
- C4: [x] Tests por capa existentes; 378 tests verdes; build sin errores de TS.
- C5: [x] Sin archivos sospechosos sin trackear; #17 correctamente en `in_progress` hasta el cierre. La entrada de `progress/history.md` para #17 queda a cargo del leader al cerrar (igual que con #16).

## Observaciones no bloqueantes
1. `@utility bookshelf` usa `overflow: hidden` (main.css ~L233): recorta cualquier sombra o anillo de foco que sobresalga del contenedor por los costados. Hoy no hay foco en las tarjetas y el `pt-2` absorbe el `-translate-y-1` del hover, así que no hay defecto visible; tenerlo en cuenta si se agrega navegación por teclado.
2. `article` con `onClick` sigue sin ser accesible por teclado (sin `role="button"`/`tabIndex`/`onKeyDown`). Era igual antes de la #17; no es una regresión, pero vale una feature futura.
3. `pnpm lint` del repo usa `--fix`; conviene un script `lint:check` sin `--fix` para revisiones.

## Cambios requeridos
Ninguno.
