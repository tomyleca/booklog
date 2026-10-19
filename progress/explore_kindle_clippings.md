# Exploración: My Clippings.txt real del usuario (Kindle Paperwhite)

> Escrito por el leader el 2026-10-19. Muestra real copiada (NO commitear) en:
> `C:\Users\Tomas\AppData\Local\Temp\claude\C--Users-Tomas-Desktop-BookLog-booklog\67f66836-2512-4e82-a8f2-72891fd2c23e\scratchpad\kindle\My Clippings.txt`
> Los fixtures de tests deben ser recortes **anonimizados** (texto de subrayados/notas reemplazado), nunca el archivo completo.

## Conexión del dispositivo
- El Kindle se conecta por **MTP** (aparece como `Este equipo\Kindle Paperwhite\Internal Storage\documents`), **no** como unidad con letra. `Get-PSDrive` solo muestra C: y E:.
- Node/`fs` no puede leer rutas MTP, y el diálogo nativo de Electron (que fuerza rutas de sistema de archivos) tampoco permite elegir archivos de un dispositivo MTP.
- Lo que sí funcionó: PowerShell con `Shell.Application` → `Namespace(17)` ("Este equipo") → ítem `Kindle Paperwhite` → `Internal Storage` → `documents` → `My Clippings.txt`, y `Namespace(destino).CopyHere(item, 16)`. La copia es **asíncrona**: hay que esperar a que el archivo aparezca con el tamaño esperado (`ExtendedProperty('System.Size')`).

## Formato
- UTF-8 **con BOM**, finales de línea **CRLF**. Separador de entradas: línea `==========`.
- Cada entrada: línea 1 = título del libro (con autor entre paréntesis al final), línea 2 = metadatos, línea en blanco, cuerpo.
- **2652 entradas, 40 títulos distintos.**

### Tipos de encabezado encontrados (N = número)
| Encabezado | Cantidad |
|---|---|
| `- Tu resaltado en la página N` / `N-N` | 889 + 5 |
| `- Tu resaltado en la posición N-N` / `N` | 720 + 5 |
| `- La nota en la página N` | 571 |
| `- La nota en la posición N` | 251 |
| `- El marcador en la página N` / `posición N` | 6 + 9 |
| `- Your Highlight on page N` | 65 |
| `- Your Highlight on Location N-N` | 98 |
| `- Your Note on page N` | 30 |
| `- Your Bookmark on Location N` | 3 |

- Formato de la línea de metadatos: `- <tipo> en la <página|posición> <N[-N]> | Añadido el <día>, <N> de <mes> de <AAAA> <H:MM:SS>`.
- **Idiomas mezclados:** hay entradas con encabezado en inglés pero **fecha en castellano**: `- Your Highlight on Location N-N | Added on martes, N de julio de N N:N:N`. El parser debe reconocer el tipo y la fecha por separado (ES/EN cada uno).
- Las referencias pueden ser por **página** o por **posición**, y como número suelto o rango.
- Cuerpos vacíos: todos los marcadores (18) y 7 resaltados. → **Ignorar marcadores y resaltados vacíos** (decisión del usuario: "no pongas marcadores sin texto").
- Hay muchas notas (852): la nota escrita sobre un subrayado tiene la posición/página del **final** del subrayado al que se refiere.

## Títulos (muy sucios)
Patrones vistos:
- `Título -- Autor -- año -- editorial -- isbn13 978... -- <hash md5> -- Anna’s Archive (Autor)`
- `Título - Autor (Autor)`
- `Título (Autor) (Z-Library) (Autor)`
- `_OceanofPDF.com_Eisenhorn_The_Omnibus_-_Dan_Abnett (Dan Abnett)`
- `Borges, Jorge Luis - Ficciones [19293] (r1.2) (Jorge Luis Borges)`
- `De-animales-a-dioses-Breve-historia-de-la-humanidad - Yuval Noah Harari (...)` (guiones en lugar de espacios)
- `Legado de cenizas _ La historia de la CIA -- ...` (`_` en lugar de `:`)
- Sin autor: `Moby-Dick  `, `Jorge_Luis_Borges_ficciones  ` (con espacios al final)
- Autor como `Apellido, Nombre`.
- **El mismo libro aparece con dos títulos distintos** (p. ej. "Legado de cenizas" ×2, "Ficciones" ×2): el agrupado debe permitir que varios títulos del Kindle apunten al mismo libro de la biblioteca.
- Varios títulos traen **ISBN** (`isbn13 978...` o un 978... suelto): si coincide con `Book.isbn`, es la asociación más fiable.

## Implicaciones de diseño
1. Normalizar títulos antes del match: quitar segmentos `-- ...`, sufijos `(Z-Library)`, `Anna’s Archive`, hashes hex de 32 caracteres, `[NNNN] (rX.Y)`, prefijos `_OceanofPDF.com_`; `_`/`-` → espacios; trim; minúsculas y sin acentos para comparar.
2. Prioridad de match: ISBN → título normalizado + autor → título normalizado parecido (similitud) → sin match.
3. Fechas en castellano con día de la semana y mes en texto; hora local.

## Diagnóstico 2026-10-19: My Clippings.txt dejó de actualizarse

- Kindle Paperwhite con firmware **5.20.1** (`system/version.txt`).
- Hay **un solo** `documents/My Clippings.txt`. Su última modificación es del **30/7/2026 19:52**. `My Clippings.sdr` contiene solo el estado de lectura del propio archivo (.mbs/.mbp1), no subrayados.
- Los libros recientes (desde ~ago 2026) se guardan en `documents/Downloads/Items01/` como `.kfx`, cada uno con su `.sdr`.
- Las carpetas `.sdr` de los libros con subrayados anteriores tienen `.yjr` grandes (5–28 KB). En cambio, Drácula y Frankenstein (leídos y subrayados en el aparato en ago–sep 2026) tienen un `.yjr` de **233 bytes** que solo contiene `font.prefs`, `sync_lpr`, `next.in.series.info.data` y `annotation.cache.object`. **No hay anotaciones locales** en ese archivo.
- Conclusión: desde fines de julio de 2026, el Kindle no escribe los subrayados nuevos ni en `My Clippings.txt` ni en el `.sdr` del libro. Probablemente se guardan en una base interna que no se ve por USB/MTP y se sincronizan con la nube de Amazon. Leer `.sdr` **no** recupera esos subrayados.
- Vía alternativa a evaluar: la exportación de la app de Kindle para PC/Mac (Cuaderno/Notebook) para documentos personales guardados en la nube. Incluiría también las notas escritas en el celular.

## Exportación del Cuaderno de la app de Kindle para PC (fuente para subrayados desde ago 2026 y notas del celular)

Muestras reales del usuario (NO commitear; derivar fixtures anonimizados):
- `E:\Tomas\Documents\Frankenstein, o el moderno Prometeo -- Mary Shelley -- 1818 -- ePubLibre -- e989a68d586e1781632452c30b20c6e9 -- Anna’s Archive-Bloc de notas.html` (solo subrayados, con capítulos "Carta II > Posición N").
- `E:\Tomas\Documents\El crepúsculo de los ídolos -- Friedrich Nietzsche -- 1889 -- a47b006f213f82cce713e9691e593bff -- Anna’s Archive-Bloc de notas.html` (subrayados + notas, una nota multilínea escrita en el celular).

Formato (app de Kindle en castellano; se espera "Highlight"/"Note"/"Location"/"Page" en inglés y el sufijo "-Notebook.html"):
- Nombre de archivo: `<título crudo>-Bloc de notas.html`, guardado en la carpeta Documentos del usuario (`app.getPath('documents')`; acá redirigida a `E:\Tomas\Documents`).
- XHTML UTF-8 **mal formado**: `<h3 class='noteHeading'>…</div><div class='noteText'>…</h3>`. Hay que parsear de forma tolerante (regex/tokenizado por `noteHeading`/`noteText`, no un parser XML estricto).
- `div.bookTitle` = título crudo, igual de sucio que en My Clippings (reusar `normalizeKindleTitle`); `div.authors` = autor limpio.
- `h2.sectionHeading` = capítulo/sección (opcional).
- Encabezado de entrada: `Subrayado (<span class='highlight_<color>'>amarillo</span>) - [Capítulo X &gt; ]Posición N` o `Nota - [Capítulo X &gt; ]Posición N`. También puede venir `Página N`. Colores: yellow, blue, pink, orange. Entidades HTML (`&gt;`, etc.).
- **Sin fechas** y **sin posición final**: solo la de inicio.
- Las notas aparecen **inmediatamente después** del subrayado al que comentan, con posición = inicio del subrayado + 0..2 (p. ej. subrayado 1265 → nota 1267; 1427 → 1427).
- Un subrayado partido entre páginas aparece como dos entradas consecutivas con la misma o la siguiente posición (p. ej. "Posición 58" ×2): son subrayados distintos, no duplicados.
- Las notas pueden ser multilínea (saltos de línea dentro de `noteText`).
