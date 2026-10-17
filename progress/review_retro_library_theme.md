# Review — feature 16 (retro_library_theme)

**Veredicto:** APPROVED

## Verificación ejecutada
- `.\init.ps1` (PowerShell): exit 0. 21 archivos de test, 364 tests verdes.
- `pnpm typecheck`: exit 0.
- Lint sin `--fix`: `pnpm exec eslint . --ext .js,.jsx,.cjs,.mjs,.ts,.tsx,.cts,.mts`: exit 0, sin problemas. `git status` no cambió después de correrlo.
- `pnpm build`: exit 0. Las fuentes salen como assets `.woff2` locales en `out/renderer/assets/`.

## Criterios de aceptación (feature 16)
- [x] Tokens semánticos en `@theme`: `src/renderer/src/assets/main.css:15-67` (paper, card, well, shelf, chrome, ink*, rule*, accent*, brass, leather, spine, danger, success, star, status-*). Las sombras usan las variables `--relief-*`.
- [x] Dos temas sobre el selector de #15. El oscuro reasigna todas las variables bajo `.dark` en `@layer base` (`main.css:81-122`) y se mantiene `@custom-variant dark` (l.3). `themeService.applyTheme` (App.tsx:62-66, SettingsPage.tsx:53) no cambió, así que "Sistema" sigue funcionando igual. El test comprueba que cada token claro tiene su override oscuro con un valor distinto.
- [x] No quedan colores crudos ni `dark:`. Un grep en `src/renderer` buscando `(slate|indigo|sky|emerald|amber|rose|red|...)-\d`, `dark:` y `bg|text|border-(white|black)` encuentra una sola coincidencia, y es el comentario de `main.css:13`. Los badges y barras de estado usan `status-*` y las estrellas `star`. El test `test_retro_library_theme` lo comprueba en cada `.tsx` y además exige que toda clase de color sea un token definido.
- [x] Todas las vistas se migraron: App, TitleBar, NavigationDrawer, Library, BookCard, EmptyLibraryState, StatusFilterTabs, BookDetail, Dashboard, Settings y los 3 modales. No pude validar el aspecto en ambos temas, porque no tengo forma de inspeccionarlo visualmente. Me baso en las capturas que declara el implementer y en las pruebas de contraste.
- [x] Fuentes serif locales con `@fontsource`: `@fontsource-variable/lora` y `@fontsource/libre-baskerville` en `package.json` (dependencies), importadas en `src/renderer/src/main.tsx:3-8`. En `main.css` y en el CSS compilado no hay ninguna URL remota (la única `http` es el namespace SVG `www.w3.org/2000/svg`) ni referencias a googleapis o gstatic.
- [x] Las texturas son SVG `feTurbulence` inline como data URI (`main.css:76-78, 120-121`), sin imágenes externas. El test calcula el contraste WCAG AA (>= 4.5:1) de 16 pares fondo/texto en ambos temas.
- [x] Layouts, data-testid y comportamiento se mantienen:
  - La cantidad de `data-testid` por archivo es idéntica a HEAD en los 14 `.tsx` modificados, y las líneas con testid solo cambian sus clases de color.
  - Comparé por script las clases que no son de color. Solo cambian radios (`rounded-lg/xl/2xl` → `rounded-md`), estilos de borde (sustituidos por las utilidades `ficha` y `rule-double`), tracking y peso en TitleBar y NavigationDrawer, y en BookCard `pt-1`→`pt-2` más un `border-b border-dashed`. Ninguna toca grid, flex ni posicionamiento.
  - En la lógica no hay cambios: solo cambian los strings de `badgeClass`, `barClass` y `textClass`.
  - `BookGrid.tsx` no se tocó, así que la estantería sigue fuera de esta feature (queda para #17).
- [x] `pnpm test`, typecheck, lint y build en verde.

## Puntos específicos pedidos
- **CSP** (`src/renderer/index.html:8`): solo se agrega `font-src 'self' data:`. No se abre ningún origen remoto ni se tocan `script-src`/`default-src`. Hace falta `data:` porque Vite inlinea como data URI los assets menores a 4 KB. Un data URI de fuente no ejecuta código, así que es un cambio mínimo y seguro.
- **Test actualizado** (`tests/renderer/test_google_books_search.test.ts:123-124`): ahora parte el className en clases y comprueba que la pestaña activa tiene exactamente `text-accent` y la inactiva no. Sigue siendo una aserción con sentido: `AddBookModal.tsx:396-411` aplica `text-accent` según `activeTab`, y como compara clases exactas, un `hover:text-accent` no daría un falso positivo.
- **Documentación:**
  - `docs/guides/design-tokens-theming.md` existe, tiene 4 bloques Mermaid y está enlazada en `docs/guides/README.md:22`.
  - `docs/decisions/016-retro-library-theme.md` existe e incluye Estado, Contexto, Decisión, Alternativas descartadas, Consecuencias y Diagrama.
  - La sección CSS de `docs/conventions.md` está actualizada.

## Checkpoints
- C1: [x] Los archivos base y los 3 docs existen. `init.ps1` termina con exit 0.
- C2: [x] Solo #16 está `in_progress`. Las features `done` tienen sus tests en verde. `progress/current.md` describe la sesión activa.
- C3: [x] El cambio está todo en `src/renderer` (piel). No toca domain ni application, y el diff no agrega `console.log`, `any` ni TODOs.
- C4: [x] Hay tests por capa y 364 tests verdes. El build compila.
- C5: [x] No hay archivos sin trackear sospechosos: los nuevos son el test, la guía, el ADR y el reporte. La entrada en `progress/history.md` y el paso de #16 a `done` le tocan al leader al cerrar la sesión (hoy #16 está correctamente en `in_progress`).

## Observaciones (no bloqueantes)
1. `src/renderer/src/pages/SettingsPage.tsx` cambia el texto descriptivo de las opciones de tema ("Biblioteca de noche: nogal, cuero y luz cálida" / "Papel de pergamino con tinta marrón"). Va más allá de lo visual, pero es coherente con la feature y ningún test dependía del texto anterior.
2. `BookCard.tsx`: `pt-1`→`pt-2` y el separador punteado son retoques visuales menores, no cambios de layout. Convendría tenerlos en cuenta en #17, que reemplaza la presentación de la Biblioteca.

## Cambios requeridos
Ninguno.
