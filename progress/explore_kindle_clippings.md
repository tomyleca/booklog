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
