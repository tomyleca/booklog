# ADR-023: Importar subrayados y notas desde My Clippings.txt (`kindle_clippings_import`)

## Estado
Aceptado. La regla de notas editadas (decisión 2) fue reemplazada por el ADR 025
(una nota por ubicación, la más reciente).

## Contexto

El usuario quiere traer a BookLog lo que subraya y anota en su Kindle Paperwhite. La
exploración (`progress/explore_kindle_clippings.md`) mostró que:

- El Kindle se conecta por **MTP**: no tiene letra de unidad, Node no puede leer la ruta y
  el diálogo nativo de Electron no deja elegir archivos dentro del dispositivo.
- `My Clippings.txt` es UTF-8 con BOM y CRLF, mezcla encabezados en castellano e inglés
  (incluso encabezado en inglés con fecha en castellano), referencia por página, posición
  o ambas, y solo **agrega**: editar un subrayado o una nota deja las dos versiones.
- Los títulos vienen muy sucios (descargas de Anna’s Archive, Z-Library, OceanofPDF,
  ePubLibre) y el mismo libro puede aparecer con dos títulos distintos.

El modelo de anotaciones ya existe (ADR 022): `Highlight`, `Note.origin = KINDLE`,
`highlightId` con `SET NULL` y huella única por libro.

Decisiones del usuario (descripción de la #23 y respuestas al bloqueo del 2026-10-19):

1. Parser ES/EN; ignorar marcadores y resaltados vacíos; subrayados editados → el más
   nuevo; dedupe por huella; match ISBN → título + autor → similitud; vista previa por
   libro con selector, "crear libro" precargado y "No importar"; varios títulos al mismo
   libro; Kindle por PowerShell con fallback a archivo.
2. **Notas editadas**: quedarse con la versión final. Se descarta una nota si una más nueva
   en la misma ubicación empieza con su texto (incluye duplicados exactos); notas
   distintas en la misma ubicación se importan todas.
3. **Vínculo nota → subrayado**: la nota se vincula si su ubicación cae **dentro** del rango
   `[inicio, fin]` del subrayado, ambos inclusive (*"con que esté dentro del subrayado está
   bien"*). Primero por posición; si alguna de las dos entradas no trae posición, por
   página. Varios candidatos: gana el de fin más cercano a la nota; si empatan, el más
   reciente anterior a la fecha de la nota. Sin candidato, nota suelta.
4. **Ubicación**: guardar **página y posición**, ambas opcionales. En la UI se muestra la
   página si existe y si no la posición. La posición se usa para el vínculo y la huella.
5. El botón "Importar del Kindle" va en una sección nueva de **Configuración**.

## Decisión

1. **Lógica pura en el dominio** (`src/shared/domain/services/kindle/`), un archivo por
   responsabilidad: `parseKindleDate`, `parseKindleClippings`, `normalizeKindleTitle`,
   `matchKindleBook`, `kindleFingerprint`, `resolveKindleAnnotations`,
   `groupKindleClippings`. Sin I/O ni dependencias de Node (el hash es cyrb53 en JS puro).
2. **Parser tolerante**: el tipo, la página/posición y la fecha se reconocen por separado,
   en castellano o inglés (fechas US con AM/PM y UK). Los bloques que no entiende se
   cuentan como "no reconocidos" en vez de abortar la importación.
3. **Grupos por encabezado exacto**: dos encabezados del mismo libro son grupos distintos
   (sus posiciones no son comparables, son ediciones distintas). El dedupe y el vínculo se
   resuelven dentro de cada grupo; el usuario asigna cada grupo a un libro.
4. **Subrayado editado** = rangos que se tocan **y** comparten texto (contención o 25+
   caracteres en común). Medido sobre la muestra real: todos los pares que se pisan más de
   una posición comparten texto, y 311 pares contiguos que solo comparten la posición de
   borde no comparten texto (son subrayados distintos). Se conserva el más reciente (fecha
   y, a igual fecha, orden en el archivo).
5. **Matching con confianza**: ISBN (13 canónico, convierte ISBN-10) → `HIGH`; mismo título
   (completo o principal antes de `:`) + autor → `HIGH`; mismo título sin autor → `MEDIUM`,
   con autor distinto → `LOW`; similitud Dice de bigramas ≥ 0.6 (+0.15 si coincide el
   autor) → `MEDIUM` desde 0.85, si no `LOW`. Es solo una propuesta: la UI la deja corregir.
6. **Huella** `kindle-v1:<hash>` de tipo + posición (o página si no hay) + texto con espacios
   colapsados. No incluye título ni fecha.
7. **Dos use cases**: `PreviewKindleImport` (parsea, agrupa, resuelve para mostrar
   cantidades reales y propone libro; no escribe) y `CommitKindleImport` (recibe
   `{ groupKey, bookId }[]`, valida **todos** los libros antes de escribir, lee las huellas
   existentes de cada libro, crea `Highlight` y `Note.createImported` y vincula notas a
   subrayados nuevos o importados antes). Devuelve el informe importados / omitidos.
   `InvalidKindleImportError` (dominio) para asignaciones inválidas.
8. **Main process**:
   - `KindleDeviceService.readFromDevice()` ejecuta un **script constante** con
     `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand`
     vía `execFile` (sin shell). La carpeta destino y el timeout viajan por variables de
     entorno: nada del usuario se interpola. El script recorre `Shell.Application`
     → `Namespace(17)` y **todos** los almacenamientos de **todos** los dispositivos
     buscando `documents\My Clippings.txt` (no se hardcodea "Kindle Paperwhite"; una unidad
     con letra se copia con `Copy-Item`), usa `CopyHere` y espera a que el archivo tenga el
     tamaño esperado (`System.Size`) o estable y se pueda abrir en exclusiva, con timeout de
     60 s (+30 s de margen en Node). Copia a `userData/kindle-import/<uuid>` y borra la
     carpeta después de leer.
   - Errores tipados `KindleDeviceError(NOT_FOUND | TIMEOUT | UNSUPPORTED | FAILED)` y
     `KindleFileError`, traducidos a códigos IPC nuevos (`KINDLE_NOT_FOUND`,
     `KINDLE_COPY_TIMEOUT`, `KINDLE_UNSUPPORTED`, `KINDLE_DEVICE_ERROR`, `KINDLE_FILE_ERROR`,
     `KINDLE_SESSION_EXPIRED`).
   - `PowerShellRunner` inyectable para testear sin dispositivo.
   - Fallback `dialog.showOpenDialog` con filtro `.txt`; cancelar devuelve `data: null`.
9. **IPC** `kindle:previewFromDevice`, `kindle:previewFromFile`, `kindle:commit`. El texto
   leído queda en memoria del main (`KindleImportSessionStore`, máx. 3 sesiones) y el
   renderer solo recibe un `sourceId`: nunca manda rutas ni el contenido de vuelta. Tras el
   commit la sesión se borra.
10. **UI**: sección "Importar del Kindle" en Configuración (botón principal + "Elegir
    archivo .txt"). `KindleImportModal`: lectura, error con reintento/fallback, vista previa
    por grupo (título y autor normalizados, encabezado original, cantidades, badge de
    confianza, selector con "No importar", "+ Crear libro…" y los libros), totales,
    confirmación e informe. "Crear libro" abre el `AddBookModal` existente con título,
    autor e ISBN precargados; `AddBookModal` ganó `onCreated(book)` para asignar el libro
    nuevo al grupo. Tras importar se invalidan `highlights`, `notes`, `books` y `book`.
    Solo tokens de color.
11. **Ampliación del modelo de #22 (ubicación con página y posición)**:
    `AnnotationLocation` pasa de `{ kind, start, end }` a `{ page, position }`, cada uno
    `{ start, end } | null`, con al menos uno. Se elimina el enum `LocationKind`. Migración
    no destructiva `20261019150000_annotation_page_and_position`: recrea `Highlight` y `Note`
    con `pageStart/pageEnd/positionStart/positionEnd` copiando la ubicación vieja a las
    columnas de página o de posición según `locationKind` (escrita a mano sobre el SQL que
    genera `prisma migrate diff`, que sin eso la perdía). `formatAnnotationLocation` muestra
    la página si existe; el repositorio ordena por posición y luego por página.

## Alternativas descartadas

- **Leer el MTP desde Node** (`fs`, `usb`, librerías MTP nativas): `fs` no ve rutas MTP y
  una dependencia nativa complica el empaquetado de Electron; el Shell de Windows ya resuelve
  el acceso.
- **Interpolar la ruta destino en el script** o usar `exec` con shell: riesgo de inyección
  y de comillas rotas con rutas con espacios o acentos.
- **Escribir un `.ps1` temporal y ejecutarlo con `-File`**: deja archivos sueltos y depende
  de la política de ejecución; `-EncodedCommand` no.
- **Confiar en que `CopyHere` terminó al volver**: es asíncrono; el proceso de PowerShell
  terminaría antes y cortaría la copia.
- **Mandar el texto o la ruta del archivo de vuelta en el commit**: el renderer podría pedir
  leer cualquier ruta; con `sourceId` el main solo usa lo que él mismo leyó.
- **Agrupar por título normalizado** en vez de por encabezado: mezclaría ediciones con
  posiciones incomparables y rompería el dedupe y el vínculo.
- **Dedupe de subrayados solo por solapamiento de rangos**: la muestra tiene cientos de
  subrayados contiguos que comparten la posición de borde y son distintos.
- **Notas: importar todas** (852 en la muestra, la mayoría borradores del autoguardado) o
  **solo la más nueva por ubicación** (46, perdería notas distintas): el usuario eligió la
  versión final por prefijo.
- **Vínculo solo si la nota está exactamente en el fin del subrayado**: en la muestra
  vinculaba 578 de 852 notas; con "dentro del rango" se vinculan 301 de las 302 finales.
- **Guardar una sola ubicación** (página o posición): perdía información; el usuario pidió
  las dos.
- **Huella con título o fecha**: cambiaría si se mejora la limpieza de títulos o la lectura
  de fechas, y reimportar duplicaría.
- **Transacción única para todo el commit**: los repositorios no exponen transacciones; se
  valida todo antes de escribir y, si algo falla a mitad, reimportar es idempotente gracias a
  las huellas.

## Limitaciones conocidas

- La copia por MTP real solo se probó hasta "no hay dispositivo" (el Kindle no estaba
  conectado al implementar); el flujo con dispositivo se cubre con el runner simulado.
- Si después de importar se edita un subrayado en el Kindle, la reimportación agrega la
  versión nueva y la vieja queda en BookLog (el dedupe de editados es dentro del archivo).

## Diagrama

Ver `docs/guides/kindle-clippings-import.md` (flujo de componentes y secuencias de lectura
del Kindle y del commit).
