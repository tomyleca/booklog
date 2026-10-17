# Reporte implementer — Feature #16 `retro_library_theme`

> Transcripto por el leader desde el mensaje de entrega del implementer
> (el entorno no le permitió escribir este archivo).

Estado: ready-for-review (feature en `in_progress`, sin commits).

## Verificación (según implementer)
- `.\init.ps1` OK: 21 archivos de test, 364 tests verdes.
- `pnpm run typecheck` OK · `eslint .` 0 problemas · `pnpm run build` OK.
- data-testid de cada .tsx modificado idénticos a HEAD (comparado por script).
- Capturas en Electron (harness con preload falso, fuera del repo) de Biblioteca, Dashboard, Detalle, Settings, modal Agregar libro y drawer, en ambos temas.

## Archivos
- `src/renderer/src/assets/main.css`: tokens `@theme` (valores claros) + reasignación bajo `.dark` en `@layer base`; sombras `--relief-*`; Lora en `html`, Libre Baskerville en `h1–h4`; utilidades `texture-paper`, `texture-wood` (SVG inline), `ficha`, `ficha-float`, `rule-double`; scrollbar con `::-webkit-scrollbar`.
- `src/renderer/src/main.tsx`: imports @fontsource (Lora variable normal+itálica; Libre Baskerville latin 400/400-italic/600/700).
- `src/renderer/index.html`: CSP con `font-src 'self' data:`.
- `package.json`, `pnpm-lock.yaml`: `@fontsource-variable/lora@5.3.0`, `@fontsource/libre-baskerville@5.3.0`.
- Migrados a tokens (sin colores crudos ni `dark:`): `App.tsx`; components AddBookModal, AddNoteModal, BookCard, EmptyLibraryState, NavigationDrawer, StatusFilterTabs, TitleBar, UpdateProgressModal; pages BookDetailPage, DashboardPage, LibraryPage, SettingsPage. `BookGrid.tsx` sin cambios (estantería = #17).
- Tests: `tests/renderer/test_google_books_search.test.ts` ahora valida `text-accent`; nuevo `tests/renderer/test_retro_library_theme.test.ts` (45 tests: tokens, override .dark, custom-variant, contraste AA, estados distintos, texturas data URI sin URLs remotas, fuentes, CSP, sin colores crudos/`dark:`, clases de color ⊂ tokens).
- Docs: `docs/guides/design-tokens-theming.md` (4 diagramas Mermaid, agregado a README de guías), `docs/decisions/016-retro-library-theme.md`, `docs/conventions.md` sección CSS reescrita.

## Paleta (claro / oscuro)
| Token | Claro | Oscuro |
|---|---|---|
| paper | #f2e8d5 | #1c1410 |
| card | #fbf5e9 | #271c16 |
| well | #ebe0cb | #140e0b |
| shelf | #e6d7bc | #33261d |
| chrome | #3a2a1f | #120c09 |
| backdrop | #1a120c | #0b0705 |
| ink | #2e2018 | #eee0c8 |
| ink-muted | #5c4636 | #c2ad90 |
| ink-faint | #7d6753 | #9e8870 |
| chrome-ink | #ebddc4 | #e3d2b5 |
| chrome-muted | #bca88a | #a08b70 |
| rule | #d3bf9c | #45352a |
| rule-strong | #b09572 | #64503f |
| accent | #8a4b22 | #d9a25b |
| accent-strong | #713a18 | #e8b874 |
| accent-ink | #fbf5e9 | #1c1410 |
| brass | #c9974a | #d9a25b |
| leather | #7a2e25 | #7e3528 |
| spine | #2f4a3a | #4f7258 |
| danger | #a3352a | #e58a78 |
| success | #4e6b30 | #a7c285 |
| star | #b07a22 | #e9b85a |
| status-to-read | #3f5f7a | #9db9d0 |
| status-reading | #4e6b30 | #afc889 |
| status-paused | #8a5e12 | #e6bc64 |
| status-finished | #6e3f68 | #d3a6cb |
| status-abandoned | #a3402f | #ec9580 |

`spine` reservado para #17. Contrastes: ink/paper 12.9/13.9; ink-muted/card 8.1/7.6; ink-faint/card 4.9/≥4.5; accent/card 6.2/7.3; status-* sobre card 4.6–9.3.

## Decisiones (detalle en ADR 016)
- `@theme` = tema claro; `.dark` reasigna las mismas variables → ningún componente usa `dark:`. themeService y selector sin cambios.
- Lora para texto, Libre Baskerville para títulos.
- Titlebar y cabecera del drawer en madera; emblemas de cuero con ícono latón; formato `ficha` en tarjetas/secciones/notas/modales; filete doble bajo encabezados; esquinas menos redondeadas.
- Badges en BookCard con fondo `card` sólido sobre la tapa; en Detalle/Dashboard `status/10`.
- Cambios menores: textos de descripción de temas en Settings; `border-l-4` en ítems del drawer; `border-transparent` en botones inactivos del nav.

## Pendientes señalados
- `AGENTS.md` §3 aún dice "Funcionalidad antes que estética".
- `STATUS_CONFIG` duplicado en BookCard, BookDetailPage, DashboardPage (refactor fuera de scope).
- Botón "+ + Agregar Libro" (ícono + "+" en texto), preexistente.
