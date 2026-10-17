# ADR-018: Tema claro por defecto y arreglos menores de UI (`ui_polish_fixes`)

## Estado
Aceptado (pendiente de revisión)

## Contexto

Tras #16 (tema retro) y #17 (estantería), el usuario pidió que el tema claro
(pergamino) sea el predeterminado. Las reviews de esas features dejaron además
arreglos menores: botón "+ + Agregar Libro", `STATUS_CONFIG` triplicado
(BookCard, BookDetailPage, DashboardPage), tarjetas de la estantería inaccesibles
por teclado y ningún script de lint que no modifique archivos.

## Decisión

1. **Claro por defecto.** `DEFAULT_SETTINGS.theme = 'light'` (main) y los fallbacks
   de `App.tsx` / `SettingsPage` pasan a `'light'`. No hace falta tocar
   `index.html` ni `main.tsx`: el `<html>` no trae `.dark` y `@theme` ya define los
   valores claros, así que el primer pintado es claro. Una preferencia guardada se
   respeta (también `dark`).
2. **Un solo "+".** Se conserva el ícono `Plus` (con `aria-hidden`) y el texto queda
   "Agregar Libro".
3. **`statusConfig.ts`** en `src/renderer/src/components/`: `STATUS_CONFIG` con
   `label`, `icon`, `shelfBadgeClass` (badge sólido de la ficha), `badgeClass`
   (`status/10`, detalle y dashboard), `barClass`, `textClass`; `STATUS_ORDER` para el
   `<select>` del detalle (mismo orden que antes) y `getStatusConfig()` con fallback
   neutro. Las diferencias de uso son campos distintos del mismo registro: sin cambio
   visual.
4. **BookCard accesible.** La celda pasa de `<article>` a
   `<div role="button" tabIndex={0} aria-label="Título, de Autor">` cuando tiene
   `onClick`; Enter/Espacio abren el detalle. Foco:
   `outline-2 outline-accent outline-offset-[-3px]` (hacia adentro), de modo que el
   `overflow: hidden` de `bookshelf` no lo recorta y la prolongación del último
   estante queda intacta. Se conservan todos los `data-testid`.
5. **`pnpm lint:check`**: igual a `lint` sin `--fix`.

## Alternativas descartadas

- **`<button>` como celda**: HTML inválido (contiene `<h3>` y `<div>`).
- **Patrón "stretched link"** (`<button>` dentro del `<h3>` con `::after` cubriendo la
  tarjeta): mantiene `<article>`, pero el foco quedaría alrededor del título o
  requeriría `focus-within` en la tarjeta. Más piezas para el mismo resultado.
- **`ring` (box-shadow) exterior + quitar `overflow: hidden`**: rompe el recorte de la
  prolongación del último estante. Con `ring-inset`, el tramo de estante (que ocupa
  todo el ancho de la celda) taparía el anillo a los costados; el `outline` se pinta
  por encima del contenido.
- **`overflow: clip` + `overflow-clip-margin`**: el margen también dejaría asomar la
  madera unos píxeles más allá del borde del estante.
- **Leer el tema de forma síncrona antes del primer pintado** (p. ej. vía preload)
  para evitar el destello claro de quien eligió "Oscuro": fuera de alcance; el
  requisito es que no haya flash oscuro en el caso por defecto.

## Consecuencias

- `DashboardPage` ya no exporta `STATUS_CONFIG`; se importa desde
  `components/statusConfig.js` (también re-exportado en `components/index.ts`).
- Tests: `tests/renderer/test_ui_polish_fixes.test.ts` + ajustes en
  `test_settings_storage_service`, `test_ipc_contracts` y `test_add_book_modal`.
- Guías: secciones nuevas en `design-tokens-theming.md` (tema por defecto) y
  `css-grid-bookshelf-layout.md` (accesibilidad por teclado).
