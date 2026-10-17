# Reporte — Feature #18 `ui_polish_fixes`

Estado en feature_list.json: `in_progress` (no se lanzó el reviewer, no hay commits).

## Verificación
- `.\init.ps1`: OK, 23 archivos de test y 403 tests en verde.
- `pnpm lint:check`: OK, sin errores.
- `pnpm build`: OK (incluye typecheck node y web).
- En el CSS compilado están `focus-visible:outline-accent`, `outline-offset-[-3px]`, `group-focus-visible:*` y todas las clases `status-*` (Tailwind detecta el nuevo `.ts`).

## Cambios por criterio
1. **Claro por defecto**
   - `src/main/services/SettingsStorageService.ts`: `DEFAULT_SETTINGS.theme = 'light'`, que también es el fallback si el tema guardado es inválido.
   - `src/renderer/src/App.tsx`: los dos fallbacks pasan a `applyTheme('light')`.
   - `src/renderer/src/pages/SettingsPage.tsx`: el estado inicial y los `|| 'light'` también.
   - `index.html` y `main.tsx` no necesitaron cambios: `<html>` no trae `.dark`, `@theme`/`:root` ya son claros y la ventana se muestra en `ready-to-show`, así que no hay flash oscuro.
   - Una preferencia guardada (incluida `dark`) se respeta.
2. **Un solo "+"**: en `src/renderer/src/pages/LibraryPage.tsx` el texto queda "Agregar Libro" y el ícono `Plus` se marca `aria-hidden`. EmptyLibraryState no tenía el problema.
3. **Módulo único `src/renderer/src/components/statusConfig.ts`**
   - Exporta `STATUS_CONFIG` (label, icon, `shelfBadgeClass`, `badgeClass` con `status/10`, `barClass`, `textClass`), `STATUS_ORDER` (el orden del `<select>` del detalle, igual que antes) y `getStatusConfig()` con fallback neutro.
   - BookCard usa `shelfBadgeClass`, BookDetailPage usa `STATUS_ORDER`/`STATUS_CONFIG`, DashboardPage usa `STATUS_CONFIG` y `getStatusConfig`.
   - Se quitaron las tres copias. `DashboardPage` ya no exporta `STATUS_CONFIG`; ningún consumidor lo importaba.
   - Se re-exporta en `components/index.ts`. Las clases son idénticas a las anteriores, sin cambio visual.
4. **BookCard accesible por teclado** (`src/renderer/src/components/BookCard.tsx`)
   - Con `onClick`, `<article>` pasa a `<div role="button" tabIndex={0} aria-label="<título>, de <autor>">`. No se usó `<button>` porque no puede contener `<h3>` ni `<div>`.
   - Enter y Espacio abren el detalle; Espacio hace `preventDefault`. Sin `onClick` no hay role ni tabIndex.
   - Foco: `outline-none focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-[-3px]`. Es un outline hacia adentro que se pinta encima del contenido, así que el `overflow: hidden` de `bookshelf` no lo recorta. `bookshelf` quedó sin tocar (solo un comentario nuevo en `main.css`), por lo que la prolongación del último estante sigue igual.
   - Agregado: `group-focus-visible:` replica el realce de hover (la tapa sube, el título toma el acento y el borde de la ficha se marca). Si el líder prefiere que no haya ningún cambio visual extra, se puede quitar.
   - Se conservan todos los `data-testid`.
5. **`lint:check`**: está en `package.json` y es igual a `lint` sin `--fix`. Se documentó en `docs/verification.md` (verificación final) y en `docs/conventions.md` (Linter).

## Tests
- Nuevo `tests/renderer/test_ui_polish_fixes.test.ts`:
  - Tema claro: `index.html` sin `.dark`; fallback de App ante rechazo y ante `success:false`; preferencia `dark` respetada; SettingsPage preselecciona Claro.
  - Botón: un solo "+".
  - Módulo de estados: cobertura completa de estados, fallback, que los tres archivos importen el módulo sin redeclararlo, que el badge de la ficha use `shelfBadgeClass` y que solo haya tokens.
  - BookCard: role y nombre accesibles, foco, Enter y Espacio (con `preventDefault`), otras teclas ignoradas, sin role cuando no hay `onClick`, clases del anillo hacia adentro, operación desde BookGrid y `data-testid` conservados.
  - Script `lint:check`.
- `tests/services/test_settings_storage_service.test.ts`: tres tests nuevos (default light, tema inválido que cae a light, dark guardado respetado).
- `tests/ipc/test_ipc_contracts.test.ts`: el default de `settings:get` ahora es `'light'`.
- `tests/renderer/test_add_book_modal.test.ts`: espera "Agregar Libro" con un solo svg.

## Documentación
- ADR: `docs/decisions/018-ui-polish-fixes.md`.
- `docs/guides/design-tokens-theming.md`: subsección "Tema por defecto: claro" con diagrama de secuencia.
- `docs/guides/css-grid-bookshelf-layout.md`: §6b "Accesibilidad por teclado" con flowchart; el diagrama de la celda ahora dice `div role=button`.
- `docs/conventions.md`: Linter, regla de `statusConfig.ts` y regla de foco para clickeables que no son `<button>`.

## Notas para el reviewer y el líder
- Quien tenga guardado "Oscuro" ve el papel claro durante el instante que tarda `settings:get`. Se aceptó porque el requisito es que no haya flash oscuro en el caso por defecto. Evitarlo implicaría leer el tema de forma síncrona (preload), que queda fuera de alcance.
- En SettingsPage la opción "Oscuro" sigue listada primero. No se reordenó porque no estaba pedido.
