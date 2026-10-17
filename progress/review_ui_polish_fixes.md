# Review — feature 18 (`ui_polish_fixes`)

**Veredicto:** APPROVED

## Verificación ejecutada
- `.\init.ps1`: exit 0. 23 archivos de test y 403 tests en verde.
- `pnpm typecheck` (node y web): exit 0.
- `pnpm lint:check`: exit 0, sin errores. El script en `package.json:11` es igual a `lint` pero sin `--fix`.
- `pnpm build`: exit 0.

## Criterios de aceptación (feature 18)
- [x] **Claro por defecto.** `SettingsStorageService.ts:10` usa `theme: 'light'`. Los dos fallbacks de `App.tsx:62,66` y los de `SettingsPage.tsx:31,52-53` pasan a `'light'`. No queda ningún default `'dark'` en `src/`; lo comprobé con grep, y solo aparece en el botón "Oscuro" y en themeService. `index.html` no trae `.dark` y `src/main/index.ts:22,32` usa `show:false` + `ready-to-show` sin `backgroundColor`, así que el primer pintado es claro y no hay flash oscuro. Una preferencia guardada se aplica por `applyTheme(res.data.theme)`, y hay tests que cubren `dark` en el servicio y en App.
- [x] **Un solo "+".** `LibraryPage.tsx:77-78` deja el ícono `Plus` con `aria-hidden` y el texto "Agregar Libro".
- [x] **Un único módulo de estados.** `src/renderer/src/components/statusConfig.ts` lo usan `BookCard.tsx:7,40`, `BookDetailPage.tsx:22,406-408` y `DashboardPage.tsx:17,87,467,485`, y ya no quedan copias. No hay cambio visual:
  - `shelfBadgeClass` es igual al `badgeClass` anterior de BookCard.
  - `badgeClass`, `barClass`, `textClass` e `icon` son iguales a los de Dashboard y Detalle.
  - Los fallbacks de `getStatusConfig` coinciden con los anteriores (`text-ink-muted border-rule-strong` y `bg-shelf ... / bg-ink-faint / text-ink / BookOpen`).
  - `STATUS_ORDER` reproduce el orden de `Object.entries` del `<select>` del detalle (TO_READ, READING, PAUSED, FINISHED, ABANDONED).
  - Dashboard recorre `orderedStatuses` de forma explícita, así que el cambio de orden de las claves no lo afecta.
- [x] **BookCard accesible por teclado** (`BookCard.tsx:56-89`).
  - Con `onClick` queda `role="button"`, `tabIndex={0}` y `aria-label="<título>, de <autor>"` (`authors` es string en primitives). Enter y Espacio llaman a `onClick`, con `preventDefault`, y se ignoran los eventos que vienen de descendientes.
  - Sin `onClick` no hay role ni tabIndex.
  - El HTML es válido: no hay `<button>`, `<a>` ni `<input>` anidados y el `<h3>` está dentro de un div.
  - El foco es `outline-2 outline-accent outline-offset-[-3px]`, hacia adentro, así que el `overflow:hidden` de `bookshelf` no lo recorta.
  - `bookshelf` no cambió (`main.css`, solo un comentario). El selector de la prolongación `& > :last-child [data-shelf-plank]::after` no depende de `article`, así que sigue funcionando.
  - Se conservan todos los `data-testid`.
- [x] **`pnpm lint:check`** existe, está documentado en `docs/verification.md` y en `docs/conventions.md`.
- [x] **test, typecheck, lint:check y build** en verde.

## Restricciones adicionales
- [x] Solo tokens: no hay hex, `rgb()`, paleta cruda de Tailwind ni `dark:` en las líneas agregadas en `src/`. Lo comprobé con grep sobre el diff.
- [x] ADR `docs/decisions/018-ui-polish-fixes.md` con contexto, decisión y alternativas. Las guías `design-tokens-theming.md` y `css-grid-bookshelf-layout.md` están actualizadas con Mermaid.
- [x] Hay tests para cada criterio: `tests/renderer/test_ui_polish_fixes.test.ts` más los ajustes en `test_settings_storage_service`, `test_ipc_contracts` y `test_add_book_modal`.

## Checkpoints
- C1: [x] Están los archivos base y los docs, y `init.ps1` termina con exit 0.
- C2: [x] Hay una sola feature `in_progress` (la #18, `feature_list.json:295`; la línea 18 es la lista de estados válidos). `progress/current.md` describe la sesión activa.
- C3: [x] Los cambios están todos en el renderer o en el servicio de main. No tocan domain ni application, no hay `console.log`, TODOs ni `any` nuevos.
- C4: [x] Hay tests por capa y `pnpm test`/`build` están en verde.
- C5: [x] No hay archivos sospechosos sin trackear. La entrada de `progress/history.md` y el paso a `done` le corresponden al líder al cerrar (después de esta review), así que no bloquean.

## Observaciones (no bloqueantes)
1. **Anillo de foco cortado por el estante.** `.shelf-plank` tiene `position: relative` (`main.css`, `@utility shelf-plank`) y ocupa todo el ancho de la celda. Como elemento posicionado se pinta por encima del outline del padre, que no está posicionado. Los lados izquierdo y derecho del anillo hacia adentro probablemente queden tapados en el tramo del estante (unos 14px de alto). El anillo se sigue viendo arriba, abajo y en el resto de los lados, así que cumple el criterio. Si se quiere un anillo continuo, se puede agregar `relative z-10` a un pseudo-elemento de foco o usar `isolate` y `z-index` en la celda. No lo verifiqué visualmente.
2. Con "Oscuro" guardado se ve claro durante el instante que tarda `settings:get`. Está documentado en el reporte y en el ADR, y queda fuera de alcance.
3. `group-focus-visible:*` replica el realce de hover. Es un agregado que no se pidió, pero es coherente y está declarado en el reporte.

## Cambios requeridos
Ninguno.
