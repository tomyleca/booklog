# ADR-019: Portadas locales visibles: CSP y fallback local → remoto (`fix_cover_display`)

## Estado
Aceptado (pendiente de revisión)

## Contexto

Las portadas de Google Books se descargaban bien a `userData/covers/<uuid>.jpg` y se
guardaban como `coverPath = covers/<uuid>.jpg`. El renderer las pide como
`booklog-media://covers/<uuid>.jpg` (ver ADR-007), pero la CSP de
`src/renderer/index.html` era `img-src 'self' data: https:`. Chromium bloqueaba la imagen
antes de llegar al handler del protocolo, la `<img>` disparaba `onError` y se mostraba el
placeholder. Además, `resolveCoverUrl(coverPath, coverUrl)` solo usa `coverUrl` cuando
`coverPath` está vacío: si la copia local fallaba, nunca se probaba la remota.

## Decisión

1. **CSP**: agregar `booklog-media:` a `img-src` y a ninguna otra directiva:
   `img-src 'self' data: https: booklog-media:`.
2. **Fallback compartido**:
   - `buildCoverCandidates(coverPath, coverUrl)` en `services/coverService.ts` devuelve la
     lista ordenada `[local, remota]` (sin vacíos ni duplicados).
   - Hook `useCoverSource(coverPath, coverUrl)` en `src/renderer/src/hooks/` devuelve
     `{ src, onError }`; cada `onError` avanza al siguiente candidato y `src === null`
     significa placeholder. El contador de fallos se guarda junto con la lista a la que
     pertenece, así que si cambian los datos del libro la cadena se reinicia en el mismo
     render (sin `useEffect`).
   - BookCard, BookDetailPage y DashboardPage (libros recientes) usan el hook. Se elimina
     el `imageError` duplicado y el reset manual del detalle. Sin cambios visuales; se
     conservan los `data-testid`.
3. **Tests** (`tests/renderer/test_fix_cover_display.test.ts`): `img-src` exacto, que
   `booklog-media:` no aparezca en otras directivas, el helper, el hook y la cadena
   local → remota → placeholder en los tres componentes.

Verificado también en Electron real con un harness fuera del repo (userData temporal):
con la CSP nueva la imagen `booklog-media://` carga; con la anterior, da error.

## Alternativas descartadas

- **Servir las portadas como `data:` (base64) por IPC**: evita tocar la CSP, pero lee
  archivos enteros a memoria y engorda el tráfico IPC; contradice ADR-007.
- **Relajar la CSP (`img-src *` o quitar el `<meta>`)**: abre orígenes innecesarios.
- **Fijar la CSP vía `session.webRequest.onHeadersReceived` en main**: más piezas y la
  regla quedaría lejos del HTML que hoy la declara; se mantiene un solo lugar.
- **Lógica de fallback copiada en cada componente**: era la causa de que el bug estuviera
  triplicado; un hook la centraliza.
- **Solo arreglar la CSP sin fallback**: una portada local borrada o corrupta seguiría
  mostrando placeholder aunque exista `coverUrl`.
