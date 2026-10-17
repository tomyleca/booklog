# Historial de sesiones

> Append-only. Cada sesión terminada se agrega al final.

---

## Sesión 2026-09-29 — Feature #1: project_scaffolding

- **Estado:** Completada (done)
- **Logros:**
  - Instalación de pnpm (v12.8.1).
  - Inicialización y configuración de electron-vite con React 18 y TypeScript strict (`strict: true`, `noUncheckedIndexedAccess: true`).
  - Configuración e integración de Tailwind CSS v4 (`@tailwindcss/vite`, `@import "tailwindcss"`).
  - Instalación de `lucide-react` con ícono `BookOpen` en `App.tsx`.
  - Configuración de Vitest (`vitest run`) con test placeholder pasando en verde.
  - Estructura de directorios de Clean Architecture implementada:
    - `src/main/`, `src/preload/`, `src/renderer/`, `src/shared/domain/`, `src/shared/application/`, `src/shared/infrastructure/`.
  - Verificación de tipos (`pnpm run typecheck`) y compilación (`pnpm run build`) 100% exitosas.
  - Redacción de guía conceptual: [docs/guides/electron-fundamentals.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/guides/electron-fundamentals.md).
  - Redacción de ADR: [docs/decisions/001-project-scaffolding.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/decisions/001-project-scaffolding.md).
  - Creación de script de verificación para Windows [init.ps1](file:///c:/Users/Tomas/Desktop/BookLog/booklog/init.ps1).

---

## Sesión 2026-09-30 — Feature #2: database_schema

- **Estado:** Completada (done)
- **Logros:**
  - Definición de esquema Prisma en `prisma/schema.prisma` con provider SQLite.
  - Modelos `Book` y `ReadingSession` con tipos, atributos, campos de auditoría, relación 1:N y eliminación en cascada (`ON DELETE CASCADE`).
  - Creación y aplicación de migración inicial con Prisma Migrate (`prisma/migrations/20260930145056_init/migration.sql`).
  - Implementación de inicialización dinámica de `PrismaClient` en `src/shared/infrastructure/persistence/prismaClient.ts`, resolviendo la ruta en Electron (`app.getPath('userData')`), soportando URLs personalizadas para pruebas y `DATABASE_URL` para CI.
  - Implementación de suite de pruebas de integración en `tests/infrastructure/test_prisma_connection.test.ts` (6 tests) ejecutadas sobre SQLite temporal en `os.tmpdir()`.
  - Verificación completa con 7 tests verdes en Vitest, 0 errores de TypeScript en Node y Web (`pnpm run typecheck`), build de producción exitoso y ESLint limpio.
  - Redacción de guía conceptual: [docs/guides/prisma-sqlite-setup.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/guides/prisma-sqlite-setup.md).
  - Redacción de ADR: [docs/decisions/002-database-schema.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/decisions/002-database-schema.md).
  - Reportes de ciclo de vida: [progress/report_database_schema.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/report_database_schema.md) y [progress/review_database_schema.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/review_database_schema.md).

---

## Sesión 2026-09-30 — Feature #2 (Evolución): database_schema (Book, Note, Progreso y Offline-First)

- **Estado:** Completada (done)
- **Logros:**
  - Redefinición arquitectónica del esquema en `prisma/schema.prisma`:
    - Incorporación del estado `PAUSED` en `BookStatus`.
    - Eliminación completa del modelo `ReadingSession`.
    - Creación del modelo independiente `Note` con relación 1:N y `onDelete: Cascade`.
    - Incorporación de campos en `Book` para progreso de lectura dual (`currentPage`, `progressPercentage`) y soporte offline-first (`coverPath`).
  - Generación y aplicación exitosa de la migración `20260930153235_update_schema_book_notes_progress` sin pérdida de integridad ni borrado de base de datos de desarrollo.
  - Actualización de pruebas de integración en `tests/infrastructure/test_prisma_connection.test.ts` cubriendo Book, Note, cascade delete, constraints y resolución dinámica de BD.
  - Verificación completa: 7/7 tests pasando, TypeScript estricto OK, ESLint limpio.
  - Actualización de documentación: ADR [002-database-schema.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/decisions/002-database-schema.md) y guía [prisma-sqlite-setup.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/guides/prisma-sqlite-setup.md).
  - Reportes: [progress/report_schema_update.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/report_schema_update.md) y [progress/review_schema_update.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/review_schema_update.md).

---

## Sesión 2026-09-30 — Feature #3: domain_entities (Entidades y puertos del dominio)

- **Estado:** Completada (done)
- **Logros:**
  - Implementación pura de dominio (Clean Architecture) sin acoplamiento a Prisma ni frameworks externos:
    - Entidad `Book` con invariantes de negocio, tipos estrictos (`authors: string[]`), validación de rating (1-5), cálculo y sincronización bidireccional entre `currentPage` y `progressPercentage`, sincronización al marcar como `FINISHED` y preservación de avance en `TO_READ`.
    - Entidad `Note` con validación de contenido obligatorio no vacío y número de página positivo ($\ge 1$).
    - Puertos de repositorio tipados: `BookRepository`, `NoteRepository` y puerto de servicio `BookSearchService`.
  - Cobertura de pruebas unitarias al 100% en `tests/domain/`:
    - `test_book_entity.test.ts` (17 pruebas).
    - `test_note_entity.test.ts` (9 pruebas).
    - Total de la suite: 33 tests pasando en verde.
  - Verificación de calidad: `pnpm test`, `pnpm run typecheck` y `pnpm run lint` 100% exitosos sin errores ni advertencias.
  - Generación de documentación técnica:
    - Guía conceptual con diagramas Mermaid: [docs/guides/clean-architecture-domain.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/guides/clean-architecture-domain.md).
    - ADR: [docs/decisions/003-domain-entities.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/decisions/003-domain-entities.md).
  - Reportes de ciclo de vida: [progress/report_domain_entities.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/report_domain_entities.md) y [progress/review_domain_entities.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/review_domain_entities.md).

---

## Sesión 2026-09-30 — Feature #4: infrastructure_repositories (Implementación de repositorios con Prisma)

- **Estado:** Completada (done)
- **Logros:**
  - Implementación concreta de los puertos de persistencia con Prisma ORM:
    - `BookMapper` y `NoteMapper`: Transformación pura y bidireccional entre modelos relacionales Prisma y entidades de dominio, serializando/deserializando `authors` en JSON string con tolerancia a fallos.
    - `PrismaBookRepository`: Implementa `BookRepository` con ordenamiento por defecto `updatedAt DESC`, carga desacoplada de notas para consultas ligeras de biblioteca, y operaciones CRUD completas.
    - `PrismaNoteRepository`: Implementa `NoteRepository` con ordenamiento cronológico `createdAt ASC` y soporte para eliminación y cascada.
  - Pruebas automatizadas en `tests/infrastructure/`:
    - `test_mappers.test.ts` (7 pruebas unitarias).
    - `test_book_repository.test.ts` (6 pruebas de integración sobre SQLite efímera en `os.tmpdir()`).
    - `test_note_repository.test.ts` (5 pruebas de integración incluyendo verificación de `ON DELETE CASCADE`).
    - Suite total: 51 tests pasando al 100% en verde.
  - Verificación rigurosa de calidad: `pnpm test`, `pnpm run typecheck` y `pnpm run lint` limpios (0 errores). Preservación estricta de la base de datos `prisma/dev.db`.
  - Documentación técnica:
    - Guía técnica: [docs/guides/repository-pattern-prisma.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/guides/repository-pattern-prisma.md).
    - ADR: [docs/decisions/004-infrastructure-repositories.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/decisions/004-infrastructure-repositories.md).
  - Reportes de ciclo de vida: [progress/report_infrastructure_repositories.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/report_infrastructure_repositories.md) y [progress/review_infrastructure_repositories.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/review_infrastructure_repositories.md).

---

## Sesión 2026-09-30 — Feature #5: use_cases_books (Casos de uso de libros y progreso de lectura)

- **Estado:** Completada (done)
- **Logros:**
  - Implementación de casos de uso de la capa de aplicación con inyección de dependencias (`BookRepository`):
    - `AddBook`: Creación de libros persistiendo entidades de dominio válidas.
    - `ListBooks`: Consulta general de libros con filtro opcional por estado (`TO_READ`, `READING`, `PAUSED`, `FINISHED`, `ABANDONED`).
    - `UpdateBookStatus`: Modificación de estado con validación de existencia.
    - `UpdateBookProgress`: Registro de avance por número de página o porcentaje directo, sincronizando bidireccionalmente y aplicando transición automática a `FINISHED` al completar el 100% o la última página física.
    - `RateBook`: Actualización o remoción de calificaciones (1-5 estrellas).
    - `DeleteBook`: Eliminación segura de libros por identificador.
    - `GetBookById`: Consulta unitaria de libro.
    - Definición del error tipado de aplicación `BookNotFoundError`.
  - Pruebas unitarias completas en `tests/application/test_book_use_cases.test.ts` con mock en memoria (`MockBookRepository`), alcanzando 33 tests dedicados y 84 tests totales del proyecto (100% pasando en verde).
  - Verificación de calidad: `pnpm test`, `pnpm run typecheck` y `pnpm run lint` totalmente limpios.
  - Documentación técnica:
    - Guía conceptual: [docs/guides/clean-architecture-use-cases.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/guides/clean-architecture-use-cases.md).
    - ADR: [docs/decisions/005-use-cases-books.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/decisions/005-use-cases-books.md).
  - Reportes de ciclo de vida: [progress/report_book_use_cases.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/report_book_use_cases.md) y [progress/review_book_use_cases.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/review_book_use_cases.md).

---

## Sesión 2026-09-30 — Feature #6: use_cases_notes (Casos de uso de notas por libro)

- **Estado:** Completada (done)
- **Logros:**
  - Redefinición del modelo de notas según alineación con el usuario: remoción del número de página (`page`) en base de datos, entidad de dominio `Note` y mappers. Las notas representan reflexiones e ideas textuales vinculadas a la obra.
  - Implementación de casos de uso de notas con inyección de dependencias (`BookRepository`, `NoteRepository`):
    - `AddNote`: Registra una nueva reflexión validando existencia del libro con `BookNotFoundError`.
    - `GetBookNotes`: Retorna notas de un libro en orden cronológico validando existencia con `BookNotFoundError`.
    - `UpdateNote`: Actualiza contenido de una nota validando existencia con `NoteNotFoundError`.
    - `DeleteNote`: Elimina una nota validando existencia con `NoteNotFoundError`.
    - Definición del error tipado `NoteNotFoundError`.
  - Pruebas unitarias completas en `tests/application/test_note_use_cases.test.ts` con mocks en memoria, alcanzando 92 tests totales del proyecto (100% pasando en verde).
  - Verificación estricta: `pnpm test`, `pnpm run typecheck` y `pnpm run lint` limpios (0 errores).
  - Documentación técnica:
    - Guía conceptual: [docs/guides/notes-use-cases.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/guides/notes-use-cases.md).
    - ADR: [docs/decisions/006-use-cases-notes.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/decisions/006-use-cases-notes.md).
  - Reportes de ciclo de vida: [progress/report_note_use_cases.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/report_note_use_cases.md) y [progress/review_note_use_cases.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/review_note_use_cases.md).

---

## Sesión 2026-09-30 — Feature #7: ipc_layer (Capa IPC Main ↔ Renderer y descarga local de portadas)

- **Estado:** Completada (done)
- **Logros:**
  - Implementación de arquitectura IPC desacoplada, tipada y segura entre Electron Main y Renderer:
    - Definición de canales fuertemente tipados (`channels.ts`) y contrato estructurado `IpcResult<T>` (`contracts.ts`) que garantiza tipado estricto de éxito/error sin crashes en el frontend.
    - Servicio de almacenamiento offline-first de portadas `CoverStorageService` en `app.getPath('userData')/covers` con nombres únicos y mitigación de path traversal.
    - Registro de esquema y protocolo seguro `booklog-media://` para carga nativa por streaming en Chromium de imágenes locales sin sobrecarga de Base64.
    - Handlers de Main (`bookHandlers`, `noteHandlers`, `coverHandlers`) que orquestan los casos de uso y formatean errores controlados (`formatIpcError`).
    - Exposición segura vía `contextBridge` en `src/preload/index.ts` con tipado global en `index.d.ts`.
    - Clientes de servicio en Renderer (`bookService`, `noteService`, `coverService` con `resolveCoverUrl`) totalmente desacoplados de `ipcRenderer`.
  - Suite de pruebas completa en `tests/ipc/test_ipc_contracts.test.ts` con 47 tests dedicados a serialización, simulación de handlers y contratos.
  - Verificación rigurosa: 139 tests pasando en verde (10 suites), `typecheck` limpio, `lint` limpio y compilación de producción `pnpm run build` exitosa.
  - Documentación técnica:
    - Guía conceptual: [docs/guides/electron-ipc-bridge.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/guides/electron-ipc-bridge.md).
    - ADR: [docs/decisions/007-ipc-layer.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/decisions/007-ipc-layer.md).
  - Reportes de ciclo de vida: [progress/report_ipc_layer.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/report_ipc_layer.md) y [progress/review_ipc_layer.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/review_ipc_layer.md).

---

## Sesión 2026-09-30 — Feature #8: ui_library_view (Vista de biblioteca / listado de libros)

- **Estado:** Completada (done)
- **Logros:**
  - Implementación de la vista principal de la biblioteca (`LibraryPage`) con React 18, TanStack Query y Tailwind CSS v4:
    - Componente `StatusFilterTabs`: Pestañas para filtrar libros por Todos (`ALL`), Por Leer (`TO_READ`), Leyendo (`READING`), Pausados (`PAUSED`), Terminados (`FINISHED`) y Abandonados (`ABANDONED`).
    - Componente `BookCard`: Visualización limpia con título, autores, badge de estado, calificación en estrellas (Lucide `Star`), barra de progreso únicamente con porcentaje numérico (ej: 65%) conforme a la preferencia del usuario, y placeholder neutro simple con ícono `BookOpen` para libros sin portada.
    - Componente `BookGrid`: Cuadrícula responsive con adaptación automática a diferentes anchos de pantalla.
    - Componente `EmptyLibraryState`: Mensaje orientativo e ícono de libro cuando la biblioteca está vacía o el filtro no arroja resultados.
    - Integración de `QueryClientProvider` en `App.tsx` para sincronización reactiva de estado de servidor.
  - Pruebas automatizadas en `tests/renderer/test_library_view.test.ts` (23 tests de componentes React con Testing Library y JSDOM), alcanzando 162 tests totales del proyecto (100% pasando en verde).
  - Verificación estricta: `pnpm test`, `pnpm run typecheck`, `pnpm run lint` y `pnpm run build` limpios sin errores.
  - Documentación técnica:
    - Guía conceptual: [docs/guides/react-query-tailwind-library.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/guides/react-query-tailwind-library.md).
    - ADR: [docs/decisions/008-ui-library-view.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/decisions/008-ui-library-view.md).
  - Reportes de ciclo de vida: [progress/report_ui_library_view.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/report_ui_library_view.md) y [progress/review_ui_library_view.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/review_ui_library_view.md).

---

## Sesión 2026-09-30 — Feature #9: ui_add_book_manual (Formulario de agregar libro manualmente)

- **Estado:** Completada (done)
- **Logros:**
  - Implementación del modal accesible `AddBookModal` con React 18, TanStack Query y Tailwind CSS v4:
    - Campos completos: Título (requerido), Autores (campo de texto separado por comas mapeado a `string[]`), Cantidad de páginas (entero > 0), ISBN (opcional), Estado inicial con selector (`TO_READ` por defecto) y Portada opcional (URL o ruta local).
    - Descarga local automática de portadas remotas a `userData/covers` mediante `window.api.covers.saveFromUrl(url)` antes de persistir, preservando el enfoque offline-first con fallback seguro.
    - Accesibilidad y cierre interactivo: Cierre con tecla Escape, clic en backdrop, botón Cancelar y botón "X" con atributos ARIA (`role="dialog"`, `aria-modal="true"`).
    - Mutación reactiva: Al guardar exitosamente, invalida la caché de `['books']` en TanStack Query refrescando la biblioteca en tiempo real.
    - Preparación modular para Feature #10: Slot `renderSearchSlot` y soporte de `initialValues` listos para alojar el buscador de Google Books sin refactorizaciones complejas.
    - Integración en `LibraryPage` mediante botón "+ Agregar Libro" en el header.
  - Pruebas automatizadas en `tests/renderer/test_add_book_modal.test.ts` (23 pruebas de componentes), alcanzando 185 tests totales en verde (12 suites).
  - Verificación estricta: `pnpm test`, `pnpm run typecheck`, `pnpm run lint` y `pnpm run build` limpios sin errores.
  - Documentación técnica:
    - Guía conceptual: [docs/guides/react-modal-forms.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/guides/react-modal-forms.md).
    - ADR: [docs/decisions/009-ui-add-book-manual.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/decisions/009-ui-add-book-manual.md).
  - Reportes de ciclo de vida: [progress/report_ui_add_book_manual.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/report_ui_add_book_manual.md) y [progress/review_ui_add_book_manual.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/review_ui_add_book_manual.md).

---

## Sesión 2026-09-30 — Feature #10: google_books_search (Búsqueda de libros vía Google Books API con descarga de portada)

- **Estado:** Completada (done)
- **Logros:**
  - Implementación del servicio de integración externa `GoogleBooksService` implementando el puerto de dominio `BookSearchService`:
    - Consulta a Google Books API (`v1/volumes`) con límite de 20 resultados y sanitización exhaustiva (forzado de HTTPS en portadas, extracción prioritaria de ISBN-13 sobre ISBN-10, extracción de año de 4 dígitos de `publishedDate`, y parsing de autores a `string[]`).
  - Capa IPC tipada end-to-end:
    - Nuevo canal `search:books` con contrato `IpcResult<BookSearchResult[]>`.
    - Handlers en Main process (`searchHandlers.ts`), exposición en `preload` (`api.search.books`) y cliente frontend `searchService.ts`.
  - Experiencia de usuario interactiva en `AddBookModal`:
    - Pestaña predeterminada "Buscar en Google" con input reactivo (búsqueda automática con debounce de 500ms tras 3 letras y tecla `Enter` inmediata).
    - Tarjetas de resultados con miniatura de portada, título, autores, año, páginas e ISBN.
    - Autocompletado instantáneo y transición fluida al formulario de confirmación al seleccionar un resultado.
    - Flujo offline-first: al guardar, la portada remota es descargada y persistida físicamente en `userData/covers` mediante `api.covers.saveFromUrl`.
  - Pruebas automatizadas en Vitest:
    - `tests/infrastructure/test_google_books_service.test.ts` (9 pruebas unitarias de API y parsing).
    - `tests/ipc/test_ipc_contracts.test.ts` (3 pruebas de contratos de búsqueda).
    - `tests/renderer/test_google_books_search.test.ts` (13 pruebas de integración de UI).
    - Total de la suite: 14 suites, 212 tests pasando al 100% en verde.
  - Verificación rigurosa: `pnpm test`, `pnpm run typecheck`, `pnpm run lint` y `pnpm run build` limpios sin errores.
  - Documentación técnica:
    - Guía técnica: [docs/guides/external-api-integration.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/guides/external-api-integration.md).
    - ADR: [docs/decisions/010-google-books-search.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/decisions/010-google-books-search.md).
  - Reportes de ciclo de vida: [progress/report_google_books_search.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/report_google_books_search.md) y [progress/review_google_books_search.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/review_google_books_search.md).

---

## Sesión 2026-09-30 — Feature #11: ui_book_detail (Vista de detalle del libro y gestión de notas)

- **Estado:** Completada (done)
- **Logros:**
  - Implementación de la pantalla completa `BookDetailPage` en React 18, TanStack Query y Tailwind CSS v4:
    - Encabezado y metadatos del libro: Portada local optimizada (con protocolo `booklog-media://` y fallback a placeholder neutro con `BookOpen`), título, autores, cantidad de páginas, ISBN y fecha de creación/actualización.
    - Edición reactiva del estado de lectura mediante selector desplegable sincronizado con `bookService.updateStatus`.
    - Componente interactivo de calificación por estrellas (`1-5` estrellas con feedback visual hover, selección y reseteo opcional).
    - Barra de progreso con edición en línea directa: controles numéricos de página actual y porcentaje sincronizados bidireccionalmente con validación de límites y botón explícito para persistir el avance (`bookService.updateProgress`).
    - Sección de gestión de notas: listado cronológico de ideas y reflexiones textuales, botón individual de eliminación por nota (`noteService.delete`) y modal compacto "+ Nueva Idea" para agregar reflexiones con validación de contenido no vacío (`noteService.create`).
    - Eliminación de libro: botón protegido con modal de confirmación advirtiendo eliminación de notas asociadas, invocando `bookService.delete` y retornando automáticamente a la biblioteca.
    - Navegación bidireccional entre `LibraryPage` y `BookDetailPage` mediante estado de vista unificado en `App.tsx`.
  - Pruebas automatizadas en Vitest:
    - `tests/renderer/test_book_detail_page.test.ts` (25 pruebas cubriendo ciclo de vida, edición en línea, mutaciones y navegación).
    - Total de la suite: 15 suites, 237 tests pasando al 100% en verde.
  - Verificación rigurosa: `pnpm test`, `pnpm run typecheck`, `pnpm run lint` y `pnpm run build` limpios sin errores.
  - Documentación técnica:
    - Guía técnica: [docs/guides/react-book-detail-view.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/guides/react-book-detail-view.md).
    - ADR: [docs/decisions/011-ui-book-detail.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/decisions/011-ui-book-detail.md).
  - Reportes de ciclo de vida: [progress/report_ui_book_detail.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/report_ui_book_detail.md) y [progress/review_ui_book_detail.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/review_ui_book_detail.md).

---

## Sesión 2026-09-30 — Feature #12: ui_book_progress_and_notes_modals (Modales de actualización de progreso y creación de notas)

- **Estado:** Completada (done)
- **Logros:**
  - Modularización e implementación de modales independientes y reutilizables en `src/renderer/src/components/`:
    - `UpdateProgressModal`:
      - Selector dual de modo ("Por número de página" vs "Por porcentaje directo").
      - Validación estricta de límites (`currentPage <= pageCount` y `0 <= progressPercentage <= 100`).
      - Cálculo reactivo bidireccional en tiempo real del valor equivalente cuando el libro dispone de `pageCount`.
      - Sugerencia interactiva de finalización: al ingresar el 100% de lectura o la última página, despliega un banner destacado con checkbox para marcar el libro como `FINISHED` automáticamente al guardar.
      - Accesibilidad ARIA completa (`role="dialog"`, `aria-modal="true"`, cierre por tecla Escape y clic en backdrop).
    - `AddNoteModal`:
      - Modal dedicado para registro de reflexiones e ideas textuales sin campo de página.
      - Autoenfoque en el área de texto, validación de contenido no vacío y atajo de teclado ágil `Ctrl + Enter` (o `Cmd + Enter`) para guardar.
      - Mutación con invalidación selectiva de queries (`['notes', bookId]`).
    - Integración en `BookDetailPage.tsx` con botón complementario de acción rápida "Actualizar progreso..." y exportación pública en `src/renderer/src/components/index.ts`.
  - Pruebas automatizadas en Vitest:
    - `tests/renderer/test_progress_and_notes_modals.test.ts` (21 pruebas unitarias y de integración de modales).
    - Total de la suite: 16 suites, 258 tests pasando al 100% en verde.
  - Verificación rigurosa: `pnpm test`, `pnpm run typecheck`, `pnpm run lint` y `pnpm run build` limpios sin errores ni advertencias.
  - Documentación técnica:
    - Guía conceptual: [docs/guides/react-reusable-modals.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/guides/react-reusable-modals.md).
    - ADR: [docs/decisions/012-ui-book-progress-and-notes-modals.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/decisions/012-ui-book-progress-and-notes-modals.md).
---

## Sesión 2026-10-01 — Feature #13: ui_dashboard_stats (Dashboard con estadísticas de lectura)

- **Estado:** Completada (done)
- **Logros:**
  - Implementación de la vista completa del Dashboard (`DashboardPage`) en React 18, TanStack Query y Tailwind CSS v4:
    - KPIs globales en tarjetas destacadas: Total de libros terminados (`FINISHED`), libros en lectura activa (`READING`), libros pausados (`PAUSED`), libros por leer (`TO_READ`), libros abandonados (`ABANDONED`) y total de libros.
    - Algoritmo de cálculo de páginas totales leídas: suma precisa computando `currentPage`, porcentaje por `pageCount` o total de páginas en libros completados.
    - Gráfico y desglose de estados: Barra de distribución visual segmentada por porcentajes y colores temáticos, junto con tarjetas detalladas de proporción.
    - Sección de lecturas recientes: listado ordenado cronológicamente por `updatedAt DESC` mostrando miniatura, título, autores, estado y porcentaje, con navegación interactiva al hacer clic para abrir `BookDetailPage`.
    - Barra de navegación superior accesible en `App.tsx` para alternar entre "Biblioteca" y "Dashboard", con soporte de navegación contextual e historial de retorno.
  - Pruebas automatizadas en Vitest:
    - `tests/renderer/test_dashboard_page.test.ts` (17 pruebas cubriendo KPIs, cálculo de páginas, desglose, lecturas recientes, estados vacío/error y navegación en App).
    - Total de la suite: 17 suites, 275 tests pasando al 100% en verde.
  - Verificación rigurosa: `pnpm test`, `pnpm run typecheck`, `pnpm run lint` y `pnpm run build` limpios sin errores ni advertencias.
  - Documentación técnica:
    - Guía conceptual: [docs/guides/dashboard-reading-analytics.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/guides/dashboard-reading-analytics.md).
    - ADR: [docs/decisions/013-ui-dashboard-stats.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/decisions/013-ui-dashboard-stats.md).
  - Reportes de ciclo de vida: [progress/report_ui_dashboard_stats.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/report_ui_dashboard_stats.md) y [progress/review_ui_dashboard_stats.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/review_ui_dashboard_stats.md).

---

## Sesión 2026-10-01 — Feature #14: app_navigation_layout (Layout principal y navegación)

- **Estado:** Completada (done)
- **Logros:**
  - Implementación del shell de aplicación, titlebar nativa personalizada y menú hamburguesa en React 18 y Electron:
    - Ventana frameless nativa (`frame: false`) en Electron Main con IPC channels para control de ventana (`window:minimize`, `window:maximize`, `window:close`, `window:isMaximized`).
    - Handlers en `src/main/ipc/windowHandlers.ts`, exposición en `src/preload/index.ts` y servicio tipado `windowService.ts`.
    - Componente `TitleBar.tsx` con soporte de región de arrastre (`-webkit-app-region: drag`), botones con `no-drag`, branding BookLog y controles de minimizar, maximizar/restaurar y cerrar con feedback visual.
    - Componente `NavigationDrawer.tsx` accesible mediante menú hamburguesa, soporte de teclado (Escape), clic en backdrop semitransparente, e indicador de ruta activa para Dashboard, Biblioteca y Configuración.
    - Routing funcional en `App.tsx` con preservación del historial para retorno contextual desde `BookDetailPage` hacia su origen.
    - Página inicial de Configuración (`SettingsPage.tsx`) con placeholder y estructura base preparada para la Feature #15.
  - Pruebas automatizadas en Vitest:
    - `tests/renderer/test_app_navigation_layout.test.ts` (16 pruebas cubriendo renderizado de TitleBar, drawer, controles de ventana, routing y accesibilidad).
    - `tests/ipc/test_ipc_contracts.test.ts` (6 pruebas añadidas para contratos IPC de ventana).
    - Total de la suite: 18 suites, 297 tests pasando al 100% en verde.
  - Verificación rigurosa: `pnpm test`, `pnpm run typecheck`, `pnpm run lint` y `pnpm run build` limpios sin errores.
  - Documentación técnica:
    - Guía conceptual: [docs/guides/electron-custom-titlebar-layout.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/guides/electron-custom-titlebar-layout.md).
    - ADR: [docs/decisions/014-app-navigation-layout.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/decisions/014-app-navigation-layout.md).
  - Reportes de ciclo de vida: [progress/report_app_navigation_layout.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/report_app_navigation_layout.md) y [progress/review_app_navigation_layout.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/review_app_navigation_layout.md).

---

## Sesión 2026-10-01 — Feature #15: settings_page (Página de configuración y persistencia de preferencias)

- **Estado:** Completada (done)
- **Logros:**
  - Implementación completa de la vista de configuración y almacenamiento persistente en Electron y React 18:
    - Servicio nativo en Main `SettingsStorageService` persistiendo en `app.getPath('userData')/settings.json`, con soporte de cifrado opcional para la API key mediante Electron `safeStorage`.
    - Handlers IPC (`settings:get`, `settings:save`, `settings:testApiKey`, `settings:getAppInfo`) con contratos tipados `IpcResult`.
    - Integración dinámica de la API key configurada en `GoogleBooksService` para búsquedas en la aplicación.
    - Test interactivo de API key en vivo con timeout y verificación directa contra el endpoint de Google Books API.
    - Selector reactivo de temas con 3 opciones ("Oscuro", "Claro", "Sistema"), sincronizando inmediatamente la clase `dark` en `document.documentElement` y persistiendo la preferencia.
    - Metadatos completos del entorno: Versión de BookLog, Electron, Node, Chromium, repositorio y licencia.
  - Pruebas automatizadas en Vitest:
    - `tests/renderer/test_settings_page.test.ts` (14 pruebas completas).
    - `tests/ipc/test_ipc_contracts.test.ts` (8 pruebas añadidas para contratos de configuración).
    - Total de la suite del proyecto: 20 suites, 319 tests pasando al 100% en verde.
  - Verificación rigurosa: `pnpm test`, `pnpm run typecheck`, `pnpm run lint` y `pnpm run build` limpios sin errores.
  - Documentación técnica:
    - Guía conceptual: [docs/guides/app-settings-persistence.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/guides/app-settings-persistence.md).
    - ADR: [docs/decisions/015-settings-page.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/decisions/015-settings-page.md).
  - Reportes de ciclo de vida: [progress/report_settings_page.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/report_settings_page.md) y [progress/review_settings_page.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/review_settings_page.md).


---

## Sesión 2026-10-17 — Feature #16: retro_library_theme (Rediseño visual: tema retro de biblioteca)

- **Estado:** Completada (done)
- **Logros:**
  - Sistema de tokens semánticos de diseño con Tailwind CSS v4:
    - Tokens de color en `@theme` de `src/renderer/src/assets/main.css`, con los valores del tema claro (papel/pergamino con tinta marrón): paper, card, well, shelf, chrome, ink*, rule*, accent*, brass, leather, spine, danger, success, star y status-*.
    - Las mismas variables se reasignan bajo `.dark` en `@layer base` para el tema oscuro (biblioteca de noche: nogal, cuero y luz cálida). El selector de #15 (Oscuro/Claro/Sistema) y `themeService` no cambiaron.
    - Se migraron todos los componentes y páginas de `src/renderer` a tokens: ya no hay clases slate/indigo/etc. crudas ni variantes `dark:`. Los layouts y los `data-testid` no cambiaron.
    - Estética retro moderada:
      - Texturas de papel y madera hechas con SVG inline (`feTurbulence`).
      - Utilidades `ficha`/`ficha-float` (tarjeta de catálogo con filete doble interior) y `rule-double`.
      - Sombras cálidas con relieve.
      - Barra de título de madera y emblemas de cuero.
    - Tipografía serif empaquetada sin red con @fontsource: Lora (texto) y Libre Baskerville (títulos). Se agregó `font-src 'self' data:` a la CSP.
  - Pruebas automatizadas en Vitest:
    - `tests/renderer/test_retro_library_theme.test.ts` (45 pruebas): tokens y overrides oscuros, contraste WCAG AA en ambos temas, ausencia de colores crudos y de `dark:`, texturas inline, fuentes y CSP.
    - `tests/renderer/test_google_books_search.test.ts` actualizado al token `text-accent`.
    - Total de la suite: 21 suites, 364 tests pasando al 100% en verde.
  - Verificación: `pnpm test`, `pnpm run typecheck`, lint y `pnpm run build` limpios. Se revisó el aspecto con capturas en ambos temas.
  - Documentación técnica:
    - Guía conceptual: [docs/guides/design-tokens-theming.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/guides/design-tokens-theming.md).
    - ADR: [docs/decisions/016-retro-library-theme.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/decisions/016-retro-library-theme.md).
    - `docs/conventions.md` (sección CSS / Estilos) actualizado.
  - Reportes de ciclo de vida: [progress/report_retro_library_theme.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/report_retro_library_theme.md) y [progress/review_retro_library_theme.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/review_retro_library_theme.md).


---

## Sesión 2026-10-17 — Feature #17: library_bookshelf_view (Biblioteca como estantería)

- **Estado:** Completada (done)
- **Logros:**
  - La vista Biblioteca se muestra como estantería, con tokens de #16:
    - `BookGrid` es un CSS grid `auto-fill` (`minmax(9.5rem, 1fr)`) sin separación horizontal. La cantidad de libros por estante depende del ancho de la ventana, sin breakpoints fijos.
    - Cada `BookCard` apila tapa → tramo de estante (`shelf-plank`) → ficha de catálogo. Los tramos de una fila se tocan y se ven como un solo estante. En la última fila incompleta, el tramo del último libro se prolonga con un `::after` que el contenedor `bookshelf` (`overflow: hidden`) recorta en el borde.
    - La ficha muestra título, autor, badge de estado (ya no va sobre la tapa), estrellas y progreso cuando corresponde. No se pierde información.
    - Los libros sin tapa son un placeholder de cuero (`leather`/`spine` alternado por id) con marco doble e icono en `brass`. `book-hinge` simula el pliegue del lomo en todas las tapas.
    - Utilidades nuevas en `main.css`: `shelf-plank`, `bookshelf` y `book-hinge`. Sólo usan tokens y `color-mix`, sin tokens nuevos.
    - Se conservan filtros, estado vacío, click al detalle y todos los `data-testid`. `LibraryPage`, Dashboard, Detalle y Settings no cambiaron.
  - Pruebas automatizadas en Vitest:
    - `tests/renderer/test_library_bookshelf_view.test.ts` (14 pruebas): estructura tapa/estante/ficha, información dentro de la ficha, placeholder de cuero, grid `auto-fill`, utilidades CSS sin colores fijos e integración con `LibraryPage`.
    - `tests/renderer/test_library_view.test.ts`: el test de layout ahora valida la estantería en lugar de las clases `grid-cols` fijas.
    - Total de la suite: 22 suites, 378 tests pasando al 100% en verde.
  - Verificación: `.\init.ps1`, eslint, typecheck y `pnpm build` limpios. Se revisó el aspecto con capturas en claro y oscuro, a 1200 px y 640 px.
  - Documentación técnica:
    - Guía conceptual: [docs/guides/css-grid-bookshelf-layout.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/guides/css-grid-bookshelf-layout.md).
    - ADR: [docs/decisions/017-library-bookshelf-view.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/decisions/017-library-bookshelf-view.md).
    - Actualizados: [docs/guides/design-tokens-theming.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/guides/design-tokens-theming.md) (tabla de utilidades), [docs/guides/README.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/guides/README.md) y [docs/conventions.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/conventions.md).
  - Reportes de ciclo de vida: [progress/report_library_bookshelf_view.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/report_library_bookshelf_view.md) y [progress/review_library_bookshelf_view.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/review_library_bookshelf_view.md).

---

## Sesión 2026-10-17 — Feature #18: ui_polish_fixes (Tema claro por defecto y arreglos menores de UI)

- **Estado:** Completada (done)
- **Logros:**
  - Tema claro (pergamino) por defecto:
    - `DEFAULT_SETTINGS.theme = 'light'` en `SettingsStorageService`.
    - Los fallbacks de `App.tsx` y `SettingsPage` también pasan a `'light'`.
    - No hay flash oscuro: `<html>` no trae `.dark` y `@theme` ya define los valores claros.
    - Una preferencia guardada se respeta.
  - El botón "Agregar Libro" muestra un solo "+" (el ícono `Plus`, con `aria-hidden`).
  - La configuración de estados está unificada en `src/renderer/src/components/statusConfig.ts` (`STATUS_CONFIG`, `STATUS_ORDER`, `getStatusConfig`):
    - `shelfBadgeClass` para la ficha y `badgeClass` (`status/10`) para el detalle y el dashboard.
    - La usan BookCard, BookDetailPage y DashboardPage, sin cambio visual.
  - `BookCard` es accesible por teclado:
    - Es un `div role="button"` con `tabIndex=0` y `aria-label` "título, de autor".
    - Enter y Espacio abren el detalle.
    - El foco es un outline hacia adentro (`focus-visible:outline-accent`, offset -3px), así que el `overflow: hidden` de `bookshelf` no lo recorta.
    - Se conservan todos los `data-testid`.
  - Nuevo script `pnpm lint:check` (eslint sin `--fix`).
  - Pruebas automatizadas en Vitest:
    - Nuevo `tests/renderer/test_ui_polish_fixes.test.ts`.
    - Ajustes en `test_settings_storage_service`, `test_ipc_contracts` y `test_add_book_modal`.
    - Total de la suite: 23 suites, 403 tests pasando al 100% en verde.
  - Verificación: `.\init.ps1`, `pnpm lint:check` y `pnpm build` (con typecheck) limpios.
  - Documentación técnica:
    - ADR: [docs/decisions/018-ui-polish-fixes.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/decisions/018-ui-polish-fixes.md).
    - Guías actualizadas: [docs/guides/design-tokens-theming.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/guides/design-tokens-theming.md) (tema por defecto) y [docs/guides/css-grid-bookshelf-layout.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/guides/css-grid-bookshelf-layout.md) (accesibilidad por teclado).
    - También se actualizaron `docs/conventions.md` y `docs/verification.md`.
  - Reportes de ciclo de vida: [progress/report_ui_polish_fixes.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/report_ui_polish_fixes.md) y [progress/review_ui_polish_fixes.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/review_ui_polish_fixes.md).

## Sesión 2026-10-17 — Feature #19: fix_cover_display (Las portadas descargadas no se muestran)

- **Estado:** Completada (done)
- **Logros:**
  - Causa: la CSP de `src/renderer/index.html` (`img-src 'self' data: https:`) no incluía `booklog-media:`. Chromium bloqueaba las tapas locales antes de llegar a `protocol.handle`, así que se mostraba el placeholder.
  - CSP: `img-src 'self' data: https: booklog-media:`. Solo se agregó el esquema a img-src, sin abrir otros orígenes.
  - Fallback local → remoto → placeholder:
    - `buildCoverCandidates` en `coverService.ts` y el hook nuevo `src/renderer/src/hooks/useCoverSource.ts`.
    - Lo usan BookCard, BookDetailPage y DashboardPage, sin cambio visual y con los mismos `data-testid`.
    - La cadena se reinicia cuando cambian los datos del libro.
  - Pruebas automatizadas en Vitest:
    - Nuevo `tests/renderer/test_fix_cover_display.test.ts`, con 12 tests (CSP, helper, hook y fallback en los tres componentes).
    - Total de la suite: 24 suites, 415 tests en verde.
  - Verificación:
    - `.\init.ps1`, `pnpm lint:check`, `pnpm typecheck` y `pnpm build` limpios.
    - En Electron real (harness con userData temporal), la imagen booklog-media carga con la CSP nueva y falla con la anterior.
  - Documentación técnica:
    - ADR: [docs/decisions/019-fix-cover-display.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/decisions/019-fix-cover-display.md).
    - Guía actualizada: [docs/guides/electron-ipc-bridge.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/guides/electron-ipc-bridge.md), con la sección "Relación con la CSP".
  - Reportes de ciclo de vida: [progress/report_fix_cover_display.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/report_fix_cover_display.md) y [progress/review_fix_cover_display.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/review_fix_cover_display.md). La review pidió quitar un comentario huérfano en BookDetailPage; ya se aplicó.

## Sesión 2026-10-17 — Feature #20: finished_date (Fecha de terminado de un libro)

- **Estado:** Completada (done)
- **Logros:**
  - Columna `finishedAt DateTime?` en `Book`.
    - Migración `20261017212053_add_book_finished_at`, generada con `--create-only` y editada a mano para hacer backfill (`finishedAt = updatedAt` en los libros FINISHED).
    - Aplicada a dev.db por el flujo normal, sin pérdida de datos.
  - Formato de fecha:
    - Se guarda el día calendario a las 12:00 hora local; en IPC e `<input type="date">` viaja como `YYYY-MM-DD`.
    - "Hoy" se calcula con el reloj local (`CalendarDate.ts`).
    - Las fechas futuras se rechazan con errores de dominio tipados (`FutureFinishedDateError`, `InvalidFinishedDateError`).
  - Dominio: `Book.finishedAt`, `updateStatus(status, finishedAt?)` y `setFinishedDate`.
    - Al pasar a FINISHED sin fecha se asigna hoy (cubre el autocompletado al 100%).
    - La fecha se conserva al salir de FINISHED y se sobrescribe al volver a terminar el libro.
  - Use case nuevo `SetFinishedDate` y canal IPC `books:setFinishedDate`. `AddBook` y `UpdateBookStatus` aceptan `finishedAt`.
  - UI:
    - Con el componente nuevo `FinishedDateField` (hoy precargado) se pide la fecha en AddBookModal, en UpdateProgressModal y al confirmar "Terminado" en el detalle.
    - En el detalle la fecha se puede editar.
    - La ficha del estante muestra la fecha si el libro está FINISHED.
    - El dashboard muestra terminados en el año y en el mes, y terminados recientes ordenados por `finishedAt`.
  - Pruebas automatizadas en Vitest:
    - 5 suites nuevas (dominio, use cases, persistencia/backfill con DB temporal, IPC y renderer) y 3 tests ajustados.
    - Total de la suite: 29 suites, 489 tests en verde.
  - Verificación: `.\init.ps1`, `pnpm typecheck`, `pnpm lint:check` y `pnpm build` limpios.
  - Documentación técnica:
    - ADR: [docs/decisions/020-finished-date.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/decisions/020-finished-date.md).
    - Guía actualizada: [docs/guides/prisma-sqlite-setup.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/docs/guides/prisma-sqlite-setup.md), §6 "Migraciones con backfill de datos".
  - Reportes de ciclo de vida: [progress/report_finished_date.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/report_finished_date.md) y [progress/review_finished_date.md](file:///c:/Users/Tomas/Desktop/BookLog/booklog/progress/review_finished_date.md) (APPROVED).
  - Pendiente fuera de alcance: la base empaquetada (`userData/booklog.db`) no aplica migraciones al arrancar.
