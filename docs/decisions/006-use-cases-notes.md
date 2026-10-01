# ADR-006: Casos de Uso de Notas y Modelo de Reflexiones sin Página

## Estado
Aceptado

## Contexto
Durante el análisis funcional y tras acordar especificaciones con el usuario, se redefinió el concepto y propósito de una `Note` en BookLog:
1. **Definición de Nota:** Una nota representa una idea, reflexión o pensamiento personal que le surge al lector respecto al libro en su conjunto o a un pasaje en particular. No representa una cita bibliográfica numerada ni depende de un número de página física (`page`).
2. **Eliminación del campo `page`:** Se determinó remover el campo `page` del esquema de base de datos SQLite y del modelo de dominio `Note`.
3. **Validación de Existencia del Libro Padre:** Ninguna nota puede agregarse (`AddNote`) ni consultarse (`GetBookNotes`) para un libro inexistente. Si el libro no existe en `BookRepository`, se debe lanzar `BookNotFoundError`.
4. **Validación de Existencia de la Nota:** Las operaciones de actualización (`UpdateNote`) y eliminación (`DeleteNote`) deben validar que la nota exista previamente en `NoteRepository`, lanzando `NoteNotFoundError` si no es encontrada.

---

## Decisiones

### 1. Simplificación del Esquema y Modelo de Dominio de Note
- Se removió la columna `page` de la tabla `Note` en `prisma/schema.prisma` y se ejecutó la migración `remove_note_page`.
- En la entidad de dominio `Note` (`src/shared/domain/entities/Note.ts`), los atributos se simplificaron a:
  - `id?: number`
  - `bookId: number`
  - `content: string`
  - `createdAt: Date`
  - `updatedAt: Date`
- Se removió el método `updatePage` y la validación `validatePage`, manteniendo invariantes estrictos:
  - `bookId` debe ser un entero positivo mayor a cero.
  - `content` debe ser una cadena no vacía (no whitespace).

### 2. Casos de Uso Atómicos de Notas
Se implementaron cuatro casos de uso en `src/shared/application/use-cases/`:
- **`AddNote`**:
  - DTO: `{ bookId: number, content: string }`
  - Inyecta `BookRepository` y `NoteRepository`.
  - Verifica si el libro existe mediante `bookRepository.findById(bookId)`. Si no existe, lanza `BookNotFoundError(bookId)`.
  - Instancia `Note.create({ bookId, content })` aplicando invariantes y persiste con `noteRepository.create(note)`.
- **`GetBookNotes`**:
  - DTO: `{ bookId: number }`
  - Inyecta `BookRepository` y `NoteRepository`.
  - Verifica la existencia del libro; si no existe, lanza `BookNotFoundError(bookId)`.
  - Recupera las notas mediante `noteRepository.findByBookId(bookId)` (ordenadas cronológicamente `createdAt ASC`).
- **`UpdateNote`**:
  - DTO: `{ id: number, content: string }`
  - Inyecta `NoteRepository`.
  - Verifica existencia con `noteRepository.findById(id)`. Si no existe, lanza `NoteNotFoundError(id)`.
  - Ejecuta `note.updateContent(content)` y persiste con `noteRepository.update(note)`.
- **`DeleteNote`**:
  - DTO: `{ id: number }`
  - Inyecta `NoteRepository`.
  - Verifica existencia con `noteRepository.findById(id)`. Si no existe, lanza `NoteNotFoundError(id)`.
  - Elimina con `noteRepository.delete(id)`.

### 3. Jerarquía de Errores Tipados
- Se añadió `NoteNotFoundError` en `src/shared/application/errors/NoteNotFoundError.ts` con propiedad `noteId: number`.
- Permite que los controladores IPC identifiquen con precisión si la falla fue por ausencia del libro contenedor (`BookNotFoundError`) o de la nota solicitada (`NoteNotFoundError`), diferenciándolos de errores de invariante (`InvalidNoteError`).

---

## Diagrama de Arquitectura de Casos de Uso de Notas

```mermaid
flowchart TD
    subgraph UseCases ["Casos de Uso (Capa de Aplicación)"]
        AN["AddNote"]
        GN["GetBookNotes"]
        UN["UpdateNote"]
        DN["DeleteNote"]
    end

    subgraph Ports ["Puertos de Dominio"]
        BR["BookRepository"]
        NR["NoteRepository"]
    end

    subgraph Errors ["Excepciones de Aplicación"]
        BNF["BookNotFoundError"]
        NNF["NoteNotFoundError"]
    end

    subgraph DomainModel ["Entidad de Dominio"]
        NoteEntity["Note\n(id, bookId, content, createdAt, updatedAt)"]
    end

    AN -->|1. findById(bookId)| BR
    AN -.->|Si no existe| BNF
    AN -->|2. Note.create(bookId, content)| NoteEntity
    AN -->|3. create(note)| NR

    GN -->|1. findById(bookId)| BR
    GN -.->|Si no existe| BNF
    GN -->|2. findByBookId(bookId)| NR

    UN -->|1. findById(id)| NR
    UN -.->|Si no existe| NNF
    UN -->|2. note.updateContent(content)| NoteEntity
    UN -->|3. update(note)| NR

    DN -->|1. findById(id)| NR
    DN -.->|Si no existe| NNF
    DN -->|2. delete(id)| NR
```

---

## Consecuencias
- **Positivas:**
  - El modelo de datos refleja de forma fiel la intención del usuario final: reflexiones e ideas libres sobre libros.
  - Consistencia relacional garantizada a nivel de aplicación previo a cualquier escritura en base de datos.
  - Testabilidad absoluta mediante repositorios mock en memoria sin necesidad de base de datos activa para probar la lógica de aplicación.
- **Riesgos Mitigados:**
  - No quedan notas huérfanas o asignadas a IDs ficticios gracias a la pre-validación de `BookRepository.findById`.
  - Las operaciones `UPDATE` y `DELETE` no fallan silenciosamente gracias a `NoteNotFoundError`.
