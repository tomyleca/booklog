# ADR-026: Importar exportaciones del Cuaderno de la app de Kindle (`kindle_app_notebook_import`)

## Estado
Aceptado (pendiente de revisión)

## Contexto

Desde fines de julio de 2026 (firmware 5.20.1) el Kindle del usuario dejó de escribir los
subrayados nuevos en `My Clippings.txt` y en los `.sdr` (diagnóstico en
`progress/explore_kindle_clippings.md`): la importación de #23/#25 ya no ve nada nuevo. La app
de Kindle para PC sí muestra todo lo sincronizado con la nube (incluidas las notas escritas en
el celular) y permite **Exportar cuaderno**: un HTML por libro en Documentos
(`<título>-Bloc de notas.html` o `-Notebook.html`), XHTML mal formado, con color y capítulo
pero **sin fechas ni posición final**.

Decisiones del usuario (descripción de la #26): buscar las exportaciones automáticamente en una
carpeta (Documentos por defecto, configurable); recordar las ya importadas; un subrayado o nota
con el mismo libro, la misma ubicación de inicio y el mismo texto que uno existente no se crea
(gana el existente), también contra lo importado de My Clippings; guardar y mostrar el color;
los subrayados de la exportación quedan sin fecha.

## Decisión

1. **Dominio puro** (`src/shared/domain/services/kindle/`):
   - `parseKindleNotebook`: tokeniza por etiquetas de apertura con las clases conocidas; el
     contenido de cada una llega hasta el primer cierre de bloque o la próxima etiqueta
     conocida. Decodifica entidades, conserva saltos de línea, entiende ES/EN
     (`Subrayado/Nota/Posición/Página`, `Highlight/Note/Location/Page`), el color por clase
     `highlight_<color>` (o por nombre) y el capítulo antes de `>`. Ignora marcadores y vacíos;
     cuenta como no reconocidos los que no tienen tipo o ubicación numérica.
   - `resolveKindleNotebook`: conserva todas las entradas (la exportación es el estado actual,
     no un historial). Cada nota se vincula al **subrayado inmediatamente anterior** del
     archivo si `0 ≤ nota − inicio ≤ 2 + ⌈largo/100⌉` posiciones (por página, `0..1`); si no,
     queda suelta. Huella `kindle-nb-v1:` = hash de tipo + inicio + texto normalizado.
   - `annotationDedupeKey`: inicio (posición, o página si no hay) + texto normalizado (NFC,
     espacios colapsados, trim). Solo el inicio porque la exportación no tiene fin.
   - `HighlightColor` (`YELLOW | BLUE | PINK | ORANGE`) y `Highlight.color` opcional.
   - `ImportedNotebookFile` (ruta + fecha de modificación) y su port.
2. **Aplicación**:
   - `KindleAnnotationWriter` (nuevo, `application/services/`): escritura común de las dos
     importaciones. Omite por huella (reimportar la misma fuente) **y** por clave de contenido
     contra anotaciones del mismo tipo del libro (otra fuente). Si omite un subrayado por
     contenido, las notas que lo comentan se vinculan al existente. `CommitKindleImport` se
     refactorizó para usarlo, así el dedupe entre fuentes vale en los dos sentidos.
   - `groupAssignmentsByBook` y `loadKindleMatchCandidates` extraídos y compartidos.
   - `PreviewKindleNotebookImport`: un grupo por archivo con la **misma forma**
     (`KindleImportGroupPreview`) más `fileName` e `importState` (`NEW | IMPORTED | CHANGED`);
     el autor de `div.authors` tiene prioridad sobre el deducido del título.
   - `CommitKindleNotebookImport`: valida asignaciones y libros antes de escribir, escribe con
     el escritor común y guarda ruta + mtime de cada archivo importado.
3. **Persistencia**: migración no destructiva `20261019200000_highlight_color_and_notebook_imports`
   (`ALTER TABLE "Highlight" ADD COLUMN "color"` + tabla `ImportedNotebookFile` con `path`
   único). Aplicada a `prisma/dev.db` con `prisma migrate deploy`.
4. **Dónde recordar los archivos importados: SQLite**, no `settings.json`. Es un dato ligado a
   la biblioteca (si se borra la base, también los subrayados que generaron esos archivos, y
   la marca "ya importado" debe desaparecer con ellos); `architecture.md` pide que la
   persistencia de datos vaya por SQLite; y el use case lo consume por un port, testeable sin
   disco.
5. **La carpeta sí va en `settings.json`** (mecanismo de #15): es una preferencia de la app.
   No forma parte de `AppSettingsDTO`: solo el main la cambia (`setKindleNotebookFolder`) tras
   el diálogo nativo de carpetas, y `settings:save` la ignora; el renderer nunca manda rutas.
6. **Main**: `KindleNotebookScanner` lee la carpeta con `fs` (sin PowerShell, no es MTP), sin
   subcarpetas, filtra `*-Bloc de notas.html` / `*-Notebook.html`, máx. 20 MB por archivo. La
   sesión del `KindleImportSessionStore` pasa a ser una unión (`CLIPPINGS | NOTEBOOK`) y
   `kindle:commit` despacha según el tipo. Canales nuevos `kindleNotebook:preview`,
   `kindleNotebook:getFolder`, `kindleNotebook:chooseFolder`, `kindleNotebook:resetFolder`.
   Carpeta ilegible → `KindleFileError` (`KINDLE_FILE_ERROR`).
7. **UI**: botón "Importar exportaciones de la app" junto a los de #23 y campo de carpeta
   (`KindleNotebookFolderField`: "Cambiar carpeta…", "Usar Documentos"). `KindleImportModal`
   acepta la fuente `NOTEBOOK`: mismo matching, orden, "+ Crear libro…" con búsqueda
   precargada y "No importar"; muestra el archivo y el estado, y los ya importados arrancan en
   "No importar". `HighlightsSection` muestra una marca de color con tokens nuevos
   `highlight-yellow|blue|pink|orange` (claro y oscuro). Se conservan los `data-testid`.
8. **Fecha**: `capturedAt = null`. `suggestFinishedDate` (#24) ya ignora anotaciones sin fecha.

## Alternativas descartadas

- **Parser XML/DOM estricto** (`DOMParser`, librería): el HTML cruza etiquetas
  (`<h3>…</div><div>…</h3>`); un parser estricto falla o reubica el texto, y en el main no hay
  DOM. Los tokens por clase son simples y toleran el formato.
- **Reutilizar `resolveKindleAnnotations`**: su vínculo exige que la nota caiga dentro de
  `[inicio, fin]` y la exportación no tiene fin; además descartaría subrayados partidos con la
  misma posición como "editados".
- **Vínculo solo por distancia fija (0..2)**: funciona con la muestra, pero una nota sobre un
  subrayado largo queda varias posiciones después; el margen proporcional al largo lo cubre.
- **Usar la huella `kindle-v1` para la exportación** y deduplicar solo por huella: My
  Clippings incluye el rango en la huella, así que nunca coincidirían. Cambiar `kindle-v1`
  duplicaría todo lo ya importado.
- **Dedupe entre fuentes solo al importar la exportación**: el usuario pidió "gana lo
  existente"; aplicarlo en los dos sentidos evita duplicados si importa primero la exportación.
- **Reemplazar el subrayado de My Clippings por el de la exportación** (para ganar el color):
  perdería la fecha, que es la que usa #24.
- **Recordar archivos en `settings.json`**: sobreviviría a borrar la base y marcaría como
  importado algo que ya no está.
- **Mandar la ruta de la carpeta desde el renderer** (`settings:save`): rompería la regla de
  #23 de que el renderer no elige rutas que lee el main.
- **Recorrer subcarpetas**: la app exporta en una sola carpeta; recorrer Documentos completo
  sería lento e inesperado.
- **Una vista previa nueva para la exportación**: duplicaría matching, orden y alta de libro;
  se extendió `KindleImportGroupPreview` con campos opcionales.

## Resultados con las muestras reales

| Exportación | Entradas | Subrayados | Notas | Vinculadas |
|---|---|---|---|---|
| El crepúsculo de los ídolos | 60 | 53 | 7 (1 multilínea) | 7 |
| Frankenstein | 8 | 8 | 0 | — |
| Tercera exportación de la carpeta | 49 | 48 | 1 | 1 |

0 no reconocidas, 0 vacías, 0 huellas repetidas.

## Diagrama

Ver `docs/guides/kindle-clippings-import.md` §9 (flujo, regla de vínculo y dedupe entre
fuentes).
