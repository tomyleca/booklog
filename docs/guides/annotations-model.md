# Guía: modelo de anotaciones — notas del usuario y subrayados

> Feature #22 (`highlights_and_note_origin`). Prepara la importación del Kindle (#23) y
> la fecha de terminado sugerida (#24). Decisión de arquitectura: `docs/decisions/022-highlights-and-note-origin.md`.

## 1. La pregunta que responde el modelo

El usuario pidió: *"quiero diferenciar lo escrito por mí sobre el libro y lo resaltado"*.
Eso define dos cosas distintas:

| Concepto | Entidad | Quién lo escribió | De dónde viene |
|---|---|---|---|
| **Lo escrito por mí** | `Note` | El usuario | A mano en BookLog (`MANUAL`) o escrito en el Kindle (`KINDLE`) |
| **Lo resaltado** | `Highlight` | El autor del libro (el usuario solo lo marcó) | Hoy solo del Kindle |

Una nota del Kindle **sigue siendo una nota**: aparece en "Mis notas" con una etiqueta
"Kindle". Si en el Kindle se escribió sobre un subrayado, la nota queda **vinculada** a él
(`highlightId`) y también se muestra debajo del subrayado, como comentario.

## 2. Diagrama de clases (dominio)

```mermaid
classDiagram
    class Book {
        +number id
        +string title
    }

    class Note {
        +number id
        +number bookId
        +string content
        +NoteOrigin origin
        +number|null highlightId
        +AnnotationLocation|null location
        +Date|null capturedAt
        +string|null fingerprint
        +Date createdAt
        +Date updatedAt
        +create(bookId, content) Note$
        +createImported(props) Note$
        +updateContent(content)
    }

    class Highlight {
        +number id
        +number bookId
        +string content
        +AnnotationLocation location
        +Date|null capturedAt
        +string fingerprint
        +Date createdAt
        +create(props) Highlight$
    }

    class AnnotationLocation {
        <<value object>>
        +LocationKind kind
        +number start
        +number|null end
    }

    class NoteOrigin {
        <<enumeration>>
        MANUAL
        KINDLE
    }

    class LocationKind {
        <<enumeration>>
        PAGE
        LOCATION
    }

    Book "1" --> "0..*" Note : notas (cascada)
    Book "1" --> "0..*" Highlight : subrayados (cascada)
    Highlight "0..1" <-- "0..*" Note : comenta (SET NULL)
    Note ..> NoteOrigin
    Note ..> AnnotationLocation
    Highlight ..> AnnotationLocation
    AnnotationLocation ..> LocationKind
```

## 3. Piezas del dominio

### `AnnotationLocation` (value object)

El Kindle referencia por **página** (`- Tu resaltado en la página 12`) o por **posición**
(`- Your Highlight on Location 1200-1205`), con un número suelto o un rango. El value
object es inmutable (`Object.freeze`) y lo construye `createAnnotationLocation`, que:

- exige `kind` ∈ `PAGE | LOCATION` y enteros positivos;
- rechaza un fin anterior al inicio;
- normaliza `12-12` a `12` (`end = null`), para que dos referencias equivalentes queden iguales.

`locationLastPoint(location)` devuelve el fin del rango (o el inicio): la importación lo
usará para vincular una nota con el subrayado que termina en esa misma posición.

### `Highlight`

Texto resaltado, ubicación obligatoria, fecha del dispositivo (`capturedAt`, puede ser
`null` si no se pudo leer) y **huella obligatoria** (`fingerprint`). La huella la calcula
la importación (#23); el dominio solo exige que no esté vacía. Un subrayado no se edita:
solo se lista y se borra.

### `Note` ampliada

- `origin` con default `MANUAL`: los datos anteriores a #22 (sin origen) se leen como manuales.
- Invariantes:
  - una nota `MANUAL` **no** puede tener ubicación, fecha del dispositivo ni huella
    (esos datos solo tienen sentido importados; las notas manuales siguen siendo
    reflexiones sobre el libro entero, ver ADR 006);
  - una nota `KINDLE` **necesita** huella, para no duplicarse al reimportar;
  - `highlightId` es opcional y positivo.
- `Note.create` sigue creando notas manuales (el flujo del modal no cambió).
  `Note.createImported` es la puerta de entrada que usará #23.

## 4. Persistencia

```mermaid
erDiagram
    Book ||--o{ Note : "onDelete Cascade"
    Book ||--o{ Highlight : "onDelete Cascade"
    Highlight |o--o{ Note : "onDelete SetNull"

    Note {
        int id PK
        int bookId FK
        string content
        NoteOrigin origin "default MANUAL"
        int highlightId FK "nullable"
        LocationKind locationKind "nullable"
        int locationStart "nullable"
        int locationEnd "nullable"
        datetime capturedAt "nullable"
        string fingerprint "nullable, unico por libro"
    }
    Highlight {
        int id PK
        int bookId FK
        string content
        LocationKind locationKind
        int locationStart
        int locationEnd "nullable"
        datetime capturedAt "nullable"
        string fingerprint "unico por libro"
    }
```

- El value object se guarda en **tres columnas planas** (`locationKind`, `locationStart`,
  `locationEnd`); `AnnotationLocationMapper` hace la conversión en ambos sentidos.
- **Huella única por libro**: `@@unique([bookId, fingerprint])` en las dos tablas. En
  `Note` la columna es nullable; SQLite considera distintos todos los `NULL` de un índice
  único, así que las notas manuales (sin huella) no chocan entre sí.
- **Borrar un subrayado no borra notas**: la FK `Note.highlightId` es `ON DELETE SET NULL`.
  La nota del usuario sobrevive y queda suelta en "Mis notas".
- **Borrar un libro** borra en cascada sus notas y subrayados.
- La migración `20261019120000_add_highlights_and_note_origin` es no destructiva: Prisma
  recrea la tabla `Note` (SQLite no puede agregar una FK con `ALTER TABLE`) copiando todas
  las filas; `origin` toma el `DEFAULT 'MANUAL'`.

### Fechas: instante, no día calendario

`capturedAt` es la fecha **con hora** que escribe el Kindle (`Añadido el lunes, 14 de julio
de 2025 22:15:03`). A diferencia de `finishedAt` (ADR 020, día a mediodía local), es un
instante: se guarda tal cual. #24 la convertirá a día con `toCalendarNoon` cuando la
proponga como fecha de terminado.

## 5. Flujo de lectura en el detalle del libro

```mermaid
sequenceDiagram
    participant UI as BookDetailPage
    participant RQ as TanStack Query
    participant P as preload (window.api)
    participant H as highlightHandlers (main)
    participant UC as GetBookHighlights
    participant R as PrismaHighlightRepository

    UI->>RQ: useQuery(['notes', id]) y useQuery(['highlights', id])
    RQ->>P: highlights.getByBook(id)
    P->>H: invoke('highlights:getByBook', { bookId })
    H->>UC: execute({ bookId })
    UC->>R: findByBookId(bookId) (ordenado por ubicación)
    R-->>UC: Highlight[]
    UC-->>H: Highlight[]
    H-->>P: IpcResult<HighlightPrimitives[]>
    P-->>RQ: data
    RQ-->>UI: "Mis notas" + "Subrayados" (notas vinculadas agrupadas por highlightId)
```

Al borrar un subrayado (`highlights:delete` → `DeleteHighlight`) se invalidan **las dos**
queries: los subrayados, porque falta uno, y las notas, porque las vinculadas ahora tienen
`highlightId = null`.

## 6. Qué deja listo para #23 y #24

- #23 (importación): crea `Highlight.create(...)` y `Note.createImported(...)` con la huella
  que calcule; el índice único por libro garantiza que reimportar no duplique (se detecta
  antes por huella o se atrapa el error de unicidad). El puerto `HighlightRepository` ya
  tiene `create`.
- #24 (fecha sugerida): tiene `capturedAt` tanto en subrayados como en notas del Kindle.
