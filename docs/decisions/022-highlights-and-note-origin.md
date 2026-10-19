# ADR-022: Subrayados y origen de las notas (`highlights_and_note_origin`)

## Estado
Aceptado (pendiente de revisión)

## Contexto

El usuario quiere importar su `My Clippings.txt` del Kindle (feature #23, ver
`progress/explore_kindle_clippings.md`) y pidió *"diferenciar lo escrito por mí sobre el
libro y lo resaltado"*. El archivo trae tres tipos de entradas: resaltados, notas y
marcadores (estos se ignoran). Cada entrada tiene ubicación por **página** o **posición**,
con número suelto o rango, y una fecha con hora. La nota escrita sobre un subrayado lleva
la posición del **final** del subrayado. Reimportar el mismo archivo no debe duplicar nada.

Hasta ahora BookLog solo tenía `Note`: una reflexión sobre el libro entero, sin página
(ADR 006 eliminó `page` a propósito).

Decisiones del usuario (feature_list #22):
- Entidad **Subrayado separada** de las notas.
- `Note` gana un **origen** `MANUAL | KINDLE`.
- Una nota del Kindle atada a un subrayado queda **vinculada** a él y se muestra debajo
  como comentario, pero sigue siendo una nota del usuario.

## Decisión

1. **Nueva entidad `Highlight`** (`bookId`, `content`, `location`, `capturedAt`, `fingerprint`,
   `createdAt`). Huella obligatoria; fecha del dispositivo nullable para no obligar a #23 a
   descartar una entrada cuya fecha no pueda leer. Sin `updatedAt`: no se edita, solo se
   lista y se borra. Use cases `GetBookHighlights` (lanza `BookNotFoundError`) y
   `DeleteHighlight` (lanza `HighlightNotFoundError`, nuevo código IPC `HIGHLIGHT_NOT_FOUND`).
   Canales `highlights:getByBook` y `highlights:delete`.
2. **Value object `AnnotationLocation`** `{ kind: PAGE | LOCATION, start, end | null }`,
   compartido por `Highlight` y `Note`. Normaliza `N-N` a `N`. En la base son tres columnas
   planas (`locationKind`, `locationStart`, `locationEnd`) para poder ordenar y comparar por
   `locationStart` con SQL (la importación necesita "el subrayado que termina en X").
3. **`Note` ampliada**: `origin` (default `MANUAL`), `highlightId?`, `location?`,
   `capturedAt?`, `fingerprint?`. Invariantes de dominio: una nota `MANUAL` no lleva
   metadatos de importación (se mantiene la idea de ADR 006 para las notas a mano); una
   `KINDLE` exige huella. `Note.createImported` es la fábrica para #23; `Note.create` sigue
   igual para el modal.
4. **Integridad en la base**:
   - `Highlight.bookId` → `ON DELETE CASCADE` (como las notas).
   - `Note.highlightId` → `ON DELETE SET NULL`: borrar un subrayado no borra lo escrito por
     el usuario.
   - `@@unique([bookId, fingerprint])` en ambas tablas: la huella es única **por libro**
     (si el usuario reasigna títulos del Kindle a otro libro en #23, la misma huella puede
     existir en otro). En `Note` es nullable y SQLite admite varios `NULL`.
5. **`capturedAt` es un instante** (fecha y hora del Kindle), no un día calendario como
   `finishedAt` (ADR 020). Se nombra igual en ambas entidades para que #24 pueda tomar "la
   última anotación importada" sin distinguir tipos.
6. **Migración no destructiva** `20261019120000_add_highlights_and_note_origin`, generada con
   `prisma migrate diff` (shadow DB temporal). Recrea `Note` copiando filas porque SQLite no
   agrega FKs con `ALTER TABLE`; las notas existentes quedan `MANUAL` por el `DEFAULT`. Se
   aplicó a `prisma/dev.db` con `prisma migrate deploy`. Un test aplica las migraciones
   anteriores, inserta una nota, aplica la nueva y verifica que la nota sigue y es `MANUAL`.
7. **UI del detalle**: la sección "Notas e Ideas" pasa a llamarse **"Mis notas"** (todas las
   `Note`, con etiqueta "Kindle", ubicación y "Sobre un subrayado" cuando corresponde) y se
   agrega la sección **"Subrayados"** (`HighlightsSection`) con texto como cita, ubicación,
   fecha y las notas vinculadas debajo. Las notas del Kindle se fechan y ordenan por
   `capturedAt` (cuándo se escribieron), no por `createdAt` (cuándo se importaron). Se
   conservan todos los `data-testid` y el botón "+ Nueva Idea". Solo tokens de color.
   Borrar un subrayado no pide confirmación, igual que borrar una nota; el `title` del botón
   aclara que las notas se conservan.

## Alternativas descartadas

- **Una sola tabla `Annotation` con `type = NOTE | HIGHLIGHT`**: mezcla lo escrito por el
  usuario con lo resaltado, que es justamente lo que el usuario quiere separar, y obliga a
  columnas que solo valen para un tipo (`updatedAt`, `origin`).
- **Ubicación como texto libre (`"pos. 1200-1205"`) o JSON**: no se puede ordenar ni
  comparar en SQL; la importación necesita comparar posiciones finales.
- **`ON DELETE CASCADE` en `Note.highlightId`**: borraría notas del usuario al borrar un
  subrayado.
- **Huella única global**: impediría que dos libros tengan la misma entrada si el usuario
  corrige la asociación de títulos en #23; además el dedupe tiene sentido dentro de un libro.
- **Reutilizar `createdAt` como fecha del Kindle**: perdería cuándo se importó y obligaría a
  `Note.create` a aceptar fechas arbitrarias.
- **Calcular la huella en el dominio ahora**: depende del formato de entrada que define #23
  (qué campos se normalizan); se deja a esa feature y el dominio solo exige que no esté vacía.
- **Confirmación modal al borrar un subrayado**: no existe para notas; se mantuvo la
  coherencia con el flujo actual.

## Diagrama

Ver diagrama de clases y ER en `docs/guides/annotations-model.md`.
