# Reporte de Implementación: Feature #5 — `use_cases_books`

## 1. Resumen Ejecutivo
Se implementó de manera completa la **Feature #5 (`use_cases_books`)**, estableciendo la capa de aplicación para la gestión de libros y el progreso de lectura de acuerdo a los principios de **Clean Architecture**. Se diseñaron los casos de uso atómicos requeridos con inyección de dependencias estricta, manejo de errores tipados (`BookNotFoundError`), y la transición reactiva automática a `BookStatus.FINISHED` al alcanzar el 100% de progreso o la última página física.

Se agregaron **33 nuevos tests unitarios** en [`tests/application/test_book_use_cases.test.ts`](file:///c:/Users/Tomas/Desktop/BookLog/booklog/tests/application/test_book_use_cases.test.ts) utilizando un `MockBookRepository` en memoria, elevando la suite general del proyecto a **84 tests pasando al 100% en verde**, sin advertencias ni errores en `typecheck` ni `lint`.

---

## 2. Artefactos Creados y Modificados

### Errores de Aplicación (`src/shared/application/errors/`)
- [`src/shared/application/errors/BookNotFoundError.ts`](file:///c:/Users/Tomas/Desktop/BookLog/booklog/src/shared/application/errors/BookNotFoundError.ts):
  - Clase que extiende de `Error`, identificando el `bookId: number` no encontrado.
  - Asigna nombre `BookNotFoundError` y preserva el stack trace.
- [`src/shared/application/errors/index.ts`](file:///c:/Users/Tomas/Desktop/BookLog/booklog/src/shared/application/errors/index.ts):
  - Barrel export para errores de la capa de aplicación.

### Casos de Uso (`src/shared/application/use-cases/`)
- [`src/shared/application/use-cases/AddBook.ts`](file:///c:/Users/Tomas/Desktop/BookLog/booklog/src/shared/application/use-cases/AddBook.ts):
  - Recibe `AddBookDTO` (`title`, `authors`, `coverUrl`, `coverPath`, `pageCount`, `isbn`, `status`, `rating`, `googleBooksId`).
  - Instancia la entidad `Book` validando invariantes y persiste mediante `bookRepository.create(book)`.
- [`src/shared/application/use-cases/ListBooks.ts`](file:///c:/Users/Tomas/Desktop/BookLog/booklog/src/shared/application/use-cases/ListBooks.ts):
  - Recibe `ListBooksDTO` opcional `{ status?: BookStatus }`.
  - Si se proporciona un estado específico, invoca `bookRepository.findByStatus(status)`; si no, consulta `bookRepository.findAll()`.
- [`src/shared/application/use-cases/UpdateBookStatus.ts`](file:///c:/Users/Tomas/Desktop/BookLog/booklog/src/shared/application/use-cases/UpdateBookStatus.ts):
  - Recibe `UpdateBookStatusDTO` (`id`, `status`).
  - Lanza `BookNotFoundError` si el libro no existe.
  - Aplica `book.updateStatus(status)` y persiste con `bookRepository.update(book)`.
- [`src/shared/application/use-cases/UpdateBookProgress.ts`](file:///c:/Users/Tomas/Desktop/BookLog/booklog/src/shared/application/use-cases/UpdateBookProgress.ts):
  - Recibe `UpdateBookProgressDTO` (`id`, `page?`, `percentage?`).
  - Lanza `BookNotFoundError` si el libro no existe.
  - Valida y aplica `book.updateProgressByPage(page)` o `book.updateProgressByPercentage(percentage)`.
  - **Transición automática a FINISHED:** Si tras la actualización el libro alcanza el 100% de avance o su página actual iguala `pageCount`, transiciona automáticamente el estado a `BookStatus.FINISHED`.
  - Persiste y retorna la entidad actualizada.
- [`src/shared/application/use-cases/RateBook.ts`](file:///c:/Users/Tomas/Desktop/BookLog/booklog/src/shared/application/use-cases/RateBook.ts):
  - Recibe `RateBookDTO` (`id`, `rating?`).
  - Lanza `BookNotFoundError` si el libro no existe.
  - Actualiza la calificación (1 a 5) o la remueve (`null` / `undefined`), validando invariantes, y persiste.
- [`src/shared/application/use-cases/DeleteBook.ts`](file:///c:/Users/Tomas/Desktop/BookLog/booklog/src/shared/application/use-cases/DeleteBook.ts):
  - Recibe `DeleteBookDTO` (`id`).
  - Lanza `BookNotFoundError` si el libro no existe y luego ejecuta `bookRepository.delete(id)`.
- [`src/shared/application/use-cases/GetBookById.ts`](file:///c:/Users/Tomas/Desktop/BookLog/booklog/src/shared/application/use-cases/GetBookById.ts):
  - Caso de uso para consulta directa por ID o lanzamiento de `BookNotFoundError`.
- [`src/shared/application/use-cases/index.ts`](file:///c:/Users/Tomas/Desktop/BookLog/booklog/src/shared/application/use-cases/index.ts):
  - Barrel export de todos los casos de uso y sus respectivos DTOs.
- [`src/shared/application/index.ts`](file:///c:/Users/Tomas/Desktop/BookLog/booklog/src/shared/application/index.ts):
  - Barrel export raíz de la capa de aplicación.

### Pruebas Unitarias Automatizadas (`tests/application/`)
- [`tests/application/test_book_use_cases.test.ts`](file:///c:/Users/Tomas/Desktop/BookLog/booklog/tests/application/test_book_use_cases.test.ts):
  - Implementación de `MockBookRepository` en memoria con aislamiento total de base de datos.
  - Cobertura exhaustiva de 33 tests:
    - `AddBook`: creación exitosa (mínima y completa), rechazo por título vacío, autores vacíos y rating fuera de rango.
    - `ListBooks`: listado completo sin filtro, filtro por status (`READING`, `PAUSED`, `FINISHED`), y retornos vacíos.
    - `UpdateBookStatus`: actualización exitosa, ajuste al 100% al pasar a FINISHED, error `BookNotFoundError` y validación de enum.
    - `UpdateBookProgress`: cálculo por página, cálculo por porcentaje, soporte para libros sin cantidad de páginas, transición automática a `FINISHED` (por 100% o última página), error `BookNotFoundError`, y validaciones de rango o argumentos faltantes (`InvalidProgressError`).
    - `RateBook`: calificación 1-5, remoción con `null` o `undefined`, rechazo fuera de rango y error `BookNotFoundError`.
    - `DeleteBook`: eliminación exitosa y error `BookNotFoundError`.
    - `GetBookById`: obtención exitosa y error `BookNotFoundError`.

### Documentación Técnica
- [`docs/guides/clean-architecture-use-cases.md`](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/guides/clean-architecture-use-cases.md):
  - Guía conceptual de casos de uso y capa de aplicación en Clean Architecture.
  - Flujo DTO $\to$ UseCase $\to$ Domain Entity $\to$ Repository Port.
  - Diagrama de flujo Mermaid (`flowchart TD`) y diagrama de secuencia Mermaid (`sequenceDiagram`).
  - Separación entre errores de dominio, aplicación e infraestructura.
- [`docs/decisions/005-use-cases-books.md`](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/decisions/005-use-cases-books.md):
  - ADR-005 con decisiones tomadas: error tipado `BookNotFoundError`, transición reactiva a `FINISHED`, inyección de dependencias estricta y diagrama de clases de aplicación (`classDiagram`).
- [`docs/guides/README.md`](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/guides/README.md):
  - Actualización del índice de guías de aprendizaje.

---

## 3. Verificaciones de Calidad

```bash
# 1. Tests automáticos (84 pasados en 8 suites)
pnpm test
# Result: 8 passed (84 tests), 0 failures

# 2. Comprobación estricta de tipos TypeScript (node + web)
pnpm run typecheck
# Result: tsc --noEmit -p tsconfig.node.json (0 errors)
#         tsc --noEmit -p tsconfig.web.json (0 errors)

# 3. Linter ESLint
pnpm run lint
# Result: 0 errors, 0 warnings
```

---

## 4. Estado de Base de Datos y Feature List
- La base de datos de desarrollo y SQLite local se mantuvieron intactas sin modificaciones de esquema ni borrado de archivos `.db`.
- Se respetó la regla de no marcar features como `done` en `feature_list.json`.
